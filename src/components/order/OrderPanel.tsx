'use client'

import { useRef, useEffect } from 'react'
import { THEME, statusColor, statusLabel } from '@/lib/theme'
import type { CartLine, MenuItem, TableWithStatus } from '@/lib/types'
import OrderLine   from './OrderLine'
import OrderFooter from './OrderFooter'

const T = THEME

interface OrderPanelProps {
  table:           TableWithStatus
  orderId:         number | null
  lines:           CartLine[]
  menuById:        Record<string, MenuItem>
  subtotal:        number
  tip:             number
  setTip:          (amount: number) => void
  total:           number
  selectedLine:    string | null
  setSelectedLine: (id: string | null) => void
  selectedSeat:    number
  setSelectedSeat: (seat: number) => void
  onUpdateQty:     (lineId: string, delta: number) => Promise<void>
  onRemove:        (lineId: string) => Promise<void>
  onSetNote:       (lineId: string, note: string) => Promise<void>
  onToggleMod:     (lineId: string, mod: string) => void
  onBack:          () => void
  onHold:          () => void
  onSplit:         () => void
  onCharge:        () => void
}

export default function OrderPanel({
  table, orderId, lines, menuById,
  subtotal, tip, setTip, total,
  selectedLine, setSelectedLine, selectedSeat, setSelectedSeat,
  onUpdateQty, onRemove, onSetNote, onToggleMod,
  onBack, onHold, onSplit, onCharge,
}: OrderPanelProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when a line is appended
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length])

  const disabled    = lines.length === 0
  const statusC     = statusColor(table.status)
  const isAttn      = table.status === 'attention'
  const openMin     = table.openMin
  const hours       = Math.floor(openMin / 60)
  const mins        = openMin % 60
  const openMinStr  = openMin > 0
    ? (hours > 0 ? `${hours}h ${mins}m` : `${mins}m`)
    : '—'

  // Seat chips: All + S1…Scapacity
  const seats = Array.from({ length: Math.max(table.capacity, 1) }, (_, i) => i + 1)

  return (
    <div style={{
      width: 720, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: T.surface, borderLeft: `1px solid ${T.line}`,
      height: '100%',
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        height: 80, padding: '0 24px', flexShrink: 0,
        borderBottom: `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>

        {/* ← Floor */}
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'transparent', border: 'none',
          color: T.textDim, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 13, padding: '6px 8px', borderRadius: T.radius,
          transition: 'color 0.12s ease', flexShrink: 0,
        }}>
          <svg viewBox="0 0 16 16" width={13} height={13} fill="none"
            stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M10 13L5 8l5-5" />
          </svg>
          Floor
        </button>

        <div style={{ width: 1, height: 26, background: T.line2, flexShrink: 0 }} />

        {/* ORDER #ID */}
        {orderId != null && (
          <span style={{
            fontFamily: T.mono, fontSize: 11, color: T.textMute,
            letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0,
          }}>
            ORDER #{orderId}
          </span>
        )}

        {/* Table label */}
        <span style={{
          fontSize: 22, fontWeight: 700, color: T.text,
          letterSpacing: '-0.02em', fontFamily: T.sansHead, flexShrink: 0,
        }}>
          {table.label}
        </span>

        {/* Open time */}
        {openMin > 0 && (
          <span style={{
            fontFamily: T.mono, fontSize: 12, color: T.textMute,
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>
            {openMinStr}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Status badge — bp-attn halo when attention */}
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color:      statusC,
          background: statusC + '18',
          border:     `1px solid ${statusC}44`,
          padding: '4px 10px', borderRadius: T.radius,
          animation: isAttn ? 'bp-attn 2.4s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }}>
          {statusLabel(table.status)}
        </span>
      </div>

      {/* ── Seat selector ───────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 24px',
        borderBottom: `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        overflowX: 'auto',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
          textTransform: 'uppercase', color: T.textMute,
          marginRight: 4, flexShrink: 0,
        }}>
          Seat
        </span>

        {/* All — seat 0 = shared */}
        <button
          onClick={() => setSelectedSeat(0)}
          style={{
            padding: '3px 10px', fontSize: 11, fontFamily: 'inherit', fontWeight: 500,
            background: selectedSeat === 0 ? T.accent : T.chip,
            color:      selectedSeat === 0 ? T.accentInk : T.textDim,
            border:     `1px solid ${selectedSeat === 0 ? T.accent : T.line2}`,
            borderRadius: T.radius, cursor: 'pointer', flexShrink: 0,
            transition: 'background 0.12s ease, border-color 0.12s ease',
          }}
        >
          All
        </button>

        {seats.map(s => (
          <button
            key={s}
            onClick={() => setSelectedSeat(s)}
            style={{
              padding: '3px 10px', fontSize: 11, fontFamily: T.mono, fontWeight: 500,
              background: selectedSeat === s ? T.accent : T.chip,
              color:      selectedSeat === s ? T.accentInk : T.textDim,
              border:     `1px solid ${selectedSeat === s ? T.accent : T.line2}`,
              borderRadius: T.radius, cursor: 'pointer', flexShrink: 0,
              transition: 'background 0.12s ease, border-color 0.12s ease',
            }}
          >
            S{s}
          </button>
        ))}
      </div>

      {/* ── Order lines (scrollable) ─────────────────────────────────────── */}
      <div
        ref={listRef}
        className="bp-no-scrollbar"
        style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
      >
        {lines.length === 0 ? (
          <div style={{
            padding: '48px 24px',
            color: T.textMute, fontFamily: T.mono, fontSize: 12,
            textAlign: 'center', lineHeight: 1.6,
          }}>
            No items yet<br />
            <span style={{ color: T.textMute, fontSize: 11 }}>
              Tap a menu item to add it to this order
            </span>
          </div>
        ) : (
          lines.map((line, i) => (
            <OrderLine
              key={line.lineId}
              line={line}
              index={i + 1}
              selected={selectedLine === line.lineId}
              menuItem={menuById[line.itemId]}
              onSelect={() => setSelectedLine(
                selectedLine === line.lineId ? null : line.lineId
              )}
              onUpdateQty={onUpdateQty}
              onRemove={onRemove}
              onSetNote={onSetNote}
              onToggleMod={onToggleMod}
            />
          ))
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <OrderFooter
        subtotal={subtotal}
        tip={tip}
        setTip={setTip}
        total={total}
        onHold={onHold}
        onSplit={onSplit}
        onCharge={onCharge}
        disabled={disabled}
      />
    </div>
  )
}
