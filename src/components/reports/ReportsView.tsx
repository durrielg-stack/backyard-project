'use client'

import { useCallback, useRef } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useReports } from '@/hooks/useReports'
import type { TableWithStatus } from '@/lib/types'
import type { RevenueBar, TransactionRow, VoidedRow, ExpenseRow } from '@/hooks/useReports'
import { PanelHd } from '@/components/floor/FloorView'
import StockAlertsStrip from '@/components/floor/InventoryPanel'
import DateRangeNav, { useDateNav } from '@/components/shared/DateRangeNav'
import { dayBounds, weekBounds, monthBounds } from '@/lib/dateNav'
import { useState } from 'react'

function fp(v: number) {
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getCatColor(T: ReturnType<typeof useTheme>['T']): Record<string, string> {
  return {
    'OPEX': T.textDim, 'Food': T.ok, 'Beer': T.warn,
    'Cocktails/Hard': T.accent, 'Non-Alcohol': T.info, 'Cigarettes': T.textMute,
  }
}

// ── Sales KPI strip ────────────────────────────────────────────────────────────
function SalesKpiStrip({ suffix, revenue, cost, expenses, txCount, avgOrder, avgTurnMin }: {
  suffix:     string
  revenue:    number
  cost:       number
  expenses:   number
  txCount:    number
  avgOrder:   number
  avgTurnMin: number | null
}) {
  const { T } = useTheme()
  const net = revenue - cost - expenses

  const kpis = [
    { label: `Sales · ${suffix}`,    value: fp(revenue),                             note: `${txCount} orders`,                                           color: T.accent },
    { label: `Cost · ${suffix}`,     value: fp(cost),                                note: 'COGS',                                                        color: T.textDim },
    { label: `Net · ${suffix}`,      value: fp(net),                                 note: revenue > 0 ? `${((net/revenue)*100).toFixed(1)}% margin` : '—', color: net >= 0 ? T.ok : T.bad },
    { label: `Expenses · ${suffix}`, value: fp(expenses),                            note: 'logged',                                                      color: T.bad },
    { label: 'Avg Order',            value: avgOrder > 0 ? fp(avgOrder) : '—',       note: `${txCount} closed`,                                           color: T.textDim },
    { label: 'Avg Turn Time',        value: avgTurnMin != null ? `${avgTurnMin}m` : '—', note: 'open → close',                                            color: T.info },
  ]

  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  return (
    <div className="bp-no-scrollbar" style={{ display: isMobile ? 'flex' : 'grid', gridTemplateColumns: isMobile ? undefined : 'repeat(6, 1fr)', overflowX: isMobile ? 'auto' : undefined, WebkitOverflowScrolling: 'touch', height: isMobile ? 'auto' : 88, borderBottom: `1px solid ${T.line}`, flexShrink: 0, background: T.bg }}>
      {kpis.map((k) => (
        <div key={k.label} style={{
          padding: '10px 18px',
          borderRight: `1px solid ${T.line}`,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minWidth: isMobile ? 140 : undefined, flexShrink: 0,
          gap: isMobile ? 4 : undefined,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute, whiteSpace: 'nowrap' }}>{k.label}</div>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: T.mono, letterSpacing: '-0.02em', color: k.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.value}</div>
          <div style={{ fontSize: 10, color: T.textMute, fontWeight: 500 }}>{k.note}</div>
        </div>
      ))}
    </div>
  )
}

