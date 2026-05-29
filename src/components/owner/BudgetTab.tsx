'use client'

import { useTheme } from '@/lib/ThemeContext'
import { useState, useCallback, useEffect } from 'react'
import { getClient } from '@/lib/supabase'
import { SectionHd, fmtPeso } from './ownerShared'
import { localDateStr, parseLocalDate, dayBounds, currentShiftDate } from '@/lib/dateNav'
import { useBreakpoint } from '@/hooks/useBreakpoint'

// ── Category config ───────────────────────────────────────────────────────────

export const BUDGET_CATS: { id: string; label: string }[] = [
  { id: 'food',        label: 'Food'           },
  { id: 'beer',        label: 'Beer'           },
  { id: 'cocktails',   label: 'Cocktails/Hard' },
  { id: 'non_alcohol', label: 'Non-Alcohol'    },
  { id: 'cigarettes',  label: 'Cigarettes'     },
  { id: 'opex',        label: 'OPEX'           },
]

// Map menu_items.category → budget cat id
const SALES_CAT_MAP: Record<string, string> = {
  Chicken: 'food', Meals: 'food', Noodles: 'food', Pork: 'food',
  Seafood: 'food', Starters: 'food', Extra: 'food',
  Beer: 'beer',
  Cocktails: 'cocktails', 'Hard Drinks': 'cocktails',
  'Non-Alcohol': 'non_alcohol',
  Cigarettes: 'cigarettes',
}

// Map daily_expenses.category → budget cat id
const EXP_CAT_MAP: Record<string, string> = {
  OPEX: 'opex', Food: 'food', Beer: 'beer',
  'Cocktails/Hard': 'cocktails', 'Non-Alcohol': 'non_alcohol',
  Cigarettes: 'cigarettes',
}

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

function emptyBycat(): Record<string, number> {
  return Object.fromEntries(BUDGET_CATS.map(c => [c.id, 0]))
}

function buildLedger(
  allIncoming: Record<string, Record<string, number>>,  // date → catId → amount
  allExpenses: Record<string, Record<string, number>>,  // date → catId → amount
): LedgerRow[] {
  const dates = Array.from(new Set([...Object.keys(allIncoming), ...Object.keys(allExpenses)])).sort()
  const ledger: LedgerRow[] = []
  const running = emptyBycat()

  for (const date of dates) {
    const starting = { ...running }
    const incoming = allIncoming[date] ?? emptyBycat()
    const expenses = allExpenses[date] ?? emptyBycat()
    const ending   = emptyBycat()

    for (const c of BUDGET_CATS) {
      ending[c.id]   = starting[c.id] + (incoming[c.id] ?? 0) - (expenses[c.id] ?? 0)
      running[c.id]  = ending[c.id]
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
    { key: 'incoming', label: 'Sales',    color: T.ok      },
    { key: 'ending',   label: 'Ending',   color: T.accent  },
  ] as const

  const [budgetView, setBudgetView] = useState<'day' | 'ledger'>('day')
  const [date,       setDate]       = useState(() => currentShiftDate())
  const [dayData,    setDayData]    = useState<DayData>({ incoming: emptyBycat(), expenses: emptyBycat() })
  const [prevData,   setPrevData]   = useState<DayData>({ incoming: emptyBycat(), expenses: emptyBycat() })  // cumulative prior days
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])
  const [loading,    setLoading]    = useState(true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  // ── Shared: accumulate order_items into a catId→amount map ──────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function accumulateItems(rows: any[], out: Record<string, number>) {
    for (const row of rows) {
      const mi  = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
      const cat = SALES_CAT_MAP[mi?.category ?? '']
      if (!cat) continue
      out[cat] = (out[cat] ?? 0) + (row.qty as number) * (row.unit_price as number)
    }
  }

  // ── Fetch all-time data for ledger ───────────────────────────────────────
  const fetchLedger = useCallback(async () => {
    // Step 1: all orders → date map
    const { data: allOrders, error: ordErr } = await sb.from('orders').select('id, opened_at')
    if (ordErr) console.error('[BudgetTab/ledger] orders error', ordErr)
    const orderDateMap: Record<number, string> = {}
    for (const o of (allOrders ?? [])) orderDateMap[o.id] = localDateStr(new Date(o.opened_at))

    // Step 2: all order_items
    const orderIds = Object.keys(orderDateMap).map(Number)
    const allIncoming: Record<string, Record<string, number>> = {}
    if (orderIds.length > 0) {
      const { data: items, error: itemsErr } = await sb
        .from('order_items').select('order_id, qty, unit_price, menu_items(category)')
        .in('order_id', orderIds).neq('status', 'voided')
      if (itemsErr) console.error('[BudgetTab/ledger] items error', itemsErr)
      for (const row of (items ?? [])) {
        const dk = orderDateMap[row.order_id]
        if (!dk) continue
        if (!allIncoming[dk]) allIncoming[dk] = emptyBycat()
        accumulateItems([row], allIncoming[dk])
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

    setLedgerRows(buildLedger(allIncoming, allExpenses))
  }, [sb])

  // ── Fetch data for a single day view ─────────────────────────────────────
  const fetchDay = useCallback(async (d: string) => {
    setLoading(true)
    const { start, end } = dayBounds(d)

    // Today's orders
    const { data: dayOrders, error: dOrdErr } = await sb
      .from('orders').select('id').gte('opened_at', start).lte('opened_at', end)
    if (dOrdErr) console.error('[BudgetTab] day orders error', dOrdErr)
    const dayIds = (dayOrders ?? []).map((o: any) => o.id as number)
    const todayIncoming = emptyBycat()
    if (dayIds.length > 0) {
      const { data: items, error: iErr } = await sb
        .from('order_items').select('order_id, qty, unit_price, menu_items(category)')
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

    // Cumulative prior days
    const { data: priorOrders, error: pOrdErr } = await sb
      .from('orders').select('id').lt('opened_at', start)
    if (pOrdErr) console.error('[BudgetTab] prior orders error', pOrdErr)
    const priorIds = (priorOrders ?? []).map((o: any) => o.id as number)
    const priorIncoming = emptyBycat()
    if (priorIds.length > 0) {
      const { data: priorItems, error: piErr } = await sb
        .from('order_items').select('order_id, qty, unit_price, menu_items(category)')
        .in('order_id', priorIds).neq('status', 'voided')
      if (piErr) console.error('[BudgetTab] prior items error', piErr)
      accumulateItems(priorItems ?? [], priorIncoming)
    }

    const { data: priorExp, error: peErr } = await sb
      .from('daily_expenses').select('category, amount').lt('expense_date', d)
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
  }, [sb])

  useEffect(() => { fetchDay(date) }, [fetchDay, date])
  useEffect(() => { fetchLedger() }, [fetchLedger])

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
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>
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
                {['Category', 'Starting', 'Sales', 'Expenses', 'Ending'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>
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
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textMute }}>Total</span>
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: totalStarting >= 0 ? T.ok : T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalStarting)}</span>
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.ok, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalIncoming)}</span>
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalExpenses)}</span>
                <span style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: totalEnding >= 0 ? T.ok : T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalEnding)}</span>
              </div>
            </div>
            </div>
          )}
          <div style={{ padding: '10px 24px', borderTop: `1px solid ${T.line}`, flexShrink: 0, fontSize: 11, color: T.textMute }}>
            Sales and expenses pulled automatically from transactions · Starting balance carried from all prior days
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
                      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.textMute }}>Date</span>
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
