'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTables }      from '@/hooks/useTables'
import { useOpenOrders }  from '@/hooks/useOpenOrders'
import { useMenuItems }   from '@/hooks/useMenuItems'
import { useAutoStatus }  from '@/hooks/useAutoStatus'
import { useTickets }     from '@/hooks/useTickets'
import { THEME }          from '@/lib/theme'
import type { CartLine }  from '@/lib/types'
import NavBar       from '@/components/NavBar'
import FloorView    from '@/components/floor/FloorView'
import OrderView    from '@/components/order/OrderView'
import ReportsView  from '@/components/reports/ReportsView'
import OwnerView    from '@/components/owner/OwnerView'
import ExpensesView from '@/components/expenses/ExpensesView'
import StaffPicker     from '@/components/StaffPicker'
import MessengerBadge  from '@/components/floor/MessengerBadge'

// ── View discriminant ──────────────────────────────────────────────────────
type View =
  | 'floor'
  | 'expenses'
  | 'reports'
  | 'owner'
  | { kind: 'order'; tableId: string }

// ── Staff context ─────────────────────────────────────────────────────────
interface StaffSession { name: string; initials: string; role: string }

function loadStaff(): StaffSession | null {
  try {
    const raw = localStorage.getItem('bp_staff')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ── POSApp ─────────────────────────────────────────────────────────────────
export default function POSApp() {
  // ── Staff session ─────────────────────────────────────────────────────────
  const [staff, setStaff] = useState<StaffSession | null>(() => {
    if (typeof window === 'undefined') return null
    return loadStaff()
  })

  function handleSelectStaff(name: string, initials: string, role: string) {
    const s = { name, initials, role }
    localStorage.setItem('bp_staff', JSON.stringify(s))
    setStaff(s)
  }

  // ── View router ───────────────────────────────────────────────────────────
  const [view, setView]         = useState<View>('floor')
  const [openTabs, setOpenTabs] = useState<string[]>([])  // table IDs in tab strip

  // ── Global 1s tick — ALL time-driven recomputation reads this ─────────────
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 1_000)
    return () => clearInterval(id)
  }, [])

  // ── Live clock (reads tick so it updates once per second) ─────────────────
  const [now, setNow] = useState(new Date())
  useEffect(() => { setNow(new Date()) }, [tick])

  // ── Data ──────────────────────────────────────────────────────────────────
  const { tables }         = useTables()
  const { orders, totals: dbTotals } = useOpenOrders()
  const { byId: menuById } = useMenuItems()

  // ── KDS tickets — live from Supabase (Step 6) ─────────────────────────────
  const { tickets, bump } = useTickets(tick)

  // ── Per-table cart state — Map keeps every open ticket intact ─────────────
  // Initialise once from Supabase in useOrder; here we just hold the master map
  const [carts, setCarts]             = useState<Map<string, CartLine[]>>(new Map())
  // Records when each table's cart first became non-empty (for accurate floor timer)
  const [cartStartTimes, setCartStartTimes] = useState<Map<string, number>>(new Map())
  const lineCounter = useRef(1)

  const setCart = useCallback((tableId: string, updater: (prev: CartLine[]) => CartLine[]) => {
    setCarts(prev => {
      const next = new Map(prev)
      next.set(tableId, updater(prev.get(tableId) ?? []))
      return next
    })
  }, [])

  const addLine = useCallback((tableId: string, line: Omit<CartLine, 'lineId'>) => {
    const lineId = 'L' + (lineCounter.current++)
    setCart(tableId, prev => {
      // Stack: same item + same mods + same seat
      const match = prev.find(l =>
        l.itemId === line.itemId &&
        l.seat === line.seat &&
        JSON.stringify(l.mods) === JSON.stringify(line.mods)
      )
      if (match) return prev.map(l => l.lineId === match.lineId ? { ...l, qty: l.qty + line.qty } : l)
      return [...prev, { ...line, lineId }]
    })
  }, [setCart])

  const updateLineQty = useCallback((tableId: string, lineId: string, delta: number) => {
    setCart(tableId, prev => prev.flatMap(l => {
      if (l.lineId !== lineId) return [l]
      const q = l.qty + delta
      return q <= 0 ? [] : [{ ...l, qty: q }]
    }))
  }, [setCart])

  const removeLine = useCallback((tableId: string, lineId: string) => {
    setCart(tableId, prev => prev.filter(l => l.lineId !== lineId))
  }, [setCart])

  const clearCart = useCallback((tableId: string) => {
    setCarts(prev => { const next = new Map(prev); next.delete(tableId); return next })
  }, [])

  // Sync cart from OrderView (useOrder lines → master Map)
  const syncCart = useCallback((tableId: string, lines: CartLine[]) => {
    setCarts(prev => {
      const next = new Map(prev)
      next.set(tableId, lines)
      return next
    })
    // Start the timer the moment the cart goes non-empty; clear it when empty
    setCartStartTimes(prev => {
      const hadItems = (prev.has(tableId))
      const hasItems = lines.length > 0
      if (hasItems === hadItems) return prev   // no transition, skip re-render
      const next = new Map(prev)
      if (hasItems) next.set(tableId, Date.now())
      else          next.delete(tableId)
      return next
    })
  }, [])

  // ── Auto-status derivation ─────────────────────────────────────────────────
  const tablesWithStatus = useAutoStatus(tables, orders, tickets, carts, cartStartTimes, dbTotals, tick)

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const openTable = useCallback((tableId: string) => {
    setOpenTabs(prev => prev.includes(tableId) ? prev : [...prev, tableId])
    setView({ kind: 'order', tableId })
  }, [])

  const closeTab = useCallback((tableId: string) => {
    setOpenTabs(prev => prev.filter(id => id !== tableId))
    setView(v => (typeof v === 'object' && v.tableId === tableId) ? 'floor' : v)
  }, [])

  const goFloor    = useCallback(() => setView('floor'),    [])
  const goExpenses = useCallback(() => setView('expenses'), [])
  const goReports  = useCallback(() => setView('reports'),  [])
  const goOwner    = useCallback(() => setView('owner'),    [])
  const goOrder   = useCallback((tableId: string) => setView({ kind: 'order', tableId }), [])

  // ── Attention count for bell badge ────────────────────────────────────────
  const attnCount = tablesWithStatus.filter(t => t.status === 'attention').length

  // ── Render ────────────────────────────────────────────────────────────────
  const T = THEME

  // ── Show staff picker if no one is logged in ──────────────────────────────
  if (!staff) return <StaffPicker onSelect={handleSelectStaff} />

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: T.bg, color: T.text,
      fontFamily: T.sansBody, fontSize: 14, lineHeight: 1.3,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', userSelect: 'none',
      fontFeatureSettings: '"ss01", "cv11"',
    }}>
      <NavBar
        view={view}
        openTabs={openTabs}
        tables={tablesWithStatus}
        carts={carts}
        attnCount={attnCount}
        now={now}
        staff={staff}
        onFloor={goFloor}
        onExpenses={goExpenses}
        onReports={goReports}
        onOwner={goOwner}
        onOrder={goOrder}
        onCloseTab={closeTab}
        onSignOut={() => { localStorage.removeItem('bp_staff'); setStaff(null) }}
      />

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {view === 'floor' && (
          <FloorView
            tables={tablesWithStatus}
            tickets={tickets}
            tick={tick}
            onOpenTable={openTable}
            onBump={bump}
          />
        )}
        {view === 'floor' && <MessengerBadge />}

        {view === 'expenses' && <ExpensesView />}

        {view === 'reports' && (
          <ReportsView tables={tablesWithStatus} />
        )}

        {view === 'owner' && (
          <OwnerView tables={tablesWithStatus} />
        )}

        {typeof view === 'object' && view.kind === 'order' && (() => {
          const tws = tablesWithStatus.find(t => t.id === view.tableId)
          if (!tws) return null
          return (
            <OrderView
              tableId={view.tableId}
              table={tws}
              tables={tablesWithStatus}
              staff={staff.name}
              onBack={goFloor}
              onCartSync={syncCart}
            />
          )
        })()}
      </div>
    </div>
  )
}
