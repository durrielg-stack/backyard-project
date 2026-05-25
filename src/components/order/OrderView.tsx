'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOrder }       from '@/hooks/useOrder'
import { useMenuItems }   from '@/hooks/useMenuItems'
import { useBreakpoint }  from '@/hooks/useBreakpoint'
import { THEME }          from '@/lib/theme'
import type { CartLine, TableWithStatus, PayMethod } from '@/lib/types'
import MenuPanel    from './MenuPanel'
import OrderPanel   from './OrderPanel'
import PayModal     from '@/components/modals/PayModal'
import SplitModal   from '@/components/modals/SplitModal'
import PaidOverlay  from '@/components/modals/PaidOverlay'
import type { SplitResult } from '@/components/modals/SplitModal'

const T = THEME

// ── Modal state discriminant ───────────────────────────────────────────────
type ModalState =
  | { kind: 'none' }
  | { kind: 'pay';   payAmount: number; splitLineIds: string[] | null; singleItem?: boolean; waysRemaining?: number }
  | { kind: 'split' }
  | { kind: 'paid';  total: number }

interface OrderViewProps {
  tableId:    string
  table:      TableWithStatus
  staff:      string
  onBack:     () => void
  onCartSync: (tableId: string, lines: CartLine[]) => void
}

export default function OrderView({ tableId, table, staff, onBack, onCartSync }: OrderViewProps) {
  const {
    orderId, lines, loading,
    addItem, updateQty, voidItem, setNote, closeOrder, payPartial,
  } = useOrder(tableId, staff)

  const { byCategory, byId: menuById } = useMenuItems()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'

  // ── Tip + discount state ──────────────────────────────────────────────────
  const [tip, setTip]           = useState(0)
  const [discount, setDiscount] = useState(0)

  // ── Selected order line (expanded) ────────────────────────────────────────
  const [selectedLine, setSelectedLine] = useState<string | null>(null)

  // ── Selected seat for next add ────────────────────────────────────────────
  const [selectedSeat, setSelectedSeat] = useState(0)

  // ── Mobile tab: menu or cart ──────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState<'menu' | 'cart'>('menu')

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })

  // ── Sync lines up to POSApp for auto-status derivation ────────────────────
  useEffect(() => {
    onCartSync(tableId, lines)
  }, [lines, tableId, onCartSync])

  // ── Clear stale selection when lines change ────────────────────────────────
  useEffect(() => {
    if (selectedLine && !lines.find(l => l.lineId === selectedLine)) {
      setSelectedLine(null)
    }
  }, [lines, selectedLine])

  // ── Totals — prices are tax-inclusive ────────────────────────────────────
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0)
  const total    = Math.max(0, subtotal - discount + tip)

  // ── Action handlers ───────────────────────────────────────────────────────
  function handleSplit()  { if (lines.length > 0) setModal({ kind: 'split' }) }
  function handleCharge() {
    if (lines.length > 0) setModal({ kind: 'pay', payAmount: total, splitLineIds: null })
  }
  function handleBillItem(lineId: string) {
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return
    setModal({ kind: 'pay', payAmount: line.unitPrice * line.qty, splitLineIds: [lineId], singleItem: true })
  }

  async function handlePaid(method: PayMethod, tendered: number) {
    if (modal.kind !== 'pay') return
    const { payAmount, splitLineIds } = modal

    if (splitLineIds !== null) {
      const waysLeft   = modal.waysRemaining ?? 1
      const isLastWay  = waysLeft <= 1
      // For equally split: don't assign lines until last payment to avoid premature auto-close
      const effectiveIds = modal.waysRemaining != null && !isLastWay ? [] : splitLineIds
      const result = await payPartial(effectiveIds, method, payAmount, tendered, isLastWay && !modal.singleItem)
      if (result === 'closed') {
        setModal({ kind: 'paid', total: payAmount })
      } else if (result === 'partial' || !isLastWay) {
        if (modal.singleItem) {
          setModal({ kind: 'none' })
        } else if (modal.waysRemaining != null && waysLeft > 1) {
          setModal({ ...modal, waysRemaining: waysLeft - 1 })
        } else {
          setModal({ kind: 'split' })
        }
      }
    } else {
      const ok = await closeOrder(method, tendered, payAmount, tip, discount)
      if (ok) setModal({ kind: 'paid', total: payAmount })
    }
  }

  function handleSplitConfirm(result: SplitResult) {
    if (result.mode === 'equally') {
      const ways   = result.ways ?? 2
      const amount = parseFloat((total / ways).toFixed(2))
      // waysRemaining tracks how many payments left; all lineIds assigned only on the last payment
      setModal({ kind: 'pay', payAmount: amount, splitLineIds: lines.map(l => l.lineId), waysRemaining: ways })
    } else if (result.mode === 'by-item' && result.items) {
      const amount = lines
        .filter(l => result.items!.includes(l.lineId))
        .reduce((s, l) => s + l.unitPrice * l.qty, 0)
      setModal({ kind: 'pay', payAmount: amount, splitLineIds: result.items })
    } else if (result.mode === 'by-seat' && result.seatMap) {
      // Pay first seat's items
      const firstSeat = Math.min(...Object.values(result.seatMap).filter(s => s > 0))
      const seatLines = lines.filter(l => result.seatMap![l.lineId] === firstSeat)
      const amount    = seatLines.reduce((s, l) => s + l.unitPrice * l.qty, 0)
      setModal({ kind: 'pay', payAmount: amount, splitLineIds: seatLines.map(l => l.lineId) })
    }
  }

  function handlePaidOverlayDone() { onBack() }

  // ── Keyboard shortcuts (bubbled from MenuPanel inputs) ────────────────────
  const handleKeyboardShortcut = useCallback((key: string) => {
    const k = key.toLowerCase()
    if (k === 's')     handleSplit()
    if (k === 'enter') handleCharge()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length])

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 13, color: '#6B6B72',
        letterSpacing: '0.08em',
      }}>
        Loading order…
      </div>
    )
  }

  return (
    <>
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'row',
        overflow: 'hidden',
      }}>

        {/* ── Menu panel ─────────────────────────────────────────────────── */}
        <div style={{
          flex: 1, minWidth: 0, height: '100%',
          display: isMobile && mobileTab !== 'menu' ? 'none' : 'flex',
          flexDirection: 'column',
        }}>
          <MenuPanel
            byCategory={byCategory}
            onAdd={item => { addItem(item, 1, [], selectedSeat); if (isMobile) setMobileTab('cart') }}
            onKeyboardShortcut={handleKeyboardShortcut}
          />
        </div>

        {/* ── Order panel ─────────────────────────────────────────────────── */}
        <div style={{
          display: isMobile && mobileTab !== 'cart' ? 'none' : 'flex',
          flexDirection: 'column',
          width: isMobile ? '100%' : undefined,
          height: '100%',
          flex: isMobile ? '1' : undefined,
        }}>
          <OrderPanel
            table={table}
            orderId={orderId}
            lines={lines}
            subtotal={subtotal}
            tip={tip}
            setTip={setTip}
            discount={discount}
            setDiscount={setDiscount}
            total={total}
            selectedLine={selectedLine}
            setSelectedLine={setSelectedLine}
            selectedSeat={selectedSeat}
            setSelectedSeat={setSelectedSeat}
            onUpdateQty={updateQty}
            onVoid={voidItem}
            onSetNote={setNote}
            onBillItem={handleBillItem}
            onBack={onBack}
            onSplit={handleSplit}
            onCharge={handleCharge}
          />
        </div>
      </div>

      {/* ── Mobile bottom tab bar ──────────────────────────────────────────── */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          display: 'flex', height: 56, zIndex: 50,
          background: T.surface2, borderTop: `1px solid ${T.line}`,
        }}>
          {(['menu', 'cart'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                color: mobileTab === tab ? T.accent : T.textDim,
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 18 }}>{tab === 'menu' ? '☰' : '🧾'}</span>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {tab === 'cart' && lines.length > 0 ? `Cart (${lines.length})` : tab === 'menu' ? 'Menu' : 'Cart'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {modal.kind === 'pay' && (
        <PayModal
          total={modal.payAmount}
          subtotal={modal.splitLineIds ? modal.payAmount : subtotal}
          tipAmt={modal.splitLineIds ? 0 : tip}
          onPaid={handlePaid}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'split' && (
        <SplitModal
          lines={lines}
          total={total}
          seats={table.capacity}
          onConfirm={handleSplitConfirm}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'paid' && (
        <PaidOverlay
          total={modal.total}
          tableLabel={table.label}
          orderId={orderId}
          onDone={handlePaidOverlayDone}
        />
      )}
    </>
  )
}
