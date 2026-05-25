'use client'

import { useState, useCallback, useEffect } from 'react'
import { getClient } from '@/lib/supabase'
import { T, SectionHd } from './ownerShared'

interface InvRow {
  id:             number
  menuItemId:     string
  name:           string
  category:       string
  quantity:       number
  unit:           string
  lowStockThresh: number
  updatedAt:      string
}

export default function InventoryTab() {
  const [rows,    setRows]    = useState<InvRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<number | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  const fetchRows = useCallback(async () => {
    const { data } = await sb
      .from('inventory')
      .select('id, menu_item_id, quantity, unit, low_stock_threshold, updated_at, menu_items(name, category)')
      .order('id')
    setRows((data ?? []).map((r: any) => {
      const mi = Array.isArray(r.menu_items) ? r.menu_items[0] : r.menu_items
      return {
        id: r.id, menuItemId: r.menu_item_id,
        name: mi?.name ?? '—', category: mi?.category ?? '—',
        quantity: r.quantity, unit: r.unit,
        lowStockThresh: r.low_stock_threshold, updatedAt: r.updated_at,
      }
    }))
    setLoading(false)
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

  async function adjust(row: InvRow, delta: number) {
    const newQty = Math.max(0, row.quantity + delta)
    setSaving(row.id)
    await sb.from('inventory').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', row.id)
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, quantity: newQty } : r))
    setSaving(null)
  }

  const lowCount = rows.filter(r => r.quantity <= r.lowStockThresh).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <SectionHd
        title="Inventory"
        badge={lowCount > 0 ? `${lowCount} low stock` : `${rows.length} items`}
      />
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
      ) : (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 120px 80px 80px 120px 160px',
            padding: '0 24px', height: 36, alignItems: 'center',
            borderBottom: `1px solid ${T.line}`, background: T.surface2, flexShrink: 0,
          }}>
            {['Item','Category','Qty','Unit','Threshold','Adjust'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>
            ))}
          </div>

          <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
            {rows.map((row, i) => {
              const isLow      = row.quantity <= row.lowStockThresh
              const isCritical = row.quantity === 0
              return (
                <div key={row.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 80px 80px 120px 160px',
                  padding: '0 24px', height: 44, alignItems: 'center',
                  borderBottom: `1px solid ${T.line}`,
                  background: i % 2 === 0 ? 'transparent' : T.surface,
                  opacity: saving === row.id ? 0.5 : 1,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{row.name}</span>
                  <span style={{ fontSize: 11, color: T.textMute }}>{row.category}</span>
                  <span style={{
                    fontFamily: T.mono, fontSize: 14, fontWeight: 700,
                    color: isCritical ? T.bad : isLow ? T.warn : T.ok,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {row.quantity}
                  </span>
                  <span style={{ fontSize: 12, color: T.textMute }}>{row.unit}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute }}>
                    {row.lowStockThresh}
                    {isLow && (
                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: isCritical ? T.bad : T.warn }}>
                        {isCritical ? 'OUT' : 'LOW'}
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => adjust(row, -1)} disabled={saving === row.id} style={{
                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim,
                      borderRadius: T.radius, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit',
                    }}>−</button>
                    <button onClick={() => adjust(row, 1)} disabled={saving === row.id} style={{
                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim,
                      borderRadius: T.radius, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit',
                    }}>+</button>
                    <button onClick={() => adjust(row, 10)} disabled={saving === row.id} style={{
                      padding: '3px 10px', fontSize: 11, fontFamily: 'inherit',
                      background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim,
                      borderRadius: T.radius, cursor: 'pointer',
                    }}>+10</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
