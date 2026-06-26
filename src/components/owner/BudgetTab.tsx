'use client'

import { useTheme } from '@/lib/ThemeContext'
import { useState, useCallback, useEffect } from 'react'
import { getClient } from '@/lib/supabase'
import { SectionHd, fmtPeso } from './ownerShared'
import { localDateStr, parseLocalDate, dayBounds, currentShiftDate } from '@/lib/dateNav'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { computeDailyOpex } from './OpexTab'
import type { OpexItem, MonthConfig } from './OpexTab'

// ── Category config ───────────────────────────────────────────────────────────

export const BUDGET_CATS: { id: string; label: string }[] = [ // eslint-disable-line
  { id: 'food',        label: 'Food'           },
  { id: 'beer',        label: 'Beer'           },
  { id: 'cocktails',   label: 'Cocktails/Hard' },
  { id: 'non_alcohol', label: 'Non-Alcohol'    },
  { id: 'cigarettes',  label: 'Cigarettes'     },
  { id: 'opex',        label: 'OPEX'           },
]

// Map menu_items.category → budget cat id
export const SALES_CAT_MAP: Record<string, string> = {
  Chicken: 'food', Meals: 'food', Noodles: 'food', Pork: 'food',
  Seafood: 'food', Starters: 'food', Extra: 'food',
  Beer: 'beer', 'Palit Bote': 'beer',
  Cocktails: 'cocktails', 'Hard Drinks': 'cocktails',
  'Non-Alcohol': 'non_alcohol',
  Cigarettes: 'cigarettes',
}

// Map daily_expenses.category → budget cat id
export const EXP_CAT_MAP: Record<string, string> = {
  OPEX: 'opex', Food: 'food', Beer: 'beer',
  'Cocktails/Hard': 'cocktails', 'Non-Alcohol': 'non_alcohol',
  Cigarettes: 'cigarettes',
}
// Reverse: budget cat id → DB category string (for budget_seed inserts)
const CAT_ID_TO_DB: Record<string, string> = Object.fromEntries(
  Object.entries(EXP_CAT_MAP).map(([db, id]) => [id, db])
)

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayData {
  incoming: Record<string, number>
  expenses: Record<string, number>
}

