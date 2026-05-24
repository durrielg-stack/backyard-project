'use client'

import { useState, useEffect, useCallback } from 'react'
import { THEME } from '@/lib/theme'
import { getClient } from '@/lib/supabase'

const T = THEME

const EXPENSE_CATS = ['Petty Cash', 'Supplies', 'Utilities', 'Wages', 'Marketing', 'Other'] as const

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
  createdAt:   string
}

const catColor: Record<string, string> = {
  'Petty Cash': T.warn, 'Supplies': T.info, 'Utilities': T.textDim,
  'Wages': T.ok, 'Marketing': T.accent, 'Other': T.textMute,
}

function fmtPeso(v: number) {
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ExpensesView() {
  const [rows,      setRows]      = useState<ExpenseRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [dateFilter, setDateFilter] = useState<'today' | 'week'>('today')

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
    const now = new Date()
    let query = sb.from('daily_expenses').select('*').order('created_at', { ascending: false })
    if (dateFilter === 'today') {
      query = query.eq('expense_date', today)
    } else {
      const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 6)
      query = query.gte('expense_date', weekStart.toISOString().slice(0, 10))
    }
    const { data } = await query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRows((data ?? []).map((r: any) => ({
      id: r.id, expenseDate: r.expense_date, category: r.category,
      description: r.description, amount: r.amount,
      qty: r.qty ?? 1, unitPrice: r.unit_price ?? null,
      paidTo: r.paid_to, receiptRef: r.receipt_ref, createdAt: r.created_at,
    })))
    setLoading(false)
  }, [dateFilter, today])

  useEffect(() => { fetchRows() }, [fetchRows])

  async function addExpense() {
    const qty  = parseFloat(fQty) || 1
    const up   = fUnitPrice !== '' ? parseFloat(fUnitPrice) : null
    const amt  = up != null ? qty * up : parseFloat(fAmt)
    if (!fDesc.trim() || isNaN(amt) || amt <= 0) return
    setSaving(true)
    await sb.from('daily_expenses').insert({
      expense_date: today, category: fCat, description: fDesc.trim(),
      amount: amt, qty, unit_price: up,
      paid_to: fTo.trim() || null, receipt_ref: fRef.trim() || null,
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

  const totalShown = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.surface }}>

      {/* Header */}
      <div style={{
        height: 52, padding: '0 24px', flexShrink: 0,
        background: T.bg, borderBottom: `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>
          Expenses
        </span>
        <span style={{
          fontFamily: T.mono, fontSize: 12, fontWeight: 600,
          color: T.bad, background: `${T.bad}18`,
          border: `1px solid ${T.bad}44`,
          padding: '2px 8px', borderRadius: T.radius,
        }}>
          {fmtPeso(totalShown)}
        </span>

        <div style={{ flex: 1 }} />

        {/* Date filter */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['today', 'week'] as const).map(d => (
            <button key={d} onClick={() => setDateFilter(d)} style={{
              padding: '5px 14px', fontSize: 12, fontFamily: 'inherit',
              background: dateFilter === d ? T.accent : T.chip,
              color:      dateFilter === d ? T.accentInk : T.textDim,
              border:     `1px solid ${dateFilter === d ? T.accent : T.line2}`,
              borderRadius: T.radius, cursor: 'pointer', fontWeight: dateFilter === d ? 600 : 400,
            }}>
              {d === 'today' ? 'Today' : 'This Week'}
            </button>
          ))}
        </div>

        <button onClick={() => setShowForm(v => !v)} style={{
          padding: '5px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
          background: showForm ? T.chip : T.accent,
          color: showForm ? T.textDim : T.accentInk,
          border: `1px solid ${showForm ? T.line2 : T.accent}`,
          borderRadius: T.radius, cursor: 'pointer',
        }}>
          {showForm ? 'Cancel' : '+ Add Expense'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (() => {
        const qty     = parseFloat(fQty) || 1
        const up      = fUnitPrice !== '' ? parseFloat(fUnitPrice) : null
        const autoAmt = up != null ? (qty * up).toFixed(2) : fAmt
        const canSave = fDesc.trim() && (up != null ? up > 0 : parseFloat(fAmt) > 0)
        return (
          <div style={{
            padding: '16px 24px', background: T.surface2, borderBottom: `1px solid ${T.line}`,
            display: 'grid', gridTemplateColumns: '140px 1fr 70px 100px 110px 130px 110px auto',
            gap: 8, alignItems: 'end', flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Category</div>
              <select value={fCat} onChange={e => setFCat(e.target.value)} style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none' }}>
                {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Description *</div>
              <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="What was this for?" style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Qty</div>
              <input value={fQty} onChange={e => setFQty(e.target.value)} placeholder="1" type="number" min="0.001" step="any" style={{ width: '100%', fontFamily: T.mono, fontSize: 13, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Unit ₱</div>
              <input value={fUnitPrice} onChange={e => { setFUnitPrice(e.target.value); setFAmt('') }} placeholder="0.00" type="number" min="0" style={{ width: '100%', fontFamily: T.mono, fontSize: 13, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>
                Total ₱ {up != null ? <span style={{ color: T.accent }}>auto</span> : '*'}
              </div>
              <input value={up != null ? autoAmt : fAmt} onChange={e => { if (up == null) setFAmt(e.target.value) }} readOnly={up != null} placeholder="0.00" type="number" min="0" style={{ width: '100%', fontFamily: T.mono, fontSize: 13, background: up != null ? T.chip : T.surface, border: `1px solid ${T.line2}`, color: up != null ? T.accent : T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Paid To</div>
              <input value={fTo} onChange={e => setFTo(e.target.value)} placeholder="Supplier / person" style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Receipt #</div>
              <input value={fRef} onChange={e => setFRef(e.target.value)} placeholder="OR-001" style={{ width: '100%', fontFamily: T.mono, fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={addExpense} disabled={saving || !canSave} style={{ padding: '7px 16px', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, background: T.accent, color: T.accentInk, border: 'none', borderRadius: T.radius, cursor: 'pointer', opacity: !canSave ? 0.4 : 1 }}>
              Save
            </button>
          </div>
        )
      })()}

      {/* List header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '90px 80px 100px 1fr 120px 100px 100px 80px 36px',
        padding: '0 24px', height: 36, alignItems: 'center',
        borderBottom: `1px solid ${T.line}`, background: T.surface2, flexShrink: 0,
      }}>
        {['Time','Date','Category','Description','Qty × Unit','Paid To','Receipt','Amount',''].map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>
        ))}
      </div>

      <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '32px 24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>
            No expenses logged {dateFilter === 'today' ? 'today' : 'this week'}
          </div>
        ) : rows.map((row, i) => {
          const dt      = new Date(row.createdAt)
          const time    = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
          const qtyUnit = row.unitPrice != null
            ? `${row.qty % 1 === 0 ? row.qty : row.qty.toFixed(3)} × ₱${row.unitPrice.toFixed(2)}`
            : '—'
          return (
            <div key={row.id} style={{
              display: 'grid', gridTemplateColumns: '90px 80px 100px 1fr 120px 100px 100px 80px 36px',
              padding: '0 24px', height: 44, alignItems: 'center',
              borderBottom: `1px solid ${T.line}`,
              background: i % 2 === 0 ? 'transparent' : T.surface,
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>{row.expenseDate.slice(5)}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: catColor[row.category] ?? T.textDim }}>{row.category}</span>
              <span style={{ fontSize: 13, color: T.text }}>{row.description}</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>{qtyUnit}</span>
              <span style={{ fontSize: 12, color: T.textDim }}>{row.paidTo ?? '—'}</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>{row.receiptRef ?? '—'}</span>
              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>
                ₱{row.amount.toFixed(2)}
              </span>
              <button onClick={() => deleteExpense(row.id)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${T.bad}33`, color: T.bad, borderRadius: T.radius, cursor: 'pointer', fontSize: 14 }}>
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer total */}
      {rows.length > 0 && (
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${T.line}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute }}>
            Total {dateFilter === 'today' ? 'Today' : 'This Week'}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: T.bad, fontVariantNumeric: 'tabular-nums' }}>
            {fmtPeso(totalShown)}
          </span>
        </div>
      )}
    </div>
  )
}
