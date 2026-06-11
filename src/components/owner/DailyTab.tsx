'use client'

import { useTheme } from '@/lib/ThemeContext'
import { useState, useCallback, useEffect } from 'react'
import { getClient } from '@/lib/supabase'
import { SectionHd, fmtPeso } from './ownerShared'
import { localDateStr, shiftLocalDate, parseLocalDate, currentShiftDate } from '@/lib/dateNav'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BUDGET_CATS, SALES_CAT_MAP, EXP_CAT_MAP, emptyBycat } from './BudgetTab'
import { computeDailyOpex } from './OpexTab'
import type { OpexItem, MonthConfig } from './OpexTab'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdjRow {
  id:        number
  amount:    number
  notes:     string
  addedBy:   string
  createdAt: string
}

interface DaySummaryRow {
  date:        string
  starting:    number
  expenses:    number
  sales:       number
  savings:     number
  adjNet:      number
  adjDetails:  AdjRow[]
  ending:      number
  budgetEnd:   number
  vsCash:      number
  cashFlow:    number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const d   = parseLocalDate(from)
  const end = parseLocalDate(to)
  while (d <= end) { dates.push(localDateStr(new Date(d))); d.setDate(d.getDate() + 1) }
  return dates
}

function fmtDate(d: string) {
  const dt = parseLocalDate(d)
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  return `${days[dt.getDay()]} ${d.slice(5)}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DailyTab({ staffName }: { staffName: string }) {
  const { T } = useTheme()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any
  const todayStr = currentShiftDate()

  const [rows,    setRows]    = useState<DaySummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Adjustment form
  const [showAdjForm, setShowAdjForm] = useState(false)
  const [adjDate,  setAdjDate]  = useState(todayStr)
  const [adjAmt,   setAdjAmt]   = useState('')
  const [adjNotes, setAdjNotes] = useState('')
  const [adjBy,    setAdjBy]    = useState(staffName)
  const [adjSaving, setAdjSaving] = useState(false)

  // ── Fetch + compute ledger ──────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)

    const [
      { data: seedRows },
      { data: payRows },
      { data: expRows },
      { data: savRows },
      { data: adjRows },
      { data: budgetSeedRows },
      { data: opexItemRows },
      { data: opexCfgRows },
      { data: allOrders },
    ] = await Promise.all([
      sb.from('daily_summary_seed').select('*').order('created_at', { ascending: false }).limit(1),
      sb.from('payments').select('amount, processed_at'),
      sb.from('daily_expenses').select('expense_date, category, amount'),
      sb.from('partner_remittances').select('remittance_date, total_amount'),
      sb.from('daily_adjustments').select('*').order('adj_date'),
      sb.from('budget_seed').select('*').order('seed_date', { ascending: false }).limit(6),
      sb.from('opex_items').select('*').eq('is_active', true),
      sb.from('opex_monthly_config').select('*'),
      sb.from('orders').select('id, opened_at'),
    ])

    const seed = seedRows?.[0] ?? null
    if (!seed) { setLoading(false); return }

    // ── Group daily data ───────────────────────────────────────────────────

    // Sales: sum payments by shift date (midnight–3 AM counts as previous day)
    const salesByDate: Record<string, number> = {}
    for (const r of (payRows ?? [])) {
      const d = shiftLocalDate(new Date(r.processed_at as string))
      salesByDate[d] = (salesByDate[d] ?? 0) + (r.amount as number)
    }

    // Expenses: sum daily_expenses by date
    const expByDate: Record<string, number> = {}
    for (const r of (expRows ?? [])) {
      expByDate[r.expense_date] = (expByDate[r.expense_date] ?? 0) + (r.amount as number)
    }

    // Savings: sum remittances by date
    const savByDate: Record<string, number> = {}
    for (const r of (savRows ?? [])) {
      savByDate[r.remittance_date] = (savByDate[r.remittance_date] ?? 0) + (r.total_amount as number)
    }

    // Adjustments: group by date with details
    const adjByDate: Record<string, AdjRow[]> = {}
    for (const r of (adjRows ?? [])) {
      if (!adjByDate[r.adj_date]) adjByDate[r.adj_date] = []
      adjByDate[r.adj_date].push({ id: r.id, amount: r.amount, notes: r.notes, addedBy: r.added_by, createdAt: r.created_at })
    }

    // ── Budget ledger computation ──────────────────────────────────────────

    // OPEX setup
    const opexItems: OpexItem[] = (opexItemRows ?? []).map((r: any) => ({
      id: r.id, name: r.name, type: r.type, amount: r.amount,
      bandDay: r.band_day ?? null, notes: r.notes ?? null, isActive: r.is_active,
    }))
    const opexConfigs: Record<string, MonthConfig> = {}
    for (const r of (opexCfgRows ?? [])) {
      const key = `${r.year}-${String(r.month).padStart(2, '0')}`
      opexConfigs[key] = { id: r.id, year: r.year, month: r.month, workingDays: r.working_days, fridays: r.fridays, saturdays: r.saturdays }
    }

    // Budget seed total
    let budgetSeedTotal = 0
    let budgetSeedDate  = seed.seed_date as string
    if (budgetSeedRows && budgetSeedRows.length > 0) {
      const latestBudgetDate = budgetSeedRows[0].seed_date
      budgetSeedDate = latestBudgetDate
      for (const r of budgetSeedRows) {
        if (r.seed_date === latestBudgetDate) budgetSeedTotal += r.balance as number
      }
    }

    // COGS per date (from order_items × menu_items.cost)
    const orderDateMap: Record<number, string> = {}
    for (const o of (allOrders ?? [])) {
      orderDateMap[o.id as number] = localDateStr(new Date(o.opened_at as string))
    }
    const orderIds = Object.keys(orderDateMap).map(Number)
    const cogsByDate: Record<string, number> = {}
    if (orderIds.length > 0) {
      const { data: itemRows } = await sb
        .from('order_items').select('order_id, qty, menu_items(category, cost)')
        .in('order_id', orderIds).neq('status', 'voided')
      for (const row of (itemRows ?? [])) {
        const dk = orderDateMap[row.order_id as number]
        if (!dk) continue
        const mi  = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
        const cat = SALES_CAT_MAP[mi?.category ?? '']
        if (!cat) continue
        cogsByDate[dk] = (cogsByDate[dk] ?? 0) + (row.qty as number) * ((mi?.cost ?? 0) as number)
      }
    }

    // Budget expenses (daily_expenses) per date — total across all categories
    const budgetExpByDate: Record<string, number> = {}
    for (const r of (expRows ?? [])) {
      const cat = EXP_CAT_MAP[r.category]
      if (!cat) continue
      budgetExpByDate[r.expense_date] = (budgetExpByDate[r.expense_date] ?? 0) + (r.amount as number)
    }

    // ── Build daily ledger ─────────────────────────────────────────────────

    const fromDate = seed.seed_date as string
    const dates    = dateRange(fromDate, todayStr)

    const result: DaySummaryRow[] = []
    let runningBalance = seed.seed_balance as number
    let runningBudget  = budgetSeedTotal
    let prevVsCash: number | null = null

    // Pre-compute budget running up to seed date
    // (if budget seed predates daily seed, catch up)
    if (budgetSeedDate < fromDate) {
      const catchupDates = dateRange(budgetSeedDate, dates[0])
      catchupDates.pop() // exclude the first daily date (handled in main loop)
      for (const d of catchupDates) {
        const cogs    = cogsByDate[d] ?? 0
        const bExp    = budgetExpByDate[d] ?? 0
        const hasActivity = cogs > 0 || bExp > 0
        const dayOpex = hasActivity ? Math.ceil(computeDailyOpex(opexItems, opexConfigs[d.slice(0, 7)] ?? null)) : 0
        runningBudget += cogs + dayOpex - bExp
      }
    }

    for (const date of dates) {
      const starting   = runningBalance
      const expenses   = expByDate[date] ?? 0
      const sales      = salesByDate[date] ?? 0
      const savings    = savByDate[date] ?? 0
      const adjDetails = adjByDate[date] ?? []
      const adjNet     = adjDetails.reduce((s, a) => s + a.amount, 0)
      const ending     = starting + sales - expenses - savings + adjNet

      // Budget running total for this day — only allocate OPEX on days with activity
      const cogs    = cogsByDate[date] ?? 0
      const bExp    = budgetExpByDate[date] ?? 0
      const hasActivity = (salesByDate[date] ?? 0) > 0 || (expByDate[date] ?? 0) > 0
      const dayOpex = hasActivity ? Math.ceil(computeDailyOpex(opexItems, opexConfigs[date.slice(0, 7)] ?? null)) : 0
      runningBudget += cogs + dayOpex - bExp
      const budgetEnd = runningBudget

      const vsCash   = ending - budgetEnd
      const cashFlow = prevVsCash === null ? 0 : vsCash - prevVsCash

      result.push({
        date, starting, expenses, sales, savings,
        adjNet, adjDetails, ending,
        budgetEnd, vsCash, cashFlow,
      })

      runningBalance = ending
      prevVsCash     = vsCash
    }

    setRows([...result].reverse()) // most recent first
    setLoading(false)
  }, [sb, todayStr])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function saveAdjustment() {
    const amt = parseFloat(adjAmt)
    if (isNaN(amt) || amt === 0 || !adjNotes.trim() || !adjBy.trim()) return
    setAdjSaving(true)
    await sb.from('daily_adjustments').insert({
      adj_date: adjDate, amount: amt, notes: adjNotes.trim(), added_by: adjBy.trim(),
    })
    setAdjAmt(''); setAdjNotes(''); setShowAdjForm(false)
    await fetchAll()
    setAdjSaving(false)
  }

  async function deleteAdj(id: number) {
    await sb.from('daily_adjustments').delete().eq('id', id)
    await fetchAll()
  }

  const todayRow = rows.find(r => r.date === todayStr)

  const colStyle = (align: 'left' | 'right' = 'right') => ({
    fontFamily: T.mono, fontSize: 12, color: T.textDim,
    fontVariantNumeric: 'tabular-nums' as const,
    textAlign: align,
  })

  const inputStyle = {
    fontFamily: 'inherit', fontSize: 12,
    background: T.surface, border: `1px solid ${T.line2}`,
    color: T.text, borderRadius: T.radius, padding: '6px 8px',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  const COL_WIDTHS = isMobile
    ? '80px 90px 90px 90px 70px 90px 90px 90px 80px 28px'
    : '96px 120px 120px 120px 80px 120px 120px 110px 100px 28px'
  const MIN_W = isMobile ? 780 : 1090

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <SectionHd
        title="Daily Summary"
        badge={todayRow ? `Today ${fmtPeso(todayRow.ending)}` : undefined}
        action={
          <button onClick={() => setShowAdjForm(v => !v)} style={{
            padding: '5px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
            background: showAdjForm ? T.chip : T.accent,
            color: showAdjForm ? T.textDim : T.accentInk,
            border: `1px solid ${showAdjForm ? T.line2 : T.accent}`,
            borderRadius: T.radius, cursor: 'pointer',
          }}>
            {showAdjForm ? 'Cancel' : '+ Adjustment'}
          </button>
        }
      />

      {/* Adjustment form */}
      {showAdjForm && (
        <div style={{ padding: '14px 24px', background: T.surface2, borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 110px 1fr 160px auto', gap: 8, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Date</div>
              <input type="date" value={adjDate} onChange={e => setAdjDate(e.target.value)} style={{ ...inputStyle, width: '100%', fontFamily: T.mono }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Amount ₱ *</div>
              <input value={adjAmt} onChange={e => setAdjAmt(e.target.value)} placeholder="+/−" type="number" step="0.01" style={{ ...inputStyle, width: '100%', fontFamily: T.mono, fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Notes *</div>
              <input value={adjNotes} onChange={e => setAdjNotes(e.target.value)} placeholder="Reason for adjustment" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Added By</div>
              <input value={adjBy} onChange={e => setAdjBy(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <button
              onClick={saveAdjustment}
              disabled={adjSaving || !adjAmt || !adjNotes.trim()}
              style={{
                padding: '7px 18px', fontSize: 12, fontFamily: 'inherit', fontWeight: 700,
                background: T.accent, color: T.accentInk, border: 'none',
                borderRadius: T.radius, cursor: 'pointer',
                opacity: (!adjAmt || !adjNotes.trim()) ? 0.4 : 1,
              }}
            >
              Save
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: T.textMute }}>
            Positive = cash in (e.g. loan received) · Negative = cash out (e.g. correction, transfer)
          </div>
        </div>
      )}

      {/* Table header */}
      <div className="bp-no-scrollbar" style={{ overflowX: 'auto', touchAction: 'pan-x', flexShrink: 0 }}>
        <div style={{ minWidth: MIN_W }}>
          <div style={{
            display: 'grid', gridTemplateColumns: COL_WIDTHS,
            padding: '0 16px', height: 36, alignItems: 'center',
            borderBottom: `1px solid ${T.line}`, background: T.surface2,
          }}>
            {(['Date','Starting','Expenses','Sales','Savings','Ending','Budget','vs Cash','Cash Flow',''] as string[]).map((h, i) => (
              <span key={h || `col-${i}`} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, textAlign: h === 'Date' ? 'left' : 'right' }}>{h}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Table body */}
      <div className="bp-no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'auto', touchAction: 'pan-x pan-y' }}>
        {loading ? (
          <div style={{ padding: 24, color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '32px 24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>No data yet — set opening balance to begin.</div>
        ) : (
          <div style={{ minWidth: MIN_W }}>
            {rows.map((row, i) => {
              const isToday = row.date === todayStr
              const hasAdj  = row.adjDetails.length > 0
              const isOpen  = expanded === row.date

              return (
                <div key={row.date} style={{ borderBottom: `1px solid ${T.line}` }}>
                  {/* Main row */}
                  <div
                    onClick={() => hasAdj && setExpanded(isOpen ? null : row.date)}
                    style={{
                      display: 'grid', gridTemplateColumns: COL_WIDTHS,
                      padding: '0 16px', height: 44, alignItems: 'center',
                      background: isToday ? `${T.accent}0d` : i % 2 === 0 ? 'transparent' : T.surface,
                      cursor: hasAdj ? 'pointer' : 'default',
                    }}
                  >
                    {/* Date */}
                    <div>
                      <div style={{ fontFamily: T.mono, fontSize: 12, color: isToday ? T.accent : T.textDim, fontWeight: isToday ? 700 : 400 }}>
                        {fmtDate(row.date)}
                      </div>
                      {isToday && <div style={{ fontSize: 8, color: T.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Today</div>}
                    </div>

                    {/* Starting */}
                    <span style={{ ...colStyle(), color: T.textDim }}>{fmtPeso(row.starting)}</span>

                    {/* Expenses */}
                    <span style={{ ...colStyle(), color: row.expenses > 0 ? T.bad : T.textMute }}>
                      {row.expenses > 0 ? fmtPeso(row.expenses) : '—'}
                    </span>

                    {/* Sales */}
                    <span style={{ ...colStyle(), color: row.sales > 0 ? T.ok : T.textMute }}>
                      {row.sales > 0 ? fmtPeso(row.sales) : '—'}
                    </span>

                    {/* Savings */}
                    <span style={{ ...colStyle(), color: row.savings > 0 ? T.warn : T.textMute }}>
                      {row.savings > 0 ? fmtPeso(row.savings) : '—'}
                    </span>

                    {/* Ending */}
                    <span style={{ ...colStyle(), fontWeight: 700, fontSize: 13, color: row.ending >= 0 ? T.ok : T.bad }}>
                      {fmtPeso(row.ending)}
                    </span>

                    {/* Budget */}
                    <span style={{ ...colStyle(), color: T.textDim }}>
                      {row.budgetEnd !== 0 ? fmtPeso(row.budgetEnd) : '—'}
                    </span>

                    {/* vs Cash */}
                    <span style={{ ...colStyle(), color: row.vsCash >= 0 ? T.ok : T.bad }}>
                      {row.budgetEnd !== 0 ? (row.vsCash >= 0 ? '+' : '') + fmtPeso(row.vsCash) : '—'}
                    </span>

                    {/* Cash Flow */}
                    <span style={{ ...colStyle(), color: row.cashFlow >= 0 ? T.ok : T.bad }}>
                      {(row.cashFlow >= 0 ? '+' : '') + fmtPeso(row.cashFlow)}
                    </span>

                    {/* Expand toggle */}
                    <span style={{ color: T.textMute, fontSize: 11, textAlign: 'right' }}>
                      {hasAdj ? (isOpen ? '▲' : `▼${row.adjDetails.length}`) : ''}
                    </span>
                  </div>

                  {/* Adjustments detail */}
                  {isOpen && (
                    <div style={{ padding: '10px 16px 12px 96px', background: T.surface2, borderTop: `1px solid ${T.line}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 8 }}>
                        Adjustments
                      </div>
                      {row.adjDetails.map(adj => (
                        <div key={adj.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0', borderBottom: `1px solid ${T.line}` }}>
                          <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: adj.amount >= 0 ? T.ok : T.bad, width: 110, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {adj.amount >= 0 ? '+' : ''}{fmtPeso(adj.amount)}
                          </span>
                          <span style={{ fontSize: 12, color: T.text, flex: 1 }}>{adj.notes}</span>
                          <span style={{ fontSize: 11, color: T.textMute, flexShrink: 0 }}>{adj.addedBy}</span>
                          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute, flexShrink: 0 }}>
                            {new Date(adj.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            onClick={() => deleteAdj(adj.id)}
                            style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${T.bad}33`, color: T.bad, borderRadius: T.radius, cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
