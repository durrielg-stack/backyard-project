'use client'

import { useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import ModalBase from './ModalBase'
import type { CartLine, TableWithStatus } from '@/lib/types'


interface MoveItemsModalProps {
  lines:           CartLine[]
  tables:          TableWithStatus[]
  currentTableId:  string
  onConfirm:       (lineIds: string[], targetTableId: string) => void
  onClose:         () => void
}

export default function MoveItemsModal({
  lines, tables, currentTableId, onConfirm, onClose,
}: MoveItemsModalProps) {
  const { T } = useTheme()
  const [selected, setSelected]     = useState<Set<string>>(new Set(lines.map(l => l.lineId)))
  const [targetTable, setTargetTable] = useState<string | null>(null)

  function toggleLine(lineId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const otherTables = tables.filter(t => t.id !== currentTableId)

  // Group by section
  const sections: Record<string, TableWithStatus[]> = {}
  for (const t of otherTables) {
    if (!sections[t.section]) sections[t.section] = []
    sections[t.section].push(t)
  }

  const canConfirm = selected.size > 0 && targetTable !== null

  function statusDot(status: TableWithStatus['status']): string {
    if (status === 'occupied' || status === 'aging' || status === 'attention') return T.warn
    if (status === 'available') return T.ok
    return T.textMute
  }

  return (
    <ModalBase width={680} onBackdropClick={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>

        {/* Header */}
        <div style={{
          padding: '24px 28px 16px', flexShrink: 0,
          borderBottom: `1px solid ${T.line}`,
        }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: T.text }}>
            Move Items to Table
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Left: item checklist */}
          <div style={{
            flex: 1, overflowY: 'auto', borderRight: `1px solid ${T.line}`,
            padding: '12px 0',
          }} className="bp-no-scrollbar">
            <div style={{
              padding: '4px 20px 8px',
              fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: T.textMute,
            }}>
              Items to move
            </div>
            {lines.map(line => {
              const checked = selected.has(line.lineId)
              return (
                <div
                  key={line.lineId}
                  onClick={() => toggleLine(line.lineId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 20px', cursor: 'pointer',
                    background: checked ? `${T.accent}0A` : 'transparent',
                    transition: 'background 0.1s ease',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, flexShrink: 0,
                    border: `1.5px solid ${checked ? T.accent : T.line2}`,
                    borderRadius: 2,
                    background: checked ? T.accent : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.12s ease, border-color 0.12s ease',
                  }}>
                    {checked && (
                      <svg viewBox="0 0 10 10" width={10} height={10} fill="none" stroke="#fff" strokeWidth={1.5}>
                        <path d="M2 5l2.5 2.5L8 3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                      {line.itemName}
                      <span style={{ marginLeft: 6, fontSize: 11, color: T.textMute, fontFamily: T.mono }}>
                        ×{line.qty}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    fontFamily: T.mono, fontSize: 12, color: T.accent,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    ₱{(line.unitPrice * line.qty).toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Right: table picker */}
          <div style={{
            width: 260, overflowY: 'auto', padding: '12px 0',
          }} className="bp-no-scrollbar">
            <div style={{
              padding: '4px 20px 8px',
              fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: T.textMute,
            }}>
              Move to table
            </div>
            {Object.entries(sections).map(([section, sectionTables]) => (
              <div key={section}>
                <div style={{
                  padding: '6px 20px 2px',
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: T.textMute,
                }}>
                  {section}
                </div>
                {sectionTables.map(t => {
                  const active = targetTable === t.id
                  return (
                    <div
                      key={t.id}
                      onClick={() => setTargetTable(t.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 20px', cursor: 'pointer',
                        background: active ? `${T.accent}14` : 'transparent',
                        borderLeft: `2px solid ${active ? T.accent : 'transparent'}`,
                        transition: 'background 0.1s ease',
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: statusDot(t.status),
                      }} />
                      <span style={{
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        color: active ? T.accent : T.text,
                      }}>
                        {t.label}
                      </span>
                      {t.checkTotal > 0 && (
                        <span style={{
                          marginLeft: 'auto', fontFamily: T.mono, fontSize: 11,
                          color: T.textMute, fontVariantNumeric: 'tabular-nums',
                        }}>
                          ₱{t.checkTotal.toFixed(0)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 28px 20px',
          borderTop: `1px solid ${T.line}`,
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px 0',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              background: 'transparent', border: `1px solid ${T.line2}`,
              color: T.textDim, borderRadius: T.radius, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(Array.from(selected), targetTable!)}
            disabled={!canConfirm}
            style={{
              flex: 2, padding: '12px 0',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              background: canConfirm ? T.accent : T.chip,
              color:      canConfirm ? T.accentInk : T.textMute,
              border: 'none', borderRadius: T.radius,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              transition: 'background 0.12s ease, color 0.12s ease',
            }}
          >
            Move {selected.size} item{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </ModalBase>
  )
}
