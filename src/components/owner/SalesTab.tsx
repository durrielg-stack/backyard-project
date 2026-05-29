'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { getClient } from '@/lib/supabase'
import { SectionHd, fmtPeso } from './ownerShared'
import DateRangeNav, { useDateNav } from '@/components/shared/DateRangeNav'
import { dayBounds, weekBounds, monthBounds } from '@/lib/dateNav'

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

// ── SalesTab ──────────────────────────────────────────────────────────────────

export default function SalesTab() {
  const { T } = useTheme()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  const nav = useDateNav()
  const [lines, setLines] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  const fetchSales = useCallback(async (start: string, end: string) => {
    setLoading(true)
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
    setLines(rows.map((r: SaleRow) => {
      const gross = r.qty * r.unit_price
      const cost  = r.qty * (r.menu_items?.cost ?? 0)
      return {
        id: r.id, tableId: r.orders?.table_id ?? '—',
        itemName: r.menu_items?.name ?? '—', category: r.menu_items?.category ?? '—',
        qty: r.qty, unitPrice: r.unit_price, gross, cost, net: gross - cost,
      }
    }))
    setLoading(false)
  }, [sb])

  useEffect(() => {
    let start: string, end: string
    if (nav.mode === 'today') {
      ;({ start, end } = dayBounds(nav.date))
    } else if (nav.mode === 'week') {
      ;({ start, end } = weekBounds(nav.weekRef))
    } else {
      ;({ start, end } = monthBounds(nav.year, nav.month))
    }
    fetchSales(start, end)
  }, [nav.mode, nav.date, nav.weekRef, nav.month, nav.year, fetchSales])

  // ── Category summary ──────────────────────────────────────────────────────
  const SUMMARY_CATS = ['Food', 'Beer', 'Cocktails/Hard', 'Non-Alcohol', 'Cigarettes']

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
    c.gross += l.gross; c.cost += l.cost; c.net += l.net
  }
  const catSummaries: CategorySummary[] = SUMMARY_CATS.map(cat => {
    const c = catMap.get(cat)!
    return { ...c, margin: c.gross > 0 ? (c.net / c.gross) * 100 : 0 }
  })

  const totalGross  = lines.reduce((s, l) => s + l.gross, 0)
  const totalCost   = lines.reduce((s, l) => s + l.cost,  0)
  const totalNet    = lines.reduce((s, l) => s + l.net,   0)
  const totalMargin = totalGross > 0 ? (totalNet / totalGross) * 100 : 0

  // ── Cell / header styles ──────────────────────────────────────────────────

  const th = (align: 'left' | 'right' = 'left', extra: React.CSSProperties = {}): React.CSSProperties => ({
    padding: '10px 16px',
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
    zIndex: 2,
    whiteSpace: 'nowrap',
    ...extra,
  })

  const td = (align: 'left' | 'right' = 'left', extra: React.CSSProperties = {}): React.CSSProperties => ({
    padding: '9px 16px',
    fontSize: 12,
    fontFamily: align === 'right' ? T.mono : 'inherit',
    color: T.text,
    textAlign: align,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    ...extra,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {isMobile ? (
        <div style={{ borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <div style={{ height: 44, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>Sales</span>
            {lines.length > 0 && (
              <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.accent, background: `${T.accent}18`, border: `1px solid ${T.accent}44`, padding: '2px 8px', borderRadius: T.radius }}>
                {lines.length} items
              </span>
            )}
          </div>
          <div className="bp-no-scrollbar" style={{ padding: '0 16px 10px', overflowX: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
            <DateRangeNav mode={nav.mode} date={nav.date} weekRef={nav.weekRef} month={nav.month} year={nav.year} onModeChange={nav.setMode} onDateChange={nav.setDate} onWeekChange={nav.setWeekRef} onMonthChange={nav.setMonth} />
          </div>
        </div>
      ) : (
        <SectionHd
          title="Sales"
          badge={lines.length > 0 ? `${lines.length} items` : undefined}
          action={<DateRangeNav mode={nav.mode} date={nav.date} weekRef={nav.weekRef} month={nav.month} year={nav.year} onModeChange={nav.setMode} onDateChange={nav.setDate} onWeekChange={nav.setWeekRef} onMonthChange={nav.setMonth} />}
        />
      )}

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ── Category summary ─────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, borderBottom: `2px solid ${T.line2}` }}>
          <div className="bp-no-scrollbar" style={{ overflowX: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 620, width: '100%' }}>
              <thead>
                <tr>
                  <th style={th('left', { position: 'sticky', left: 0, zIndex: 3, minWidth: 160 })}>Category</th>
                  <th style={th('right', { minWidth: 130 })}>Gross</th>
                  <th style={th('right', { minWidth: 130 })}>Cost</th>
                  <th style={th('right', { minWidth: 130 })}>Net</th>
                  <th style={th('right', { minWidth: 100 })}>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {catSummaries.map((c, i) => {
                  const rowBg = i % 2 === 0 ? T.surface : T.bg
                  return (
                    <tr key={c.category} style={{ background: rowBg }}>
                      <td style={td('left', { position: 'sticky', left: 0, background: rowBg, zIndex: 1, fontWeight: 500 })}>{c.category}</td>
                      <td style={td('right')}>{fmtPeso(c.gross)}</td>
                      <td style={td('right', { color: T.textMute })}>{fmtPeso(c.cost)}</td>
                      <td style={td('right', { color: c.net >= 0 ? T.ok : T.bad })}>{fmtPeso(c.net)}</td>
                      <td style={td('right', { color: T.textMute })}>{c.margin.toFixed(1)}%</td>
                    </tr>
                  )
                })}
                <tr style={{ background: T.surface2, borderTop: `1px solid ${T.line2}` }}>
                  <td style={td('left', { position: 'sticky', left: 0, background: T.surface2, zIndex: 1, fontWeight: 700, color: T.text })}>Total</td>
                  <td style={td('right', { fontWeight: 700, color: T.text })}>{fmtPeso(totalGross)}</td>
                  <td style={td('right', { fontWeight: 700, color: T.textMute })}>{fmtPeso(totalCost)}</td>
                  <td style={td('right', { fontWeight: 700, color: totalNet >= 0 ? T.ok : T.bad })}>{fmtPeso(totalNet)}</td>
                  <td style={td('right', { fontWeight: 700, color: T.textMute })}>{totalMargin.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Line items ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>
              Loading…
            </div>
          ) : lines.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>
              No sales on this date
            </div>
          ) : (
            // Single scroll container for both header and rows — they move together
            <div className="bp-no-scrollbar" style={{ flex: 1, overflow: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 920 }}>
                <thead>
                  <tr>
                    {/* Category — sticky left + sticky top */}
                    <th style={th('left', { position: 'sticky', top: 0, left: 0, zIndex: 4, minWidth: 140 })}>Category</th>
                    <th style={th('left', { minWidth: 80 })}>Table</th>
                    <th style={th('left', { minWidth: 220 })}>Item Name</th>
                    <th style={th('right', { minWidth: 64 })}>Qty</th>
                    <th style={th('right', { minWidth: 120 })}>Unit Price</th>
                    <th style={th('right', { minWidth: 120 })}>Gross</th>
                    <th style={th('right', { minWidth: 120 })}>Cost</th>
                    <th style={th('right', { minWidth: 120 })}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const rowBg = i % 2 === 0 ? T.surface : T.bg
                    return (
                      <tr key={l.id} style={{ background: rowBg }}>
                        <td style={td('left', { position: 'sticky', left: 0, background: rowBg, zIndex: 1, color: T.textDim })}>{l.category}</td>
                        <td style={td('left')}>{l.tableId}</td>
                        <td style={td('left')}>{l.itemName}</td>
                        <td style={td('right', { color: T.textMute })}>{l.qty}</td>
                        <td style={td('right')}>{fmtPeso(l.unitPrice)}</td>
                        <td style={td('right')}>{fmtPeso(l.gross)}</td>
                        <td style={td('right', { color: T.textMute })}>{fmtPeso(l.cost)}</td>
                        <td style={td('right', { color: l.net >= 0 ? T.ok : T.bad })}>{fmtPeso(l.net)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
