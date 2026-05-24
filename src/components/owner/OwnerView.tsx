'use client'

import { useState, useEffect, useCallback } from 'react'
import { THEME } from '@/lib/theme'
import { getClient } from '@/lib/supabase'
import type { TableWithStatus } from '@/lib/types'

const T = THEME

// ── Types ─────────────────────────────────────────────────────────────────────

interface RevenueBar { label: string; value: number; isPeak: boolean }

interface SummaryRow {
  date:     string   // YYYY-MM-DD
  label:    string   // 'Mon 19'
  revenue:  number
  txCount:  number
}

interface ExpenseRow {
  id:          number
  expenseDate: string
  category:    string
  description: string
  amount:      number
  qty:         number
  unitPrice:   number | null
  paidTo:      string | null
  receiptRef:  string | null
  addedBy:     string | null
  createdAt:   string
}

interface CategoryBreakdown {
  category: string
  gross:    number
  cost:     number
  net:      number
}

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

interface TableRow {
  id:       string
  label:    string
  section:  string
  capacity: number
  status:   string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function makePeak(bars: Omit<RevenueBar,'isPeak'>[]): RevenueBar[] {
  const max = Math.max(...bars.map(b => b.value), 0.01)
  return bars.map(b => ({ ...b, isPeak: b.value === max && b.value > 0 }))
}

function fmtPeso(v: number) {
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: Date) {
  return `${DAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function SectionHd({ title, badge, action }: { title: string; badge?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{
      height: 48, padding: '0 24px', flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: `1px solid ${T.line}`,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: T.textMute,
      }}>
        {title}
      </span>
      {badge != null && (
        <span style={{
          fontFamily: T.mono, fontSize: 12, fontWeight: 600,
          color: T.accent, background: `${T.accent}18`,
          border: `1px solid ${T.accent}44`,
          padding: '2px 8px', borderRadius: T.radius,
        }}>
          {badge}
        </span>
      )}
      <div style={{ flex: 1 }} />
      {action}
    </div>
  )
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 14px', fontSize: 12, fontFamily: 'inherit',
      background: active ? T.accent : T.chip,
      color:      active ? T.accentInk : T.textDim,
      border:     `1px solid ${active ? T.accent : T.line2}`,
      borderRadius: T.radius, cursor: 'pointer',
      fontWeight: active ? 600 : 400,
      transition: 'background 0.12s ease',
    }}>
      {label}
    </button>
  )
}

// ── Bar chart (shared) ────────────────────────────────────────────────────────
function BarChart({ bars, height = 200 }: { bars: RevenueBar[]; height?: number }) {
  if (bars.length === 0) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.textMute, fontFamily: T.mono, fontSize: 12,
      }}>
        No data
      </div>
    )
  }
  const maxVal = Math.max(...bars.map(b => b.value), 1)
  return (
    <div style={{ height, padding: '12px 24px 0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {[0.25, 0.5, 0.75, 1.0].map(pct => (
          <div key={pct} style={{
            position: 'absolute', left: 0, right: 0,
            top: `${(1 - pct) * 100}%`,
            borderTop: `1px solid ${T.line}`,
            pointerEvents: 'none',
          }}>
            <span style={{
              position: 'absolute', right: 0, transform: 'translateY(-100%)',
              fontSize: 9, fontFamily: T.mono, color: T.textMute,
              fontVariantNumeric: 'tabular-nums', paddingBottom: 1,
            }}>
              {(maxVal * pct) >= 1000
                ? `${((maxVal * pct) / 1000).toFixed(1)}k`
                : (maxVal * pct).toFixed(0)}
            </span>
          </div>
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${bars.length}, 1fr)`,
          alignItems: 'flex-end',
        }}>
          {bars.map(bar => {
            const h = maxVal > 0 ? (bar.value / maxVal) * 100 : 0
            return (
              <div key={bar.label} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-end', height: '100%',
              }}>
                {bar.value > 0 && (
                  <div style={{
                    fontFamily: T.mono, fontSize: 8, fontWeight: 600,
                    color: bar.isPeak ? T.accent : T.textMute,
                    marginBottom: 2, whiteSpace: 'nowrap',
                  }}>
                    {bar.value >= 1000 ? `${(bar.value / 1000).toFixed(1)}k` : bar.value.toFixed(0)}
                  </div>
                )}
                <div style={{
                  width: '70%', height: h > 0 ? `${h}%` : 2,
                  background: bar.isPeak ? T.accent : `${T.accent}44`,
                  borderRadius: `${T.radius} ${T.radius} 0 0`,
                  minHeight: bar.value > 0 ? 4 : 2,
                  transition: 'height 0.4s ease',
                }} />
              </div>
            )
          })}
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${bars.length}, 1fr)`,
        marginTop: 4, paddingBottom: 8,
      }}>
        {bars.map((bar, i) => (
          <div key={bar.label} style={{
            textAlign: 'center', fontFamily: T.mono, fontSize: 8, color: T.textMute,
            visibility: (bars.length > 14 && i % 2 !== 0) ? 'hidden' : 'visible',
          }}>
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── REPORTS TAB ───────────────────────────────────────────────────────────────

function ReportsTab() {
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today')

  // ── State ──────────────────────────────────────────────────────────────────
  const [todayGross, setTodayGross] = useState(0)
  const [todayRev,  setTodayRev]  = useState(0)
  const [weekRev,   setWeekRev]   = useState(0)
  const [monthRev,  setMonthRev]  = useState(0)
  const [txToday,   setTxToday]   = useState(0)
  const [txWeek,    setTxWeek]    = useState(0)
  const [txMonth,   setTxMonth]   = useState(0)
  const [hourlyBars,  setHourlyBars]  = useState<RevenueBar[]>([])
  const [weeklyBars,  setWeeklyBars]  = useState<RevenueBar[]>([])
  const [monthlyBars, setMonthlyBars] = useState<RevenueBar[]>([])
  const [methodMap,       setMethodMap]       = useState<Record<string, number>>({})
  const [topItems,        setTopItems]        = useState<{ name: string; qty: number; rev: number; cost: number }[]>([])
  const [catBreakdown,    setCatBreakdown]    = useState<CategoryBreakdown[]>([])
  const [todayCost,       setTodayCost]       = useState(0)
  const [voidedCount,     setVoidedCount]     = useState(0)
  const [voidedAmount,    setVoidedAmount]    = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb  = getClient() as any
    const now = new Date()

    // Today
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
    const { data: todayPmts } = await sb
      .from('payments').select('amount, method, processed_at')
      .gte('processed_at', todayStart.toISOString())
    const tp = todayPmts ?? []
    const todayTotal = tp.reduce((s: number, p: any) => s + p.amount, 0)
    setTodayRev(todayTotal); setTxToday(tp.length)

    // Today's gross sales + cost — via orders opened today (includes unpaid open tables)
    const { data: todayOrderRows } = await sb
      .from('orders').select('id').gte('opened_at', todayStart.toISOString())
    const todayOIds = (todayOrderRows ?? []).map((o: any) => o.id)
    if (todayOIds.length > 0) {
      const { data: todayLineItems } = await sb
        .from('order_items')
        .select('qty, unit_price, menu_items(cost)')
        .in('order_id', todayOIds)
        .neq('status', 'voided')
      let gross = 0; let cost = 0
      for (const row of (todayLineItems ?? [])) {
        const mi = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
        gross += row.qty * row.unit_price
        cost  += row.qty * (mi?.cost ?? 0)
      }
      setTodayGross(gross)
      setTodayCost(cost)
    } else {
      setTodayGross(0); setTodayCost(0)
    }

    // Hourly
    const hourBuckets: Record<number,number> = {}
    for (const p of tp) { const h = new Date(p.processed_at).getHours(); hourBuckets[h] = (hourBuckets[h]??0) + p.amount }
    const maxHour = now.getHours()
    setHourlyBars(makePeak(Array.from({ length: maxHour + 1 }, (_,h) => ({ label: `${String(h).padStart(2,'0')}:00`, value: hourBuckets[h]??0 }))))

    // Method breakdown (today)
    const mm: Record<string,number> = {}
    for (const p of tp) { mm[p.method] = (mm[p.method]??0) + p.amount }
    setMethodMap(mm)

    // Week (last 7 days)
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0,0,0,0)
    const { data: weekPmts } = await sb
      .from('payments').select('amount, processed_at')
      .gte('processed_at', weekStart.toISOString())
    const wp = weekPmts ?? []
    setWeekRev(wp.reduce((s: number, p: any) => s + p.amount, 0)); setTxWeek(wp.length)
    const dayBuckets: Record<string,number> = {}
    for (const p of wp) {
      const d = new Date(p.processed_at)
      const key = d.toISOString().slice(0,10)
      dayBuckets[key] = (dayBuckets[key]??0) + p.amount
    }
    setWeeklyBars(makePeak(Array.from({ length: 7 }, (_,i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i)
      return { label: DAY_ABBR[d.getDay()], value: dayBuckets[d.toISOString().slice(0,10)]??0 }
    })))

    // Month (last 30 days)
    const monthStart = new Date(now); monthStart.setDate(monthStart.getDate() - 29); monthStart.setHours(0,0,0,0)
    const { data: monthPmts } = await sb
      .from('payments').select('amount, processed_at')
      .gte('processed_at', monthStart.toISOString())
    const mp = monthPmts ?? []
    setMonthRev(mp.reduce((s: number, p: any) => s + p.amount, 0)); setTxMonth(mp.length)
    const dateBuckets: Record<string,number> = {}
    for (const p of mp) { const k = new Date(p.processed_at).toISOString().slice(0,10); dateBuckets[k]=(dateBuckets[k]??0)+p.amount }
    setMonthlyBars(makePeak(Array.from({ length: 30 }, (_,i) => {
      const d = new Date(monthStart); d.setDate(d.getDate() + i)
      const k = d.toISOString().slice(0,10)
      return { label: `${d.getDate()}`, value: dateBuckets[k]??0 }
    })))

    // Top items (last 30 days) + category breakdown — join menu_items for cost
    const { data: items } = await sb
      .from('order_items')
      .select('qty, unit_price, status, created_at, menu_items(name, category, cost)')
      .gte('created_at', monthStart.toISOString())
    const itemAgg: Record<string, { qty: number; rev: number; cost: number }> = {}
    const catAgg:  Record<string, { gross: number; cost: number }> = {}
    for (const row of (items ?? [])) {
      if (row.status === 'voided') continue
      const mi   = (Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items)
      const name = mi?.name ?? '—'
      const cat  = mi?.category ?? 'Other'
      const itemCost = (mi?.cost ?? 0) * row.qty
      if (!itemAgg[name]) itemAgg[name] = { qty: 0, rev: 0, cost: 0 }
      itemAgg[name].qty  += row.qty
      itemAgg[name].rev  += row.qty * row.unit_price
      itemAgg[name].cost += itemCost
      if (!catAgg[cat]) catAgg[cat] = { gross: 0, cost: 0 }
      catAgg[cat].gross += row.qty * row.unit_price
      catAgg[cat].cost  += itemCost
    }
    const sorted = Object.entries(itemAgg)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 10)
    setTopItems(sorted)
    setCatBreakdown(
      Object.entries(catAgg)
        .map(([category, v]) => ({ category, gross: v.gross, cost: v.cost, net: v.gross - v.cost }))
        .sort((a, b) => b.gross - a.gross)
    )

    // Voided items — today: get today's order ids first, then query voided items
    const { data: todayOrders } = await sb
      .from('orders').select('id')
      .gte('opened_at', todayStart.toISOString())
    const todayOrderIds = (todayOrders ?? []).map((o: any) => o.id)
    const vi: any[] = []
    if (todayOrderIds.length > 0) {
      const { data: voidedItems } = await sb
        .from('order_items').select('qty, unit_price')
        .eq('status', 'voided')
        .in('order_id', todayOrderIds)
      vi.push(...(voidedItems ?? []))
    }
    setVoidedCount(vi.length)
    setVoidedAmount(vi.reduce((s: number, r: any) => s + r.qty * r.unit_price, 0))

    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const bars = range === 'today' ? hourlyBars : range === 'week' ? weeklyBars : monthlyBars
  const rev  = range === 'today' ? todayRev  : range === 'week' ? weekRev   : monthRev
  const txc  = range === 'today' ? txToday   : range === 'week' ? txWeek    : txMonth

  const methodColors: Record<string, string> = {
    cash: T.ok, card: T.info, gcash: T.accent, maya: T.warn, comp: T.textDim,
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Summary KPIs */}
      {(() => {
        const todayNet = todayGross - todayCost
        const kpis = [
          { label: 'Gross · Today',  value: fmtPeso(todayGross),  sub: `${txToday} txn`,                                                          color: T.accent },
          { label: 'Cost · Today',   value: fmtPeso(todayCost),   sub: todayGross > 0 ? `${((todayCost/todayGross)*100).toFixed(1)}% of gross` : '—', color: T.textDim },
          { label: 'Net · Today',    value: fmtPeso(todayNet),    sub: todayGross > 0 ? `${((todayNet/todayGross)*100).toFixed(1)}% margin`  : '—', color: todayNet >= 0 ? T.ok : T.bad },
          { label: 'Avg. Order',     value: txToday > 0 ? fmtPeso(todayGross / txToday) : '—', sub: 'today', color: T.text },
          { label: 'Voided Items',   value: String(voidedCount),  sub: voidedCount > 0 ? fmtPeso(voidedAmount) : 'today',             color: voidedCount > 0 ? T.bad : T.textMute },
          { label: 'Voided Total',   value: fmtPeso(voidedAmount),sub: 'today',                                                       color: voidedAmount > 0 ? T.bad : T.textMute },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
            {kpis.map((k, i) => (
              <div key={k.label} style={{ padding: '16px 20px', borderRight: i < 5 ? `1px solid ${T.line}` : 'none' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute, marginBottom: 6 }}>
                  {k.label}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: k.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {k.value}
                </div>
                <div style={{ fontSize: 11, color: T.textMute, marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )
      })()}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Revenue chart */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${T.line}` }}>
          <SectionHd
            title="Revenue"
            badge={fmtPeso(rev) + (txc > 0 ? ` · ${txc} txn` : '')}
            action={
              <div style={{ display: 'flex', gap: 4 }}>
                {(['today','week','month'] as const).map(r => (
                  <Pill key={r} label={r === 'today' ? 'Today' : r === 'week' ? 'Week' : 'Month'} active={range === r} onClick={() => setRange(r)} />
                ))}
              </div>
            }
          />
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>
              Loading…
            </div>
          ) : (
            <BarChart bars={bars} height={220} />
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
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: methodColors[m] ?? T.textDim,
                  }} />
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
          <SectionHd title="Top Items" badge="30 days" />
          <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
            {topItems.length === 0 ? (
              <div style={{ padding: '24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>No data</div>
            ) : topItems.map((item, i) => {
              const maxRev = topItems[0].rev
              const margin = item.rev > 0 ? ((item.rev - item.cost) / item.rev) * 100 : null
              return (
                <div key={item.name} style={{
                  padding: '10px 16px',
                  borderBottom: `1px solid ${T.line}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute, width: 16 }}>
                      {String(i+1).padStart(2,'0')}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </span>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtPeso(item.rev)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <div style={{ flex: 1, height: 3, background: T.line2, borderRadius: 2 }}>
                      <div style={{ width: `${(item.rev / maxRev) * 100}%`, height: '100%', background: `${T.accent}66`, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute }}>{item.qty}×</span>
                  </div>
                  {item.cost > 0 && (
                    <div style={{ display: 'flex', gap: 8, paddingLeft: 24 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute }}>
                        cost {fmtPeso(item.cost)}
                      </span>
                      {margin !== null && (
                        <span style={{
                          fontFamily: T.mono, fontSize: 10, fontWeight: 600,
                          color: margin >= 60 ? T.ok : margin >= 40 ? T.warn : T.bad,
                        }}>
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

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: `1px solid ${T.line}` }}>
          <SectionHd title="By Category · 30 days" />
          {/* header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 130px 130px 130px 90px',
            padding: '0 24px', height: 32, alignItems: 'center',
            background: T.surface2, borderBottom: `1px solid ${T.line}`,
          }}>
            {['Category','Gross','Cost','Net','Margin'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>
                {h}
              </span>
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
                <span style={{
                  fontFamily: T.mono, fontSize: 12, fontWeight: 600,
                  color: margin >= 60 ? T.ok : margin >= 40 ? T.warn : T.bad,
                }}>
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

// ── TABLES TAB ────────────────────────────────────────────────────────────────

function TablesTab({ liveTableStatuses }: { liveTableStatuses: TableWithStatus[] }) {
  const [tables, setTables]   = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)

  const fetchTables = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (getClient() as any).from('restaurant_tables').select('id, label, section, capacity, status').order('id')
    setTables(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTables() }, [fetchTables])

  // Merge live statuses from POSApp
  const merged = tables.map(t => {
    const live = liveTableStatuses.find(l => l.id === t.id)
    return { ...t, status: live?.status ?? t.status, openMin: live?.openMin ?? 0, checkTotal: live?.checkTotal ?? 0 }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  async function setReserved(tableId: string, reserve: boolean) {
    setWorking(tableId)
    await sb.from('restaurant_tables').update({ status: reserve ? 'reserved' : 'available' }).eq('id', tableId)
    await fetchTables()
    setWorking(null)
  }

  async function forceClose(tableId: string) {
    setWorking(tableId)
    // Close any open orders for this table
    const { data: orders } = await sb.from('orders').select('id').eq('table_id', tableId).eq('status', 'open')
    for (const o of (orders ?? [])) {
      await sb.from('orders').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', o.id)
    }
    await sb.from('restaurant_tables').update({ status: 'available' }).eq('id', tableId)
    await fetchTables()
    setWorking(null)
  }

  const statusColor: Record<string, string> = {
    available: T.ok, occupied: T.accent, aging: T.warn,
    attention: T.bad, reserved: T.info,
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <SectionHd title="Tables" badge={`${tables.length} total`} />
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
      ) : (
        <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '64px 1fr 80px 60px 80px 1fr 220px',
            padding: '0 24px', height: 36, alignItems: 'center',
            borderBottom: `1px solid ${T.line}`, background: T.surface2, flexShrink: 0,
          }}>
            {['Table','Section','Seats','Status','Open','Check','Actions'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>
                {h}
              </span>
            ))}
          </div>

          {merged.map((t, i) => {
            const sc = statusColor[t.status] ?? T.textDim
            const isWorking = working === t.id
            return (
              <div key={t.id} style={{
                display: 'grid', gridTemplateColumns: '64px 1fr 80px 60px 80px 1fr 220px',
                padding: '0 24px', height: 48, alignItems: 'center',
                borderBottom: `1px solid ${T.line}`,
                background: i % 2 === 0 ? 'transparent' : T.surface,
                opacity: isWorking ? 0.5 : 1,
              }}>
                <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: T.text }}>{t.label}</span>
                <span style={{ fontSize: 12, color: T.textDim }}>{t.section}</span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim }}>{t.capacity}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: sc,
                }}>
                  {t.status}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute, fontVariantNumeric: 'tabular-nums' }}>
                  {(t as any).openMin > 0 ? `${(t as any).openMin}m` : '—'}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim, fontVariantNumeric: 'tabular-nums' }}>
                  {(t as any).checkTotal > 0 ? fmtPeso((t as any).checkTotal) : '—'}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {t.status === 'reserved' ? (
                    <button onClick={() => setReserved(t.id, false)} disabled={isWorking} style={{
                      padding: '4px 10px', fontSize: 11, fontFamily: 'inherit',
                      background: `${T.info}18`, border: `1px solid ${T.info}44`,
                      color: T.info, borderRadius: T.radius, cursor: 'pointer',
                    }}>
                      Clear Reserve
                    </button>
                  ) : t.status === 'available' ? (
                    <button onClick={() => setReserved(t.id, true)} disabled={isWorking} style={{
                      padding: '4px 10px', fontSize: 11, fontFamily: 'inherit',
                      background: T.chip, border: `1px solid ${T.line2}`,
                      color: T.textDim, borderRadius: T.radius, cursor: 'pointer',
                    }}>
                      Reserve
                    </button>
                  ) : null}

                  {['occupied','aging','attention'].includes(t.status) && (
                    <button onClick={() => forceClose(t.id)} disabled={isWorking} style={{
                      padding: '4px 10px', fontSize: 11, fontFamily: 'inherit',
                      background: `${T.bad}18`, border: `1px solid ${T.bad}44`,
                      color: T.bad, borderRadius: T.radius, cursor: 'pointer',
                    }}>
                      Force Close
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── MENU TAB ──────────────────────────────────────────────────────────────────

function MenuTab() {
  const [items,   setItems]   = useState<MenuRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [saving, setSaving]   = useState<string | null>(null)

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

  const cats = ['all', ...Array.from(new Set(items.map(i => i.category)))]
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
          {/* Column header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 120px',
            padding: '0 24px', height: 36, alignItems: 'center',
            borderBottom: `1px solid ${T.line}`, background: T.surface2, flexShrink: 0,
          }}>
            {['Name','Category','Price','Cost','Available'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>
                {h}
              </span>
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

                  {/* Price — click to edit */}
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

                  {/* Toggle */}
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

// ── INVENTORY TAB ─────────────────────────────────────────────────────────────

function InventoryTab() {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>
                {h}
              </span>
            ))}
          </div>

          <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
            {rows.map((row, i) => {
              const isLow = row.quantity <= row.lowStockThresh
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

// ── EXPENSES TAB ──────────────────────────────────────────────────────────────

const EXPENSE_CATS = ['Petty Cash', 'Supplies', 'Utilities', 'Wages', 'Marketing', 'Other'] as const

function ExpensesTab() {
  const [rows,    setRows]    = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]    = useState(false)

  // Form state
  const [fCat,       setFCat]       = useState<string>('Petty Cash')
  const [fDesc,      setFDesc]      = useState('')
  const [fQty,       setFQty]       = useState('1')
  const [fUnitPrice, setFUnitPrice] = useState('')
  const [fAmt,       setFAmt]       = useState('')
  const [fTo,        setFTo]        = useState('')
  const [fRef,       setFRef]       = useState('')

  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  const fetchRows = useCallback(async () => {
    const { data } = await sb
      .from('daily_expenses')
      .select('*')
      .eq('expense_date', today)
      .order('created_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRows((data ?? []).map((r: any) => ({
      id: r.id, expenseDate: r.expense_date, category: r.category,
      description: r.description, amount: r.amount,
      qty: r.qty ?? 1, unitPrice: r.unit_price ?? null,
      paidTo: r.paid_to, receiptRef: r.receipt_ref,
      addedBy: r.added_by, createdAt: r.created_at,
    })))
    setLoading(false)
  }, [today])

  useEffect(() => { fetchRows() }, [fetchRows])

  async function addExpense() {
    const qty  = parseFloat(fQty) || 1
    const up   = fUnitPrice !== '' ? parseFloat(fUnitPrice) : null
    const amt  = up != null ? qty * up : parseFloat(fAmt)
    if (!fDesc.trim() || isNaN(amt) || amt <= 0) return
    setSaving(true)
    await sb.from('daily_expenses').insert({
      expense_date: today,
      category:     fCat,
      description:  fDesc.trim(),
      amount:       amt,
      qty,
      unit_price:   up,
      paid_to:      fTo.trim() || null,
      receipt_ref:  fRef.trim() || null,
    })
    setFDesc(''); setFQty('1'); setFUnitPrice(''); setFAmt(''); setFTo(''); setFRef('')
    setShowForm(false)
    await fetchRows()
    setSaving(false)
  }

  async function deleteExpense(id: number) {
    await sb.from('daily_expenses').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const totalToday = rows.reduce((s, r) => s + r.amount, 0)

  const catColor: Record<string, string> = {
    'Petty Cash': T.warn, 'Supplies': T.info, 'Utilities': T.textDim,
    'Wages': T.ok, 'Marketing': T.accent, 'Other': T.textMute,
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <SectionHd
        title="Daily Expenses"
        badge={fmtPeso(totalToday)}
        action={
          <button onClick={() => setShowForm(v => !v)} style={{
            padding: '5px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
            background: showForm ? T.chip : T.accent,
            color: showForm ? T.textDim : T.accentInk,
            border: `1px solid ${showForm ? T.line2 : T.accent}`,
            borderRadius: T.radius, cursor: 'pointer',
          }}>
            {showForm ? 'Cancel' : '+ Add Expense'}
          </button>
        }
      />

      {/* Add form */}
      {showForm && (() => {
        const qty  = parseFloat(fQty) || 1
        const up   = fUnitPrice !== '' ? parseFloat(fUnitPrice) : null
        const autoAmt = up != null ? (qty * up).toFixed(2) : fAmt
        const canSave = fDesc.trim() && (up != null ? up > 0 : (parseFloat(fAmt) > 0))
        return (
          <div style={{
            padding: '16px 24px',
            background: T.surface2, borderBottom: `1px solid ${T.line}`,
            display: 'grid', gridTemplateColumns: '140px 1fr 70px 100px 110px 130px 110px auto',
            gap: 8, alignItems: 'end', flexShrink: 0,
          }}>
            {/* Category */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Category</div>
              <select value={fCat} onChange={e => setFCat(e.target.value)} style={{
                width: '100%', fontFamily: 'inherit', fontSize: 12,
                background: T.surface, border: `1px solid ${T.line2}`,
                color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none',
              }}>
                {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {/* Description */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Description *</div>
              <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="What was this for?" style={{
                width: '100%', fontFamily: 'inherit', fontSize: 12,
                background: T.surface, border: `1px solid ${T.line2}`,
                color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
            {/* Qty */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Qty</div>
              <input value={fQty} onChange={e => setFQty(e.target.value)} placeholder="1" type="number" min="0.001" step="any" style={{
                width: '100%', fontFamily: T.mono, fontSize: 13,
                background: T.surface, border: `1px solid ${T.line2}`,
                color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
            {/* Unit Price */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Unit ₱</div>
              <input value={fUnitPrice} onChange={e => { setFUnitPrice(e.target.value); setFAmt('') }} placeholder="0.00" type="number" min="0" style={{
                width: '100%', fontFamily: T.mono, fontSize: 13,
                background: T.surface, border: `1px solid ${T.line2}`,
                color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
            {/* Amount — auto-calculated or manual */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>
                Total ₱ {up != null ? <span style={{ color: T.accent }}>auto</span> : '*'}
              </div>
              <input
                value={up != null ? autoAmt : fAmt}
                onChange={e => { if (up == null) setFAmt(e.target.value) }}
                readOnly={up != null}
                placeholder="0.00" type="number" min="0"
                style={{
                  width: '100%', fontFamily: T.mono, fontSize: 13,
                  background: up != null ? T.chip : T.surface,
                  border: `1px solid ${T.line2}`,
                  color: up != null ? T.accent : T.text,
                  borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {/* Paid to */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Paid To</div>
              <input value={fTo} onChange={e => setFTo(e.target.value)} placeholder="Supplier / person" style={{
                width: '100%', fontFamily: 'inherit', fontSize: 12,
                background: T.surface, border: `1px solid ${T.line2}`,
                color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
            {/* Receipt */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Receipt #</div>
              <input value={fRef} onChange={e => setFRef(e.target.value)} placeholder="OR-001" style={{
                width: '100%', fontFamily: T.mono, fontSize: 12,
                background: T.surface, border: `1px solid ${T.line2}`,
                color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
            <button onClick={addExpense} disabled={saving || !canSave} style={{
              padding: '7px 16px', fontSize: 12, fontFamily: 'inherit', fontWeight: 700,
              background: T.accent, color: T.accentInk,
              border: 'none', borderRadius: T.radius, cursor: 'pointer',
              opacity: !canSave ? 0.4 : 1,
            }}>
              Save
            </button>
          </div>
        )
      })()}

      {/* List header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '90px 100px 1fr 120px 100px 100px 80px 36px',
        padding: '0 24px', height: 36, alignItems: 'center',
        borderBottom: `1px solid ${T.line}`, background: T.surface2, flexShrink: 0,
      }}>
        {['Time','Category','Description','Qty × Unit','Paid To','Receipt','Amount',''].map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>
            {h}
          </span>
        ))}
      </div>

      <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '32px 24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>
            No expenses logged today
          </div>
        ) : rows.map((row, i) => {
          const dt = new Date(row.createdAt)
          const time = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
          const qtyUnit = row.unitPrice != null
            ? `${row.qty % 1 === 0 ? row.qty : row.qty.toFixed(3)} × ₱${row.unitPrice.toFixed(2)}`
            : '—'
          return (
            <div key={row.id} style={{
              display: 'grid', gridTemplateColumns: '90px 100px 1fr 120px 100px 100px 80px 36px',
              padding: '0 24px', height: 44, alignItems: 'center',
              borderBottom: `1px solid ${T.line}`,
              background: i % 2 === 0 ? 'transparent' : T.surface,
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: catColor[row.category] ?? T.textDim }}>
                {row.category}
              </span>
              <span style={{ fontSize: 13, color: T.text }}>{row.description}</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>{qtyUnit}</span>
              <span style={{ fontSize: 12, color: T.textDim }}>{row.paidTo ?? '—'}</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>{row.receiptRef ?? '—'}</span>
              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>
                ₱{row.amount.toFixed(2)}
              </span>
              <button onClick={() => deleteExpense(row.id)} style={{
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: `1px solid ${T.bad}33`,
                color: T.bad, borderRadius: T.radius, cursor: 'pointer', fontSize: 14,
              }}>
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* Total footer */}
      {rows.length > 0 && (
        <div style={{
          padding: '12px 24px', borderTop: `1px solid ${T.line}`,
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute }}>
            Total Expenses Today
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>
            {fmtPeso(totalToday)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── OwnerView ─────────────────────────────────────────────────────────────────

type OwnerTab = 'reports' | 'tables' | 'menu' | 'inventory' | 'expenses'

const TABS: { id: OwnerTab; label: string }[] = [
  { id: 'reports',   label: 'Reports'   },
  { id: 'tables',    label: 'Tables'    },
  { id: 'menu',      label: 'Menu'      },
  { id: 'inventory', label: 'Inventory' },
  { id: 'expenses',  label: 'Expenses'  },
]

interface OwnerViewProps {
  tables: TableWithStatus[]
}

export default function OwnerView({ tables }: OwnerViewProps) {
  const [tab, setTab] = useState<OwnerTab>('reports')
  const today = new Date()

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.surface }}>

      {/* ── Owner header ──────────────────────────────────────────────────── */}
      <div style={{
        height: 52, padding: '0 24px', flexShrink: 0,
        background: T.bg, borderBottom: `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        {/* Lock icon */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: T.accent,
        }}>
          <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
            <rect x="3" y="7" width="10" height="7" rx="1" />
            <path d="M5 7V5a3 3 0 016 0v2" />
          </svg>
          Owner
        </div>

        <div style={{ width: 1, height: 20, background: T.line2 }} />

        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute }}>
          {fmtDate(today)}
        </span>

        <div style={{ flex: 1 }} />

        {/* Tab strip */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '5px 16px', fontSize: 12, fontFamily: 'inherit', fontWeight: tab === t.id ? 700 : 400,
              background: tab === t.id ? T.surface2 : 'transparent',
              color:      tab === t.id ? T.text : T.textDim,
              border:     `1px solid ${tab === t.id ? T.line2 : 'transparent'}`,
              borderRadius: T.radius, cursor: 'pointer',
              borderBottom: tab === t.id ? `2px solid ${T.accent}` : `2px solid transparent`,
              transition: 'background 0.12s ease',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'reports'   && <ReportsTab />}
        {tab === 'tables'    && <TablesTab liveTableStatuses={tables} />}
        {tab === 'menu'      && <MenuTab />}
        {tab === 'inventory' && <InventoryTab />}
        {tab === 'expenses'  && <ExpensesTab />}
      </div>
    </div>
  )
}
