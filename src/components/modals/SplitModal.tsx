'use client'

import { useState, useMemo } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import ModalBase from './ModalBase'
import type { CartLine } from '@/lib/types'


// ── Types ──────────────────────────────────────────────────────────────────
type SplitMode = 'equally' | 'by-item' | 'by-seat'

export interface SplitResult {
  mode:    SplitMode
  ways?:   number              // for equally
  items?:  string[]            // lineIds for by-item
  seatMap?: Record<string, number>  // lineId → seat for by-seat
}

interface SplitModalProps {
  lines:    CartLine[]
  total:    number
  seats:    number             // table.capacity
  onConfirm: (result: SplitResult) => void
  onClose:  () => void
}

// ── Tab button ─────────────────────────────────────────────────────────────
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { T } = useTheme()
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '12px 0',
      fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
      background:  active ? `${T.accent}18` : 'transparent',
      color:       active ? T.accent : T.textDim,
      borderBottom: `2px solid ${active ? T.accent : 'transparent'}`,
      border:      'none',
      borderBottomStyle: 'solid',
      borderBottomWidth: 2,
      borderBottomColor: active ? T.accent : 'transparent',
      cursor: 'pointer',
      transition: 'color 0.12s ease, border-color 0.12s ease, background 0.12s ease',
    }}>
      {label}
    </button>
  )
}

