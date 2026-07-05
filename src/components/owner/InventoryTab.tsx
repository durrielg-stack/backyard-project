'use client'

import { useTheme } from '@/lib/ThemeContext'
import { useState, useCallback, useEffect } from 'react'
import { getClient } from '@/lib/supabase'
import { SectionHd, SearchBox } from './ownerShared'
import { useSortable } from '@/lib/useSortable'

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

type StockFilter = 'all' | 'out' | 'low' | 'normal'

export default function InventoryTab() {
  const { T } = useTheme()

  const [rows,    setRows]    = useState<InvRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<number | null>(null)
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [search, setSearch] = useState('')

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

  function level(row: InvRow): 'out' | 'low' | 'normal' {
    if (row.quantity === 0) return 'out'
    if (row.quantity <= row.lowStockThresh) return 'low'
    return 'normal'
  }

  const outCount    = rows.filter(r => level(r) === 'out').length
  const lowCount    = rows.filter(r => level(r) === 'low').length
  const normalCount = rows.filter(r => level(r) === 'normal').length

  const stockRows = stockFilter === 'all' ? rows : rows.filter(r => level(r) === stockFilter)
  const visibleRows = search.trim() ? stockRows.filter(r => r.name.toLowerCase().includes(search.trim().toLowerCase())) : stockRows
  const { sorted: sortedRows, toggle: sortToggle, icon: sortIcon } = useSortable(visibleRows, 'name' as keyof InvRow)

  const stockPill = (id: StockFilter, label: string, count: number, color: string) => (
    <button
      key={id}
      onClick={() => setStockFilter(prev => prev === id ? 'all' : id)}
      style={{
        padding: '4px 12px', fontSize: 11, fontFamily: 'inherit', fontWeight: 700,
        background: stockFilter === id ? color : `${color}18`,
        color:      stockFilter === id ? '#fff' : color,
        border: `1px solid ${color}`, borderRadius: T.radius, cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {count} {label}
    </button>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <SectionHd
        title="Inventory"
        badge={`${rows.length} items`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="bp-no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', touchAction: 'pan-x pan-y' }}>
              {stockPill('out',    'Out of Stock', outCount,    T.bad)}
              {stockPill('low',    'Low Stock',    lowCount,    T.warn)}
              {stockPill('normal', 'Normal',       normalCount, T.ok)}
            </div>
            <SearchBox value={search} onChange={setSearch} placeholder="Search inventory…" />
          </div>
        }
      />
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
      ) : (
        <div className="bp-no-scrollbar" style={{ flex: 1, overflow: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
          <div style={{ minWidth: 680 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 120px 80px 80px 120px 160px',
            padding: '0 24px', height: 36, alignItems: 'center',
            borderBottom: `1px solid ${T.line}`, background: T.surface2,
            position: 'sticky', top: 0, zIndex: 1,
          }}>
            {([
              ['Item',      'name'],
              ['Category',  'category'],
              ['Qty',       'quantity'],
              ['Unit',      'unit'],
              ['Threshold', 'lowStockThresh'],
              ['Adjust',    null],
            ] as [string, keyof InvRow | null][]).map(([h, k]) => k ? (
              <button key={h} onClick={() => sortToggle(k)} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.headerText, display: 'flex', alignItems: 'center', gap: 3, textAlign: 'left' }}>
                {h}<span style={{ fontSize: 8, opacity: 0.7 }}>{sortIcon(k)}</span>
              </button>
            ) : (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.headerText }}>{h}</span>
            ))}
          </div>
            {sortedRows.map((row, i) => {
              const isLow      = row.quantity <= row.lowStockThresh
              const isCritical = row.quantity === 0
              const isAuto     = row.category === 'Beer'
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
                  <div title={isAuto ? 'Beer stock is auto-managed by sales and expense restocks' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => adjust(row, -1)} disabled={saving === row.id || isAuto} style={{
                      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim,
                      borderRadius: T.radius, cursor: isAuto ? 'not-allowed' : 'pointer', fontSize: 16, fontFamily: 'inherit',
                      opacity: isAuto ? 0.35 : 1,
                    }}>−</button>
                    <button onClick={() => adjust(row, 1)} disabled={saving === row.id || isAuto} style={{
                      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim,
                      borderRadius: T.radius, cursor: isAuto ? 'not-allowed' : 'pointer', fontSize: 16, fontFamily: 'inherit',
                      opacity: isAuto ? 0.35 : 1,
                    }}>+</button>
                    <button onClick={() => adjust(row, 10)} disabled={saving === row.id || isAuto} style={{
                      padding: '8px 10px', fontSize: 11, fontFamily: 'inherit',
                      background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim,
                      borderRadius: T.radius, cursor: isAuto ? 'not-allowed' : 'pointer',
                      opacity: isAuto ? 0.35 : 1,
                    }}>+10</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
