'use client'

import { useEffect, useState } from 'react'
import { THEME } from '@/lib/theme'
import { getClient } from '@/lib/supabase'
import type { InventoryRow } from '@/lib/types'

const T = THEME

export default function StockAlertsStrip() {
  const [rows, setRows] = useState<(InventoryRow & { menu_items?: { name: string } })[]>([])

  useEffect(() => {
    getClient()
      .from('inventory')
      .select('*, menu_items(name)')
      .lte('quantity', 5)
      .order('quantity')
      .limit(12)
      .then(({ data }) => setRows(data ?? []))
  }, [])

  if (rows.length === 0) return null

  const critical = rows.filter(r => r.quantity <= 0).length

  return (
    <div style={{
      borderTop: `1px solid ${T.line}`,
      background: T.surface,
      flexShrink: 0,
      padding: '8px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* Header label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: T.textMute,
          }}>
            Stock Alerts
          </span>
          {critical > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px',
              background: `${T.bad}22`, color: T.bad,
              borderRadius: T.radius, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {critical} critical
            </span>
          )}
        </div>

        {/* Chips */}
        {rows.map(r => {
          const name  = (r.menu_items as { name: string } | undefined)?.name ?? String(r.id)
          const color = r.quantity <= 0 ? T.bad : r.quantity <= r.low_stock_threshold * 0.4 ? T.warn : T.ok
          const pct   = r.low_stock_threshold > 0
            ? Math.min(1, r.quantity / r.low_stock_threshold) : 0
          return (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 10px',
              background: `${color}11`,
              border: `1px solid ${color}44`,
              borderRadius: T.radius,
            }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: T.text }}>{name}</span>
              {/* Mini bar */}
              <div style={{ width: 40, height: 4, background: T.surface2, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct * 100}%`,
                  background: color, borderRadius: 2,
                }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: T.mono, color, fontVariantNumeric: 'tabular-nums' }}>
                {r.quantity} {r.unit}
              </span>
            </div>
          )
        })}

        {/* Reorder list button */}
        <button
          onClick={() => {
            const lines = rows.map(r => {
              const name = (r.menu_items as { name: string } | undefined)?.name ?? String(r.id)
              return `${name}: ${r.quantity} ${r.unit} remaining (threshold ${r.low_stock_threshold})`
            }).join('\n')
            window.prompt(`Copy this reorder list:`, `REORDER LIST — ${new Date().toLocaleDateString()}\n${lines}`)
          }}
          style={{
            marginLeft: 'auto', padding: '5px 12px', fontSize: 10, fontFamily: 'inherit', fontWeight: 600,
            background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim,
            borderRadius: T.radius, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          Reorder List
        </button>
      </div>
    </div>
  )
}
