'use client'

import { useState, useCallback, useEffect } from 'react'
import { getClient } from '@/lib/supabase'
import { T, SectionHd, fmtPeso } from './ownerShared'

export const BUDGET_CATS: { id: string; label: string }[] = [
  { id: 'opex',        label: 'OPEX'           },
  { id: 'food',        label: 'Food'           },
  { id: 'beer',        label: 'Beer'           },
  { id: 'cocktails',   label: 'Cocktails/Hard' },
  { id: 'non_alcohol', label: 'Non-Alcohol'    },
  { id: 'cigarettes',  label: 'Cigarettes'     },
]

interface BudgetEntry { id: number | null; category: string; incoming: number; expenses: number }

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

function buildLedger(allRows: { entry_date: string; category: string; incoming: number; expenses: number }[]): LedgerRow[] {
  const dateMap = new Map<string, Record<string, { incoming: number; expenses: number }>>()
  for (const r of allRows) {
    if (!dateMap.has(r.entry_date)) dateMap.set(r.entry_date, {})
    dateMap.get(r.entry_date)![r.category] = { incoming: r.incoming, expenses: r.expenses }
  }
  const dates = Array.from(dateMap.keys()).sort()

  const ledger: LedgerRow[] = []
  const running: Record<string, number> = {}
  for (const c of BUDGET_CATS) running[c.id] = 0

  for (const date of dates) {
    const dayMap   = dateMap.get(date)!
    const starting: Record<string, number> = { ...running }
    const expenses: Record<string, number> = {}
    const incoming: Record<string, number> = {}
    const ending:   Record<string, number> = {}

    for (const c of BUDGET_CATS) {
      expenses[c.id] = dayMap[c.id]?.expenses ?? 0
      incoming[c.id] = dayMap[c.id]?.incoming ?? 0
      ending[c.id]   = starting[c.id] + incoming[c.id] - expenses[c.id]
      running[c.id]  = ending[c.id]
    }

    ledger.push({
      date, starting, expenses, incoming, ending,
      startTotal: BUDGET_CATS.reduce((s, c) => s + starting[c.id], 0),
      expTotal:   BUDGET_CATS.reduce((s, c) => s + expenses[c.id], 0),
      incTotal:   BUDGET_CATS.reduce((s, c) => s + incoming[c.id], 0),
      endTotal:   BUDGET_CATS.reduce((s, c) => s + ending[c.id],   0),
    })
  }
  return ledger
}

const GROUPS_L = [
  { key: 'starting', label: 'Starting', color: T.textDim },
  { key: 'expenses', label: 'Expenses', color: T.bad     },
  { key: 'incoming', label: 'Incoming', color: T.ok      },
  { key: 'ending',   label: 'Ending',   color: T.accent  },
] as const

const COL_W  = 110
const TOT_W  = 130
const DATE_W = 96

