'use client'

import { useState } from 'react'
import { THEME } from '@/lib/theme'
import { useReports } from '@/hooks/useReports'
import type { TableWithStatus } from '@/lib/types'
import type { RevenueBar, TransactionRow } from '@/hooks/useReports'
import { PanelHd } from '@/components/floor/FloorView'

const T = THEME

// ── KPI strip ─────────────────────────────────────────────────────────────────
function KpiStrip({
  todayRevenue, weekRevenue, todayCost, todayExpenses, weekExpenses, txCount,
}: {
  todayRevenue:  number
  weekRevenue:   number
  todayCost:     number
  todayExpenses: number
  weekExpenses:  number
  txCount:       number
}) {
  const fp = (v: number) => `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const todayNet = todayRevenue - todayCost - todayExpenses
  const weekNet  = weekRevenue  - weekExpenses

  const kpis = [
    { label: 'Sales · Today',    value: fp(todayRevenue),  note: `${txCount} orders`,                                                               color: T.accent },
    { label: 'Expenses · Today', value: fp(todayExpenses), note: 'logged today',                                                                    color: T.bad },
    { label: 'Net · Today',      value: fp(todayNet),      note: todayRevenue > 0 ? `${((todayNet/todayRevenue)*100).toFixed(1)}% margin` : '—',    color: todayNet >= 0 ? T.ok : T.bad },
    { label: 'Sales · Week',     value: fp(weekRevenue),   note: 'last 7 days',                                                                     color: T.text },
    { label: 'Expenses · Week',  value: fp(weekExpenses),  note: 'last 7 days',                                                                     color: T.textDim },
    { label: 'Net · Week',       value: fp(weekNet),       note: weekRevenue > 0 ? `${((weekNet/weekRevenue)*100).toFixed(1)}% margin` : '—',        color: weekNet >= 0 ? T.ok : T.bad },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
      height: 100, borderBottom: `1px solid ${T.line}`, flexShrink: 0,
    }}>
      {kpis.map((k, i) => (
        <div key={k.label} style={{
          padding: '16px 24px',
          borderRight: i < 5 ? `1px solid ${T.line}` : 'none',
          borderLeft: i === 3 ? `2px solid ${T.line2}` : 'none',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>
            {k.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: T.mono, letterSpacing: '-0.02em', color: k.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {k.value}
          </div>
          <div style={{ fontSize: 11, color: T.textMute, fontWeight: 500 }}>{k.note}</div>
        </div>
      ))}
    </div>
  )
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function BarChart({ bars }: { bars: RevenueBar[] }) {
  if (bars.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.textMute, fontFamily: T.mono, fontSize: 12,
      }}>
        No data yet
      </div>
    )
  }

  const maxVal = Math.max(...bars.map(b => b.value), 1)

  // 4 horizontal gridlines at 25 / 50 / 75 / 100%
  const gridPcts = [0.25, 0.50, 0.75, 1.00]

  return (
    <div style={{ flex: 1, padding: '16px 28px 0', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Chart area */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {/* Gridlines */}
        {gridPcts.map(pct => (
          <div key={pct} style={{
            position: 'absolute', left: 0, right: 0,
            top: `${(1 - pct) * 100}%`,
            borderTop: `1px solid ${T.line}`,
            pointerEvents: 'none',
          }}>
            <span style={{
              position: 'absolute', right: 0,
              transform: 'translateY(-100%)',
              fontSize: 10, fontFamily: T.mono, color: T.textMute,
              fontVariantNumeric: 'tabular-nums',
              paddingBottom: 2,
            }}>
              ₱{(maxVal * pct).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}

        {/* Bars */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${bars.length}, 1fr)`,
          alignItems: 'flex-end',
          gap: 0,
        }}>
          {bars.map(bar => {
            const heightPct = maxVal > 0 ? (bar.value / maxVal) * 100 : 0
            const barColor  = bar.isPeak ? T.accent : `${T.accent}54`  // 33% alpha ≈ 54 hex

            return (
              <div key={bar.label} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'flex-end', height: '100%',
                paddingBottom: 0,
              }}>
                {/* Value label above bar */}
                {bar.value > 0 && (
                  <div style={{
                    fontFamily: T.mono, fontSize: 9, fontWeight: 600,
                    color: bar.isPeak ? T.accent : T.textMute,
                    fontVariantNumeric: 'tabular-nums',
                    marginBottom: 3, whiteSpace: 'nowrap',
                    letterSpacing: '-0.02em',
                  }}>
                    {bar.value >= 1000
                      ? `${(bar.value / 1000).toFixed(1)}k`
                      : bar.value.toFixed(0)}
                  </div>
                )}

                {/* Bar itself — 70% column width */}
                <div style={{
                  width: '70%',
                  height: heightPct > 0 ? `${heightPct}%` : 2,
                  background:   barColor,
                  borderRadius: `${T.radius} ${T.radius} 0 0`,
                  minHeight:    bar.value > 0 ? 4 : 2,
                  transition:   'height 0.4s ease',
                }} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Label row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${bars.length}, 1fr)`,
        marginTop: 6, paddingBottom: 12,
      }}>
        {bars.map((bar, i) => (
          <div key={bar.label} style={{
            textAlign: 'center',
            fontFamily: T.mono, fontSize: 9, color: T.textMute,
            letterSpacing: '0.04em',
            // For hourly: only show every 3rd label to avoid crowding
            visibility: (bars.length > 12 && i % 3 !== 0) ? 'hidden' : 'visible',
          }}>
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Revenue panel (360px) ─────────────────────────────────────────────────────
function RevenuePanel({
  hourlyBars, weeklyBars, todayRevenue,
}: {
  hourlyBars: RevenueBar[]
  weeklyBars: RevenueBar[]
  todayRevenue: number
}) {
  const [range, setRange] = useState<'today' | 'week'>('today')
  const bars = range === 'today' ? hourlyBars : weeklyBars

  const total = bars.reduce((s, b) => s + b.value, 0)

  return (
    <div style={{
      height: 360, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      borderBottom: `1px solid ${T.line}`,
    }}>
      <PanelHd
        title="Revenue"
        badge={`₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        action={
          <div style={{ display: 'flex', gap: 2 }}>
            {(['today','week'] as const).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                padding: '4px 12px', fontSize: 12, fontFamily: 'inherit',
                background: range === r ? T.accent : T.chip,
                color:      range === r ? T.accentInk : T.textDim,
                border:     `1px solid ${range === r ? T.accent : T.line2}`,
                borderRadius: T.radius, cursor: 'pointer',
                fontWeight: range === r ? 600 : 400, textTransform: 'capitalize',
                transition: 'background 0.12s ease',
              }}>
                {r === 'today' ? 'Today' : 'Week'}
              </button>
            ))}
          </div>
        }
      />
      <BarChart bars={bars} />
    </div>
  )
}

