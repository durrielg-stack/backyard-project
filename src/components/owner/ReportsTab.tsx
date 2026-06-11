'use client'

import { useTheme } from '@/lib/ThemeContext'
import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { SectionHd, Pill, GroupedBarChart, HBarChart, fmtPeso, DAY_ABBR, MONTH_ABBR } from './ownerShared'
import type { MultiBar, CategoryBreakdown } from './ownerShared'
import DateRangeNav, { useDateNav } from '@/components/shared/DateRangeNav'
import { dayBounds, weekBounds, monthBounds, localDateStr, parseLocalDate, shiftLocalDate, ViewMode, shiftHoursUpToNow } from '@/lib/dateNav'

// ── Types local to ReportsTab ─────────────────────────────────────────────────

interface TopItem { name: string; qty: number; rev: number; cost: number }
interface VoidedItem { id: number; time: string; tableId: string; itemName: string; qty: number; amount: number; reason: string | null }

// ── ReportsTab ────────────────────────────────────────────────────────────────

export default function ReportsTab() {
  const { T } = useTheme()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  const nav = useDateNav()

  const [chartMode, setChartMode] = useState<'bar' | 'line'>('bar')
  const [rightTab, setRightTab] = useState<'top' | 'voided'>('top')

  const [gross,      setGross]      = useState(0)
  const [cost,       setCost]       = useState(0)
  const [expenses,   setExpenses]   = useState(0)
  const [txCount,    setTxCount]    = useState(0)
  const [bars,       setBars]       = useState<MultiBar[]>([])
  const [methodMap,  setMethodMap]  = useState<Record<string, number>>({})
  const [topItems,   setTopItems]   = useState<TopItem[]>([])
  const [catBreakdown, setCatBreakdown] = useState<CategoryBreakdown[]>([])
  const [expCat,     setExpCat]     = useState<{ category: string; amount: number }[]>([])
  const [voidedCount,  setVoidedCount]  = useState(0)
  const [voidedAmount, setVoidedAmount] = useState(0)
  const [voidedItems,  setVoidedItems]  = useState<VoidedItem[]>([])
  const [avgTurnMinBar,     setAvgTurnMinBar]     = useState<number | null>(null)
  const [avgTurnMinKitchen, setAvgTurnMinKitchen] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async (startISO: string, endISO: string, mode: ViewMode) => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb  = getClient() as any

    // Use parseLocalDate to avoid UTC→local date shift when iterating bars
    const startDateStr = localDateStr(new Date(startISO))
    const endDateStr   = localDateStr(new Date(endISO))
    const startLocal   = parseLocalDate(startDateStr)   // guaranteed local midnight

    // ── Sales: two-step fetch to avoid unreliable orders!inner join filter ──
    const { data: rangeOrders } = await sb
      .from('orders').select('id, opened_at')
      .gte('opened_at', startISO).lte('opened_at', endISO)
    const orderOpenedMap: Record<number, Date> = {}
    for (const o of (rangeOrders ?? [])) orderOpenedMap[o.id] = new Date(o.opened_at)
    const orderIds: number[] = Object.keys(orderOpenedMap).map(Number)

    const hourGross: Record<number, number> = {}; const hourCost: Record<number, number> = {}
    const dayGross:  Record<string, number> = {}; const dayCost:  Record<string, number> = {}
    let gTotal = 0; let cTotal = 0; let txN = orderIds.length
    const itemAgg: Record<string, { qty: number; rev: number; cost: number }> = {}
    const catAgg:  Record<string, { gross: number; cost: number }> = {}

    if (orderIds.length > 0) {
      const { data: allLines } = await sb
        .from('order_items')
        .select('order_id, qty, unit_price, menu_items(name, category, cost)')
        .in('order_id', orderIds)
        .neq('status', 'voided')

      for (const row of (allLines ?? [])) {
        const openedAt = orderOpenedMap[row.order_id]
        if (!openedAt) continue
        const val  = row.qty * row.unit_price
        const mi   = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
        const rc   = row.qty * (mi?.cost ?? 0)
        const dk   = shiftLocalDate(openedAt)  // hours 0–3 belong to previous day's shift
        const name = mi?.name ?? '—'; const cat = mi?.category ?? 'Other'

        gTotal += val; cTotal += rc
        dayGross[dk] = (dayGross[dk] ?? 0) + val; dayCost[dk] = (dayCost[dk] ?? 0) + rc

        if (mode === 'today') {
          const h = openedAt.getHours()
          hourGross[h] = (hourGross[h] ?? 0) + val; hourCost[h] = (hourCost[h] ?? 0) + rc
        }

        if (!itemAgg[name]) itemAgg[name] = { qty: 0, rev: 0, cost: 0 }
        itemAgg[name].qty += row.qty; itemAgg[name].rev += val; itemAgg[name].cost += rc
        if (!catAgg[cat]) catAgg[cat] = { gross: 0, cost: 0 }
        catAgg[cat].gross += val; catAgg[cat].cost += rc
      }
    }

    setGross(gTotal); setCost(cTotal); setTxCount(txN)
    setTopItems(Object.entries(itemAgg).map(([name, v]) => ({ name, ...v })).sort((a,b) => b.rev - a.rev).slice(0, 10))
    setCatBreakdown(Object.entries(catAgg).map(([category, v]) => ({ category, gross: v.gross, cost: v.cost, net: v.gross - v.cost })).sort((a,b) => b.gross - a.gross))

    // ── Expenses ─────────────────────────────────────────────────────────────
    const { data: expData } = await sb
      .from('daily_expenses').select('expense_date, category, amount')
      .gte('expense_date', startDateStr)
      .lte('expense_date', endDateStr)
    const expDayBuckets: Record<string, number> = {}
    const expCatBuckets: Record<string, number> = {}
    let expTotal = 0
    for (const r of (expData ?? [])) {
      expDayBuckets[r.expense_date] = (expDayBuckets[r.expense_date] ?? 0) + r.amount
      expCatBuckets[r.category] = (expCatBuckets[r.category] ?? 0) + r.amount
      expTotal += r.amount
    }
    setExpenses(expTotal)
    setExpCat(Object.entries(expCatBuckets).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount))

    // ── Build bars — always generated regardless of whether orders exist ─────
    let newBars: MultiBar[]
    if (mode === 'today') {
      newBars = shiftHoursUpToNow().map(h => ({
        label: `${String(h).padStart(2, '0')}:00`,
        gross: hourGross[h] ?? 0, cost: hourCost[h] ?? 0,
        expenses: expDayBuckets[startDateStr] ?? 0,
      }))
    } else if (mode === 'week') {
      // 6 days Wed–Mon; use startLocal (local midnight) to avoid UTC day-shift
      newBars = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(startLocal); d.setDate(d.getDate() + i)
        const dk = localDateStr(d)
        return { label: DAY_ABBR[d.getDay()], gross: dayGross[dk] ?? 0, cost: dayCost[dk] ?? 0, expenses: expDayBuckets[dk] ?? 0 }
      })
    } else {
      const year = startLocal.getFullYear()
      const month = startLocal.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      newBars = Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(year, month, i + 1)
        const dk = localDateStr(d)
        return { label: `${i + 1}`, gross: dayGross[dk] ?? 0, cost: dayCost[dk] ?? 0, expenses: expDayBuckets[dk] ?? 0 }
      })
    }
    setBars(newBars)

    const { data: pmts } = await sb
      .from('payments').select('amount, method')
      .gte('processed_at', startISO)
      .lte('processed_at', endISO)
    const mm: Record<string,number> = {}
    for (const p of (pmts ?? [])) { mm[p.method] = (mm[p.method]??0) + p.amount }
    setMethodMap(mm)

    const { data: voidedData } = orderIds.length > 0
      ? await sb.from('order_items')
          .select('id, qty, unit_price, void_reason, order_id, menu_items(name), orders!inner(table_id, opened_at)')
          .eq('status', 'voided')
          .in('order_id', orderIds)
          .order('id', { ascending: false })
      : { data: [] }
    const vi: any[] = voidedData ?? []
    setVoidedCount(vi.length)
    setVoidedAmount(vi.reduce((s: number, r: any) => s + r.qty * r.unit_price, 0))
    setVoidedItems(vi.map((row: any) => {
      const order = Array.isArray(row.orders) ? row.orders[0] : row.orders
      const mi    = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
      const dt    = new Date(order?.opened_at ?? 0)
      return {
        id:       row.id,
        time:     `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`,
        tableId:  order?.table_id ?? '—',
        itemName: mi?.name ?? '—',
        qty:      row.qty,
        amount:   row.qty * row.unit_price,
        reason:   row.void_reason ?? null,
      }
    }))

    const BAR_CATS = new Set(['Beer', 'Cocktails', 'Hard Drinks', 'Palit Bote', 'Non-Alcohol'])
    const { data: servedItems } = orderIds.length > 0
      ? await sb.from('order_items').select('fired_at, completed_at, menu_items(category)').eq('status', 'served').in('order_id', orderIds).not('fired_at', 'is', null).not('completed_at', 'is', null)
      : { data: [] }
    const si: any[] = servedItems ?? []
    const calcAvg = (items: any[]): number | null => {
      if (items.length === 0) return null
      const total = items.reduce((s: number, i: any) => s + (new Date(i.completed_at).getTime() - new Date(i.fired_at).getTime()) / 60000, 0)
      return Math.round(total / items.length)
    }
    setAvgTurnMinBar(calcAvg(si.filter(i => BAR_CATS.has(i.menu_items?.category))))
    setAvgTurnMinKitchen(calcAvg(si.filter(i => !BAR_CATS.has(i.menu_items?.category))))

    setLoading(false)
  }, [])

  useEffect(() => {
    const { start, end } = nav.mode === 'today'
      ? dayBounds(nav.date)
      : nav.mode === 'week'
      ? weekBounds(nav.weekRef)
      : monthBounds(nav.year, nav.month)
    fetchAll(start, end, nav.mode)
  }, [nav.mode, nav.date, nav.weekRef, nav.month, nav.year, fetchAll])

  useEffect(() => {
    const sb = getClient()
    const channel = sb
      .channel('owner-sales-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },      () => {
        const { start, end } = nav.mode === 'today' ? dayBounds(nav.date) : nav.mode === 'week' ? weekBounds(nav.weekRef) : monthBounds(nav.year, nav.month)
        fetchAll(start, end, nav.mode)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },           () => {
        const { start, end } = nav.mode === 'today' ? dayBounds(nav.date) : nav.mode === 'week' ? weekBounds(nav.weekRef) : monthBounds(nav.year, nav.month)
        fetchAll(start, end, nav.mode)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },         () => {
        const { start, end } = nav.mode === 'today' ? dayBounds(nav.date) : nav.mode === 'week' ? weekBounds(nav.weekRef) : monthBounds(nav.year, nav.month)
        fetchAll(start, end, nav.mode)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_expenses' },   () => {
        const { start, end } = nav.mode === 'today' ? dayBounds(nav.date) : nav.mode === 'week' ? weekBounds(nav.weekRef) : monthBounds(nav.year, nav.month)
        fetchAll(start, end, nav.mode)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
        const { start, end } = nav.mode === 'today' ? dayBounds(nav.date) : nav.mode === 'week' ? weekBounds(nav.weekRef) : monthBounds(nav.year, nav.month)
        fetchAll(start, end, nav.mode)
      })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [nav.mode, nav.date, nav.weekRef, nav.month, nav.year, fetchAll])

  const net      = gross - cost
  const suffix   = nav.mode === 'today' ? 'Today' : nav.mode === 'week' ? 'Week' : 'Month'

  const methodColors: Record<string, string> = {
    cash: T.ok, card: T.info, gcash: T.accent, maya: T.warn, comp: T.textDim,
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {isMobile ? (
        <div style={{ borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <div style={{ height: 44, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.headerText }}>Reports</span>
          </div>
          <div className="bp-no-scrollbar" style={{ padding: '0 16px 10px', overflowX: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
            <DateRangeNav mode={nav.mode} date={nav.date} weekRef={nav.weekRef} month={nav.month} year={nav.year} onModeChange={nav.setMode} onDateChange={nav.setDate} onWeekChange={nav.setWeekRef} onMonthChange={nav.setMonth} />
          </div>
        </div>
      ) : (
        <div style={{ height: 46, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <DateRangeNav mode={nav.mode} date={nav.date} weekRef={nav.weekRef} month={nav.month} year={nav.year} onModeChange={nav.setMode} onDateChange={nav.setDate} onWeekChange={nav.setWeekRef} onMonthChange={nav.setMonth} />
        </div>
      )}

      {/* KPIs */}
      {(() => {
        const kpis = [
          { label: `Gross · ${suffix}`,    value: fmtPeso(gross),    sub: `${txCount} txn`,                                                   color: T.accent },
          { label: `Cost · ${suffix}`,     value: fmtPeso(cost),     sub: gross > 0 ? `${((cost/gross)*100).toFixed(1)}% of gross` : '—', color: T.textDim },
          { label: `Net · ${suffix}`,      value: fmtPeso(net),      sub: gross > 0 ? `${((net/gross)*100).toFixed(1)}% margin` : '—',    color: net >= 0 ? T.ok : T.bad },
          { label: `Expenses · ${suffix}`, value: fmtPeso(expenses), sub: 'logged',                                                        color: T.bad },
          { label: 'Voided Items',         value: String(voidedCount), sub: voidedCount > 0 ? fmtPeso(voidedAmount) : 'none',            color: voidedCount > 0 ? T.bad : T.textMute },
          { label: 'Bar Turn Time',         value: avgTurnMinBar != null ? `${avgTurnMinBar}m` : '—',         sub: 'fired → served', color: T.info },
          { label: 'Kitchen Turn Time',     value: avgTurnMinKitchen != null ? `${avgTurnMinKitchen}m` : '—', sub: 'fired → served', color: T.info },
        ]
        return (
          <div className="bp-no-scrollbar" style={{ overflowX: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${T.line}`, minWidth: 840 }}>
            {kpis.map((k, i) => (
              <div key={k.label} style={{ padding: '14px 20px', borderRight: i < 6 ? `1px solid ${T.line}` : 'none' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute, marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: k.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: T.textMute, marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          </div>
        )
      })()}

      {/* Single scroll body — prevents category sections from squishing P&L chart */}
      <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto', touchAction: 'pan-y' }}>

        {/* P&L Overview + Top/Voided panel */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', borderBottom: `1px solid ${T.line}` }}>

          {/* P&L chart column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: isMobile ? 'none' : `1px solid ${T.line}`, borderBottom: isMobile ? `1px solid ${T.line}` : 'none' }}>
            <SectionHd
              title="P&L Overview"
              badge={`Gross ${fmtPeso(gross)} · Net ${fmtPeso(net)}`}
              action={
                <div style={{ display: 'flex', gap: 2 }}>
                  {(['bar', 'line'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setChartMode(m)}
                      title={m === 'bar' ? 'Bar chart' : 'Line chart'}
                      style={{
                        width: 28, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: chartMode === m ? T.accent : T.chip,
                        border: `1px solid ${chartMode === m ? T.accent : T.line2}`,
                        borderRadius: T.radius, cursor: 'pointer', padding: 0,
                        transition: 'background 0.12s ease',
                      }}
                    >
                      {m === 'bar' ? (
                        <svg viewBox="0 0 12 10" width={12} height={10} fill="none">
                          <rect x="0" y="4" width="2.5" height="6" fill={chartMode === 'bar' ? T.accentInk : T.textDim} />
                          <rect x="3.5" y="1" width="2.5" height="9" fill={chartMode === 'bar' ? T.accentInk : T.textDim} />
                          <rect x="7" y="2.5" width="2.5" height="7.5" fill={chartMode === 'bar' ? T.accentInk : T.textDim} />
                          <rect x="10" y="5.5" width="2" height="4.5" fill={chartMode === 'bar' ? T.accentInk : T.textDim} />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 12 10" width={12} height={10} fill="none" stroke={chartMode === 'line' ? T.accentInk : T.textDim} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round">
                          <polyline points="0,8 3,4 6,5.5 9,1.5 12,3" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              }
            />
            {loading ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
            ) : isMobile ? (
              <div className="bp-no-scrollbar" style={{ overflowX: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
                <div style={{ minWidth: 480 }}>
                  <GroupedBarChart bars={bars} height={220} mode={chartMode} />
                </div>
              </div>
            ) : (
              <GroupedBarChart bars={bars} height={220} mode={chartMode} />
            )}

            {/* Payment method breakdown */}
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute, marginBottom: 8 }}>
                Payment Methods · {suffix}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(methodMap).length === 0 ? (
                  <span style={{ fontSize: 12, color: T.textMute, fontFamily: T.mono }}>No payments</span>
                ) : Object.entries(methodMap).map(([m, v]) => (
                  <div key={m} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: T.surface2, border: `1px solid ${T.line2}`,
                    padding: '4px 10px', borderRadius: T.radius,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: methodColors[m] ?? T.textDim }} />
                    <span style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 600, textTransform: 'uppercase', color: T.textDim }}>
                      {m === 'gcash' ? 'QR' : m.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 12, fontFamily: T.mono, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtPeso(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top items / Voided items panel */}
          <div style={{ width: isMobile ? '100%' : 300, flexShrink: 0, display: 'flex', flexDirection: 'column', borderTop: isMobile ? `1px solid ${T.line}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', height: 36, borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
              {([['top', `Top Items`], ['voided', `Voided (${voidedCount})`]] as const).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setRightTab(t)}
                  style={{
                    padding: '3px 10px', fontSize: 10, fontWeight: 700,
                    borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    border: `1px solid ${rightTab === t ? (t === 'voided' ? T.bad : T.accent) : T.line2}`,
                    background: rightTab === t ? (t === 'voided' ? `${T.bad}18` : `${T.accent}18`) : 'transparent',
                    color: rightTab === t ? (t === 'voided' ? T.bad : T.accent) : T.textMute,
                  }}
                >{label}</button>
              ))}
            </div>

            {rightTab === 'top' ? (
              <div className="bp-no-scrollbar" style={{ overflowY: isMobile ? 'visible' : 'auto', touchAction: 'pan-y' }}>
                {topItems.length === 0 ? (
                  <div style={{ padding: '24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>No data</div>
                ) : topItems.map((item, i) => {
                  const maxRev = topItems[0].rev
                  const margin = item.rev > 0 ? ((item.rev - item.cost) / item.rev) * 100 : null
                  return (
                    <div key={item.name} style={{ padding: '10px 16px', borderBottom: `1px solid ${T.line}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute, width: 16 }}>{String(i+1).padStart(2,'0')}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, fontVariantNumeric: 'tabular-nums' }}>{fmtPeso(item.rev)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <div style={{ flex: 1, height: 3, background: T.line2, borderRadius: 2 }}>
                          <div style={{ width: `${(item.rev / maxRev) * 100}%`, height: '100%', background: `${T.accent}66`, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute }}>{item.qty}×</span>
                      </div>
                      {item.cost > 0 && (
                        <div style={{ display: 'flex', gap: 8, paddingLeft: 24 }}>
                          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute }}>cost {fmtPeso(item.cost)}</span>
                          {margin !== null && (
                            <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, color: margin >= 60 ? T.ok : margin >= 40 ? T.warn : T.bad }}>
                              {margin.toFixed(0)}% margin
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bp-no-scrollbar" style={{ overflowY: isMobile ? 'visible' : 'auto', touchAction: 'pan-y' }}>
                {voidedItems.length === 0 ? (
                  <div style={{ padding: '24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>No voided items</div>
                ) : voidedItems.map((row, i) => (
                  <div key={row.id} style={{ padding: '10px 16px', borderBottom: `1px solid ${T.line}`, background: i % 2 === 0 ? 'transparent' : T.surface }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{row.itemName}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtPeso(row.amount)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute }}>{row.time}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>{row.tableId}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute }}>×{row.qty}</span>
                      {row.reason && <span style={{ fontSize: 10, color: T.textMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {row.reason}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sales by Category */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', borderBottom: `1px solid ${T.line}` }}>
          <div style={{ flex: 1, borderRight: isMobile ? 'none' : `1px solid ${T.line}`, borderBottom: isMobile ? `1px solid ${T.line}` : 'none' }}>
            <SectionHd title={`Sales by Category · ${suffix}`} badge={fmtPeso(gross)} />
            {isMobile ? (
              <div className="bp-no-scrollbar" style={{ overflowX: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
                <div style={{ minWidth: 360 }}>
                  <HBarChart color={`${T.accent}88`} data={catBreakdown.map(c => ({ category: c.category, value: c.gross, sub: c.gross > 0 ? `${((c.net/c.gross)*100).toFixed(0)}% net` : undefined }))} />
                </div>
              </div>
            ) : (
              <HBarChart color={`${T.accent}88`} data={catBreakdown.map(c => ({ category: c.category, value: c.gross, sub: c.gross > 0 ? `${((c.net/c.gross)*100).toFixed(0)}% net` : undefined }))} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <SectionHd title={`Expenses by Category · ${suffix}`} badge={fmtPeso(expenses)} />
            {isMobile ? (
              <div className="bp-no-scrollbar" style={{ overflowX: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
                <div style={{ minWidth: 360 }}>
                  <HBarChart color={`${T.bad}88`} data={expCat.map(c => ({ category: c.category, value: c.amount }))} />
                </div>
              </div>
            ) : (
              <HBarChart color={`${T.bad}88`} data={expCat.map(c => ({ category: c.category, value: c.amount }))} />
            )}
          </div>
        </div>

        {/* By Category breakdown table */}
        {catBreakdown.length > 0 && (
          <div>
            <SectionHd title={`By Category · ${suffix}`} />
            <div className="bp-no-scrollbar" style={{ overflow: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 580, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.headerText, textAlign: 'left', background: T.surface2, borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, left: 0, zIndex: 4, minWidth: 160, whiteSpace: 'nowrap' }}>Category</th>
                    <th style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.headerText, textAlign: 'right', background: T.surface2, borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, zIndex: 2, minWidth: 130, whiteSpace: 'nowrap' }}>Gross</th>
                    <th style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.headerText, textAlign: 'right', background: T.surface2, borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, zIndex: 2, minWidth: 130, whiteSpace: 'nowrap' }}>Cost</th>
                    <th style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.headerText, textAlign: 'right', background: T.surface2, borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, zIndex: 2, minWidth: 130, whiteSpace: 'nowrap' }}>Net</th>
                    <th style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.headerText, textAlign: 'right', background: T.surface2, borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, zIndex: 2, minWidth: 90, whiteSpace: 'nowrap' }}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {catBreakdown.map((row, i) => {
                    const margin = row.gross > 0 ? (row.net / row.gross) * 100 : 0
                    const rowBg = i % 2 === 0 ? T.bg : T.surface
                    return (
                      <tr key={row.category} style={{ background: rowBg }}>
                        <td style={{ padding: '9px 16px', fontSize: 13, fontWeight: 500, color: T.text, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: rowBg, zIndex: 1 }}>{row.category}</td>
                        <td style={{ padding: '9px 16px', fontFamily: T.mono, fontSize: 12, color: T.accent, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtPeso(row.gross)}</td>
                        <td style={{ padding: '9px 16px', fontFamily: T.mono, fontSize: 12, color: T.textMute, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtPeso(row.cost)}</td>
                        <td style={{ padding: '9px 16px', fontFamily: T.mono, fontSize: 12, color: T.ok, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtPeso(row.net)}</td>
                        <td style={{ padding: '9px 16px', fontFamily: T.mono, fontSize: 12, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', color: margin >= 60 ? T.ok : margin >= 40 ? T.warn : T.bad }}>{margin.toFixed(1)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
