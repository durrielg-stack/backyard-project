'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { useOrder } from '@/hooks/useOrder'
import { useTickets } from '@/hooks/useTickets'

interface Props {
  tableId: string
  waiterId: string
  waiterName: string
  onAddItems: () => void
  onBack: () => void
}

function fmtPeso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function WaiterTableView({ tableId, waiterId, waiterName, onAddItems, onBack }: Props) {
  const { T, mode, toggle } = useTheme()
  const { lines, loading }  = useOrder(tableId, waiterId)
  const [tick, setTick]     = useState(0)
  const { tickets, bump }   = useTickets(tick)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const readyItems = tickets.filter(t => t.tableId === tableId)

  useEffect(() => {
    function enableScroll() {
      document.documentElement.style.overflow = 'auto'
      document.body.style.overflow = 'auto'
    }
    enableScroll()
    window.addEventListener('resize', enableScroll)
    return () => {
      window.removeEventListener('resize', enableScroll)
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0)

  return (
    <div className="bp-waiter-root" style={{
      background: T.bg, height: '100dvh',
      fontFamily: T.sansBody, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: T.surface, borderBottom: `1px solid ${T.line}`,
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.info, fontSize: 14, fontFamily: 'inherit',
            padding: '10px 8px', minHeight: 44, display: 'flex', alignItems: 'center',
          }}
        >
          ← Tables
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{tableId}</div>
        <button
          onClick={toggle}
          style={{
            background: T.surface2, border: `1px solid ${T.line2}`,
            borderRadius: T.radiusLg, padding: '10px 14px',
            color: T.textDim, fontSize: 16, cursor: 'pointer', lineHeight: 1,
            minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {mode === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Ready to deliver */}
      {readyItems.length > 0 && (
        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: T.ok, marginBottom: 8,
          }}>
            Ready to Serve · {readyItems.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {readyItems.map(ticket => {
              const color = ticket.status === 'late' ? T.bad : ticket.status === 'aging' ? T.warn : T.ok
              return (
                <div
                  key={ticket.itemId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: T.surface, border: `1px solid ${color}`,
                    borderRadius: T.radius, padding: '10px 12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text, lineHeight: 1.2 }}>
                      {ticket.qty > 1 && <span style={{ color: T.textMute, marginRight: 4 }}>×{ticket.qty}</span>}
                      {ticket.itemName}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: T.mono, color, marginTop: 2 }}>
                      {fmtElapsed(ticket.elapsedSec)}
                    </div>
                  </div>
                  <button
                    onClick={() => bump(ticket.itemId)}
                    style={{
                      padding: '10px 16px', fontSize: 13, fontWeight: 700,
                      background: T.ok, color: '#fff',
                      border: 'none', borderRadius: T.radius,
                      cursor: 'pointer', fontFamily: 'inherit',
                      flexShrink: 0, minHeight: 44,
                    }}
                  >
                    Served
                  </button>
                </div>
              )
            })}
          </div>
          <div style={{ height: 1, background: T.line, margin: '12px 0 0' }} />
        </div>
      )}

      {/* Order lines */}
      <div className="bp-scroll-y" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {loading ? (
          <div style={{ color: T.textMute, fontSize: 13, fontFamily: T.mono, padding: '24px 0', textAlign: 'center' }}>
            Loading order…
          </div>
        ) : lines.length === 0 ? (
          <div style={{ color: T.textMute, fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
            No items yet — tap Add Items to start.
          </div>
        ) : (
          <>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: T.textMute, paddingBottom: 8, borderBottom: `1px solid ${T.line}`, marginBottom: 4,
            }}>
              Current Order
            </div>
            {lines.map(line => (
              <div key={line.lineId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '10px 0', borderBottom: `1px solid ${T.line}`,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: T.text }}>{line.itemName}</div>
                  {line.note && (
                    <div style={{ fontSize: 11, color: T.textMute, marginTop: 2, fontStyle: 'italic' }}>
                      {line.note}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: T.textDim, margin: '0 12px' }}>×{line.qty}</div>
                <div style={{ fontSize: 13, color: T.textDim, fontFamily: T.mono }}>
                  {fmtPeso(line.unitPrice * line.qty)}
                </div>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '12px 0', fontSize: 14, fontWeight: 700, color: T.text,
            }}>
              <span>Running Total</span>
              <span style={{ color: T.ok }}>{fmtPeso(total)}</span>
            </div>
          </>
        )}
      </div>

      {/* Add Items button */}
      <div style={{ padding: `12px 16px calc(12px + env(safe-area-inset-bottom, 0px))`, borderTop: `1px solid ${T.line}`, background: T.surface }}>
        <button
          onClick={onAddItems}
          style={{
            width: '100%', padding: '15px', fontSize: 15, fontWeight: 700,
            background: T.accent, color: T.accentInk,
            border: 'none', borderRadius: T.radius, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Add Items
        </button>
      </div>
    </div>
  )
}
