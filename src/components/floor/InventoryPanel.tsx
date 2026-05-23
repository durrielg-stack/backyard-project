'use client'

import { useEffect, useState } from 'react'
import { THEME } from '@/lib/theme'
import { getClient } from '@/lib/supabase'
import type { InventoryRow } from '@/lib/types'
import { PanelHd } from './FloorView'

const T = THEME

export default function InventoryPanel() {
  const [rows, setRows] = useState<(InventoryRow & { menu_items?: { name: string } })[]>([])

  useEffect(() => {
    getClient()
      .from('inventory')
      .select('*, menu_items(name)')
      .lte('quantity', 5)          // only low-stock rows
      .order('quantity')
      .limit(8)
      .then(({ data }) => setRows(data ?? []))
  }, [])

  const critical = rows.filter(r => r.quantity <= 0).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PanelHd
        title="Stock Alerts"
        badge={critical > 0 ? `${critical} critical` : undefined}
        action={
          <button style={{
            padding: '5px 12px', fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
            background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim,
            borderRadius: T.radius, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Reorder all
          </button>
        }
      />

      <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '16px 20px', color: T.textMute, fontSize: 12, fontFamily: T.mono }}>
            All stock healthy
          </div>
        ) : rows.map(r => {
          const pct     = r.low_stock_threshold > 0
            ? Math.min(1, r.quantity / r.low_stock_threshold) : 0
          const color   = r.quantity <= 0 ? T.bad : r.quantity <= r.low_stock_threshold * 0.4 ? T.warn : T.ok
          const name    = (r.menu_items as { name: string } | undefined)?.name ?? '—'
          return (
            <div key={r.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 70px',
              padding: '8px 16px', borderBottom: `1px solid ${T.line}`,
              alignItems: 'center', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.text }}>{name}</div>
                <div style={{ fontSize: 10, color: T.textMute, fontFamily: T.mono, marginTop: 1 }}>
                  {r.quantity} / {r.low_stock_threshold} {r.unit}
                </div>
              </div>
              {/* Progress bar */}
              <div style={{
                height: 4, background: T.surface2, borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${pct * 100}%`,
                  background: color, borderRadius: 2,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <button style={{
                padding: '4px 8px', fontSize: 10, fontFamily: 'inherit', fontWeight: 600,
                background: `${color}22`, border: `1px solid ${color}44`, color,
                borderRadius: T.radius, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                Reorder
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
