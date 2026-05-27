'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { getClient } from '@/lib/supabase'
import { SectionHd, fmtPeso } from './ownerShared'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SaleRow {
  id:         string
  qty:        number
  unit_price: number
  status:     string
  orders:     { table_id: string; opened_at: string } | null
  menu_items: { name: string; category: string; cost: number | null } | null
}

interface LineItem {
  id:        string
  tableId:   string
  itemName:  string
  category:  string
  qty:       number
  unitPrice: number
  gross:     number
  cost:      number
  net:       number
}

interface CategorySummary {
  category: string
  gross:    number
  cost:     number
  net:      number
  margin:   number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayBounds(dateStr: string): { start: string; end: string } {
  // Parse dateStr as local date, produce ISO boundaries for the full day in local time
  const [y, m, day] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, day, 0, 0, 0, 0)
  const end   = new Date(y, m - 1, day, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

// ── SalesTab ──────────────────────────────────────────────────────────────────

export default function SalesTab() {
  const { T } = useTheme()

  const today     = localDateStr(new Date())
  const [date, setDate] = useState(today)
  const [lines, setLines] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  const fetchSales = useCallback(async (dateStr: string) => {
    setLoading(true)
    const { start, end } = dayBounds(dateStr)
    const { data, error } = await sb
      .from('order_items')
      .select('id, qty, unit_price, status, orders(table_id, opened_at), menu_items(name, category, cost)')
      .gte('orders.opened_at', start)
      .lte('orders.opened_at', end)
      .neq('status', 'voided')
      .order('id', { ascending: true })

    if (error) {
      console.error('[SalesTab] fetch error', error)
      setLines([])
      setLoading(false)
      return
    }

    const rows: SaleRow[] = (data ?? []).filter((r: SaleRow) => r.orders !== null)

    const mapped: LineItem[] = rows.map((r: SaleRow) => {
      const gross = r.qty * r.unit_price
      const cost  = r.qty * (r.menu_items?.cost ?? 0)
      return {
        id:        r.id,
        tableId:   r.orders?.table_id ?? '—',
        itemName:  r.menu_items?.name ?? '—',
        category:  r.menu_items?.category ?? '—',
        qty:       r.qty,
        unitPrice: r.unit_price,
        gross,
        cost,
        net: gross - cost,
      }
    })

    setLines(mapped)
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchSales(date) }, [date, fetchSales])

  // ── Category summary — fixed order ────────────────────────────────────────
  const SUMMARY_CATS = ['Food', 'Beer', 'Cocktails/Hard', 'Non-Alcohol', 'Cigarettes']

  // Map DB category values → summary bucket
  const CAT_BUCKET: Record<string, string> = {
    Chicken: 'Food', Meals: 'Food', Noodles: 'Food', Pork: 'Food',
    Seafood: 'Food', Starters: 'Food', Extra: 'Food',
    Beer: 'Beer',
    Cocktails: 'Cocktails/Hard', 'Hard Drinks': 'Cocktails/Hard',
    'Non-Alcohol': 'Non-Alcohol',
    Cigarettes: 'Cigarettes',
  }

  const catMap = new Map<string, CategorySummary>()
  for (const cat of SUMMARY_CATS) {
    catMap.set(cat, { category: cat, gross: 0, cost: 0, net: 0, margin: 0 })
  }
  for (const l of lines) {
    const key = CAT_BUCKET[l.category] ?? null
    if (!key) continue
    const c = catMap.get(key)!
    c.gross += l.gross
    c.cost  += l.cost
    c.net   += l.net
  }
  const catSummaries: CategorySummary[] = SUMMARY_CATS.map(cat => {
    const c = catMap.get(cat)!
    return { ...c, margin: c.gross > 0 ? (c.net / c.gross) * 100 : 0 }
  })

  const totalGross  = lines.reduce((s, l) => s + l.gross,  0)
  const totalCost   = lines.reduce((s, l) => s + l.cost,   0)
  const totalNet    = lines.reduce((s, l) => s + l.net,    0)
  const totalMargin = totalGross > 0 ? (totalNet / totalGross) * 100 : 0

  // ── Shared cell style ──────────────────────────────────────────────────────

  const cellStyle = (align: 'left' | 'right' = 'left', muted = false): React.CSSProperties => ({
    padding: '7px 12px',
    fontFamily: align === 'right' ? T.mono : 'inherit',
    fontSize: 12,
    color: muted ? T.textMute : T.text,
    textAlign: align,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  })

  const thStyle = (align: 'left' | 'right' = 'left'): React.CSSProperties => ({
    padding: '8px 12px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: T.textMute,
    textAlign: align,
    background: T.surface2,
    borderBottom: `1px solid ${T.line}`,
    position: 'sticky',
    top: 0,
    zIndex: 1,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Header controls ─────────────────────────────────────────────────── */}
      <SectionHd
        title="Sales"
        badge={lines.length > 0 ? `${lines.length} items` : undefined}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() - 1)
                setDate(localDateStr(d))
              }}
              style={{
                padding: '4px 12px', fontSize: 12, fontFamily: 'inherit',
                background: T.chip, color: T.textDim,
                border: `1px solid ${T.line2}`, borderRadius: T.radius,
                cursor: 'pointer',
              }}
            >
              Yesterday
            </button>
            <button
              onClick={() => setDate(localDateStr(new Date()))}
              style={{
                padding: '4px 12px', fontSize: 12, fontFamily: 'inherit',
                background: T.chip, color: T.textDim,
                border: `1px solid ${T.line2}`, borderRadius: T.radius,
                cursor: 'pointer',
              }}
            >
              Today
            </button>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                padding: '4px 10px', fontSize: 12, fontFamily: T.mono,
                background: T.surface2, color: T.text,
                border: `1px solid ${T.line2}`, borderRadius: T.radius,
                outline: 'none', cursor: 'pointer',
              }}
            />
          </div>
        }
      />

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.textMute, fontFamily: T.mono, fontSize: 12,
        }}>
          Loading…
        </div>
      ) : lines.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.textMute, fontFamily: T.mono, fontSize: 12,
        }}>
          No sales on this date
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

          {/* ── Category summary ────────────────────────────────────────────── */}
          <div style={{ flexShrink: 0, borderBottom: `1px solid ${T.line}` }}>
            <div style={{
              padding: '8px 0 4px',
              borderBottom: `1px solid ${T.line}`,
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle('left'),   position: 'static' }}>Category</th>
                    <th style={{ ...thStyle('right'),  position: 'static' }}>Gross</th>
                    <th style={{ ...thStyle('right'),  position: 'static' }}>Cost</th>
                    <th style={{ ...thStyle('right'),  position: 'static' }}>Net</th>
                    <th style={{ ...thStyle('right'),  position: 'static' }}>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {catSummaries.map((c, i) => (
                    <tr key={c.category} style={{ background: i % 2 === 0 ? T.surface : 'transparent' }}>
                      <td style={cellStyle('left')}>{c.category}</td>
                      <td style={cellStyle('right')}>{fmtPeso(c.gross)}</td>
                      <td style={{ ...cellStyle('right'), color: T.textMute }}>{fmtPeso(c.cost)}</td>
                      <td style={{ ...cellStyle('right'), color: c.net >= 0 ? T.ok : T.bad }}>{fmtPeso(c.net)}</td>
                      <td style={{ ...cellStyle('right'), color: T.textMute }}>{c.margin.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr style={{ background: T.surface2, borderTop: `1px solid ${T.line}` }}>
                    <td style={{ ...cellStyle('left'), fontWeight: 700, color: T.text }}>Total</td>
                    <td style={{ ...cellStyle('right'), fontWeight: 700, color: T.text }}>{fmtPeso(totalGross)}</td>
                    <td style={{ ...cellStyle('right'), fontWeight: 700, color: T.textMute }}>{fmtPeso(totalCost)}</td>
                    <td style={{ ...cellStyle('right'), fontWeight: 700, color: totalNet >= 0 ? T.ok : T.bad }}>{fmtPeso(totalNet)}</td>
                    <td style={{ ...cellStyle('right'), fontWeight: 700, color: T.textMute }}>{totalMargin.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Line items ──────────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} className="bp-no-scrollbar">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle('left')}>Category</th>
                  <th style={thStyle('left')}>Table</th>
                  <th style={thStyle('left')}>Item Name</th>
                  <th style={thStyle('right')}>Qty</th>
                  <th style={thStyle('right')}>Unit Price</th>
                  <th style={thStyle('right')}>Gross</th>
                  <th style={thStyle('right')}>Cost</th>
                  <th style={thStyle('right')}>Net</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.id} style={{ background: i % 2 === 0 ? T.surface : 'transparent' }}>
                    <td style={{ ...cellStyle('left'), color: T.textDim }}>{l.category}</td>
                    <td style={cellStyle('left')}>{l.tableId}</td>
                    <td style={cellStyle('left')}>{l.itemName}</td>
                    <td style={{ ...cellStyle('right'), color: T.textMute }}>{l.qty}</td>
                    <td style={cellStyle('right')}>{fmtPeso(l.unitPrice)}</td>
                    <td style={cellStyle('right')}>{fmtPeso(l.gross)}</td>
                    <td style={{ ...cellStyle('right'), color: T.textMute }}>{fmtPeso(l.cost)}</td>
                    <td style={{ ...cellStyle('right'), color: l.net >= 0 ? T.ok : T.bad }}>{fmtPeso(l.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  )
}
