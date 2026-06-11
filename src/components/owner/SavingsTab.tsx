'use client'

import { useTheme } from '@/lib/ThemeContext'
import { useState, useCallback, useEffect } from 'react'
import { getClient } from '@/lib/supabase'
import { SectionHd, fmtPeso } from './ownerShared'
import { useSortable } from '@/lib/useSortable'

const PARTNERS = ['Albert', 'Arvin', 'Benok', 'Bimbo', 'Durriel', 'Ramon'] as const

interface RemittanceSplit {
  id:        number
  partner:   string
  dividends: number
  bonus:     number
  licensing: number
  others:    number
  paidOut:   number
}

interface Remittance {
  id:     number
  date:   string
  total:  number
  notes:  string | null
  splits: RemittanceSplit[]
}

export default function SavingsTab() {
  const { T } = useTheme()

  const [rows,     setRows]     = useState<Remittance[]>([])
  const { sorted: sortedRows, toggle: sortToggle, icon: sortIcon } = useSortable(rows, 'date' as keyof Remittance, 'desc')
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const [fDate,    setFDate]    = useState(() => new Date().toISOString().slice(0, 10))
  const [fTotal,   setFTotal]   = useState('')
  const [fNotes,   setFNotes]   = useState('')
  const [fPaidOut, setFPaidOut] = useState<Record<string, string>>({})

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  const fetchRows = useCallback(async () => {
    const { data: remits } = await sb.from('partner_remittances').select('*').order('remittance_date', { ascending: false })
    const { data: splits } = await sb.from('partner_remittance_splits').select('*')
    const splitMap: Record<number, RemittanceSplit[]> = {}
    for (const s of (splits ?? [])) {
      if (!splitMap[s.remittance_id]) splitMap[s.remittance_id] = []
      splitMap[s.remittance_id].push({ id: s.id, partner: s.partner_name, dividends: s.dividends, bonus: s.bonus, licensing: s.licensing, others: s.others, paidOut: s.paid_out })
    }
    setRows((remits ?? []).map((r: any) => ({ id: r.id, date: r.remittance_date, total: r.total_amount, notes: r.notes, splits: splitMap[r.id] ?? [] })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

  async function addRemittance() {
    const total = parseFloat(fTotal)
    if (isNaN(total) || total <= 0) return
    setSaving(true)

    const { data: rem } = await sb.from('partner_remittances').insert({ remittance_date: fDate, total_amount: total, notes: fNotes.trim() || null }).select('id').single()
    const remId = rem.id

    const perPartner = total / PARTNERS.length
    const dividends  = parseFloat((total * 0.7 / PARTNERS.length).toFixed(2))
    const bonus      = parseFloat((total * 0.1 / PARTNERS.length).toFixed(2))
    const licensing  = parseFloat((total * 0.1 / PARTNERS.length).toFixed(2))
    const others     = parseFloat((perPartner - dividends - bonus - licensing).toFixed(2))

    await sb.from('partner_remittance_splits').insert(
      PARTNERS.map(p => ({
        remittance_id: remId,
        partner_name:  p,
        dividends,
        bonus,
        licensing,
        others,
        paid_out: parseFloat(fPaidOut[p] ?? '0') || 0,
      }))
    )

    setFTotal(''); setFNotes(''); setFPaidOut({}); setShowForm(false)
    await fetchRows()
    setSaving(false)
  }

  async function deleteRemittance(id: number) {
    await sb.from('partner_remittances').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const balances: Record<string, number> = {}
  for (const p of PARTNERS) balances[p] = 0
  for (const r of rows) {
    for (const s of r.splits) {
      balances[s.partner] = (balances[s.partner] ?? 0) + s.dividends + s.bonus + s.licensing + s.others - s.paidOut
    }
  }

  const previewTotal = parseFloat(fTotal) || 0
  const previewPer   = previewTotal > 0 ? previewTotal / PARTNERS.length : 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <SectionHd
        title="Partner Savings"
        badge={`${rows.length} remittances`}
        action={
          <button onClick={() => setShowForm(v => !v)} style={{ padding: '5px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: showForm ? T.chip : T.accent, color: showForm ? T.textDim : T.accentInk, border: `1px solid ${showForm ? T.line2 : T.accent}`, borderRadius: T.radius, cursor: 'pointer' }}>
            {showForm ? 'Cancel' : '+ New Remittance'}
          </button>
        }
      />

      {/* Running balance per partner */}
      <div className="bp-no-scrollbar" style={{ overflowX: 'auto', touchAction: 'pan-x pan-y', flexShrink: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderBottom: `1px solid ${T.line}`, minWidth: 600 }}>
        {PARTNERS.map((p, i) => (
          <div key={p} style={{ padding: '14px 20px', borderRight: i < 5 ? `1px solid ${T.line}` : 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>{p}</div>
            <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: balances[p] >= 0 ? T.ok : T.bad, fontVariantNumeric: 'tabular-nums' }}>{fmtPeso(balances[p])}</div>
            <div style={{ fontSize: 10, color: T.textMute, marginTop: 2 }}>running balance</div>
          </div>
        ))}
      </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ padding: '20px 24px', background: T.surface2, borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 160px 1fr auto', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Date</div>
              <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={{ width: '100%', fontFamily: T.mono, fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Total Amount ₱ *</div>
              <input value={fTotal} onChange={e => setFTotal(e.target.value)} placeholder="0.00" type="number" min="0" style={{ width: '100%', fontFamily: T.mono, fontSize: 13, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 4 }}>Notes</div>
              <input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Optional note" style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={addRemittance} disabled={saving || !fTotal} style={{ padding: '7px 20px', fontSize: 13, fontFamily: 'inherit', fontWeight: 700, background: T.accent, color: T.accentInk, border: 'none', borderRadius: T.radius, cursor: 'pointer', opacity: !fTotal ? 0.4 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          {previewTotal > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 8 }}>
                Paid Out per Partner — each earns {fmtPeso(previewPer)} (auto-split equally)
              </div>
              <div className="bp-no-scrollbar" style={{ overflowX: 'auto', touchAction: 'pan-x pan-y' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, minWidth: 480 }}>
                {PARTNERS.map(p => (
                  <div key={p}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, marginBottom: 4 }}>{p}</div>
                    <input value={fPaidOut[p] ?? ''} onChange={e => setFPaidOut(prev => ({ ...prev, [p]: e.target.value }))} placeholder={fmtPeso(previewPer)} type="number" min="0" style={{ width: '100%', fontFamily: T.mono, fontSize: 12, background: T.surface, border: `1px solid ${T.line2}`, color: T.text, borderRadius: T.radius, padding: '5px 8px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '120px 160px 1fr 160px 36px', padding: '0 24px', height: 36, alignItems: 'center', borderBottom: `1px solid ${T.line}`, background: T.surface2, flexShrink: 0 }}>
        {([
          ['Date',     'date'],
          ['Total',    'total'],
          ['Notes',    null],
          ['Paid Out', null],
          ['',         null],
        ] as [string, keyof Remittance | null][]).map(([h, k]) => k ? (
          <button key={h} onClick={() => sortToggle(k)} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.headerText, display: 'flex', alignItems: 'center', gap: 3 }}>
            {h}<span style={{ fontSize: 8, opacity: 0.7 }}>{sortIcon(k)}</span>
          </button>
        ) : (
          <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.headerText }}>{h}</span>
        ))}
      </div>

      <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto', touchAction: 'pan-y' }}>
        {loading ? (
          <div style={{ padding: '24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '32px 24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>No remittances recorded yet</div>
        ) : sortedRows.map((r, i) => {
          const isOpen = expanded === r.id
          return (
            <div key={r.id} style={{ borderBottom: `1px solid ${T.line}` }}>
              <div
                onClick={() => setExpanded(isOpen ? null : r.id)}
                style={{ display: 'grid', gridTemplateColumns: '120px 160px 1fr 160px 36px', padding: '0 24px', height: 48, alignItems: 'center', background: i % 2 === 0 ? 'transparent' : T.surface, cursor: 'pointer' }}
              >
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute }}>{r.date}</span>
                <span style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: T.accent, fontVariantNumeric: 'tabular-nums' }}>{fmtPeso(r.total)}</span>
                <span style={{ fontSize: 12, color: T.textDim }}>{r.notes ?? `${PARTNERS.length} partners · ${fmtPeso(r.total / PARTNERS.length)} each`}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute }}>
                  paid out: {fmtPeso(r.splits.reduce((s, sp) => s + sp.paidOut, 0))}
                </span>
                <span style={{ color: T.textMute, fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {isOpen && (
                <div style={{ padding: '12px 24px 16px', background: T.surface2, borderTop: `1px solid ${T.line}` }}>
                  <div className="bp-no-scrollbar" style={{ overflowX: 'auto', touchAction: 'pan-x pan-y' }}>
                  <div style={{ minWidth: 560 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${PARTNERS.length}, 1fr)`, gap: 0, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.headerText }}></span>
                    {PARTNERS.map(p => (
                      <span key={p} style={{ fontSize: 11, fontWeight: 700, color: T.textDim, textAlign: 'right' }}>{p}</span>
                    ))}
                  </div>
                  {(['dividends','bonus','licensing','others'] as const).map(field => (
                    <div key={field} style={{ display: 'grid', gridTemplateColumns: `140px repeat(${PARTNERS.length}, 1fr)`, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: T.textMute, textTransform: 'capitalize' }}>{field}</span>
                      {PARTNERS.map(p => {
                        const sp = r.splits.find(s => s.partner === p)
                        return <span key={p} style={{ fontFamily: T.mono, fontSize: 11, color: T.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sp ? fmtPeso(sp[field]) : '—'}</span>
                      })}
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 6, marginTop: 6, display: 'grid', gridTemplateColumns: `140px repeat(${PARTNERS.length}, 1fr)` }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.textDim }}>Paid Out</span>
                    {PARTNERS.map(p => {
                      const sp = r.splits.find(s => s.partner === p)
                      return <span key={p} style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.bad, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sp ? fmtPeso(sp.paidOut) : '—'}</span>
                    })}
                  </div>
                  </div>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => deleteRemittance(r.id)} style={{ padding: '4px 12px', fontSize: 11, fontFamily: 'inherit', background: `${T.bad}18`, border: `1px solid ${T.bad}44`, color: T.bad, borderRadius: T.radius, cursor: 'pointer' }}>
                      Delete remittance
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
