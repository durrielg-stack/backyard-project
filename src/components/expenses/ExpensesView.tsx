'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/lib/ThemeContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { getClient } from '@/lib/supabase'
import DateRangeNav, { useDateNav } from '@/components/shared/DateRangeNav'
import { localDateStr, dayBounds, weekBounds, monthBounds } from '@/lib/dateNav'
import { useSortable } from '@/lib/useSortable'


const EXPENSE_CATS = ['OPEX', 'Food', 'Beer', 'Cocktails/Hard', 'Non-Alcohol', 'Cigarettes'] as const

const UOM_OPTIONS = ['pcs','kg','g','ltr','ml','box','pack','bag','bottle','case','tray','set','roll','sheet','bundle','pair','dozen','sack','can','jar']
const BEER_UOM_OPTIONS = ['bottle','case','box','pcs']
const CONTAINER_UNITS = ['case','box']

interface ExpenseRow {
  id:          number
  expenseDate: string
  category:    string
  description: string
  amount:      number
  qty:         number
  unit:        string | null
  unitPrice:   number | null
  paidTo:      string | null
  createdAt:   string
}

interface Preset {
  name:         string
  category:     string
  default_cost: number | null
  menu_item_id: string | null
}

interface InvItem {
  id:   string
  name: string
}

function catColor(T: ReturnType<typeof useTheme>['T']): Record<string, string> {
  return {
    'OPEX': T.textDim, 'Food': T.ok, 'Beer': T.warn,
    'Cocktails/Hard': T.accent, 'Non-Alcohol': T.info, 'Cigarettes': T.textMute,
  }
}

function fmtPeso(v: number) {
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Renders suggestion list in a portal so overflow containers don't clip it
function SuggestionsPortal({ open, anchorRef, suggestions, activeIdx, onPick }: {
  open:        boolean
  anchorRef:   React.RefObject<HTMLInputElement | null>
  suggestions: Preset[]
  activeIdx:   number
  onPick:      (p: Preset) => void
}) {
  const { T } = useTheme()
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!open || !anchorRef.current) { setRect(null); return }
    setRect(anchorRef.current.getBoundingClientRect())
  }, [open, anchorRef, suggestions])

  if (!open || !rect) return null

  return createPortal(
    <div style={{
      position: 'fixed',
      top:  rect.bottom + 2,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      background: T.surface2, border: `1px solid ${T.line2}`,
      borderRadius: T.radius, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      maxHeight: 260, overflowY: 'auto', overscrollBehavior: 'contain',
    }}>
      {suggestions.map((s, i) => (
        <div
          key={s.name}
          onMouseDown={() => onPick(s)}
          style={{
            padding: '8px 12px', cursor: 'pointer',
            background: i === activeIdx ? T.surface : 'transparent',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: i < suggestions.length - 1 ? `1px solid ${T.line}` : 'none',
          }}
        >
          <div>
            <span style={{ fontSize: 12, color: T.text }}>{s.name}</span>
            <span style={{ marginLeft: 8, fontSize: 10, color: catColor(T)[s.category] ?? T.textMute }}>{s.category}</span>
          </div>
          {s.default_cost != null && (
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>
              ₱{s.default_cost.toFixed(2)}
            </span>
          )}
        </div>
      ))}
    </div>,
    document.body,
  )
}

