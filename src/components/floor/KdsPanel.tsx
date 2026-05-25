'use client'

import { useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import type { KdsTicket } from '@/lib/types'
import { PanelHd } from './FloorView'

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function KdsTicketRow({ ticket, onBump }: {
  ticket: KdsTicket
  onBump: (itemId: number) => void
}) {
  const { T } = useTheme()
  const isLate  = ticket.elapsedSec > 600
  const isAging = ticket.elapsedSec > 360
  const color   = isLate ? T.bad : isAging ? T.warn : T.ok
  const badge   = isLate ? 'LATE' : isAging ? 'AGING' : 'FIRING'

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '64px 1fr auto',
      padding: '10px 16px', borderBottom: `1px solid ${T.line}`,
      alignItems: 'center', gap: 12,
    }}>
      {/* Elapsed time */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: T.mono, fontSize: 22, fontWeight: 700, color,
          fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        }}>
          {fmtElapsed(ticket.elapsedSec)}
        </div>
        <div style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', color, marginTop: 3,
        }}>{badge}</div>
      </div>

      {/* Meta + item name */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: T.mono,
            background: ticket.station === 'kitchen' ? T.chip : `${T.info}22`,
            color: ticket.station === 'kitchen' ? T.textDim : T.info,
            padding: '1px 6px', borderRadius: 2, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {ticket.station === 'kitchen' ? 'KIT' : 'BAR'}
          </span>
          <span style={{ fontSize: 12, color: T.textDim }}>· {ticket.tableId}</span>
          <span style={{ fontSize: 12, color: T.textMute }}>· {ticket.server}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {ticket.qty > 1 && (
            <span style={{
              fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.accent,
              flexShrink: 0,
            }}>
              ×{ticket.qty}
            </span>
          )}
          <span style={{
            fontSize: 13, color: T.text, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {ticket.itemName}
          </span>
        </div>
      </div>

      {/* Served button */}
      <button
        onClick={e => { e.stopPropagation(); onBump(ticket.itemId) }}
        style={{
          padding: '5px 12px', fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
          background: 'transparent', border: `1px solid ${T.line2}`, color: T.textDim,
          borderRadius: T.radius, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
          transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
        }}
        onMouseEnter={e => {
          const b = e.currentTarget
          b.style.background = T.ok + '22'
          b.style.borderColor = T.ok
          b.style.color = T.ok
        }}
        onMouseLeave={e => {
          const b = e.currentTarget
          b.style.background = 'transparent'
          b.style.borderColor = T.line2
          b.style.color = T.textDim
        }}
      >
        Served
      </button>
    </div>
  )
}

// Filter modes
type FilterMode = 'all' | 'kitchen' | 'bar'

export default function KdsPanel({
  tickets, tick: _tick, onBump,
}: {
  tickets: KdsTicket[]
  tick: number
  onBump: (itemId: number) => void
}) {
  const { T } = useTheme()
  const [filter, setFilter] = useState<FilterMode>('all')

  const visible   = filter === 'all' ? tickets : tickets.filter(t => t.station === filter)
  const openCount = tickets.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PanelHd
        title={<><span style={{ color: T.accent, marginRight: 8 }}>●</span>Live · Kitchen + Bar</>}
        badge={`${openCount} open`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Auto-refresh indicator */}
            <span style={{ fontSize: 10, color: T.textMute, fontFamily: T.mono }}>auto-refresh 1s</span>
            {/* Station filter */}
            <div style={{ display: 'flex', gap: 2 }}>
              {(['all', 'kitchen', 'bar'] as FilterMode[]).map(m => (
                <button key={m} onClick={() => setFilter(m)} style={{
                  padding: '4px 10px', fontSize: 11, fontFamily: 'inherit',
                  background: filter === m ? T.accent : T.chip,
                  color:      filter === m ? T.accentInk : T.textDim,
                  border: 'none', borderRadius: T.radius, cursor: 'pointer',
                  fontWeight: filter === m ? 600 : 400, textTransform: 'capitalize',
                  transition: 'background 0.12s ease',
                }}>
                  {m === 'all' ? 'All' : m === 'kitchen' ? 'Kitchen' : 'Bar'}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <div style={{
            padding: '24px 20px', color: T.textMute, fontSize: 13, fontFamily: T.mono,
          }}>
            No open tickets
          </div>
        ) : (
          visible.map(t => <KdsTicketRow key={t.id} ticket={t} onBump={onBump} />)
        )}
      </div>
    </div>
  )
}
