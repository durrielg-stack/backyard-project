'use client'

import { useRef, useEffect, useState } from 'react'
import { statusColor, statusLabel } from '@/lib/theme'
import { useTheme } from '@/lib/ThemeContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import type { CartLine, TableWithStatus } from '@/lib/types'
import OrderLine   from './OrderLine'
import OrderFooter from './OrderFooter'

type ManualStatus = 'available' | 'occupied' | 'reserved'

interface OrderPanelProps {
  table:              TableWithStatus
  orderId:            number | null
  lines:              CartLine[]
  subtotal:           number
  tip:                number
  setTip:             (amount: number) => void
  discount:           number
  setDiscount:        (amount: number) => void
  total:              number
  selectedLine:       string | null
  setSelectedLine:    (id: string | null) => void
  selectedSeat:       number
  setSelectedSeat:    (seat: number) => void
  onUpdateQty:        (lineId: string, delta: number) => Promise<void>
  onVoid:             (lineId: string, reason: string) => Promise<void>
  onSetNote:          (lineId: string, note: string) => Promise<void>
  onSetOrderType:     (lineId: string, type: 'dine_in' | 'takeout') => Promise<void>
  onBillItem:         (lineId: string) => void
  onBack:             () => void
  onSplit:            () => void
  onCharge:           () => void
  bulkMode:           boolean
  bulkSelected:       Set<string>
  onToggleBulkMode:   () => void
  onToggleBulk:       (lineId: string) => void
  onBulkVoid:         () => void
  onMove?:            () => void
  onSetStatus?:       (status: ManualStatus) => Promise<void>
}

export default function OrderPanel({
  table, orderId, lines,
  subtotal, tip, setTip, discount, setDiscount, total,
  selectedLine, setSelectedLine, selectedSeat, setSelectedSeat,
  onUpdateQty, onVoid, onSetNote, onSetOrderType, onBillItem,
  onBack, onSplit, onCharge,
  bulkMode, bulkSelected, onToggleBulkMode, onToggleBulk, onBulkVoid, onMove, onSetStatus,
}: OrderPanelProps) {
  const { T } = useTheme()
  const listRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'

  const [statusOpen, setStatusOpen] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    if (!statusOpen) return
    function onDown(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [statusOpen])

  // Auto-scroll to bottom when a line is appended
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length])

  const disabled    = lines.length === 0
  const statusC     = statusColor(table.status, T)
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
      width: isMobile ? '100%' : 'clamp(480px, 37.5vw, 960px)', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: T.surface, borderLeft: isMobile ? 'none' : `1px solid ${T.line}`,
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

        {/* Status badge — clickable to manually override */}
        <div ref={statusMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => onSetStatus && setStatusOpen(p => !p)}
            style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color:      statusC,
              background: statusC + '18',
              border:     `1px solid ${statusC}44`,
              padding: '4px 10px', borderRadius: T.radius,
              animation: isAttn ? 'bp-attn 2.4s ease-in-out infinite' : 'none',
              cursor: onSetStatus ? 'pointer' : 'default',
              fontFamily: 'inherit',
              transition: 'background 0.12s ease, border-color 0.12s ease',
            }}
          >
            {statusLabel(table.status)}
            {onSetStatus && <span style={{ marginLeft: 5, opacity: 0.6 }}>▾</span>}
          </button>

          {statusOpen && onSetStatus && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: T.surface, border: `1px solid ${T.line}`,
              borderRadius: T.radius, boxShadow: '0 8px 24px rgba(0,0,0,.35)',
              overflow: 'hidden', zIndex: 50, minWidth: 140,
            }}>
              {([
                ['available', 'Available'],
                ['occupied',  'Occupied'],
                ['reserved',  'Reserved'],
              ] as [ManualStatus, string][]).map(([s, label]) => {
                const c = statusColor(s, T)
                const isCurrent = table.status === s || (table.status === 'aging' && s === 'occupied') || (table.status === 'attention' && s === 'occupied')
                return (
                  <button
                    key={s}
                    onClick={async () => {
                      setStatusOpen(false)
                      await onSetStatus(s)
                    }}
                    style={{
                      width: '100%', padding: '9px 14px',
                      display: 'flex', alignItems: 'center', gap: 9,
                      background: isCurrent ? c + '18' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = c + '18' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isCurrent ? c + '18' : 'transparent' }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? c : T.textDim, letterSpacing: '0.04em' }}>
                      {label}
                    </span>
                    {isCurrent && <span style={{ marginLeft: 'auto', fontSize: 10, color: c }}>✓</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Move to Table */}
        {onMove && (
          <button onClick={onMove} style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            background: 'transparent', border: `1px solid ${T.line2}`,
            color: T.textDim, borderRadius: T.radius, cursor: 'pointer', flexShrink: 0,
            transition: 'border-color 0.12s ease, color 0.12s ease',
          }}>
            Move
          </button>
        )}

        {/* Bulk select toggle */}
        <button onClick={onToggleBulkMode} style={{
          padding: '4px 10px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
          background: bulkMode ? `${T.warn}18` : 'transparent',
          border:     `1px solid ${bulkMode ? T.warn : T.line2}`,
          color:      bulkMode ? T.warn : T.textDim,
          borderRadius: T.radius, cursor: 'pointer', flexShrink: 0,
          transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
        }}>
          {bulkMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {/* ── Bulk void bar (shown when items selected) ───────────────────── */}
      {bulkMode && bulkSelected.size > 0 && (
        <div style={{
          padding: '6px 24px',
          background: `${T.bad}14`, borderBottom: `1px solid ${T.bad}44`,
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: T.bad, fontFamily: T.mono }}>
            {bulkSelected.size} item{bulkSelected.size !== 1 ? 's' : ''} selected
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onBulkVoid} style={{
            padding: '4px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: `${T.bad}18`, border: `1px solid ${T.bad}66`,
            color: T.bad, borderRadius: T.radius, cursor: 'pointer',
          }}>
            Void {bulkSelected.size} item{bulkSelected.size !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* ── Seat selector ───────────────────────────────────────────────── */}
      <div className="bp-no-scrollbar" style={{
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
              selected={!bulkMode && selectedLine === line.lineId}
              onSelect={() => {
                if (bulkMode) { onToggleBulk(line.lineId); return }
                setSelectedLine(selectedLine === line.lineId ? null : line.lineId)
              }}
              onUpdateQty={onUpdateQty}
              onVoid={onVoid}
              onSetNote={onSetNote}
              onSetOrderType={onSetOrderType}
              onBill={onBillItem}
              bulkMode={bulkMode}
              bulkChecked={bulkSelected.has(line.lineId)}
            />
          ))
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <OrderFooter
        subtotal={subtotal}
        tip={tip}
        setTip={setTip}
        discount={discount}
        setDiscount={setDiscount}
        total={total}
        onSplit={onSplit}
        onCharge={onCharge}
        disabled={disabled}
      />
    </div>
  )
}
