'use client'

import { useState } from 'react'
import { THEME } from '@/lib/theme'
import type { CartLine, MenuItem } from '@/lib/types'

const T = THEME

interface OrderLineProps {
  line:       CartLine
  index:      number          // display index (1-based)
  selected:   boolean
  menuItem:   MenuItem | undefined
  onSelect:   () => void
  onUpdateQty:(lineId: string, delta: number) => void
  onRemove:   (lineId: string) => void
  onSetNote:  (lineId: string, note: string) => void
  onToggleMod:(lineId: string, mod: string) => void
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
      <path d="M3 4h10M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4M7 7v4M9 7v4" />
    </svg>
  )
}
function NoteIcon() {
  return (
    <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
      <path d="M3 3h7l3 3v7H3z M10 3v3h3" />
    </svg>
  )
}

export default function OrderLine({
  line, index, selected, menuItem,
  onSelect, onUpdateQty, onRemove, onSetNote, onToggleMod,
}: OrderLineProps) {
  const [editNote, setEditNote] = useState(false)
  const [noteVal, setNoteVal]   = useState(line.note)

  const availableMods = menuItem?.modifiers ?? []
  const lineTotal     = line.unitPrice * line.qty

  return (
    <div
      onClick={() => !selected && onSelect()}
      className="bp-cart-in"
      style={{
        borderBottom: `1px solid ${T.line}`,
        borderLeft:   selected ? `2px solid ${T.accent}` : '2px solid transparent',
        background:   selected ? T.surface2 : 'transparent',
        cursor:       selected ? 'default' : 'pointer',
        transition:   'background 0.12s ease, border-color 0.12s ease',
      }}
    >
      {/* ── Main row ────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr auto',
        padding: selected ? '12px 16px 8px 14px' : '10px 16px 10px 14px',
        gap: 10, alignItems: 'flex-start',
      }}>
        {/* Index */}
        <span style={{
          fontFamily: T.mono, fontSize: 12, color: T.textMute,
          fontVariantNumeric: 'tabular-nums', paddingTop: 2,
        }}>
          {String(index).padStart(2, '0')}
        </span>

        {/* Name + mods + note */}
        <div>
          <div style={{
            fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 4,
          }}>
            {line.itemName}
            {line.unitPrice > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 12, color: T.textMute,
                fontFamily: T.mono,
              }}>
                ₱{line.unitPrice.toFixed(0)}
              </span>
            )}
          </div>

          {/* Active modifier chips */}
          {line.mods.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
              {line.mods.map(mod => (
                <span key={mod} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 11, fontWeight: 500,
                  background: `${T.accent}1E`,  // accent 12% alpha
                  color: T.accent,
                  border: `1px solid ${T.accent}66`,
                  padding: '2px 7px', borderRadius: T.radius,
                }}>
                  <svg viewBox="0 0 16 16" width={9} height={9} fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M3 8.5L6.5 12L13 4.5" />
                  </svg>
                  {mod}
                </span>
              ))}
            </div>
          )}

          {/* Note pill */}
          {line.note && !editNote && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: T.warn,
              background: `${T.warn}18`,
              border: `1px solid ${T.warn}44`,
              padding: '2px 8px', borderRadius: T.radius, marginBottom: 4,
            }}>
              <span>ⓘ</span>
              <span>{line.note}</span>
            </div>
          )}

          {/* Inline note editor */}
          {editNote && (
            <input
              autoFocus
              value={noteVal}
              onChange={e => setNoteVal(e.target.value)}
              onBlur={() => { onSetNote(line.lineId, noteVal); setEditNote(false) }}
              onKeyDown={e => {
                if (e.key === 'Enter') { onSetNote(line.lineId, noteVal); setEditNote(false) }
                if (e.key === 'Escape') { setNoteVal(line.note); setEditNote(false) }
                e.stopPropagation()
              }}
              placeholder="Add a note…"
              style={{
                display: 'block', width: '100%', marginBottom: 4,
                background: T.surface, border: `1px solid ${T.warn}88`,
                color: T.text, fontFamily: 'inherit', fontSize: 12,
                padding: '4px 8px', borderRadius: T.radius, outline: 'none',
              }}
            />
          )}

          {/* Expanded: available modifier add-chips */}
          {selected && availableMods.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {availableMods
                .filter(m => !line.mods.includes(m))
                .map(mod => (
                  <button key={mod} onClick={() => onToggleMod(line.lineId, mod)} style={{
                    fontSize: 11, padding: '2px 7px',
                    background: 'transparent',
                    border: `1px dashed ${T.line2}`,
                    color: T.textDim, fontFamily: 'inherit',
                    borderRadius: T.radius, cursor: 'pointer',
                    transition: 'border-color 0.12s ease, color 0.12s ease',
                  }}>
                    + {mod}
                  </button>
                ))
              }
            </div>
          )}
        </div>

        {/* Right: line total + qty controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{
            fontFamily: T.mono, fontSize: 14, fontWeight: 600,
            color: selected ? T.accent : T.text,
            fontVariantNumeric: 'tabular-nums',
          }}>
            ₱{lineTotal.toFixed(2)}
          </span>

          {/* Qty stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={e => { e.stopPropagation(); onUpdateQty(line.lineId, -1) }}
              style={{
                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: T.chip, border: `1px solid ${T.line2}`,
                color: T.textDim, fontFamily: 'inherit', fontSize: 16, lineHeight: 1,
                borderRadius: T.radius, cursor: 'pointer',
              }}
            >−</button>
            <span style={{
              fontFamily: T.mono, fontSize: 14, fontWeight: 600,
              minWidth: 20, textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {line.qty}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onUpdateQty(line.lineId, 1) }}
              style={{
                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: T.chip, border: `1px solid ${T.line2}`,
                color: T.textDim, fontFamily: 'inherit', fontSize: 16, lineHeight: 1,
                borderRadius: T.radius, cursor: 'pointer',
              }}
            >+</button>
          </div>

          {/* Expanded: note + trash */}
          {selected && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={e => { e.stopPropagation(); setEditNote(true) }}
                title="Add note"
                style={{
                  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: T.chip, border: `1px solid ${T.line2}`,
                  color: line.note ? T.warn : T.textDim,
                  borderRadius: T.radius, cursor: 'pointer',
                }}
              >
                <NoteIcon />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onRemove(line.lineId) }}
                title="Remove item"
                style={{
                  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${T.bad}18`,
                  border: `1px solid ${T.bad}44`,
                  color: T.bad,
                  borderRadius: T.radius, cursor: 'pointer',
                }}
              >
                <TrashIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
