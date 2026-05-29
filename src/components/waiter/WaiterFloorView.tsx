'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { useTables } from '@/hooks/useTables'
import { useOpenOrders } from '@/hooks/useOpenOrders'

interface Props {
  waiterName: string
  onTableSelect: (tableId: string) => void
  onSignOut: () => void
}

function elapsed(openedAt: string): string {
  const min = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000)
  if (min < 60) return `${min}m`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

function openMin(openedAt: string): number {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000)
}

export default function WaiterFloorView({ waiterName, onTableSelect, onSignOut }: Props) {
  const { T, mode, toggle } = useTheme()
  const { tables }          = useTables()
  const { orders, totals }  = useOpenOrders()
  const [tick, setTick]     = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  // Build order lookup by table
  const orderByTable = new Map(orders.map(o => [o.table_id, o]))

  return (
    <div style={{
      background: T.bg, minHeight: '100dvh',
      fontFamily: T.sansBody, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: T.surface, borderBottom: `1px solid ${T.line}`,
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Tables</div>
          <div style={{ fontSize: 11, color: T.textMute }}>Hi, {waiterName}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={toggle}
            title="Toggle theme"
            style={{
              background: T.surface2, border: `1px solid ${T.line2}`,
              borderRadius: T.radiusLg, padding: '7px 10px',
              color: T.textDim, fontSize: 15, cursor: 'pointer', lineHeight: 1,
            }}
          >
            {mode === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            onClick={onSignOut}
            style={{
              background: T.surface2, border: `1px solid ${T.line2}`,
              borderRadius: T.radiusLg, padding: '7px 12px',
              color: T.textMute, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {tables.map(table => {
          void tick // triggers re-render for elapsed time refresh
          const order = orderByTable.get(table.id)
          const total = totals.get(table.id) ?? 0
          const min   = order ? openMin(order.opened_at) : 0
          const isAttention = order && min >= 60
          const isOccupied  = !!order

          const borderColor = isAttention ? T.bad : isOccupied ? T.warn : T.line
          const dotColor    = isAttention ? T.bad : isOccupied ? T.warn : T.ok
          const statusLabel = isAttention ? 'Attention' : isOccupied ? 'Occupied' : 'Available'

          return (
            <button
              key={table.id}
              onClick={() => onTableSelect(table.id)}
              style={{
                background: T.surface, border: `1px solid ${borderColor}`,
                borderRadius: T.radiusLg, padding: '14px 12px',
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', gap: 4,
                transition: 'background 0.1s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: dotColor, display: 'inline-block', flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{table.label}</span>
              </div>
              <div style={{ fontSize: 11, color: isOccupied ? dotColor : T.textMute, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {statusLabel}
              </div>
              {order && (
                <>
                  <div style={{ fontSize: 11, color: T.textDim }}>{elapsed(order.opened_at)}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ok }}>
                    ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                  </div>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