// ── Equally tab ────────────────────────────────────────────────────────────
function EquallyTab({ total, onConfirm }: { total: number; onConfirm: (ways: number) => void }) {
  const { T } = useTheme()
  const [ways, setWays] = useState(2)
  const perPerson = total / ways

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(20px, 4vw, 32px) clamp(20px, 5vw, 48px)', gap: 28,
    }}>
      {/* Big readout */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: T.mono, fontSize: 'clamp(48px, 12vw, 96px)', fontWeight: 700,
          color: T.accent, letterSpacing: '-0.04em',
          fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        }}>
          ₱{perPerson.toFixed(2)}
        </div>
        <div style={{
          fontFamily: T.mono, fontSize: 13, color: T.textMute,
          marginTop: 8, letterSpacing: '0.04em',
        }}>
          per person · {ways} way{ways !== 1 ? 's' : ''} · ₱{total.toFixed(2)} total
        </div>
      </div>

      {/* Ways selector */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[2, 3, 4, 5, 6].map(n => (
          <button
            key={n}
            onClick={() => setWays(n)}
            style={{
              width: 52, height: 52,
              fontFamily: T.mono, fontSize: 18, fontWeight: 700,
              background: ways === n ? T.accent : T.chip,
              color:      ways === n ? T.accentInk : T.textDim,
              border:     `1px solid ${ways === n ? T.accent : T.line2}`,
              borderRadius: T.radius, cursor: 'pointer',
              transition: 'background 0.12s ease, border-color 0.12s ease',
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Confirm */}
      <button
        onClick={() => onConfirm(ways)}
        style={{
          width: '100%', padding: '15px 0',
          fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
          letterSpacing: '-0.01em', textTransform: 'uppercase',
          background: T.accent, color: T.accentInk,
          border: 'none', borderRadius: T.radius, cursor: 'pointer',
          transition: 'background 0.12s ease',
        }}
      >
        Split {ways} Ways · ₱{perPerson.toFixed(2)} each
      </button>
    </div>
  )
}

// ── By Item tab ────────────────────────────────────────────────────────────
function ByItemTab({ lines, total, onConfirm }: {
  lines: CartLine[]; total: number; onConfirm: (ids: string[]) => void
}) {
  const { T } = useTheme()
  const [checked, setChecked] = useState<Set<string>>(new Set(lines.map(l => l.lineId)))

  const selectedTotal = useMemo(() => {
    return lines
      .filter(l => checked.has(l.lineId))
      .reduce((s, l) => s + l.unitPrice * l.qty, 0)
  }, [lines, checked])

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: 'clamp(240px, 45vh, 380px)' }}>

      {/* Items list */}
      <div style={{ flex: 1, overflowY: 'auto', borderRight: `1px solid ${T.line}` }} className="bp-no-scrollbar">
        {lines.map((line, i) => {
          const on = checked.has(line.lineId)
          return (
            <div
              key={line.lineId}
              onClick={() => toggle(line.lineId)}
              style={{
                display: 'grid', gridTemplateColumns: '24px 28px 1fr auto',
                gap: 10, padding: '12px 24px', alignItems: 'center',
                borderBottom: `1px solid ${T.line}`,
                cursor: 'pointer',
                background: on ? `${T.accent}0A` : 'transparent',
                transition: 'background 0.12s ease',
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: 18, height: 18, borderRadius: T.radius,
                background:  on ? T.accent : 'transparent',
                border:      `1.5px solid ${on ? T.accent : T.line2}`,
                display:     'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink:  0, transition: 'all 0.12s ease',
              }}>
                {on && (
                  <svg viewBox="0 0 12 12" width={10} height={10} fill="none" stroke={T.accentInk} strokeWidth={2} strokeLinecap="round">
                    <path d="M2 6.5L5 9.5L10 3.5" />
                  </svg>
                )}
              </div>

              {/* Index */}
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>
                {String(i + 1).padStart(2, '0')}
              </span>

              {/* Name + mods */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: on ? T.text : T.textDim }}>
                  {line.itemName}
                  {line.qty > 1 && (
                    <span style={{ marginLeft: 6, fontFamily: T.mono, fontSize: 11, color: T.textMute }}>
                      ×{line.qty}
                    </span>
                  )}
                </div>
                {line.mods.length > 0 && (
                  <div style={{ fontSize: 11, color: T.accent, marginTop: 2 }}>
                    {line.mods.join(' · ')}
                  </div>
                )}
              </div>

              {/* Price */}
              <span style={{
                fontFamily: T.mono, fontSize: 13, fontWeight: 600,
                color: on ? T.accent : T.textMute,
                fontVariantNumeric: 'tabular-nums',
              }}>
                ₱{(line.unitPrice * line.qty).toFixed(2)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Summary sidebar */}
      <div style={{
        width: 200, padding: '20px 20px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
          textTransform: 'uppercase', color: T.textMute,
        }}>
          This Payment
        </div>

        <div style={{
          fontFamily: T.mono, fontSize: 28, fontWeight: 700,
          color: T.accent, letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          ₱{selectedTotal.toFixed(2)}
        </div>

        <div style={{ fontSize: 11, color: T.textMute }}>
          {checked.size} of {lines.length} item{lines.length !== 1 ? 's' : ''}
        </div>

        <div style={{ flex: 1 }} />

        {selectedTotal < total && (
          <div style={{
            padding: '10px 12px',
            background: T.surface2, border: `1px solid ${T.line2}`,
            borderRadius: T.radius, fontSize: 11, color: T.textMute,
            fontFamily: T.mono, lineHeight: 1.6,
          }}>
            Remaining<br />
            <span style={{ color: T.warn, fontSize: 14, fontWeight: 600 }}>
              ₱{(total - selectedTotal).toFixed(2)}
            </span>
          </div>
        )}

        <button
          onClick={() => checked.size > 0 && onConfirm([...checked])}
          disabled={checked.size === 0}
          style={{
            padding: '12px 0',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            background: checked.size > 0 ? T.accent : T.chip,
            color:      checked.size > 0 ? T.accentInk : T.textMute,
            border: 'none', borderRadius: T.radius,
            cursor: checked.size > 0 ? 'pointer' : 'not-allowed',
            transition: 'background 0.12s ease',
          }}
        >
          Bill Out
        </button>
      </div>
    </div>
  )
}

// ── By Seat tab ────────────────────────────────────────────────────────────
function BySeatTab({ lines, seats, total, onConfirm }: {
  lines: CartLine[]; seats: number; total: number; onConfirm: (map: Record<string, number>) => void
}) {
  const { T } = useTheme()
  // seatMap: lineId → seat (0 = unassigned)
  const [seatMap, setSeatMap] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map(l => [l.lineId, l.seat ?? 0]))
  )

  const seatNums = Array.from({ length: seats }, (_, i) => i + 1)

  function assign(lineId: string, seat: number) {
    setSeatMap(prev => ({ ...prev, [lineId]: seat }))
  }

  const seatTotals = useMemo(() => {
    return seatNums.reduce<Record<number, number>>((acc, s) => {
      acc[s] = lines
        .filter(l => seatMap[l.lineId] === s)
        .reduce((sum, l) => sum + l.unitPrice * l.qty, 0)
      return acc
    }, {})
  }, [lines, seatMap, seatNums])

  const unassigned = lines.filter(l => !seatMap[l.lineId] || seatMap[l.lineId] === 0)
  const allAssigned = unassigned.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'clamp(240px, 45vh, 380px)' }}>

      {/* Seat columns */}
      <div style={{
        flex: 1, overflowY: 'auto', display: 'flex', gap: 0,
        borderBottom: `1px solid ${T.line}`,
      }} className="bp-no-scrollbar">

        {/* Unassigned column */}
        <div style={{
          flex: 1, borderRight: `1px solid ${T.line}`, minWidth: 0,
        }}>
          <div style={{
            padding: '8px 12px',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: T.warn,
            borderBottom: `1px solid ${T.line}`,
          }}>
            Unassigned · {unassigned.length}
          </div>
          {unassigned.map(line => (
            <div key={line.lineId} style={{
              padding: '8px 12px', borderBottom: `1px solid ${T.line}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 4 }}>
                {line.itemName}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {seatNums.map(s => (
                  <button key={s} onClick={() => assign(line.lineId, s)} style={{
                    padding: '2px 8px', fontSize: 11, fontFamily: T.mono,
                    background: T.chip, border: `1px dashed ${T.line2}`,
                    color: T.textDim, borderRadius: T.radius, cursor: 'pointer',
                    transition: 'background 0.12s ease',
                  }}>
                    S{s}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {unassigned.length === 0 && (
            <div style={{
              padding: '20px 12px',
              fontSize: 11, color: T.ok, fontFamily: T.mono,
            }}>
              All assigned ✓
            </div>
          )}
        </div>

        {/* Per-seat columns */}
        {seatNums.map(s => {
          const sLines = lines.filter(l => seatMap[l.lineId] === s)
          return (
            <div key={s} style={{
              flex: 1, borderRight: `1px solid ${T.line}`, minWidth: 0,
            }}>
              <div style={{
                padding: '8px 12px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: `1px solid ${T.line}`,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
                  textTransform: 'uppercase', color: T.accent,
                }}>
                  S{s}
                </span>
                {seatTotals[s] > 0 && (
                  <span style={{
                    fontFamily: T.mono, fontSize: 11, color: T.accent,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    ₱{seatTotals[s].toFixed(2)}
                  </span>
                )}
              </div>
              {sLines.map(line => (
                <div
                  key={line.lineId}
                  onClick={() => assign(line.lineId, 0)}
                  title="Click to unassign"
                  style={{
                    padding: '8px 12px', borderBottom: `1px solid ${T.line}`,
                    cursor: 'pointer', fontSize: 12, color: T.text,
                    transition: 'background 0.12s ease',
                  }}
                >
                  {line.itemName}
                  {line.qty > 1 && (
                    <span style={{ marginLeft: 4, fontFamily: T.mono, fontSize: 10, color: T.textMute }}>
                      ×{line.qty}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>
          {allAssigned
            ? `All ${lines.length} items assigned`
            : `${unassigned.length} item${unassigned.length !== 1 ? 's' : ''} unassigned`}
        </span>
        <button
          onClick={() => allAssigned && onConfirm(seatMap)}
          disabled={!allAssigned}
          style={{
            padding: '10px 24px',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            background: allAssigned ? T.accent : T.chip,
            color:      allAssigned ? T.accentInk : T.textMute,
            border: 'none', borderRadius: T.radius,
            cursor: allAssigned ? 'pointer' : 'not-allowed',
            transition: 'background 0.12s ease',
          }}
        >
          Confirm Split
        </button>
      </div>
    </div>
  )
}

// ── SplitModal ─────────────────────────────────────────────────────────────
export default function SplitModal({ lines, total, seats, onConfirm, onClose }: SplitModalProps) {
  const { T } = useTheme()
  const [mode, setMode] = useState<SplitMode>('equally')

  return (
    <ModalBase width={920} onBackdropClick={onClose}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{
        padding: '22px 32px 0',
        borderBottom: `1px solid ${T.line}`,
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
            Split Bill
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute }}>
            {lines.length} item{lines.length !== 1 ? 's' : ''} · ₱{total.toFixed(2)} total
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            color: T.textMute, cursor: 'pointer', fontSize: 20, lineHeight: 1,
            padding: '0 2px',
          }}>
            ×
          </button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex' }}>
          <Tab label="Equally"  active={mode === 'equally'}  onClick={() => setMode('equally')}  />
          <Tab label="By Item"  active={mode === 'by-item'}  onClick={() => setMode('by-item')}  />
          <Tab label="By Seat"  active={mode === 'by-seat'}  onClick={() => setMode('by-seat')}  />
        </div>
      </div>

      {/* ── Tab body ──────────────────────────────────────────────────── */}
      {mode === 'equally' && (
        <EquallyTab
          total={total}
          onConfirm={ways => onConfirm({ mode: 'equally', ways })}
        />
      )}
      {mode === 'by-item' && (
        <ByItemTab
          lines={lines}
          total={total}
          onConfirm={ids => onConfirm({ mode: 'by-item', items: ids })}
        />
      )}
      {mode === 'by-seat' && (
        <BySeatTab
          lines={lines}
          seats={seats}
          total={total}
          onConfirm={map => onConfirm({ mode: 'by-seat', seatMap: map })}
        />
      )}
    </ModalBase>
  )
}