interface LedgerRow {
  date:       string
  starting:   Record<string, number>
  expenses:   Record<string, number>
  incoming:   Record<string, number>
  ending:     Record<string, number>
  startTotal: number
  expTotal:   number
  incTotal:   number
  endTotal:   number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function emptyBycat(): Record<string, number> {
  return Object.fromEntries(BUDGET_CATS.map(c => [c.id, 0]))
}

function buildLedger(
  allIncoming: Record<string, Record<string, number>>,  // date → catId → amount (COGS)
  allExpenses: Record<string, Record<string, number>>,  // date → catId → amount
  seed: { date: string; balances: Record<string, number> } | null,
  opexItems: OpexItem[],
  opexConfigs: Record<string, MonthConfig>,             // 'YYYY-MM' → config
): LedgerRow[] {
  const allDates = Array.from(new Set([...Object.keys(allIncoming), ...Object.keys(allExpenses)])).sort()
  // Only include dates from seed date onwards
  const seedDate = seed?.date ?? '1970-01-01'
  const dates = allDates.filter(d => d >= seedDate)
  const ledger: LedgerRow[] = []
  const running = seed ? { ...seed.balances } : emptyBycat()

  for (const date of dates) {
    const starting = { ...running }

    // COGS incoming per category
    const cogsBycat = allIncoming[date] ?? emptyBycat()

    // OPEX daily allocation — only allocate if the venue had any activity
    // (sales or expenses). No activity = venue was closed that day.
    const monthKey = date.slice(0, 7) // 'YYYY-MM'
    const dayCfg = opexConfigs[monthKey] ?? null
    const hasActivity = Object.values(allIncoming[date] ?? {}).some(v => v > 0)
                     || Object.values(allExpenses[date] ?? {}).some(v => v > 0)
    const dailyOpex = hasActivity ? computeDailyOpex(opexItems, dayCfg) : 0

    // Merge: product categories get COGS, opex category gets daily allocation
    const incoming: Record<string, number> = { ...cogsBycat, opex: Math.ceil(dailyOpex) }
    const expenses = allExpenses[date] ?? emptyBycat()
    const ending   = emptyBycat()

    for (const c of BUDGET_CATS) {
      ending[c.id]  = starting[c.id] + (incoming[c.id] ?? 0) - (expenses[c.id] ?? 0)
      running[c.id] = ending[c.id]
    }

    ledger.push({
      date, starting, incoming, expenses, ending,
      startTotal: BUDGET_CATS.reduce((s, c) => s + (starting[c.id] ?? 0), 0),
      incTotal:   BUDGET_CATS.reduce((s, c) => s + (incoming[c.id] ?? 0), 0),
      expTotal:   BUDGET_CATS.reduce((s, c) => s + (expenses[c.id] ?? 0), 0),
      endTotal:   BUDGET_CATS.reduce((s, c) => s + ending[c.id], 0),
    })
  }
  return ledger
}

// ── Layout constants ──────────────────────────────────────────────────────────

const COL_W  = 110
const TOT_W  = 130
const DATE_W = 96

// ── Component ─────────────────────────────────────────────────────────────────

export default function BudgetTab() {
  const { T } = useTheme()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'

  const GROUPS_L = [
    { key: 'starting', label: 'Starting', color: T.textDim },
    { key: 'expenses', label: 'Expenses', color: T.bad     },
    { key: 'incoming', label: 'COGS+OPEX', color: T.ok     },
    { key: 'ending',   label: 'Ending',   color: T.accent  },
  ] as const

  const [budgetView, setBudgetView] = useState<'day' | 'ledger'>('day')
  const [date,       setDate]       = useState(() => currentShiftDate())
  const [dayData,    setDayData]    = useState<DayData>({ incoming: emptyBycat(), expenses: emptyBycat() })
  const [prevData,   setPrevData]   = useState<DayData>({ incoming: emptyBycat(), expenses: emptyBycat() })  // cumulative prior days
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])
  const [loading,    setLoading]    = useState(true)

  // Seed state
  const [seed,       setSeed]       = useState<{ date: string; balances: Record<string, number> } | null>(null)
  const [showSeedForm, setShowSeedForm] = useState(false)
  const [seedDate,   setSeedDate]   = useState(() => '2026-06-01')
  const [seedInputs, setSeedInputs] = useState<Record<string, string>>(() => Object.fromEntries(BUDGET_CATS.map(c => [c.id, '0'])))
  const [seedSaving, setSeedSaving] = useState(false)

  // OPEX data for daily allocation
  const [opexItems,   setOpexItems]   = useState<OpexItem[]>([])
  const [opexConfigs, setOpexConfigs] = useState<Record<string, MonthConfig>>({})

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  // ── Shared: accumulate order_items COGS into a catId→amount map ─────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function accumulateItems(rows: any[], out: Record<string, number>) {
    for (const row of rows) {
      const mi  = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
      const cat = SALES_CAT_MAP[mi?.category ?? '']
      if (!cat) continue
      // Use cost (COGS), not unit_price (selling price)
      out[cat] = (out[cat] ?? 0) + (row.qty as number) * ((mi?.cost ?? 0) as number)
    }
  }

  // ── Load seed + OPEX data ────────────────────────────────────────────────
  const fetchSeedAndOpex = useCallback(async () => {
    const [{ data: seedRows }, { data: opexItemRows }, { data: opexCfgRows }] = await Promise.all([
      sb.from('budget_seed').select('*').order('seed_date', { ascending: false }).limit(6),
      sb.from('opex_items').select('*').eq('is_active', true),
      sb.from('opex_monthly_config').select('*'),
    ])

    // Build seed from most recent batch (all rows with the same seed_date)
    if (seedRows && seedRows.length > 0) {
      const latestDate = seedRows[0].seed_date
      const balances: Record<string, number> = emptyBycat()
      for (const r of seedRows) {
        if (r.seed_date !== latestDate) continue
        const catId = EXP_CAT_MAP[r.category]
        if (catId) balances[catId] = r.balance
      }
      setSeed({ date: latestDate, balances })
    }

    // OPEX items
    setOpexItems((opexItemRows ?? []).map((r: any) => ({
      id: r.id, name: r.name, type: r.type, amount: r.amount,
      bandDay: r.band_day ?? null, notes: r.notes ?? null, isActive: r.is_active,
    })))

    // OPEX configs keyed by 'YYYY-MM'
    const cfgMap: Record<string, MonthConfig> = {}
    for (const r of (opexCfgRows ?? [])) {
      const key = `${r.year}-${String(r.month).padStart(2, '0')}`
      cfgMap[key] = { id: r.id, year: r.year, month: r.month, workingDays: r.working_days, fridays: r.fridays, saturdays: r.saturdays }
    }
    setOpexConfigs(cfgMap)
  }, [sb])

  // ── Fetch all-time data for ledger ───────────────────────────────────────
  const fetchLedger = useCallback(async () => {
    const PAGE = 1000
    // Filter from seed date onwards — ledger doesn't need earlier data,
    // and without this filter the query hits the server's default row cap.
    const seedStartISO = seed?.date ? new Date(seed.date).toISOString() : '1970-01-01'

    // Step 1: paginate orders from seed date → date map
    let allOrderRows: any[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from('orders').select('id, opened_at')
        .gte('opened_at', seedStartISO)
        .range(from, from + PAGE - 1)
      if (error) { console.error('[BudgetTab/ledger] orders error', error); break }
      if (!data || data.length === 0) break
      allOrderRows = allOrderRows.concat(data)
      if (data.length < PAGE) break
    }
    const orderDateMap: Record<number, string> = {}
    for (const o of allOrderRows) orderDateMap[o.id] = localDateStr(new Date(o.opened_at))

    // Step 2: paginate order_items for those orders — COGS from menu_items.cost
    const orderIds = Object.keys(orderDateMap).map(Number)
    const allIncoming: Record<string, Record<string, number>> = {}
    if (orderIds.length > 0) {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await sb
          .from('order_items').select('order_id, qty, menu_items(category, cost)')
          .in('order_id', orderIds).neq('status', 'voided')
          .range(from, from + PAGE - 1)
        if (error) { console.error('[BudgetTab/ledger] items error', error); break }
        if (!data || data.length === 0) break
        for (const row of data) {
          const dk = orderDateMap[row.order_id]
          if (!dk) continue
          if (!allIncoming[dk]) allIncoming[dk] = emptyBycat()
          accumulateItems([row], allIncoming[dk])
        }
        if (data.length < PAGE) break
      }
    }

    // Step 3: all expenses
    const { data: expRows, error: expErr } = await sb
      .from('daily_expenses').select('expense_date, category, amount').order('expense_date')
    if (expErr) console.error('[BudgetTab/ledger] expenses error', expErr)
    const allExpenses: Record<string, Record<string, number>> = {}
    for (const r of (expRows ?? [])) {
      const cat = EXP_CAT_MAP[r.category]
      if (!cat) continue
      if (!allExpenses[r.expense_date]) allExpenses[r.expense_date] = emptyBycat()
      allExpenses[r.expense_date][cat] = (allExpenses[r.expense_date][cat] ?? 0) + r.amount
    }

    setLedgerRows(buildLedger(allIncoming, allExpenses, seed, opexItems, opexConfigs))
  }, [sb, seed, opexItems, opexConfigs])

  // ── Fetch data for a single day view ─────────────────────────────────────
  const fetchDay = useCallback(async (d: string) => {
    setLoading(true)
    const { start, end } = dayBounds(d)
    const seedStart = seed?.date ?? '1970-01-01'

    // Today's orders
    const { data: dayOrders, error: dOrdErr } = await sb
      .from('orders').select('id').gte('opened_at', start).lte('opened_at', end)
    if (dOrdErr) console.error('[BudgetTab] day orders error', dOrdErr)
    const dayIds = (dayOrders ?? []).map((o: any) => o.id as number)
    const todayIncoming = emptyBycat()
    if (dayIds.length > 0) {
      const { data: items, error: iErr } = await sb
        .from('order_items').select('order_id, qty, menu_items(category, cost)')
        .in('order_id', dayIds).neq('status', 'voided')
      if (iErr) console.error('[BudgetTab] day items error', iErr)
      accumulateItems(items ?? [], todayIncoming)
    }

    // Today's expenses
    const { data: expRows, error: expErr } = await sb
      .from('daily_expenses').select('category, amount').eq('expense_date', d)
    if (expErr) console.error('[BudgetTab] day expenses error', expErr)
    const todayExpenses = emptyBycat()
    for (const r of (expRows ?? [])) {
      const cat = EXP_CAT_MAP[r.category]
      if (!cat) continue
      todayExpenses[cat] = (todayExpenses[cat] ?? 0) + r.amount
    }

    // OPEX only if venue had activity (sales or expenses) — no activity = closed day
    const monthKey = d.slice(0, 7)
    const dayCfg = opexConfigs[monthKey] ?? null
    const hasSales = dayIds.length > 0
    const hasExpenses = (expRows ?? []).length > 0
    todayIncoming.opex = (hasSales || hasExpenses) ? Math.ceil(computeDailyOpex(opexItems, dayCfg)) : 0

    // Cumulative prior days (from seed date onwards)
    const { data: priorOrders, error: pOrdErr } = await sb
      .from('orders').select('id, opened_at').lt('opened_at', start).gte('opened_at', new Date(seedStart).toISOString())
    if (pOrdErr) console.error('[BudgetTab] prior orders error', pOrdErr)
    const priorIds = (priorOrders ?? []).map((o: any) => o.id as number)
    const priorIncoming = seed ? { ...seed.balances } : emptyBycat()
    if (priorIds.length > 0) {
      const { data: priorItems, error: piErr } = await sb
        .from('order_items').select('order_id, qty, menu_items(category, cost)')
        .in('order_id', priorIds).neq('status', 'voided')
      if (piErr) console.error('[BudgetTab] prior items error', piErr)
      accumulateItems(priorItems ?? [], priorIncoming)
    }

    // Add cumulative OPEX allocation — one allocation per unique operating day
    const priorDates: string[] = [...new Set<string>((priorOrders ?? []).map((o: any) => localDateStr(new Date(o.opened_at as string))))]
    for (const priorDate of priorDates) {
      const priorCfg = opexConfigs[priorDate.slice(0, 7)] ?? null
      priorIncoming.opex = (priorIncoming.opex ?? 0) + Math.ceil(computeDailyOpex(opexItems, priorCfg))
    }

    const { data: priorExp, error: peErr } = await sb
      .from('daily_expenses').select('category, amount').lt('expense_date', d).gte('expense_date', seedStart)
    if (peErr) console.error('[BudgetTab] prior expenses error', peErr)
    const priorExpenses = emptyBycat()
    for (const r of (priorExp ?? [])) {
      const cat = EXP_CAT_MAP[r.category]
      if (!cat) continue
      priorExpenses[cat] = (priorExpenses[cat] ?? 0) + r.amount
    }

    setDayData({ incoming: todayIncoming, expenses: todayExpenses })
    setPrevData({ incoming: priorIncoming, expenses: priorExpenses })
    setLoading(false)
  }, [sb, seed, opexItems, opexConfigs])

  useEffect(() => { fetchSeedAndOpex() }, [fetchSeedAndOpex])
  useEffect(() => { fetchDay(date) }, [fetchDay, date])
  useEffect(() => { fetchLedger() }, [fetchLedger])

  async function saveSeed() {
    setSeedSaving(true)
    // Delete any existing seed rows, then insert new ones
    await sb.from('budget_seed').delete().neq('id', 0)
    const rows = BUDGET_CATS.map(c => ({
      seed_date: seedDate,
      category:  CAT_ID_TO_DB[c.id],
      balance:   parseFloat(seedInputs[c.id] ?? '0') || 0,
    }))
    await sb.from('budget_seed').insert(rows)
    setShowSeedForm(false)
    await fetchSeedAndOpex()
    setSeedSaving(false)
  }

  function shiftDate(days: number) {
    const d = parseLocalDate(date); d.setDate(d.getDate() + days)
    setDate(localDateStr(d))
  }

  const getStarting   = (catId: string) => (prevData.incoming[catId] ?? 0) - (prevData.expenses[catId] ?? 0)
  const totalStarting = BUDGET_CATS.reduce((s, c) => s + getStarting(c.id), 0)
  const totalIncoming = BUDGET_CATS.reduce((s, c) => s + (dayData.incoming[c.id] ?? 0), 0)
  const totalExpenses = BUDGET_CATS.reduce((s, c) => s + (dayData.expenses[c.id] ?? 0), 0)
  const totalEnding   = totalStarting + totalIncoming - totalExpenses

  const fmtSign  = (v: number) => v === 0 ? '—' : fmtPeso(v)
  const todayStr = localDateStr(new Date())

  const actionControls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {budgetView === 'ledger' && ledgerRows.length > 0 && (() => {
        const latest = ledgerRows[ledgerRows.length - 1].endTotal
        return (
          <span style={{
            fontFamily: T.mono, fontSize: 12, fontWeight: 700,
            color: latest >= 0 ? T.ok : T.bad,
            background: latest >= 0 ? `${T.ok}18` : `${T.bad}18`,
            border: `1px solid ${latest >= 0 ? T.ok : T.bad}44`,
            padding: '2px 8px', borderRadius: T.radius,
          }}>
            {fmtPeso(latest)}
          </span>
        )
      })()}
      <div style={{ display: 'flex', gap: 2 }}>
        {(['day', 'ledger'] as const).map(v => (
          <button key={v} onClick={() => setBudgetView(v)} style={{
            padding: '4px 12px', fontSize: 11, fontFamily: 'inherit', fontWeight: budgetView === v ? 600 : 400,
            background: budgetView === v ? T.accent : T.chip,
            color:      budgetView === v ? T.accentInk : T.textDim,
            border: `1px solid ${budgetView === v ? T.accent : T.line2}`,
            borderRadius: T.radius, cursor: 'pointer',
          }}>
            {v === 'day' ? 'Day' : 'Ledger'}
          </button>
        ))}
      </div>
      {budgetView === 'day' && (
        <>
          <button onClick={() => shiftDate(-1)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim, borderRadius: T.radius, cursor: 'pointer', fontSize: 14 }}>‹</button>
          <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={{ fontFamily: T.mono, fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '4px 8px', outline: 'none', cursor: 'pointer' }} />
          <button onClick={() => shiftDate(1)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim, borderRadius: T.radius, cursor: 'pointer', fontSize: 14 }}>›</button>
          {date !== todayStr && (
            <button onClick={() => setDate(todayStr)} style={{ padding: '3px 8px', fontSize: 11, fontFamily: 'inherit', background: T.chip, color: T.textDim, border: `1px solid ${T.line2}`, borderRadius: T.radius, cursor: 'pointer' }}>Today</button>
          )}
        </>
      )}
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {isMobile ? (
        <div style={{ flexShrink: 0, borderBottom: `1px solid ${T.line}` }}>
          {/* Row 1: title + badge */}
          <div style={{ height: 44, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.headerText }}>
              {budgetView === 'day' ? 'Daily Budget' : 'Running Ledger'}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.accent, background: `${T.accent}18`, border: `1px solid ${T.accent}44`, padding: '2px 8px', borderRadius: T.radius }}>
              {budgetView === 'day' ? `Ending ${fmtSign(totalEnding)}` : `${ledgerRows.length} days`}
            </span>
          </div>
          {/* Row 2: controls, h-scrollable */}
          <div className="bp-no-scrollbar" style={{ height: 44, overflowX: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {actionControls}
            </div>
          </div>
        </div>
      ) : (
        <SectionHd
          title={budgetView === 'day' ? 'Daily Budget' : 'Running Ledger'}
          badge={budgetView === 'day' ? `Ending ${fmtSign(totalEnding)}` : `${ledgerRows.length} days`}
          action={actionControls}
        />
      )}

      {/* ── SEED SETUP BANNER ─────────────────────────────────────────────── */}
      {!seed && !showSeedForm && (
        <div style={{ padding: '16px 24px', background: `${T.warn}18`, borderBottom: `1px solid ${T.warn}44`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: T.warn, flex: 1 }}>Set opening balances to start tracking your budget from June 1.</span>
          <button onClick={() => setShowSeedForm(true)} style={{ padding: '6px 16px', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, background: T.warn, color: '#000', border: 'none', borderRadius: T.radius, cursor: 'pointer' }}>
            Set Opening Balance
          </button>
        </div>
      )}

      {/* ── SEED FORM ─────────────────────────────────────────────────────── */}
      {showSeedForm && (
        <div style={{ padding: '16px 24px', background: T.surface2, borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 12 }}>Opening Balances</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
            {BUDGET_CATS.map(c => (
              <div key={c.id}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>{c.label}</div>
                <input
                  value={seedInputs[c.id] ?? '0'}
                  onChange={e => setSeedInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                  type="number" step="0.01"
                  style={{ width: '100%', fontFamily: T.mono, fontSize: 13, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 11, color: T.textMute }}>Seed date:</div>
            <input type="date" value={seedDate} onChange={e => setSeedDate(e.target.value)} style={{ fontFamily: T.mono, fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '4px 8px', outline: 'none' }} />
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowSeedForm(false)} style={{ padding: '6px 14px', fontSize: 12, fontFamily: 'inherit', background: T.chip, color: T.textDim, border: `1px solid ${T.line2}`, borderRadius: T.radius, cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveSeed} disabled={seedSaving} style={{ padding: '6px 16px', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, background: T.accent, color: T.accentInk, border: 'none', borderRadius: T.radius, cursor: 'pointer' }}>Save</button>
          </div>
        </div>
      )}

      {/* ── DAY VIEW ──────────────────────────────────────────────────────── */}
      {budgetView === 'day' && (
        <>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
          ) : (
            <div className="bp-no-scrollbar" style={{ flex: 1, overflow: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
            <div style={{ minWidth: 560 }}>
              {/* Column header */}
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr 1fr', padding: '0 24px', height: 36, alignItems: 'center', borderBottom: `1px solid ${T.line}`, background: T.surface2, position: 'sticky', top: 0, zIndex: 1 }}>
                {['Category', 'Starting', 'COGS+OPEX', 'Expenses', 'Ending'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.headerText }}>{h}</span>
                ))}
              </div>
              {BUDGET_CATS.map((cat, i) => {
                const starting = getStarting(cat.id)
                const incoming = dayData.incoming[cat.id] ?? 0
                const expenses = dayData.expenses[cat.id] ?? 0
                const ending   = starting + incoming - expenses
                return (
                  <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr 1fr', padding: '0 24px', height: 52, alignItems: 'center', borderBottom: `1px solid ${T.line}`, background: i % 2 === 0 ? 'transparent' : T.surface }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{cat.label}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 13, color: starting >= 0 ? T.ok : T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(starting)}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 13, color: incoming > 0 ? T.ok : T.textMute, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(incoming)}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 13, color: expenses > 0 ? T.bad : T.textMute, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(expenses)}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: ending >= 0 ? T.ok : T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(ending)}</span>
                  </div>
                )
              })}
              {/* Totals row — close inner divs after this */}
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr 1fr', padding: '0 24px', height: 52, alignItems: 'center', background: T.surface2 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.headerText }}>Total</span>
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: totalStarting >= 0 ? T.ok : T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalStarting)}</span>
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.ok, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalIncoming)}</span>
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalExpenses)}</span>
                <span style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: totalEnding >= 0 ? T.ok : T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalEnding)}</span>
              </div>
            </div>
            </div>
          )}
          <div style={{ padding: '10px 24px', borderTop: `1px solid ${T.line}`, flexShrink: 0, fontSize: 11, color: T.textMute }}>
            COGS pulled from item cost × qty sold · OPEX allocation from calculator · Expenses from daily logs · Starting balance rolls from seed
          </div>
        </>
      )}

      {/* ── LEDGER VIEW ───────────────────────────────────────────────────── */}
      {budgetView === 'ledger' && (
        <div className="bp-no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'auto', touchAction: 'pan-x pan-y' }}>
          {ledgerRows.length === 0 ? (
            <div style={{ padding: '24px', color: T.textMute, fontFamily: T.mono, fontSize: 13 }}>No data yet — bill out some orders to see data here.</div>
          ) : (() => {
            const reversed = [...ledgerRows].reverse()
            const totalW   = DATE_W + GROUPS_L.length * (BUDGET_CATS.length * COL_W + TOT_W + 1)
            return (
              <div style={{ minWidth: totalW }}>
                {/* Sticky double-header */}
                <div style={{ position: 'sticky', top: 0, zIndex: 3, background: T.surface2 }}>
                  <div style={{ display: 'flex', borderBottom: `1px solid ${T.line}` }}>
                    <div style={{ width: DATE_W, flexShrink: 0, position: 'sticky', left: 0, background: T.surface2, zIndex: 4 }} />
                    {GROUPS_L.map(g => (
                      <div key={g.key} style={{ display: 'flex', borderLeft: `1px solid ${T.line}` }}>
                        <div style={{ width: BUDGET_CATS.length * COL_W + TOT_W, height: 30, display: 'flex', alignItems: 'center', paddingLeft: 14 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: g.color }}>{g.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', borderBottom: `2px solid ${T.line}` }}>
                    <div style={{ width: DATE_W, flexShrink: 0, height: 30, display: 'flex', alignItems: 'center', paddingLeft: 14, position: 'sticky', left: 0, background: T.surface2, zIndex: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.headerText }}>Date</span>
                    </div>
                    {GROUPS_L.map(g => (
                      <div key={g.key} style={{ display: 'flex', borderLeft: `1px solid ${T.line}` }}>
                        {BUDGET_CATS.map(c => (
                          <div key={c.id} style={{ width: COL_W, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: T.textMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                          </div>
                        ))}
                        <div style={{ width: TOT_W, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 14, borderLeft: `1px solid ${T.line2}` }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: g.color }}>Total</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data rows */}
                {reversed.map((row, ri) => {
                  const isToday = row.date === todayStr
                  const rowBg     = isToday ? `${T.accent}0d` : ri % 2 === 0 ? 'transparent' : T.surface
                  const dateCellBg = isToday ? T.bg : ri % 2 === 0 ? T.bg : T.surface
                  return (
                    <div key={row.date} style={{ display: 'flex', borderBottom: `1px solid ${T.line}`, background: rowBg }}>
                      <div style={{ width: DATE_W, flexShrink: 0, height: 42, display: 'flex', alignItems: 'center', paddingLeft: 14, position: 'sticky', left: 0, background: dateCellBg, zIndex: 1, borderRight: `1px solid ${T.line2}` }}>
                        <div>
                          <div style={{ fontFamily: T.mono, fontSize: 12, color: isToday ? T.accent : T.textDim, fontWeight: isToday ? 700 : 400 }}>
                            {`${row.date.slice(5)}/${row.date.slice(2, 4)}`}
                          </div>
                          {isToday && <div style={{ fontSize: 8, color: T.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Today</div>}
                        </div>
                      </div>

                      {GROUPS_L.map(g => {
                        const groupData  = row[g.key] as Record<string, number>
                        const total      = g.key === 'starting' ? row.startTotal : g.key === 'expenses' ? row.expTotal : g.key === 'incoming' ? row.incTotal : row.endTotal
                        const totalColor = (g.key === 'ending' || g.key === 'starting') ? (total >= 0 ? T.ok : T.bad) : g.color
                        return (
                          <div key={g.key} style={{ display: 'flex', borderLeft: `1px solid ${T.line}` }}>
                            {BUDGET_CATS.map(c => {
                              const v         = groupData[c.id] ?? 0
                              const cellColor = (g.key === 'ending' || g.key === 'starting') ? (v >= 0 ? T.ok : T.bad) : v > 0 ? g.color : T.textMute
                              return (
                                <div key={c.id} style={{ width: COL_W, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12 }}>
                                  <span style={{ fontFamily: T.mono, fontSize: 12, color: cellColor, fontVariantNumeric: 'tabular-nums' }}>
                                    {v !== 0 ? fmtPeso(v) : '—'}
                                  </span>
                                </div>
                              )
                            })}
                            <div style={{ width: TOT_W, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 14, borderLeft: `1px solid ${T.line2}` }}>
                              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: totalColor, fontVariantNumeric: 'tabular-nums' }}>
                                {total !== 0 ? fmtPeso(total) : '—'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
