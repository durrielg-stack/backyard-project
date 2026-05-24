'use client'

import { useState, useCallback, useRef } from 'react'
import { THEME } from '@/lib/theme'
import { useReports } from '@/hooks/useReports'
import type { TableWithStatus } from '@/lib/types'
import type { RevenueBar, TransactionRow, ExpenseRow } from '@/hooks/useReports'
import { PanelHd } from '@/components/floor/FloorView'

const T = THEME

function fp(v: number) {
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const catColor: Record<string, string> = {
  'OPEX': T.textDim, 'Food': T.ok, 'Beer': T.warn,
  'Cocktails/Hard': T.accent, 'Non-Alcohol': T.info, 'Cigarettes': T.textMute,
}

// ── Sales KPI strip ────────────────────────────────────────────────────────────
function SalesKpiStrip({ range, todayRevenue, weekRevenue, todayCost, todayExpenses, weekExpenses, txCount, weekTxCount, avgOrder, weekAvgOrder, avgTurnMin, weekAvgTurnMin }: {
  range:          'today' | 'week'
  todayRevenue:   number
  weekRevenue:    number
  todayCost:      number
  todayExpenses:  number
  weekExpenses:   number
  txCount:        number
  weekTxCount:    number
  avgOrder:       number
  weekAvgOrder:   number
  avgTurnMin:     number | null
  weekAvgTurnMin: number | null
}) {
  const isToday = range === 'today'
  const rev     = isToday ? todayRevenue  : weekRevenue
  const exp     = isToday ? todayExpenses : weekExpenses
  const cost    = isToday ? todayCost     : 0
  const net     = rev - cost - exp
  const tx      = isToday ? txCount       : weekTxCount
  const ao      = isToday ? avgOrder      : weekAvgOrder
  const turn    = isToday ? avgTurnMin    : weekAvgTurnMin
  const suffix  = isToday ? 'Today'       : 'Week'

  const kpis = [
    { label: `Sales · ${suffix}`,    value: fp(rev),                                note: `${tx} orders`,                                              color: T.accent },
    { label: `Cost · ${suffix}`,     value: isToday ? fp(cost) : '—',               note: isToday ? 'COGS' : 'Today only',                             color: T.textDim },
    { label: `Net · ${suffix}`,      value: fp(net),                                note: rev > 0 ? `${((net/rev)*100).toFixed(1)}% margin` : '—',     color: net >= 0 ? T.ok : T.bad },
    { label: `Expenses · ${suffix}`, value: fp(exp),                                note: 'logged',                                                    color: T.bad },
    { label: 'Avg Order',            value: ao > 0 ? fp(ao) : '—',                  note: `${tx} closed`,                                              color: T.textDim },
    { label: 'Avg Turn Time',        value: turn != null ? `${turn}m` : '—',        note: 'open → close',                                              color: T.info },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', height: 88, borderBottom: `1px solid ${T.line}`, flexShrink: 0, background: T.bg }}>
      {kpis.map((k, i) => (
        <div key={k.label} style={{
          padding: '10px 18px',
          borderRight: i < 5 ? `1px solid ${T.line}` : 'none',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{k.label}</div>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: T.mono, letterSpacing: '-0.02em', color: k.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.value}</div>
          <div style={{ fontSize: 10, color: T.textMute, fontWeight: 500 }}>{k.note}</div>
        </div>
      ))}
    </div>
  )
}

// ── Expenses KPI strip ─────────────────────────────────────────────────────────
function ExpensesKpiStrip({ range, todayExpenses, weekExpenses, expCatBreakdown }: {
  range:           'today' | 'week'
  todayExpenses:   number
  weekExpenses:    number
  expCatBreakdown: { category: string; today: number; week: number }[]
}) {
  const isToday = range === 'today'
  const total   = isToday ? todayExpenses : weekExpenses
  const suffix  = isToday ? 'Today'       : 'Week'

  const CAT_ORDER = ['OPEX', 'Food', 'Beer', 'Cocktails/Hard', 'Non-Alcohol', 'Cigarettes']
  const catMap = Object.fromEntries(expCatBreakdown.map(c => [c.category, c]))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', height: 88, borderBottom: `1px solid ${T.line}`, flexShrink: 0, background: T.surface }}>
      {CAT_ORDER.map((cat, i) => {
        const c   = catMap[cat] ?? { category: cat, today: 0, week: 0 }
        const val = isToday ? c.today : c.week
        return (
          <div key={cat} style={{
            padding: '10px 18px',
            borderRight: i < 5 ? `1px solid ${T.line}` : 'none',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: catColor[cat] ?? T.textMute }}>{cat}</div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: T.mono, color: val > 0 ? T.bad : T.textMute, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fp(val)}</div>
            <div style={{ fontSize: 10, color: T.textMute }}>{isToday ? `wk ${fp(c.week)}` : `today ${fp(c.today)}`}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Bar chart ──────────────────────────────────────────────────────────────────
function BarChart({ bars, barColor }: { bars: RevenueBar[]; barColor?: string }) {
  if (bars.length === 0) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>No data yet</div>
  }
  const maxVal = Math.max(...bars.map(b => b.value), 1)
  const color  = barColor ?? T.accent

  return (
    <div style={{ flex: 1, padding: '10px 18px 0', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <div key={pct} style={{ position: 'absolute', left: 0, right: 0, top: `${(1-pct)*100}%`, borderTop: `1px solid ${T.line}`, pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', right: 0, transform: 'translateY(-100%)', fontSize: 9, fontFamily: T.mono, color: T.textMute, paddingBottom: 2 }}>
              ₱{(maxVal * pct).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${bars.length}, 1fr)`, alignItems: 'flex-end' }}>
          {bars.map(bar => {
            const h = maxVal > 0 ? (bar.value / maxVal) * 100 : 0
            return (
              <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                {bar.value > 0 && (
                  <div style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 600, color: bar.isPeak ? color : T.textMute, fontVariantNumeric: 'tabular-nums', marginBottom: 2, whiteSpace: 'nowrap' }}>
                    {bar.value >= 1000 ? `${(bar.value/1000).toFixed(1)}k` : bar.value.toFixed(0)}
                  </div>
                )}
                <div style={{ width: '70%', height: h > 0 ? `${h}%` : 2, background: bar.isPeak ? color : `${color}54`, borderRadius: `${T.radius} ${T.radius} 0 0`, minHeight: bar.value > 0 ? 4 : 2, transition: 'height 0.4s ease' }} />
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bars.length}, 1fr)`, marginTop: 4, paddingBottom: 8 }}>
        {bars.map((bar, i) => (
          <div key={bar.label} style={{ textAlign: 'center', fontFamily: T.mono, fontSize: 9, color: T.textMute, visibility: (bars.length > 12 && i % 3 !== 0) ? 'hidden' : 'visible' }}>
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Revenue chart panel ────────────────────────────────────────────────────────
function RevenuePanel({ range, hourlyBars, weeklyBars }: { range: 'today' | 'week'; hourlyBars: RevenueBar[]; weeklyBars: RevenueBar[] }) {
  const bars  = range === 'today' ? hourlyBars : weeklyBars
  const total = bars.reduce((s, b) => s + b.value, 0)
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${T.line}`, minHeight: 0 }}>
      <PanelHd title="Revenue" badge={`₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
      <BarChart bars={bars} />
    </div>
  )
}

// ── Expenses chart panel ───────────────────────────────────────────────────────
function ExpensesChartPanel({ range, expenseDayBars, todayExpenses, weekExpenses }: { range: 'today' | 'week'; expenseDayBars: RevenueBar[]; todayExpenses: number; weekExpenses: number }) {
  const total = range === 'today' ? todayExpenses : weekExpenses
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PanelHd title="Expenses" badge={`₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} badgeColor={T.bad} />
      <BarChart bars={expenseDayBars} barColor={T.bad} />
    </div>
  )
}

// ── Sales transactions list ────────────────────────────────────────────────────
const TX_COLS = '60px 64px 46px 1fr 28px 90px 64px'
const TX_HDRS = ['Time', 'ID', 'Tbl', 'Server', '×', 'Total', 'Pay']

function TransactionsPanel({ transactions }: { transactions: TransactionRow[] }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: `1px solid ${T.line}` }}>
      <PanelHd title="Sales Transactions" badge={`${transactions.length}`} />
      <div style={{ display: 'grid', gridTemplateColumns: TX_COLS, padding: '0 14px', height: 30, alignItems: 'center', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
        {TX_HDRS.map(h => <span key={h} style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>)}
      </div>
      <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {transactions.length === 0 ? (
          <div style={{ padding: '20px 14px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>No transactions</div>
        ) : transactions.map((tx, i) => (
          <div key={tx.id} style={{
            display: 'grid', gridTemplateColumns: TX_COLS,
            padding: '0 14px', height: 36, alignItems: 'center',
            borderBottom: `1px solid ${T.line}`,
            background: i % 2 === 0 ? T.surface2 : 'transparent',
            opacity: tx.isRefund ? 0.55 : 1,
          }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute, fontVariantNumeric: 'tabular-nums' }}>{tx.time}</span>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute }}>#{tx.id}</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>{tx.tableId}</span>
            <span style={{ fontSize: 11, color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.server}</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>{tx.itemCount}</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: tx.isRefund ? T.bad : T.accent, fontVariantNumeric: 'tabular-nums' }}>
              {tx.isRefund ? '−' : ''}₱{tx.amount.toFixed(2)}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.textDim }}>
              {tx.method === 'GCASH' ? 'QR' : tx.method}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Expenses list ──────────────────────────────────────────────────────────────
const EX_COLS = '50px 80px 1fr 80px'
const EX_HDRS = ['Time', 'Category', 'Name', 'Amount']

function ExpensesListPanel({ expenseRows }: { expenseRows: ExpenseRow[] }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PanelHd title="Expenses Transactions" badge={`${expenseRows.length}`} badgeColor={T.bad} />
      <div style={{ display: 'grid', gridTemplateColumns: EX_COLS, padding: '0 14px', height: 30, alignItems: 'center', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
        {EX_HDRS.map(h => <span key={h} style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>)}
      </div>
      <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {expenseRows.length === 0 ? (
          <div style={{ padding: '20px 14px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>No expenses</div>
        ) : expenseRows.map((row, i) => (
          <div key={row.id} style={{
            display: 'grid', gridTemplateColumns: EX_COLS,
            padding: '0 14px', height: 36, alignItems: 'center',
            borderBottom: `1px solid ${T.line}`,
            background: i % 2 === 0 ? T.surface2 : 'transparent',
          }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute, fontVariantNumeric: 'tabular-nums' }}>{row.time}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: catColor[row.category] ?? T.textDim }}>{row.category}</span>
            <span style={{ fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>₱{row.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Drag-resizable split panel ─────────────────────────────────────────────────
function ResizableSplit({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  const [split, setSplit] = useState(50) // percent
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback(() => {
    dragging.current = true
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct  = Math.min(80, Math.max(20, ((e.clientX - rect.left) / rect.width) * 100))
      setSplit(pct)
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ width: `${split}%`, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{left}</div>
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: 5, flexShrink: 0, cursor: 'col-resize',
          background: T.line, transition: 'background 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = T.accent)}
        onMouseLeave={e => (e.currentTarget.style.background = T.line)}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{right}</div>
    </div>
  )
}

// ── ReportsView ────────────────────────────────────────────────────────────────
export default function ReportsView({ tables: _tables }: { tables: TableWithStatus[] }) {
  const [range, setRange] = useState<'today' | 'week'>('today')
  const {
    todayRevenue, weekRevenue, todayCost, todayExpenses, weekExpenses,
    txCount, weekTxCount, avgOrder, weekAvgOrder, avgTurnMin, weekAvgTurnMin,
    hourlyBars, weeklyBars, expenseDayBars,
    transactions, weekTransactions,
    expenseRows, weekExpenseRows,
    expCatBreakdown,
  } = useReports()

  const txRows  = range === 'today' ? transactions  : weekTransactions
  const expRows = range === 'today' ? expenseRows   : weekExpenseRows

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Range toggle ─────────────────────────────────────────────────── */}
      <div style={{
        height: 44, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: `1px solid ${T.line}`, flexShrink: 0, background: T.bg,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute, marginRight: 4 }}>View</span>
        {(['today', 'week'] as const).map(r => (
          <button key={r} onClick={() => setRange(r)} style={{
            padding: '5px 16px', fontSize: 12, fontFamily: 'inherit', fontWeight: range === r ? 700 : 400,
            background: range === r ? T.accent : T.chip,
            color:      range === r ? T.accentInk : T.textDim,
            border:     `1px solid ${range === r ? T.accent : T.line2}`,
            borderRadius: T.radius, cursor: 'pointer',
          }}>
            {r === 'today' ? 'Today' : 'This Week'}
          </button>
        ))}
      </div>

      {/* ── Sales KPI ───────────────────────────────────────────────────── */}
      <SalesKpiStrip
        range={range}
        todayRevenue={todayRevenue} weekRevenue={weekRevenue}
        todayCost={todayCost}
        todayExpenses={todayExpenses} weekExpenses={weekExpenses}
        txCount={txCount} weekTxCount={weekTxCount}
        avgOrder={avgOrder} weekAvgOrder={weekAvgOrder}
        avgTurnMin={avgTurnMin} weekAvgTurnMin={weekAvgTurnMin}
      />

      {/* ── Expenses KPI ─────────────────────────────────────────────────── */}
      <ExpensesKpiStrip
        range={range}
        todayExpenses={todayExpenses} weekExpenses={weekExpenses}
        expCatBreakdown={expCatBreakdown}
      />

      {/* ── Charts row (220px) ───────────────────────────────────────────── */}
      <div style={{ height: 220, display: 'flex', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
        <RevenuePanel range={range} hourlyBars={hourlyBars} weeklyBars={weeklyBars} />
        <ExpensesChartPanel range={range} expenseDayBars={expenseDayBars} todayExpenses={todayExpenses} weekExpenses={weekExpenses} />
      </div>

      {/* ── Resizable lists row ──────────────────────────────────────────── */}
      <ResizableSplit
        left={<TransactionsPanel transactions={txRows} />}
        right={<ExpensesListPanel expenseRows={expRows} />}
      />
    </div>
  )
}
