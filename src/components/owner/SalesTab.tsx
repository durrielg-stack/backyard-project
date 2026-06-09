'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { getClient } from '@/lib/supabase'
import { SectionHd, fmtPeso } from './ownerShared'
import DateRangeNav, { useDateNav } from '@/components/shared/DateRangeNav'
import { dayBounds, weekBounds, monthBounds } from '@/lib/dateNav'
import { useSortable } from '@/lib/useSortable'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SaleRow {
  id:           string
  qty:          number
  unit_price:   number
  status:       string
  fired_at:     string | null
  completed_at: string | null
  orders:       { table_id: string; opened_at: string } | null
  menu_items:   { name: string; category: string; cost: number | null } | null
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
  margin:    number
  serveMin:  number | null
}

interface CategorySummary {
  category: string
  gross:    number
  cost:     number
  net:      number
  margin:   number
}

interface ItemSummary {
  itemName:    string
  category:    string
  totalQty:    number
  unitPrice:   number
  gross:       number
  cost:        number
  net:         number
  margin:      number
  avgServeMin: number | null
}

// ── SalesTab ──────────────────────────────────────────────────────────────────

export default function SalesTab() {
  const { T } = useTheme()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  const nav = useDateNav()
  const [lines, setLines] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [tableView, setTableView] = useState<'lines' | 'summary'>('lines')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  const fetchSales = useCallback(async (start: string, end: string) => {
    setLoading(true)
    const { data, error } = await sb
      .from('order_items')
      .select('id, qty, unit_price, status, fired_at, completed_at, orders(table_id, opened_at), menu_items(name, category, cost)')
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
      const gross    = r.qty * r.unit_price
      const cost     = r.qty * (r.menu_items?.cost ?? 0)
      const serveMin = r.fired_at && r.completed_at
        ? Math.round((new Date(r.completed_at).getTime() - new Date(r.fired_at).getTime()) / 60000)
        : null
      const net = gross - cost
      return {
        id: r.id, tableId: r.orders?.table_id ?? '—',
        itemName: r.menu_items?.name ?? '—', category: r.menu_items?.category ?? '—',
        qty: r.qty, unitPrice: r.unit_price, gross, cost, net,
        margin: gross > 0 ? (net / gross) * 100 : 0,
        serveMin,
      }
    }))
    setLoading(false)
  }, [sb])

  useEffect(() => {
    setSearch('')
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

  const filteredLines = search.trim()
    ? lines.filter(l => l.itemName.toLowerCase().includes(search.toLowerCase()))
    : lines

  // ── Per-unique-item summary ───────────────────────────────────────────────
  const itemSummaryMap = new Map<string, ItemSummary>()
  for (const l of filteredLines) {
    const key = l.itemName
    if (!itemSummaryMap.has(key)) {
      itemSummaryMap.set(key, { itemName: l.itemName, category: l.category, totalQty: 0, unitPrice: l.unitPrice, gross: 0, cost: 0, net: 0, margin: 0, avgServeMin: null })
    }
    const s = itemSummaryMap.get(key)!
    s.totalQty += l.qty
    s.gross    += l.gross
    s.cost     += l.cost
    s.net      += l.net
  }
  const rawItemSummaries: ItemSummary[] = Array.from(itemSummaryMap.values()).map(s => {
    // average serve time only over lines that have it
    const serveLines = filteredLines.filter(l => l.itemName === s.itemName && l.serveMin != null)
    const avgServeMin = serveLines.length > 0
      ? Math.round(serveLines.reduce((acc, l) => acc + l.serveMin!, 0) / serveLines.length)
      : null
    return { ...s, margin: s.gross > 0 ? (s.net / s.gross) * 100 : 0, avgServeMin }
  })

  const { sorted: sortedSummary, toggle: summaryToggle, icon: summaryIcon } = useSortable<ItemSummary>(rawItemSummaries, 'gross', 'desc')

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
  for (const l of filteredLines) {
    const key = CAT_BUCKET[l.category] ?? null
    if (!key) continue
    const c = catMap.get(key)!
    c.gross += l.gross; c.cost += l.cost; c.net += l.net
  }
  const catSummaries: CategorySummary[] = SUMMARY_CATS.map(cat => {
    const c = catMap.get(cat)!
    return { ...c, margin: c.gross > 0 ? (c.net / c.gross) * 100 : 0 }
  })

  const totalGross  = filteredLines.reduce((s, l) => s + l.gross, 0)
  const totalCost   = filteredLines.reduce((s, l) => s + l.cost,  0)
  const totalNet    = filteredLines.reduce((s, l) => s + l.net,   0)
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

  const sortBtn = (_k: string, align: 'left' | 'right' = 'left'): React.CSSProperties => ({
    background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: T.textMute,
    display: 'flex', alignItems: 'center', gap: 3,
    justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
    width: '100%',
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
          {nav.mode !== 'today' && (
            <div style={{ padding: '0 16px 8px', position: 'relative' }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, background: T.surface, border: `1px solid ${search ? T.accent : T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 28px 6px 8px', outline: 'none', boxSizing: 'border-box' }}
              />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: T.textMute, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>}
            </div>
          )}
          <div className="bp-no-scrollbar" style={{ padding: '0 16px 10px', overflowX: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
            <DateRangeNav mode={nav.mode} date={nav.date} weekRef={nav.weekRef} month={nav.month} year={nav.year} onModeChange={nav.setMode} onDateChange={nav.setDate} onWeekChange={nav.setWeekRef} onMonthChange={nav.setMonth} />
          </div>
        </div>
      ) : (
        <SectionHd
          title="Sales"
          badge={lines.length > 0 ? `${filteredLines.length}${search ? `/${lines.length}` : ''} items` : undefined}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {nav.mode !== 'today' && (
                <div style={{ position: 'relative' }}>
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search items…"
                    style={{ fontFamily: 'inherit', fontSize: 12, background: T.surface, border: `1px solid ${search ? T.accent : T.line2}`, color: T.text, borderRadius: T.radius, padding: '5px 26px 5px 8px', outline: 'none', width: 180 }}
                  />
                  {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: T.textMute, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>}
                </div>
              )}
              <DateRangeNav mode={nav.mode} date={nav.date} weekRef={nav.weekRef} month={nav.month} year={nav.year} onModeChange={nav.setMode} onDateChange={nav.setDate} onWeekChange={nav.setWeekRef} onMonthChange={nav.setMonth} />
            </div>
          }
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
          {/* Toggle header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 34, borderBottom: `1px solid ${T.line}`, flexShrink: 0, background: T.surface2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.textMute }}>
              {`${sortedSummary.length} unique item${sortedSummary.length !== 1 ? 's' : ''}`}
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              {(['lines', 'summary'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setTableView(v)}
                  style={{
                    padding: '2px 8px', fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${tableView === v ? T.accent : T.line2}`,
                    background: tableView === v ? `${T.accent}18` : 'transparent',
                    color: tableView === v ? T.accent : T.textMute,
                  }}
                >{v === 'lines' ? 'Per Line' : 'Per Item'}</button>
              ))}
            </div>
          </div>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>
              Loading…
            </div>
          ) : sortedSummary.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>
              {search ? `No items match "${search}"` : 'No sales on this date'}
            </div>
          ) : tableView === 'summary' ? (
            <div className="bp-no-scrollbar" style={{ flex: 1, overflow: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={th('left', { position: 'sticky', top: 0, left: 0, zIndex: 4, minWidth: 140 })}>
                      <button style={sortBtn('category')} onClick={() => summaryToggle('category')}>
                        Category<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('category')}</span>
                      </button>
                    </th>
                    <th style={th('left', { minWidth: 220 })}>
                      <button style={sortBtn('itemName')} onClick={() => summaryToggle('itemName')}>
                        Item Name<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('itemName')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 64 })}>
                      <button style={sortBtn('totalQty', 'right')} onClick={() => summaryToggle('totalQty')}>
                        Qty<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('totalQty')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 120 })}>
                      <button style={sortBtn('gross', 'right')} onClick={() => summaryToggle('gross')}>
                        Gross<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('gross')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 120 })}>
                      <button style={sortBtn('cost', 'right')} onClick={() => summaryToggle('cost')}>
                        Cost<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('cost')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 120 })}>
                      <button style={sortBtn('net', 'right')} onClick={() => summaryToggle('net')}>
                        Net<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('net')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 110 })}>
                      <button style={sortBtn('avgServeMin', 'right')} onClick={() => summaryToggle('avgServeMin')}>
                        Avg Fire→Serve<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('avgServeMin')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 90 })}>
                      <button style={sortBtn('margin', 'right')} onClick={() => summaryToggle('margin')}>
                        Margin %<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('margin')}</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSummary.map((s, i) => {
                    const rowBg = i % 2 === 0 ? T.surface : T.bg
                    return (
                      <tr key={s.itemName} style={{ background: rowBg }}>
                        <td style={td('left', { position: 'sticky', left: 0, background: rowBg, zIndex: 1, color: T.textDim })}>{s.category}</td>
                        <td style={td('left', { fontWeight: 500 })}>{s.itemName}</td>
                        <td style={td('right', { color: T.textMute })}>{s.totalQty}</td>
                        <td style={td('right')}>{fmtPeso(s.gross)}</td>
                        <td style={td('right', { color: T.textMute })}>{fmtPeso(s.cost)}</td>
                        <td style={td('right', { color: s.net >= 0 ? T.ok : T.bad })}>{fmtPeso(s.net)}</td>
                        <td style={td('right', { color: s.avgServeMin != null ? T.info : T.textMute })}>
                          {s.avgServeMin != null ? `${s.avgServeMin}m` : '—'}
                        </td>
                        <td style={td('right', { color: s.margin >= 60 ? T.ok : s.margin >= 40 ? T.warn : s.gross > 0 ? T.bad : T.textMute })}>
                          {s.gross > 0 ? `${s.margin.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bp-no-scrollbar" style={{ flex: 1, overflow: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 1040 }}>
                <thead>
                  <tr>
                    <th style={th('left', { position: 'sticky', top: 0, left: 0, zIndex: 4, minWidth: 140 })}>
                      <button style={sortBtn('category')} onClick={() => summaryToggle('category')}>
                        Category<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('category')}</span>
                      </button>
                    </th>
                    <th style={th('left', { minWidth: 220 })}>
                      <button style={sortBtn('itemName')} onClick={() => summaryToggle('itemName')}>
                        Item Name<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('itemName')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 64 })}>
                      <button style={sortBtn('totalQty', 'right')} onClick={() => summaryToggle('totalQty')}>
                        Qty<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('totalQty')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 120 })}>
                      <button style={sortBtn('unitPrice', 'right')} onClick={() => summaryToggle('unitPrice')}>
                        Unit Price<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('unitPrice')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 120 })}>
                      <button style={sortBtn('gross', 'right')} onClick={() => summaryToggle('gross')}>
                        Gross<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('gross')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 120 })}>
                      <button style={sortBtn('cost', 'right')} onClick={() => summaryToggle('cost')}>
                        Cost<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('cost')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 120 })}>
                      <button style={sortBtn('net', 'right')} onClick={() => summaryToggle('net')}>
                        Net<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('net')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 110 })}>
                      <button style={sortBtn('avgServeMin', 'right')} onClick={() => summaryToggle('avgServeMin')}>
                        Fire→Serve<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('avgServeMin')}</span>
                      </button>
                    </th>
                    <th style={th('right', { minWidth: 90 })}>
                      <button style={sortBtn('margin', 'right')} onClick={() => summaryToggle('margin')}>
                        Margin %<span style={{ fontSize: 8, opacity: 0.7 }}>{summaryIcon('margin')}</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSummary.map((s, i) => {
                    const rowBg = i % 2 === 0 ? T.surface : T.bg
                    return (
                      <tr key={s.itemName} style={{ background: rowBg }}>
                        <td style={td('left', { position: 'sticky', left: 0, background: rowBg, zIndex: 1, color: T.textDim })}>{s.category}</td>
                        <td style={td('left', { fontWeight: 500 })}>{s.itemName}</td>
                        <td style={td('right', { color: T.textMute })}>{s.totalQty}</td>
                        <td style={td('right')}>{fmtPeso(s.unitPrice)}</td>
                        <td style={td('right')}>{fmtPeso(s.gross)}</td>
                        <td style={td('right', { color: T.textMute })}>{fmtPeso(s.cost)}</td>
                        <td style={td('right', { color: s.net >= 0 ? T.ok : T.bad })}>{fmtPeso(s.net)}</td>
                        <td style={td('right', { color: s.avgServeMin != null ? T.info : T.textMute })}>
                          {s.avgServeMin != null ? `${s.avgServeMin}m` : '—'}
                        </td>
                        <td style={td('right', { color: s.margin >= 60 ? T.ok : s.margin >= 40 ? T.warn : s.gross > 0 ? T.bad : T.textMute })}>
                          {s.gross > 0 ? `${s.margin.toFixed(1)}%` : '—'}
                        </td>
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