export default function BudgetTab() {
  const [budgetView, setBudgetView] = useState<'day' | 'ledger'>('day')
  const [date,       setDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const [entries,    setEntries]    = useState<BudgetEntry[]>(BUDGET_CATS.map(c => ({ id: null, category: c.id, incoming: 0, expenses: 0 })))
  const [history,    setHistory]    = useState<{ category: string; incoming: number; expenses: number }[]>([])
  const [editCell,   setEditCell]   = useState<{ cat: string; field: 'incoming' | 'expenses' } | null>(null)
  const [editVal,    setEditVal]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  const fetchLedger = useCallback(async () => {
    const { data } = await sb.from('budget_daily').select('entry_date, category, incoming, expenses').order('entry_date')
    setLedgerRows(buildLedger(data ?? []))
  }, [])

  useEffect(() => { fetchLedger() }, [fetchLedger])

  const fetchData = useCallback(async (d: string) => {
    setLoading(true)
    const { data: all } = await sb.from('budget_daily').select('*').lte('entry_date', d)
    const rows: any[] = all ?? []

    const hist      = rows.filter((r: any) => r.entry_date < d)
    const todayRows = rows.filter((r: any) => r.entry_date === d)

    const histMap: Record<string, { incoming: number; expenses: number }> = {}
    for (const r of hist) {
      if (!histMap[r.category]) histMap[r.category] = { incoming: 0, expenses: 0 }
      histMap[r.category].incoming += r.incoming
      histMap[r.category].expenses += r.expenses
    }
    setHistory(BUDGET_CATS.map(c => ({
      category: c.id,
      incoming: histMap[c.id]?.incoming ?? 0,
      expenses: histMap[c.id]?.expenses ?? 0,
    })))

    const todayMap: Record<string, any> = {}
    for (const r of todayRows) todayMap[r.category] = r
    setEntries(BUDGET_CATS.map(c => ({
      id:       todayMap[c.id]?.id   ?? null,
      category: c.id,
      incoming: todayMap[c.id]?.incoming ?? 0,
      expenses: todayMap[c.id]?.expenses ?? 0,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(date) }, [fetchData, date])

  function shiftDate(days: number) {
    const d = new Date(date); d.setDate(d.getDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }

  async function saveCell(cat: string, field: 'incoming' | 'expenses', raw: string) {
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0) { setEditCell(null); return }
    setSaving(true)
    const entry = entries.find(e => e.category === cat)!
    const patch = { [field]: val }

    if (entry.id) {
      await sb.from('budget_daily').update(patch).eq('id', entry.id)
    } else {
      const { data } = await sb.from('budget_daily').insert({
        entry_date: date, category: cat,
        incoming:  field === 'incoming'  ? val : 0,
        expenses:  field === 'expenses'  ? val : 0,
      }).select('id').single()
      setEntries(prev => prev.map(e => e.category === cat ? { ...e, id: data?.id ?? null } : e))
    }
    setEntries(prev => prev.map(e => e.category === cat ? { ...e, [field]: val } : e))
    setEditCell(null); setSaving(false)
    fetchLedger()
  }

  const getStarting    = (cat: string) => { const h = history.find(h => h.category === cat); return h ? h.incoming - h.expenses : 0 }
  const totalStarting  = history.reduce((s, h) => s + h.incoming - h.expenses, 0)
  const totalIncoming  = entries.reduce((s, e) => s + e.incoming, 0)
  const totalExpenses  = entries.reduce((s, e) => s + e.expenses, 0)
  const totalEnding    = totalStarting + totalIncoming - totalExpenses

  function NumCell({ cat, field, value }: { cat: string; field: 'incoming' | 'expenses'; value: number }) {
    const isEdit = editCell?.cat === cat && editCell.field === field
    const color  = field === 'expenses' ? T.bad : T.ok
    if (isEdit) {
      return (
        <input
          autoFocus value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={() => saveCell(cat, field, editVal)}
          onKeyDown={e => {
            if (e.key === 'Enter') saveCell(cat, field, editVal)
            if (e.key === 'Escape') setEditCell(null)
          }}
          style={{
            width: 100, fontFamily: T.mono, fontSize: 13, fontWeight: 600,
            background: T.surface, border: `1px solid ${color}88`,
            color: T.text, borderRadius: T.radius, padding: '2px 6px', outline: 'none',
          }}
        />
      )
    }
    return (
      <span
        onClick={() => { setEditCell({ cat, field }); setEditVal(value > 0 ? value.toFixed(2) : '') }}
        title="Click to edit"
        style={{
          fontFamily: T.mono, fontSize: 13, fontWeight: value > 0 ? 600 : 400,
          color: value > 0 ? color : T.textMute,
          fontVariantNumeric: 'tabular-nums', cursor: 'pointer',
          borderBottom: `1px dashed ${value > 0 ? color + '44' : T.line2}`,
        }}
      >
        {value > 0 ? fmtPeso(value) : '—'}
      </span>
    )
  }

  const fmtSign = (v: number) => v === 0 ? '—' : fmtPeso(v)
  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      <SectionHd
        title={budgetView === 'day' ? 'Daily Budget' : 'Running Ledger'}
        badge={budgetView === 'day' ? `Ending ${fmtSign(totalEnding)}` : `${ledgerRows.length} days`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {(['day', 'ledger'] as const).map(v => (
                <button key={v} onClick={() => setBudgetView(v)} style={{
                  padding: '4px 12px', fontSize: 11, fontFamily: 'inherit', fontWeight: budgetView === v ? 600 : 400,
                  background: budgetView === v ? T.accent : T.chip,
                  color:      budgetView === v ? T.accentInk : T.textDim,
                  border: `1px solid ${budgetView === v ? T.accent : T.line2}`,
                  borderRadius: T.radius, cursor: 'pointer', textTransform: 'capitalize',
                }}>
                  {v === 'day' ? 'Day' : 'Ledger'}
                </button>
              ))}
            </div>
            {budgetView === 'day' && (
              <>
                <button onClick={() => shiftDate(-1)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim, borderRadius: T.radius, cursor: 'pointer', fontSize: 14 }}>‹</button>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ fontFamily: T.mono, fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '4px 8px', outline: 'none', cursor: 'pointer' }} />
                <button onClick={() => shiftDate(1)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.chip, border: `1px solid ${T.line2}`, color: T.textDim, borderRadius: T.radius, cursor: 'pointer', fontSize: 14 }}>›</button>
                {saving && <span style={{ fontSize: 11, color: T.textMute, fontFamily: T.mono }}>saving…</span>}
              </>
            )}
          </div>
        }
      />

      {/* DAY VIEW */}
      {budgetView === 'day' && (<>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr 1fr', padding: '0 24px', height: 36, alignItems: 'center', borderBottom: `1px solid ${T.line}`, background: T.surface2, flexShrink: 0 }}>
          {['Category', 'Starting', 'Incoming', 'Expenses', 'Ending'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>
          ))}
        </div>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
        ) : (
          <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
            {BUDGET_CATS.map((cat, i) => {
              const entry    = entries.find(e => e.category === cat.id)!
              const starting = getStarting(cat.id)
              const ending   = starting + entry.incoming - entry.expenses
              return (
                <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr 1fr', padding: '0 24px', height: 52, alignItems: 'center', borderBottom: `1px solid ${T.line}`, background: i % 2 === 0 ? 'transparent' : T.surface }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{cat.label}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 13, color: starting >= 0 ? T.ok : T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(starting)}</span>
                  <NumCell cat={cat.id} field="incoming" value={entry.incoming} />
                  <NumCell cat={cat.id} field="expenses" value={entry.expenses} />
                  <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: ending >= 0 ? T.ok : T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(ending)}</span>
                </div>
              )
            })}
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr 1fr', padding: '0 24px', height: 52, alignItems: 'center', borderBottom: `1px solid ${T.line}`, background: T.surface2 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textMute }}>Total</span>
              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: totalStarting >= 0 ? T.ok : T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalStarting)}</span>
              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.ok, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalIncoming)}</span>
              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalExpenses)}</span>
              <span style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: totalEnding >= 0 ? T.ok : T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtSign(totalEnding)}</span>
            </div>
          </div>
        )}
        <div style={{ padding: '10px 24px', borderTop: `1px solid ${T.line}`, flexShrink: 0, fontSize: 11, color: T.textMute }}>
          Click any Incoming or Expenses value to edit · Starting balance carried from all prior days
        </div>
      </>)}

      {/* LEDGER VIEW */}
      {budgetView === 'ledger' && (
        <div className="bp-no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {ledgerRows.length === 0 ? (
            <div style={{ padding: '24px', color: T.textMute, fontFamily: T.mono, fontSize: 13 }}>No data yet</div>
          ) : (() => {
            const reversed = [...ledgerRows].reverse()
            const totalW = DATE_W + GROUPS_L.length * (BUDGET_CATS.length * COL_W + TOT_W + 1)
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
                  const rowBg   = isToday ? `${T.accent}0d` : ri % 2 === 0 ? 'transparent' : T.surface
                  return (
                    <div key={row.date} style={{ display: 'flex', borderBottom: `1px solid ${T.line}`, background: rowBg }}>
                      <div style={{ width: DATE_W, flexShrink: 0, height: 42, display: 'flex', alignItems: 'center', paddingLeft: 14, position: 'sticky', left: 0, background: rowBg, zIndex: 1, borderRight: `1px solid ${T.line2}` }}>
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
