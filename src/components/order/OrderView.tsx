'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOrder }     from '@/hooks/useOrder'
import { useMenuItems } from '@/hooks/useMenuItems'
import type { CartLine, TableWithStatus, PayMethod } from '@/lib/types'
import MenuPanel    from './MenuPanel'
import OrderPanel   from './OrderPanel'
import PayModal     from '@/components/modals/PayModal'
import SplitModal   from '@/components/modals/SplitModal'
import PaidOverlay  from '@/components/modals/PaidOverlay'
import type { SplitResult } from '@/components/modals/SplitModal'

// ── Modal state discriminant ───────────────────────────────────────────────
type ModalState =
  | { kind: 'none' }
  | { kind: 'pay';   payAmount: number; splitLineIds: string[] | null }
  | { kind: 'split' }
  | { kind: 'paid';  total: number }

interface OrderViewProps {
  tableId:    string
  table:      TableWithStatus
  onBack:     () => void
  onCartSync: (tableId: string, lines: CartLine[]) => void
}

export default function OrderView({ tableId, table, onBack, onCartSync }: OrderViewProps) {
  const {
    orderId, lines, loading,
    addItem, updateQty, voidItem, setNote, toggleMod, closeOrder, payPartial,
  } = useOrder(tableId)

  const { byCategory, byId: menuById } = useMenuItems()

  // ── Tip state — custom amount only, default 0 ────────────────────────────
  const [tip, setTip] = useState(0)

  // ── Selected order line (expanded) ────────────────────────────────────────
  const [selectedLine, setSelectedLine] = useState<string | null>(null)

  // ── Selected seat for next add ────────────────────────────────────────────
  const [selectedSeat, setSelectedSeat] = useState(0)

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
  const total    = subtotal + tip

  // ── Action handlers ───────────────────────────────────────────────────────
  function handleHold()   { /* TODO: hold ticket persistence */ }
  function handleSplit()  { if (lines.length > 0) setModal({ kind: 'split' }) }
  function handleCharge() {
    if (lines.length > 0) setModal({ kind: 'pay', payAmount: total, splitLineIds: null })
  }

  async function handlePaid(method: PayMethod, tendered: number) {
    if (modal.kind !== 'pay') return
    const { payAmount, splitLineIds } = modal

    if (splitLineIds) {
      // Partial split payment
      const result = await payPartial(splitLineIds, method, payAmount, tendered)
      if (result === 'closed') {
        setModal({ kind: 'paid', total: payAmount })
      } else if (result === 'partial') {
        // Remaining items — re-open split modal
        setModal({ kind: 'split' })
      }
    } else {
      // Full order payment
      const ok = await closeOrder(method, tendered, payAmount, tip)
      if (ok) setModal({ kind: 'paid', total: payAmount })
    }
  }

  function handleSplitConfirm(result: SplitResult) {
    if (result.mode === 'equally') {
      // Equally: pay total/ways per transaction — assign all remaining lines
      const ways   = result.ways ?? 2
      const amount = parseFloat((total / ways).toFixed(2))
      setModal({ kind: 'pay', payAmount: amount, splitLineIds: lines.map(l => l.lineId) })
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
    if (k === 'h')     handleHold()
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

        {/* ── Menu panel — fills remaining width ──────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
          <MenuPanel
            byCategory={byCategory}
            onAdd={item => addItem(item, 1, [], selectedSeat)}
            onKeyboardShortcut={handleKeyboardShortcut}
          />
        </div>

        {/* ── Order panel — fixed 720px right column ──────────────────────── */}
        <OrderPanel
          table={table}
          orderId={orderId}
          lines={lines}
          menuById={menuById}
          subtotal={subtotal}
          tip={tip}
          setTip={setTip}
          total={total}
          selectedLine={selectedLine}
          setSelectedLine={setSelectedLine}
          selectedSeat={selectedSeat}
          setSelectedSeat={setSelectedSeat}
          onUpdateQty={updateQty}
          onVoid={voidItem}
          onSetNote={setNote}
          onToggleMod={toggleMod}
          onBack={onBack}
          onHold={handleHold}
          onSplit={handleSplit}
          onCharge={handleCharge}
        />
      </div>

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
          onDone={handlePaidOverlayDone}
        />
      )}
    </>
  )
}
