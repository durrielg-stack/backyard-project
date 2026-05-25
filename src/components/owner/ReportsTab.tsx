'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase'
import { T, SectionHd, Pill, GroupedBarChart, HBarChart, fmtPeso, DAY_ABBR, MONTH_ABBR } from './ownerShared'
import type { MultiBar, CategoryBreakdown } from './ownerShared'

// ── Types local to ReportsTab ─────────────────────────────────────────────────

interface TopItem { name: string; qty: number; rev: number; cost: number }

// ── ReportsTab ────────────────────────────────────────────────────────────────

export default function ReportsTab() {
  const [range, setRange]         = useState<'today' | 'week' | 'month'>('today')
  const [chartMode, setChartMode] = useState<'bar' | 'line'>('bar')

  const [todayGross,  setTodayGross]  = useState(0)
  const [weekGross,   setWeekGross]   = useState(0)
  const [monthGross,  setMonthGross]  = useState(0)
  const [todayCost,   setTodayCost]   = useState(0)
  const [weekCost,    setWeekCost]    = useState(0)
  const [monthCost,   setMonthCost]   = useState(0)
  const [todayExp,    setTodayExp]    = useState(0)
  const [weekExp,     setWeekExp]     = useState(0)
  const [monthExp,    setMonthExp]    = useState(0)
  const [txToday,     setTxToday]     = useState(0)
  const [txWeek,      setTxWeek]      = useState(0)
  const [txMonth,     setTxMonth]     = useState(0)
  const [hourlyGrouped,  setHourlyGrouped]  = useState<MultiBar[]>([])
  const [weeklyGrouped,  setWeeklyGrouped]  = useState<MultiBar[]>([])
  const [monthlyGrouped, setMonthlyGrouped] = useState<MultiBar[]>([])
  const [methodMap,      setMethodMap]      = useState<Record<string, number>>({})
  const [topItemsAll,    setTopItemsAll]    = useState<Record<string, TopItem[]>>({ today: [], week: [], month: [] })
  const [catBreakdownAll,setCatBreakdownAll]= useState<Record<string, CategoryBreakdown[]>>({ today: [], week: [], month: [] })
  const [expCatAll,      setExpCatAll]      = useState<Record<string, { category: string; amount: number }[]>>({ today: [], week: [], month: [] })
  const [voidedCount,    setVoidedCount]    = useState(0)
  const [voidedAmount,   setVoidedAmount]   = useState(0)
  const [avgTurnMin,     setAvgTurnMin]     = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb  = getClient() as any
    const now = new Date()

    const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
    const weekStart  = new Date(now); weekStart.setDate(weekStart.getDate() - 6);  weekStart.setHours(0,0,0,0)
    const monthStart = new Date(now); monthStart.setDate(monthStart.getDate() - 29); monthStart.setHours(0,0,0,0)

    const { data: allOrders } = await sb
      .from('orders').select('id, opened_at, status')
      .gte('opened_at', monthStart.toISOString())
    const allOrderIds = (allOrders ?? []).map((o: any) => o.id)

    const todayStartMs = todayStart.getTime()
    const weekStartMs  = weekStart.getTime()

    if (allOrderIds.length === 0) {
      setTodayGross(0); setTodayCost(0); setWeekGross(0); setWeekCost(0); setMonthGross(0); setMonthCost(0)
      setTxToday(0); setTxWeek(0); setTxMonth(0)
      setHourlyGrouped([]); setWeeklyGrouped([]); setMonthlyGrouped([])
    } else {
      const { data: allLines } = await sb
        .from('order_items')
        .select('order_id, qty, unit_price, menu_items(name, category, cost)')
        .in('order_id', allOrderIds)
        .neq('status', 'voided')
      const lines: any[] = allLines ?? []

      const orderDateMap: Record<number, string> = {}
      const orderOpenedAtMap: Record<number, Date> = {}
      for (const o of (allOrders ?? [])) {
        orderDateMap[o.id] = new Date(o.opened_at).toISOString().slice(0,10)
        orderOpenedAtMap[o.id] = new Date(o.opened_at)
      }

      const hourGross: Record<number, number> = {}; const hourCost: Record<number, number> = {}
      const dayGross:  Record<string, number> = {}; const dayCost:  Record<string, number> = {}
      let gToday = 0; let cToday = 0; let gWeek = 0; let cWeek = 0; let gMonth = 0; let cMonth = 0
      let txTodayN = 0; let txWeekN = 0; let txMonthN = 0
      const countedOrders = new Set<number>()

      const itemAgg: Record<string, Record<string, { qty: number; rev: number; cost: number }>> = { today: {}, week: {}, month: {} }
      const catAgg:  Record<string, Record<string, { gross: number; cost: number }>>             = { today: {}, week: {}, month: {} }

      for (const row of lines) {
        const openedAt = orderOpenedAtMap[row.order_id]
        if (!openedAt) continue
        const ts  = openedAt.getTime()
        const val = row.qty * row.unit_price
        const mi  = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
        const rc  = row.qty * (mi?.cost ?? 0)
        const dk  = orderDateMap[row.order_id]
        const name = mi?.name ?? '—'; const cat = mi?.category ?? 'Other'

        gMonth += val; cMonth += rc
        dayGross[dk] = (dayGross[dk] ?? 0) + val; dayCost[dk] = (dayCost[dk] ?? 0) + rc

        if (ts >= weekStartMs)  { gWeek  += val; cWeek  += rc }
        if (ts >= todayStartMs) {
          gToday += val; cToday += rc
          const h = openedAt.getHours()
          hourGross[h] = (hourGross[h] ?? 0) + val; hourCost[h] = (hourCost[h] ?? 0) + rc
        }

        if (!countedOrders.has(row.order_id)) {
          countedOrders.add(row.order_id)
          if (ts >= todayStartMs) txTodayN++
          if (ts >= weekStartMs)  txWeekN++
          txMonthN++
        }

        for (const [rng, ms] of [['today', todayStartMs], ['week', weekStartMs], ['month', -Infinity]] as const) {
          if (ts >= ms) {
            if (!itemAgg[rng][name]) itemAgg[rng][name] = { qty: 0, rev: 0, cost: 0 }
            itemAgg[rng][name].qty += row.qty; itemAgg[rng][name].rev += val; itemAgg[rng][name].cost += rc
            if (!catAgg[rng][cat]) catAgg[rng][cat] = { gross: 0, cost: 0 }
            catAgg[rng][cat].gross += val; catAgg[rng][cat].cost += rc
          }
        }
      }

      setTodayGross(gToday); setTodayCost(cToday); setTxToday(txTodayN)
      setWeekGross(gWeek);   setWeekCost(cWeek);   setTxWeek(txWeekN)
      setMonthGross(gMonth); setMonthCost(cMonth);  setTxMonth(txMonthN)

      const maxHour = now.getHours()
      setHourlyGrouped(Array.from({ length: maxHour + 1 }, (_, h) => ({
        label: `${String(h).padStart(2,'0')}:00`,
        gross: hourGross[h] ?? 0, cost: hourCost[h] ?? 0, expenses: 0,
      })))
      setWeeklyGrouped(Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart); d.setDate(d.getDate() + i)
        const dk = d.toISOString().slice(0,10)
        return { label: DAY_ABBR[d.getDay()], gross: dayGross[dk] ?? 0, cost: dayCost[dk] ?? 0, expenses: 0 }
      }))
      setMonthlyGrouped(Array.from({ length: 30 }, (_, i) => {
        const d = new Date(monthStart); d.setDate(d.getDate() + i)
        const dk = d.toISOString().slice(0,10)
        return { label: `${d.getDate()}`, gross: dayGross[dk] ?? 0, cost: dayCost[dk] ?? 0, expenses: 0 }
      }))

      const buildTop = (rng: string) =>
        Object.entries(itemAgg[rng]).map(([name, v]) => ({ name, ...v })).sort((a,b) => b.rev - a.rev).slice(0, 10)
      const buildCat = (rng: string) =>
        Object.entries(catAgg[rng]).map(([category, v]) => ({ category, gross: v.gross, cost: v.cost, net: v.gross - v.cost })).sort((a,b) => b.gross - a.gross)
      setTopItemsAll({ today: buildTop('today'), week: buildTop('week'), month: buildTop('month') })
      setCatBreakdownAll({ today: buildCat('today'), week: buildCat('week'), month: buildCat('month') })
    }

    const { data: expData } = await sb
      .from('daily_expenses').select('expense_date, category, amount')
      .gte('expense_date', monthStart.toISOString().slice(0,10))
    const expDayBuckets: Record<string, number> = {}
    const expCatBuckets: Record<string, Record<string, number>> = { today: {}, week: {}, month: {} }
    let expTodayTotal = 0; let expWeekTotal = 0; let expMonthTotal = 0
    const todayStr = todayStart.toISOString().slice(0,10)
    const weekStr  = weekStart.toISOString().slice(0,10)
    for (const r of (expData ?? [])) {
      expDayBuckets[r.expense_date] = (expDayBuckets[r.expense_date] ?? 0) + r.amount
      expMonthTotal += r.amount
      expCatBuckets.month[r.category] = (expCatBuckets.month[r.category] ?? 0) + r.amount
      if (r.expense_date >= weekStr) {
        expWeekTotal += r.amount
        expCatBuckets.week[r.category] = (expCatBuckets.week[r.category] ?? 0) + r.amount
      }
      if (r.expense_date === todayStr) {
        expTodayTotal += r.amount
        expCatBuckets.today[r.category] = (expCatBuckets.today[r.category] ?? 0) + r.amount
      }
    }
    setTodayExp(expTodayTotal); setWeekExp(expWeekTotal); setMonthExp(expMonthTotal)
    const buildExpCat = (rng: string) =>
      Object.entries(expCatBuckets[rng]).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
    setExpCatAll({ today: buildExpCat('today'), week: buildExpCat('week'), month: buildExpCat('month') })

    setHourlyGrouped(prev => prev.map(b => ({ ...b, expenses: expDayBuckets[todayStr] ?? 0 })))
    setWeeklyGrouped(prev => prev.map(b => {
      const idx = DAY_ABBR.indexOf(b.label)
      if (idx < 0) return b
      const d = new Date(); d.setDate(d.getDate() - (d.getDay() - idx + 7) % 7)
      return { ...b, expenses: expDayBuckets[d.toISOString().slice(0,10)] ?? 0 }
    }))
    setMonthlyGrouped(prev => prev.map(b => {
      const d = new Date(monthStart); d.setDate(monthStart.getDate() + parseInt(b.label) - monthStart.getDate())
      return { ...b, expenses: expDayBuckets[d.toISOString().slice(0,10)] ?? 0 }
    }))

    const { data: todayPmts } = await sb
      .from('payments').select('amount, method')
      .gte('processed_at', todayStart.toISOString())
    const mm: Record<string,number> = {}
    for (const p of (todayPmts ?? [])) { mm[p.method] = (mm[p.method]??0) + p.amount }
    setMethodMap(mm)

    const { data: todayOrdersV } = await sb.from('orders').select('id').gte('opened_at', todayStart.toISOString())
    const todayOrderIds = (todayOrdersV ?? []).map((o: any) => o.id)
    const vi: any[] = []
    if (todayOrderIds.length > 0) {
      const { data: voidedItems } = await sb.from('order_items').select('qty, unit_price').eq('status', 'voided').in('order_id', todayOrderIds)
      vi.push(...(voidedItems ?? []))
    }
    setVoidedCount(vi.length)
    setVoidedAmount(vi.reduce((s: number, r: any) => s + r.qty * r.unit_price, 0))

    const { data: closedToday } = await sb.from('orders').select('opened_at, closed_at').eq('status', 'closed').gte('opened_at', todayStart.toISOString()).not('closed_at', 'is', null)
    const ct: any[] = closedToday ?? []
    if (ct.length > 0) {
      const totalMin = ct.reduce((s: number, o: any) => s + (new Date(o.closed_at).getTime() - new Date(o.opened_at).getTime()) / 60000, 0)
      setAvgTurnMin(Math.round(totalMin / ct.length))
    } else {
      setAvgTurnMin(null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const sb = getClient()
    const channel = sb
      .channel('owner-sales-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },      fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },           fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },         fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_expenses' },   fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, fetchAll)
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [fetchAll])

  const gross    = range === 'today' ? todayGross : range === 'week' ? weekGross  : monthGross
  const cost     = range === 'today' ? todayCost  : range === 'week' ? weekCost   : monthCost
  const expenses = range === 'today' ? todayExp   : range === 'week' ? weekExp    : monthExp
  const net      = gross - cost
  const txc      = range === 'today' ? txToday    : range === 'week' ? txWeek     : txMonth
  const bars     = range === 'today' ? hourlyGrouped : range === 'week' ? weeklyGrouped : monthlyGrouped
  const topItems     = topItemsAll[range] ?? []
  const catBreakdown = catBreakdownAll[range] ?? []
  const expCat       = expCatAll[range] ?? []
  const suffix       = range === 'today' ? 'Today' : range === 'week' ? 'Week' : 'Month'

  const methodColors: Record<string, string> = {
    cash: T.ok, card: T.info, gcash: T.accent, maya: T.warn, comp: T.textDim,
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      <div style={{ height: 46, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute, marginRight: 4 }}>View</span>
        {(['today','week','month'] as const).map(r => (
          <Pill key={r} label={r === 'today' ? 'Today' : r === 'week' ? 'Week' : 'Month'} active={range === r} onClick={() => setRange(r)} />
        ))}
      </div>

      {/* KPIs */}
      {(() => {
        const kpis = [
          { label: `Gross · ${suffix}`,    value: fmtPeso(gross),    sub: `${txc} txn`,                                                   color: T.accent },
          { label: `Cost · ${suffix}`,     value: fmtPeso(cost),     sub: gross > 0 ? `${((cost/gross)*100).toFixed(1)}% of gross` : '—', color: T.textDim },
          { label: `Net · ${suffix}`,      value: fmtPeso(net),      sub: gross > 0 ? `${((net/gross)*100).toFixed(1)}% margin` : '—',    color: net >= 0 ? T.ok : T.bad },
          { label: `Expenses · ${suffix}`, value: fmtPeso(expenses), sub: 'logged',                                                        color: T.bad },
          { label: 'Voided Items',         value: String(voidedCount), sub: voidedCount > 0 ? fmtPeso(voidedAmount) : 'today',            color: voidedCount > 0 ? T.bad : T.textMute },
          { label: 'Avg Turn Time',        value: avgTurnMin != null ? `${avgTurnMin}m` : '—', sub: 'open → close today',                color: T.info },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
            {kpis.map((k, i) => (
              <div key={k.label} style={{ padding: '14px 20px', borderRight: i < 5 ? `1px solid ${T.line}` : 'none' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute, marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: k.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: T.textMute, marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )
      })()}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* P&L Overview chart */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${T.line}` }}>
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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
          ) : (
            <GroupedBarChart bars={bars} height={220} mode={chartMode} />
          )}

          {/* Payment method breakdown */}
          <div style={{ padding: '12px 24px', borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute, marginBottom: 8 }}>
              Payment Methods · Today
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(methodMap).length === 0 ? (
                <span style={{ fontSize: 12, color: T.textMute, fontFamily: T.mono }}>No payments today</span>
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

        {/* Top items */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <SectionHd title="Top Items" badge={suffix} />
          <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
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
        </div>
      </div>

      {/* Category charts */}
      <div style={{ display: 'flex', borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
        <div style={{ flex: 1, borderRight: `1px solid ${T.line}` }}>
          <SectionHd title={`Sales by Category · ${suffix}`} badge={fmtPeso(gross)} />
          <HBarChart
            color={`${T.accent}88`}
            data={catBreakdown.map(c => ({
              category: c.category,
              value: c.gross,
              sub: c.gross > 0 ? `${((c.net/c.gross)*100).toFixed(0)}% net` : undefined,
            }))}
          />
        </div>
        <div style={{ flex: 1 }}>
          <SectionHd title={`Expenses by Category · ${suffix}`} badge={fmtPeso(expenses)} />
          <HBarChart
            color={`${T.bad}88`}
            data={expCat.map(c => ({ category: c.category, value: c.amount }))}
          />
        </div>
      </div>

      {/* Category breakdown table */}
      {catBreakdown.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: `1px solid ${T.line}` }}>
          <SectionHd title={`By Category · ${suffix}`} />
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 130px 130px 130px 90px',
            padding: '0 24px', height: 32, alignItems: 'center',
            background: T.surface2, borderBottom: `1px solid ${T.line}`,
          }}>
            {['Category','Gross','Cost','Net','Margin'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>
            ))}
          </div>
          {catBreakdown.map((row, i) => {
            const margin = row.gross > 0 ? (row.net / row.gross) * 100 : 0
            return (
              <div key={row.category} style={{
                display: 'grid', gridTemplateColumns: '1fr 130px 130px 130px 90px',
                padding: '0 24px', height: 40, alignItems: 'center',
                borderBottom: `1px solid ${T.line}`,
                background: i % 2 === 0 ? 'transparent' : T.surface,
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{row.category}</span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.accent, fontVariantNumeric: 'tabular-nums' }}>{fmtPeso(row.gross)}</span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute, fontVariantNumeric: 'tabular-nums' }}>{fmtPeso(row.cost)}</span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.ok, fontVariantNumeric: 'tabular-nums' }}>{fmtPeso(row.net)}</span>
                <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: margin >= 60 ? T.ok : margin >= 40 ? T.warn : T.bad }}>
                  {margin.toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