// ── Expenses KPI strip ─────────────────────────────────────────────────────────
function ExpensesKpiStrip({ expenses, expCatBreakdown }: {
  expenses:        number
  expCatBreakdown: { category: string; amount: number }[]
}) {
  const { T } = useTheme()
  const catMap = Object.fromEntries(expCatBreakdown.map(c => [c.category, c]))

  const CAT_ORDER = ['OPEX', 'Food', 'Beer', 'Cocktails/Hard', 'Non-Alcohol', 'Cigarettes']

  const bp2 = useBreakpoint()
  const isMobile2 = bp2 === 'mobile'
  return (
    <div className="bp-no-scrollbar" style={{ display: isMobile2 ? 'flex' : 'grid', gridTemplateColumns: isMobile2 ? undefined : 'repeat(6, 1fr)', overflowX: isMobile2 ? 'auto' : undefined, WebkitOverflowScrolling: 'touch', height: isMobile2 ? 'auto' : 88, borderBottom: `1px solid ${T.line}`, flexShrink: 0, background: T.surface }}>
      {CAT_ORDER.map((cat) => {
        const c   = catMap[cat] ?? { category: cat, amount: 0 }
        const val = c.amount
        return (
          <div key={cat} style={{
            padding: '10px 18px',
            borderRight: `1px solid ${T.line}`,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            minWidth: isMobile2 ? 130 : undefined, flexShrink: 0,
            gap: isMobile2 ? 4 : undefined,
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: getCatColor(T)[cat] ?? T.textMute }}>{cat}</div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: T.mono, color: val > 0 ? T.bad : T.textMute, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fp(val)}</div>
            <div style={{ fontSize: 10, color: T.textMute }}>{fp(expenses)} total</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Bar chart ──────────────────────────────────────────────────────────────────
function BarChart({ bars, barColor }: { bars: RevenueBar[]; barColor?: string }) {
  const { T } = useTheme()
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
function RevenuePanel({ bars }: { bars: RevenueBar[] }) {
  const { T } = useTheme()
  const total = bars.reduce((s, b) => s + b.value, 0)
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${T.line}`, minHeight: 0 }}>
      <PanelHd title="Revenue" badge={`₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
      <BarChart bars={bars} />
    </div>
  )
}

// ── Expenses chart panel ───────────────────────────────────────────────────────
function ExpensesChartPanel({ expenseDayBars, expenses }: { expenseDayBars: RevenueBar[]; expenses: number }) {
  const { T } = useTheme()
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PanelHd title="Expenses" badge={`₱${expenses.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} badgeColor={T.bad} />
      <BarChart bars={expenseDayBars} barColor={T.bad} />
    </div>
  )
}

// ── Sales transactions list ────────────────────────────────────────────────────
const TX_COLS  = '60px 64px 46px 1fr 28px 90px 64px'
const TX_HDRS  = ['Time', 'ID', 'Tbl', 'Server', '×', 'Total', 'Pay']
const VOD_COLS = '60px 46px 1fr 40px 80px 1fr'
const VOD_HDRS = ['Time', 'Tbl', 'Item', 'Qty', 'Amount', 'Reason']

type TxTab = 'sales' | 'voided'

function TransactionsPanel({ transactions, voidedRows }: { transactions: TransactionRow[]; voidedRows: VoidedRow[] }) {
  const { T } = useTheme()
  const [tab, setTab] = useState<TxTab>('sales')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: `1px solid ${T.line}` }}>
      {/* Header with toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', height: 36, borderBottom: `1px solid ${T.line}`, flexShrink: 0, background: T.surface }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['sales', 'voided'] as TxTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '3px 10px', fontSize: 10, fontWeight: 700,
                borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                border: `1px solid ${tab === t ? (t === 'voided' ? T.bad : T.accent) : T.line2}`,
                background: tab === t ? (t === 'voided' ? `${T.bad}18` : `${T.accent}18`) : 'transparent',
                color: tab === t ? (t === 'voided' ? T.bad : T.accent) : T.textMute,
              }}
            >
              {t === 'sales' ? `Sales (${transactions.length})` : `Voided (${voidedRows.length})`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'sales' ? (
        <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ minWidth: 420 }}>
            <div style={{ display: 'grid', gridTemplateColumns: TX_COLS, padding: '0 14px', height: 30, alignItems: 'center', borderBottom: `1px solid ${T.line}`, flexShrink: 0, position: 'sticky', top: 0, background: T.surface2, zIndex: 1 }}>
              {TX_HDRS.map(h => <span key={h} style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>)}
            </div>
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
      ) : (
        <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ minWidth: 420 }}>
            <div style={{ display: 'grid', gridTemplateColumns: VOD_COLS, padding: '0 14px', height: 30, alignItems: 'center', borderBottom: `1px solid ${T.line}`, flexShrink: 0, position: 'sticky', top: 0, background: T.surface2, zIndex: 1 }}>
              {VOD_HDRS.map(h => <span key={h} style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>)}
            </div>
            {voidedRows.length === 0 ? (
              <div style={{ padding: '20px 14px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>No voided items</div>
            ) : voidedRows.map((row, i) => (
              <div key={row.id} style={{
                display: 'grid', gridTemplateColumns: VOD_COLS,
                padding: '0 14px', height: 36, alignItems: 'center',
                borderBottom: `1px solid ${T.line}`,
                background: i % 2 === 0 ? T.surface2 : 'transparent',
              }}>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute, fontVariantNumeric: 'tabular-nums' }}>{row.time}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>{row.tableId}</span>
                <span style={{ fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.itemName}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>×{row.qty}</span>
                <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>₱{row.amount.toFixed(2)}</span>
                <span style={{ fontSize: 10, color: T.textMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.reason ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Expenses list ──────────────────────────────────────────────────────────────
const EX_COLS = '50px 80px 1fr 80px'
const EX_HDRS = ['Time', 'Category', 'Name', 'Amount']

function ExpensesListPanel({ expenseRows }: { expenseRows: ExpenseRow[] }) {
  const { T } = useTheme()
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PanelHd title="Expenses Transactions" badge={`${expenseRows.length}`} badgeColor={T.bad} />
      <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: 300 }}>
        <div style={{ display: 'grid', gridTemplateColumns: EX_COLS, padding: '0 14px', height: 30, alignItems: 'center', borderBottom: `1px solid ${T.line}`, flexShrink: 0, position: 'sticky', top: 0, background: T.surface2, zIndex: 1 }}>
          {EX_HDRS.map(h => <span key={h} style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>)}
        </div>
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
            <span style={{ fontSize: 10, fontWeight: 600, color: getCatColor(T)[row.category] ?? T.textDim }}>{row.category}</span>
            <span style={{ fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>₱{row.amount.toFixed(2)}</span>
          </div>
        ))}
        </div>
      </div>
    </div>
  )
}

// ── Drag-resizable split panel ─────────────────────────────────────────────────
function ResizableSplit({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  const { T } = useTheme()
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
  const { T } = useTheme()
  const nav = useDateNav()

  // Compute bounds from nav state
  const { start, end } = nav.mode === 'today'
    ? dayBounds(nav.date)
    : nav.mode === 'week'
    ? weekBounds(nav.weekRef)
    : monthBounds(nav.year, nav.month)

  const {
    revenue, cost, expenses, txCount, avgOrder, avgTurnMin,
    bars, expenseDayBars,
    transactions, voidedRows, expenseRows,
    expCatBreakdown,
  } = useReports({ start, end, mode: nav.mode })

  const suffix = nav.mode === 'today' ? 'Today' : nav.mode === 'week' ? 'Week' : 'Month'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Date range nav ───────────────────────────────────────────────── */}
      <div style={{
        height: 44, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: `1px solid ${T.line}`, flexShrink: 0, background: T.bg,
      }}>
        <DateRangeNav
          mode={nav.mode}
          date={nav.date}
          weekRef={nav.weekRef}
          month={nav.month}
          year={nav.year}
          onModeChange={nav.setMode}
          onDateChange={nav.setDate}
          onWeekChange={nav.setWeekRef}
          onMonthChange={nav.setMonth}
        />
      </div>

      {/* ── Sales KPI ───────────────────────────────────────────────────── */}
      <SalesKpiStrip
        suffix={suffix}
        revenue={revenue}
        cost={cost}
        expenses={expenses}
        txCount={txCount}
        avgOrder={avgOrder}
        avgTurnMin={avgTurnMin}
      />

      {/* ── Expenses KPI ─────────────────────────────────────────────────── */}
      <ExpensesKpiStrip
        expenses={expenses}
        expCatBreakdown={expCatBreakdown}
      />

      {/* ── Charts row (220px) ───────────────────────────────────────────── */}
      <div style={{ height: 220, display: 'flex', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
        <RevenuePanel bars={bars} />
        <ExpensesChartPanel expenseDayBars={expenseDayBars} expenses={expenses} />
      </div>

      {/* ── Resizable lists row ──────────────────────────────────────────── */}
      <ResizableSplit
        left={<TransactionsPanel transactions={transactions} voidedRows={voidedRows} />}
        right={<ExpensesListPanel expenseRows={expenseRows} />}
      />

      {/* ── Stock alerts strip ───────────────────────────────────────────── */}
      <StockAlertsStrip />
    </div>
  )
}
