'use client'

import { useEffect, useState, useCallback } from 'react'
import { getClient } from '@/lib/supabase'

// ── Output shapes ────────────────────────────────────────────────────────────
export interface RevenueBar {
  label:   string   // '08:00' (hourly) or 'Mon' (daily)
  value:   number   // ₱ revenue
  isPeak:  boolean  // true for the tallest bar
}

export interface TransactionRow {
  id:         number
  time:       string   // 'HH:MM'
  tableId:    string
  server:     string
  itemCount:  number
  method:     string   // 'cash' | 'card' | 'gcash' | etc
  amount:     number
  isRefund:   boolean
}

export interface ReportsData {
  todayRevenue:  number
  weekRevenue:   number
  todayCost:     number
  todayExpenses: number
  weekExpenses:  number
  avgOrder:      number
  txCount:       number
  hourlyBars:    RevenueBar[]
  weeklyBars:    RevenueBar[]
  transactions:  TransactionRow[]
  loading:       boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function makePeak(bars: Omit<RevenueBar, 'isPeak'>[]): RevenueBar[] {
  const max = Math.max(...bars.map(b => b.value), 0.01)
  return bars.map(b => ({ ...b, isPeak: b.value === max && b.value > 0 }))
}

// ── useReports ────────────────────────────────────────────────────────────────
export function useReports(): ReportsData {
  const [loading,       setLoading]       = useState(true)
  const [todayRevenue,  setTodayRevenue]  = useState(0)
  const [weekRevenue,   setWeekRevenue]   = useState(0)
  const [todayCost,     setTodayCost]     = useState(0)
  const [todayExpenses, setTodayExpenses] = useState(0)
  const [weekExpenses,  setWeekExpenses]  = useState(0)
  const [avgOrder,      setAvgOrder]      = useState(0)
  const [txCount,       setTxCount]       = useState(0)
  const [hourlyBars,    setHourlyBars]    = useState<RevenueBar[]>([])
  const [weeklyBars,    setWeeklyBars]    = useState<RevenueBar[]>([])
  const [transactions,  setTransactions]  = useState<TransactionRow[]>([])

  const fetchAll = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb  = getClient() as any
    const now = new Date()

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const weekStart  = new Date(now); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0)

    // ── Sales: order-items via orders.opened_at ────────────────────────────
    const { data: allOrders } = await sb
      .from('orders').select('id, opened_at')
      .gte('opened_at', weekStart.toISOString())
    const allOrderIds = (allOrders ?? []).map((o: any) => o.id as number)
    const orderOpenedMap: Record<number, Date> = {}
    for (const o of (allOrders ?? [])) orderOpenedMap[o.id] = new Date(o.opened_at)

    let todayGross = 0; let weekGross = 0; let costToday = 0
    const hourBuckets: Record<number, number> = {}
    const dayBuckets:  Record<string, number> = {}
    const todayOrderIds: number[] = []
    const todayStartMs = todayStart.getTime()
    const weekStartMs  = weekStart.getTime()

    if (allOrderIds.length > 0) {
      const { data: lines } = await sb
        .from('order_items')
        .select('order_id, qty, unit_price, menu_items(cost)')
        .in('order_id', allOrderIds)
        .neq('status', 'voided')

      for (const row of (lines ?? [])) {
        const openedAt = orderOpenedMap[row.order_id as number]
        if (!openedAt) continue
        const ts  = openedAt.getTime()
        const val = (row.qty as number) * (row.unit_price as number)
        const mi  = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
        const dk  = openedAt.toISOString().slice(0, 10)

        weekGross += val
        dayBuckets[dk] = (dayBuckets[dk] ?? 0) + val

        if (ts >= todayStartMs) {
          todayGross += val
          costToday  += (row.qty as number) * ((mi as any)?.cost ?? 0)
          const h = openedAt.getHours()
          hourBuckets[h] = (hourBuckets[h] ?? 0) + val
        }
      }

      for (const o of (allOrders ?? [])) {
        if (new Date(o.opened_at).getTime() >= todayStartMs) todayOrderIds.push(o.id)
      }
    }

    const txTodayN = todayOrderIds.length
    setTodayRevenue(todayGross)
    setWeekRevenue(weekGross)
    setTodayCost(costToday)
    setTxCount(txTodayN)
    setAvgOrder(txTodayN > 0 ? todayGross / txTodayN : 0)

    const maxHour = now.getHours()
    setHourlyBars(makePeak(Array.from({ length: maxHour + 1 }, (_, h) => ({ label: fmtHour(h), value: hourBuckets[h] ?? 0 }))))
    setWeeklyBars(makePeak(Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i)
      return { label: DAY_LABELS[d.getDay()], value: dayBuckets[d.toISOString().slice(0, 10)] ?? 0 }
    })))

    // ── Expenses ───────────────────────────────────────────────────────────
    const { data: expToday } = await sb
      .from('daily_expenses').select('amount')
      .eq('expense_date', todayStart.toISOString().slice(0, 10))
    setTodayExpenses((expToday ?? []).reduce((s: number, r: any) => s + r.amount, 0))

    const { data: expWeek } = await sb
      .from('daily_expenses').select('amount')
      .gte('expense_date', weekStart.toISOString().slice(0, 10))
    setWeekExpenses((expWeek ?? []).reduce((s: number, r: any) => s + r.amount, 0))

    // ── Recent transactions (last 100) ─────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentPmts } = await (sb as any)
      .from('payments')
      .select(`
        id, amount, method, processed_at, notes,
        orders!inner(table_id, opened_by)
      `)
      .order('processed_at', { ascending: false })
      .limit(100)

    const rp: any[] = recentPmts ?? []

    // Also fetch item counts per order
    const orderIds: number[] = [...new Set(rp.map((p: any) => p.order_id as number).filter(Boolean))]
    let itemCountMap: Record<number, number> = {}

    if (orderIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: iCounts } = await (sb as any)
        .from('order_items')
        .select('order_id')
        .in('order_id', orderIds)
        .neq('status', 'voided')

      const ic: any[] = iCounts ?? []
      for (const row of ic) {
        const oid = row.order_id as number
        itemCountMap[oid] = (itemCountMap[oid] ?? 0) + 1
      }
    }

    const txRows: TransactionRow[] = rp.map((p: any) => {
      const order  = Array.isArray(p.orders) ? p.orders[0] : p.orders
      const dt     = new Date(p.processed_at as string)
      const hh     = String(dt.getHours()).padStart(2, '0')
      const mm     = String(dt.getMinutes()).padStart(2, '0')
      const isRef  = (p.notes as string | null)?.toLowerCase().includes('refund') ?? false
      return {
        id:        p.id as number,
        time:      `${hh}:${mm}`,
        tableId:   order?.table_id ?? '—',
        server:    order?.opened_by ?? 'Server',
        itemCount: itemCountMap[p.order_id as number] ?? 0,
        method:    (p.method as string).toUpperCase(),
        amount:    p.amount as number,
        isRefund:  isRef,
      }
    })
    setTransactions(txRows)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return {
    todayRevenue, weekRevenue, todayCost,
    todayExpenses, weekExpenses,
    avgOrder, txCount,
    hourlyBars, weeklyBars, transactions, loading,
  }
}