export default function ExpensesView({ role = 'manager' }: { role?: string }) {
  const { T } = useTheme()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  const isOwner = role === 'owner'
  const [rows,       setRows]       = useState<ExpenseRow[]>([])
  const { sorted: sortedRows, toggle: sortToggle, icon: sortIcon } = useSortable(rows, 'expenseDate' as keyof ExpenseRow, 'desc')
  const [presets,    setPresets]    = useState<Preset[]>([])
  const [beerItems,  setBeerItems]  = useState<InvItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [search,     setSearch]     = useState('')
  const nav = useDateNav()

  // Form state
  const [fDate,       setFDate]       = useState(() => localDateStr(new Date()))
  const [fCat,        setFCat]        = useState<string>('OPEX')
  const [fDesc,       setFDesc]       = useState('')
  const [fQty,        setFQty]        = useState('1')
  const [fUnit,       setFUnit]       = useState('')
  const [fUnitPrice,  setFUnitPrice]  = useState('')
  const [fAmt,        setFAmt]        = useState('')
  const [fMenuItemId, setFMenuItemId] = useState('')
  const [fCaseSize,   setFCaseSize]   = useState('24')

  // Autocomplete state
  const [suggestions,    setSuggestions]    = useState<Preset[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIdx,   setSuggestionIdx]   = useState(-1)
  const descRef = useRef<HTMLInputElement>(null)

  const today = localDateStr(new Date())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  // Load presets once
  useEffect(() => {
    sb.from('expense_presets').select('name,category,default_cost,menu_item_id').order('name')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => setPresets(data ?? []))
  }, [])

  // Load beer menu items once — used to link a purchase to inventory.
  // Excludes buckets/mixed buckets (anything defined as a composition of other
  // items) since those are assembled from bottles at sale time, never purchased
  // directly from a supplier — only real, independently-stocked bottle types
  // should show up here.
  useEffect(() => {
    (async () => {
      const [{ data: items }, { data: comps }] = await Promise.all([
        sb.from('menu_items').select('id,name').eq('category2', 'Beer').order('name'),
        sb.from('inventory_compositions').select('sold_menu_item_id'),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const composedIds = new Set((comps ?? []).map((c: any) => c.sold_menu_item_id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setBeerItems((items ?? []).filter((r: any) => !composedIds.has(r.id)).map((r: any) => ({ id: r.id, name: r.name })))
    })()
  }, [])

  const fetchRows = useCallback(async (start: string, end: string) => {
    let query = sb.from('daily_expenses').select('*').order('created_at', { ascending: false })
    query = query.gte('expense_date', start.slice(0, 10)).lte('expense_date', end.slice(0, 10))
    const { data } = await query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRows((data ?? []).map((r: any) => ({
      id: r.id, expenseDate: r.expense_date, category: r.category,
      description: r.description, amount: r.amount,
      qty: r.qty ?? 1, unit: r.unit ?? null, unitPrice: r.unit_price ?? null,
      paidTo: r.paid_to, createdAt: r.created_at,
    })))
    setLoading(false)
  }, [sb])

  useEffect(() => {
    setSearch('')
    let start: string, end: string
    if (nav.mode === 'today') {
      ;({ start, end } = dayBounds(nav.date))
    } else if (nav.mode === 'week') {
      ;({ start, end } = weekBounds(nav.weekRef))
    } else {
      ;({ start, end } = monthBounds(nav.year, nav.month))
    }
    fetchRows(start, end)
  }, [nav.mode, nav.date, nav.weekRef, nav.month, nav.year, fetchRows])

  const filteredRows = search.trim()
    ? sortedRows.filter(r => r.description.toLowerCase().includes(search.toLowerCase()))
    : sortedRows

  // Update suggestions as user types
  function handleDescChange(val: string) {
    setFDesc(val)
    setSuggestionIdx(-1)
    setFMenuItemId('') // typing away from a matched preset drops the auto-linked beer item
    if (val.trim().length < 1) {
      setSuggestions([]); setShowSuggestions(false); return
    }
    const q = val.toLowerCase()
    const matches = presets.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }

  function applyPreset(preset: Preset) {
    setFDesc(preset.name)
    setFCat(preset.category)
    setFMenuItemId(preset.menu_item_id ?? '')
    if (preset.default_cost != null) {
      setFUnitPrice(preset.default_cost.toFixed(2))
      setFAmt('')
    }
    setSuggestions([]); setShowSuggestions(false)
    // Focus qty field after selection
    setTimeout(() => descRef.current?.blur(), 0)
  }

  function handleDescKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSuggestionIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && suggestionIdx >= 0) { e.preventDefault(); applyPreset(suggestions[suggestionIdx]) }
    if (e.key === 'Escape') { setShowSuggestions(false) }
  }

  async function addExpense() {
    const qty  = parseFloat(fQty) || 1
    const up   = fUnitPrice !== '' ? parseFloat(fUnitPrice) : null
    const amt  = up != null ? qty * up : parseFloat(fAmt)
    if (!fDesc.trim() || isNaN(amt) || amt <= 0) return
    setSaving(true)
    const expDate = isOwner ? fDate : today
    // Case/box vs bottle/pcs comes straight from the Unit field already on the form —
    // no separate toggle. Anything else (bottle, pcs, etc.) is 1:1.
    const isContainer = CONTAINER_UNITS.includes(fUnit)
    const caseSize = parseFloat(fCaseSize) || 0
    const invQty = fMenuItemId
      ? (isContainer ? qty * caseSize : qty)
      : null
    await sb.from('daily_expenses').insert({
      expense_date: expDate, category: fCat, description: fDesc.trim(),
      amount: amt, qty, unit: fUnit.trim() || null, unit_price: up,
      menu_item_id: fMenuItemId || null,
      inventory_qty: fMenuItemId && invQty ? invQty : null,
    })
    setFDesc(''); setFQty('1'); setFUnit(''); setFUnitPrice(''); setFAmt('')
    setFMenuItemId(''); setFCaseSize('24')
    if (isOwner) setFDate(today)
    setShowForm(false)
    // re-fetch current range after adding
    let start: string, end: string
    if (nav.mode === 'today') { ;({ start, end } = dayBounds(nav.date)) }
    else if (nav.mode === 'week') { ;({ start, end } = weekBounds(nav.weekRef)) }
    else { ;({ start, end } = monthBounds(nav.year, nav.month)) }
    await fetchRows(start, end)
    setSaving(false)
  }

  async function deleteExpense(id: number) {
    await sb.from('daily_expenses').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const totalShown    = rows.reduce((s, r) => s + r.amount, 0)
  const totalFiltered = filteredRows.reduce((s, r) => s + r.amount, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.surface }}>

      {/* Header */}
      {isMobile ? (
        <div style={{ flexShrink: 0, background: T.bg, borderBottom: `1px solid ${T.line}` }}>
          <div style={{ height: 44, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.headerText }}>Expenses</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.bad, background: `${T.bad}18`, border: `1px solid ${T.bad}44`, padding: '2px 8px', borderRadius: T.radius }}>
              {fmtPeso(totalShown)}
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowForm(v => !v)} style={{
              padding: '6px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
              background: showForm ? T.chip : T.accent, color: showForm ? T.textDim : T.accentInk,
              border: `1px solid ${showForm ? T.line2 : T.accent}`, borderRadius: T.radius, cursor: 'pointer',
            }}>
              {showForm ? 'Cancel' : '+ Add'}
            </button>
          </div>
          {nav.mode !== 'today' && (
            <div style={{ padding: '0 16px 8px', position: 'relative' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search expenses…"
                style={{
                  width: '100%', fontFamily: 'inherit', fontSize: 12,
                  background: T.surface, border: `1px solid ${search ? T.accent : T.line2}`,
                  color: T.text, borderRadius: T.radius,
                  padding: '6px 28px 6px 8px', outline: 'none', boxSizing: 'border-box',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{
                  position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: T.textMute,
                  cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1,
                }}>×</button>
              )}
            </div>
          )}
          <div className="bp-no-scrollbar" style={{ padding: '0 16px 10px', overflowX: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
            <DateRangeNav
              mode={nav.mode} date={nav.date} weekRef={nav.weekRef}
              month={nav.month} year={nav.year}
              onModeChange={nav.setMode}
              onDateChange={nav.setDate}
              onWeekChange={nav.setWeekRef}
              onMonthChange={nav.setMonth}
            />
          </div>
        </div>
      ) : (
        <div style={{
          height: 52, padding: '0 24px', flexShrink: 0,
          background: T.bg, borderBottom: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.headerText }}>Expenses</span>
          <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.bad, background: `${T.bad}18`, border: `1px solid ${T.bad}44`, padding: '2px 8px', borderRadius: T.radius }}>
            {fmtPeso(totalShown)}
          </span>
          <div style={{ flex: 1 }} />
          {nav.mode !== 'today' && (
            <div style={{ position: 'relative' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search expenses…"
                style={{
                  fontFamily: 'inherit', fontSize: 12,
                  background: T.surface, border: `1px solid ${search ? T.accent : T.line2}`,
                  color: T.text, borderRadius: T.radius,
                  padding: '5px 28px 5px 8px', outline: 'none', width: 180,
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: T.textMute,
                  cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1,
                }}>×</button>
              )}
            </div>
          )}
          <DateRangeNav
            mode={nav.mode} date={nav.date} weekRef={nav.weekRef}
            month={nav.month} year={nav.year}
            onModeChange={nav.setMode}
            onDateChange={nav.setDate}
            onWeekChange={nav.setWeekRef}
            onMonthChange={nav.setMonth}
          />
          <button onClick={() => setShowForm(v => !v)} style={{
            padding: '5px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
            background: showForm ? T.chip : T.accent, color: showForm ? T.textDim : T.accentInk,
            border: `1px solid ${showForm ? T.line2 : T.accent}`, borderRadius: T.radius, cursor: 'pointer',
          }}>
            {showForm ? 'Cancel' : '+ Add Expense'}
          </button>
        </div>
      )}

      {/* Add form */}
      {showForm && (() => {
        const qty     = parseFloat(fQty) || 1
        const up      = fUnitPrice !== '' ? parseFloat(fUnitPrice) : null
        const autoAmt = up != null ? (qty * up).toFixed(2) : fAmt
        const canSave = fDesc.trim() && (up != null ? up > 0 : parseFloat(fAmt) > 0)
        return (
          <div className="bp-no-scrollbar" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', background: T.surface2, borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <div style={{
            padding: '16px 24px',
            display: 'grid', gridTemplateColumns: `${isOwner ? '120px ' : ''}140px 1fr 70px 90px 110px 120px auto`,
            gap: 8, alignItems: 'end', minWidth: isOwner ? 800 : 680,
          }}>
            {/* Date — owner only */}
            {isOwner && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Date</div>
                <input
                  type="date" value={fDate} max={today}
                  onChange={e => e.target.value && setFDate(e.target.value)}
                  style={{ width: '100%', fontFamily: T.mono, fontSize: 12, background: fDate !== today ? `${T.warn}18` : T.surface, border: `1px solid ${fDate !== today ? T.warn : T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' as const }}
                />
              </div>
            )}
            {/* Category */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Category</div>
              <select value={fCat} onChange={e => setFCat(e.target.value)} style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none' }}>
                {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Name with autocomplete */}
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Name *</div>
              <input
                ref={descRef}
                value={fDesc}
                onChange={e => handleDescChange(e.target.value)}
                onKeyDown={handleDescKeyDown}
                onFocus={() => fDesc.trim() && setSuggestions(presets.filter(p => p.name.toLowerCase().includes(fDesc.toLowerCase())).slice(0, 8))}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Type to search presets…"
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }}
              />
              <SuggestionsPortal
                open={showSuggestions && suggestions.length > 0}
                anchorRef={descRef}
                suggestions={suggestions}
                activeIdx={suggestionIdx}
                onPick={applyPreset}
              />
            </div>

            {/* Qty */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Qty</div>
              <input value={fQty} onChange={e => setFQty(e.target.value)} placeholder="1" type="number" min="0.001" step="any" style={{ width: '100%', fontFamily: T.mono, fontSize: 13, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Unit */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Unit</div>
              <select
                value={fUnit}
                onChange={e => setFUnit(e.target.value)}
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none' }}
              >
                <option value="">—</option>
                {(fCat === 'Beer' ? BEER_UOM_OPTIONS : UOM_OPTIONS).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Unit Price */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Unit Price</div>
              <input value={fUnitPrice} onChange={e => { setFUnitPrice(e.target.value); setFAmt('') }} placeholder="0.00" type="number" min="0" style={{ width: '100%', fontFamily: T.mono, fontSize: 13, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Total Price */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>
                Total Price {up != null ? <span style={{ color: T.accent }}>auto</span> : '*'}
              </div>
              <input value={up != null ? autoAmt : fAmt} onChange={e => { if (up == null) setFAmt(e.target.value) }} readOnly={up != null} placeholder="0.00" type="number" min="0" style={{ width: '100%', fontFamily: T.mono, fontSize: 13, background: up != null ? T.chip : T.surface, border: `1px solid ${T.line2}`, color: up != null ? T.accent : T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <button onClick={addExpense} disabled={saving || !canSave} style={{ padding: '7px 16px', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, background: T.accent, color: T.accentInk, border: 'none', borderRadius: T.radius, cursor: 'pointer', opacity: !canSave ? 0.4 : 1 }}>
              Save
            </button>
          </div>

          {/* Beer item — auto-linked from the preset picked above (name → menu item); the
              dropdown stays visible as an override for custom-typed names or new beers that
              don't have a preset yet. Restock qty is driven by the Unit field (case/box vs bottle/pcs). */}
          {fCat === 'Beer' && (() => {
            const selectedBeer = beerItems.find(b => b.id === fMenuItemId)
            const isContainer = CONTAINER_UNITS.includes(fUnit)
            const caseSize = parseFloat(fCaseSize) || 0
            const bottlesToAdd = isContainer ? qty * caseSize : qty
            return (
            <div style={{ padding: '0 24px 16px', minWidth: isOwner ? 800 : 680 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isContainer ? '1fr 130px' : '1fr', gap: 8, alignItems: 'end' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>
                    Beer Item
                  </div>
                  <select value={fMenuItemId} onChange={e => setFMenuItemId(e.target.value)} style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none' }}>
                    <option value="">Select item…</option>
                    {beerItems.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                {isContainer && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>
                      Qty/{fUnit === 'box' ? 'Box' : 'Case'}
                    </div>
                    <input
                      value={fCaseSize} onChange={e => setFCaseSize(e.target.value)}
                      disabled={!fMenuItemId} type="number" min="1" step="1"
                      style={{ width: '100%', fontFamily: T.mono, fontSize: 13, background: fMenuItemId ? T.surface : T.chip, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box', opacity: fMenuItemId ? 1 : 0.5 }}
                    />
                  </div>
                )}
              </div>
              {fMenuItemId && bottlesToAdd > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, fontFamily: T.mono, color: T.ok }}>
                  → Adds {bottlesToAdd} bottle{bottlesToAdd === 1 ? '' : 's'} to {selectedBeer?.name} ({isContainer ? `${qty} ${fUnit} × ${caseSize}` : `${qty} bottle`}{qty === 1 && !isContainer ? '' : 's'})
                </div>
              )}
            </div>
            )
          })()}
          </div>
        )
      })()}

      {/* List header + rows — single scroll container so they move together horizontally */}
      <div className="bp-no-scrollbar" style={{ flex: 1, overflow: 'auto', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}>
        <div style={{ minWidth: 820, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '90px 80px 120px 1fr 180px 100px 36px',
            padding: '0 24px', height: 36, alignItems: 'center',
            borderBottom: `1px solid ${T.line}`, background: T.surface2,
            position: 'sticky', top: 0, zIndex: 1,
          }}>
            {([
              ['Time',       null],
              ['Date',       'expenseDate'],
              ['Category',   'category'],
              ['Name',       'description'],
              ['Qty × Price', null],
              ['Amount',     'amount'],
              ['',           null],
            ] as [string, keyof ExpenseRow | null][]).map(([h, k]) => k ? (
              <button key={h} onClick={() => sortToggle(k)} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.headerText, display: 'flex', alignItems: 'center', gap: 3, textAlign: 'left' }}>
                {h}<span style={{ fontSize: 8, opacity: 0.7 }}>{sortIcon(k)}</span>
              </button>
            ) : (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.headerText }}>{h}</span>
            ))}
          </div>
          {loading ? (
            <div style={{ padding: '24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '32px 24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>
              No expenses logged for this period
            </div>
          ) : filteredRows.length === 0 ? (
            <div style={{ padding: '32px 24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>
              No expenses match &ldquo;{search}&rdquo;
            </div>
          ) : filteredRows.map((row, i) => {
            const dt      = new Date(row.createdAt)
            const time    = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
            const qtyPart = row.qty % 1 === 0 ? String(row.qty) : row.qty.toFixed(3)
            const unitPart = row.unit ? ` ${row.unit}` : ''
            const pricePart = row.unitPrice != null ? ` × ₱${row.unitPrice.toFixed(2)}` : ''
            const qtyUnit = row.unitPrice != null || row.unit
              ? `${qtyPart}${unitPart}${pricePart}`
              : '—'
            return (
              <div key={row.id} style={{
                display: 'grid', gridTemplateColumns: '90px 80px 120px 1fr 180px 100px 36px',
                padding: '0 24px', height: 44, alignItems: 'center',
                borderBottom: `1px solid ${T.line}`,
                background: i % 2 === 0 ? T.surface : T.bg,
              }}>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>{row.expenseDate.slice(5)}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: catColor(T)[row.category] ?? T.textDim }}>{row.category}</span>
                <span style={{ fontSize: 13, color: T.text }}>{row.description}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>{qtyUnit}</span>
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>
                  ₱{row.amount.toFixed(2)}
                </span>
                {(isOwner || row.expenseDate === today) && (
                  <button onClick={() => deleteExpense(row.id)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${T.bad}33`, color: T.bad, borderRadius: T.radius, cursor: 'pointer', fontSize: 14 }}>
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer total */}
      {rows.length > 0 && (
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${T.line}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {search && (
            <span style={{ fontSize: 11, color: T.textMute, fontFamily: T.mono }}>
              {filteredRows.length} of {rows.length} expenses
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.headerText }}>
            {search ? `Total for "${search}"` : `Total ${nav.mode === 'today' ? 'Today' : nav.mode === 'week' ? 'This Week' : 'This Month'}`}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>
            {fmtPeso(search ? totalFiltered : totalShown)}
          </span>
        </div>
      )}
    </div>
  )
}