// ── Transactions table ────────────────────────────────────────────────────────
const TX_COLS = '64px 72px 50px 90px 30px 1fr 72px'
const TX_HEADERS = ['Time', 'ID', 'Tbl', 'Server', '×', 'Total', 'Pay']

function TxHeader() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: TX_COLS,
      padding: '0 24px', height: 36, alignItems: 'center',
      borderBottom: `1px solid ${T.line}`,
      flexShrink: 0,
    }}>
      {TX_HEADERS.map(h => (
        <span key={h} style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: T.textMute,
          fontFamily: h === 'Total' ? T.mono : 'inherit',
        }}>
          {h}
        </span>
      ))}
    </div>
  )
}

function TxRow({ tx, even }: { tx: TransactionRow; even: boolean }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: TX_COLS,
      padding: '0 24px', height: 40, alignItems: 'center',
      borderBottom: `1px solid ${T.line}`,
      background: even ? T.surface2 : 'transparent',
      opacity: tx.isRefund ? 0.5 : 1,
    }}>
      {/* Time */}
      <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim, fontVariantNumeric: 'tabular-nums' }}>
        {tx.time}
      </span>

      {/* ID */}
      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>
        #{tx.id}
      </span>

      {/* Table */}
      <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim }}>
        {tx.tableId}
      </span>

      {/* Server */}
      <span style={{ fontSize: 12, color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {tx.server}
      </span>

      {/* Item count */}
      <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute, fontVariantNumeric: 'tabular-nums' }}>
        {tx.itemCount}
      </span>

      {/* Total */}
      <span style={{
        fontFamily: T.mono, fontSize: 13, fontWeight: 600,
        color: tx.isRefund ? T.bad : T.accent,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {tx.isRefund ? '−' : ''}₱{tx.amount.toFixed(2)}
        {tx.isRefund && (
          <span style={{
            marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            color: T.bad, background: `${T.bad}18`, border: `1px solid ${T.bad}44`,
            padding: '1px 5px', borderRadius: T.radius,
          }}>
            REFUND
          </span>
        )}
      </span>

      {/* Method */}
      <span style={{
        fontFamily: T.mono, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: T.textDim,
      }}>
        {tx.method === 'GCASH' ? 'QR' : tx.method}
      </span>
    </div>
  )
}

function TransactionsPanel({ transactions }: { transactions: TransactionRow[] }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PanelHd
        title="Transactions"
        badge={`${transactions.length} today`}
      />
      <TxHeader />
      <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {transactions.length === 0 ? (
          <div style={{
            padding: '32px 24px',
            color: T.textMute, fontFamily: T.mono, fontSize: 12,
          }}>
            No transactions yet today
          </div>
        ) : (
          transactions.map((tx, i) => (
            <TxRow key={tx.id} tx={tx} even={i % 2 === 0} />
          ))
        )}
      </div>
    </div>
  )
}

// ── ReportsView ───────────────────────────────────────────────────────────────
export default function ReportsView({ tables: _tables }: { tables: TableWithStatus[] }) {
  const { todayRevenue, weekRevenue, todayCost, todayExpenses, weekExpenses, txCount, hourlyBars, weeklyBars, transactions } = useReports()

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <KpiStrip
        todayRevenue={todayRevenue}
        weekRevenue={weekRevenue}
        todayCost={todayCost}
        todayExpenses={todayExpenses}
        weekExpenses={weekExpenses}
        txCount={txCount}
      />

      {/* ── Revenue chart (360px) ─────────────────────────────────────────── */}
      <RevenuePanel
        hourlyBars={hourlyBars}
        weeklyBars={weeklyBars}
        todayRevenue={todayRevenue}
      />

      {/* ── Transactions (1fr) ────────────────────────────────────────────── */}
      <TransactionsPanel transactions={transactions} />
    </div>
  )
}
