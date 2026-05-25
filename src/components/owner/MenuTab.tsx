'use client'

import { useTheme } from '@/lib/ThemeContext'
import { useState, useCallback, useEffect } from 'react'
import { getClient } from '@/lib/supabase'
import { SectionHd, Pill } from './ownerShared'

interface MenuRow {
  id:          string
  name:        string
  category:    string
  category2:   string
  category3:   string
  price:       number
  cost:        number | null
  isAvailable: boolean
  sortOrder:   number
}

export default function MenuTab() {
  const { T } = useTheme()

  const [items,     setItems]     = useState<MenuRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [saving,    setSaving]    = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  const fetchItems = useCallback(async () => {
    const { data } = await sb.from('menu_items').select('id, name, category, category2, category3, price, cost, is_available, sort_order').order('sort_order')
    setItems((data ?? []).map((r: any) => ({
      id: r.id, name: r.name, category: r.category, category2: r.category2, category3: r.category3,
      price: r.price, cost: r.cost, isAvailable: r.is_available, sortOrder: r.sort_order,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function toggleAvail(item: MenuRow) {
    setSaving(item.id)
    await sb.from('menu_items').update({ is_available: !item.isAvailable }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i))
    setSaving(null)
  }

  async function savePrice(item: MenuRow) {
    const p = parseFloat(editPrice)
    if (isNaN(p) || p < 0) { setEditId(null); return }
    setSaving(item.id)
    await sb.from('menu_items').update({ price: p }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, price: p } : i))
    setEditId(null); setSaving(null)
  }

  const cats     = ['all', ...Array.from(new Set(items.map(i => i.category)))]
  const filtered = filterCat === 'all' ? items : items.filter(i => i.category === filterCat)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <SectionHd
        title="Menu"
        badge={`${items.filter(i => i.isAvailable).length}/${items.length} available`}
        action={
          <div className="bp-no-scrollbar" style={{ display: 'flex', gap: 4, overflowX: 'auto', maxWidth: 480 }}>
            {cats.slice(0, 8).map(c => (
              <Pill key={c} label={c === 'all' ? 'All' : c} active={filterCat === c} onClick={() => setFilterCat(c)} />
            ))}
          </div>
        }
      />
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
      ) : (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 120px',
            padding: '0 24px', height: 36, alignItems: 'center',
            borderBottom: `1px solid ${T.line}`, background: T.surface2, flexShrink: 0,
          }}>
            {['Name','Category','Price','Cost','Available'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>
            ))}
          </div>

          <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.map((item, i) => {
              const isEditing = editId === item.id
              const isSaving  = saving === item.id
              return (
                <div key={item.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 120px',
                  padding: '0 24px', height: 44, alignItems: 'center',
                  borderBottom: `1px solid ${T.line}`,
                  background: i % 2 === 0 ? 'transparent' : T.surface,
                  opacity: isSaving ? 0.5 : item.isAvailable ? 1 : 0.45,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: item.isAvailable ? T.text : T.textMute }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 11, color: T.textMute }}>{item.category}</span>

                  {isEditing ? (
                    <input
                      autoFocus
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value)}
                      onBlur={() => savePrice(item)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') savePrice(item)
                        if (e.key === 'Escape') setEditId(null)
                      }}
                      style={{
                        width: 70, fontFamily: T.mono, fontSize: 13, fontWeight: 600,
                        background: T.surface, border: `1px solid ${T.accent}88`,
                        color: T.text, borderRadius: T.radius, padding: '2px 6px', outline: 'none',
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => { setEditId(item.id); setEditPrice(item.price.toFixed(0)) }}
                      title="Click to edit price"
                      style={{
                        fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.accent,
                        fontVariantNumeric: 'tabular-nums', cursor: 'pointer',
                        borderBottom: `1px dashed ${T.accent}44`,
                      }}
                    >
                      ₱{item.price.toFixed(0)}
                    </span>
                  )}

                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute }}>
                    {item.cost != null ? `₱${item.cost.toFixed(0)}` : '—'}
                  </span>

                  <div>
                    <button
                      onClick={() => toggleAvail(item)}
                      disabled={isSaving}
                      style={{
                        padding: '3px 12px', fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
                        background: item.isAvailable ? `${T.ok}22` : `${T.bad}18`,
                        border: `1px solid ${item.isAvailable ? T.ok : T.bad}44`,
                        color: item.isAvailable ? T.ok : T.bad,
                        borderRadius: T.radius, cursor: 'pointer',
                      }}
                    >
                      {item.isAvailable ? 'Available' : 'Unavailable'}
                    </button>
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
