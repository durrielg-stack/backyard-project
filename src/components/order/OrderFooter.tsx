'use client'

import { useState } from 'react'
import { THEME } from '@/lib/theme'

const T = THEME

const TIP_PRESETS = [15, 18, 20, 25] as const

interface OrderFooterProps {
  subtotal:       number
  tax:            number
  tipPct:         number
  setTipPct:      (pct: number) => void
  customTip:      number | null
  setCustomTip:   (tip: number | null) => void
  total:          number
  onHold:         () => void
  onSplit:        () => void
  onCharge:       () => void
  disabled:       boolean    // true when cart is empty
}

function TotalsRow({ label, value, accent, large, mute }: {
  label: string; value: string; accent?: boolean; large?: boolean; mute?: boolean
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 0',
    }}>
      <span style={{
        fontSize: large ? 13 : 12,
        fontWeight: large ? 600 : 400,
        letterSpacing: large ? '0.06em' : 0,
        textTransform: large ? 'uppercase' : 'none',
        color: mute ? T.textMute : T.textDim,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: T.mono, fontVariantNumeric: 'tabular-nums',
        fontSize: large ? 28 : 14,
        fontWeight: large ? 700 : 400,
        color: accent ? T.accent : mute ? T.textMute : T.textDim,
        letterSpacing: large ? '-0.02em' : 0,
      }}>
        {value}
      </span>
    </div>
  )
}

export default function OrderFooter({
  subtotal, tax, tipPct, setTipPct, customTip, setCustomTip,
  total, onHold, onSplit, onCharge, disabled,
}: OrderFooterProps) {
  const [customInput, setCustomInput] = useState(false)
  const [customVal, setCustomVal]     = useState('')

  const tipAmt = customTip != null ? customTip : subtotal * (tipPct / 100)

  function applyCustom() {
    const v = parseFloat(customVal)
    if (!isNaN(v) && v >= 0) { setCustomTip(v); setCustomInput(false) }
    else                      { setCustomInput(false) }
  }

  return (
    <div style={{
      borderTop: `1px solid ${T.line}`, padding: '18px 24px',
      flexShrink: 0, background: T.surface,
    }}>
      {/* ── Totals ──────────────────────────────────────────────────── */}
      <TotalsRow label="Subtotal"    value={`₱${subtotal.toFixed(2)}`} mute />
      <TotalsRow label="Tax · 8.75%" value={`₱${tax.toFixed(2)}`}     mute />

      {/* Tip row with selector */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 0 10px',
      }}>
        <span style={{ fontSize: 12, color: T.textDim }}>
          Tip · {customTip != null ? 'Custom' : `${tipPct}%`}
          <span style={{
            marginLeft: 6, fontFamily: T.mono, fontSize: 12,
            color: T.textMute, fontVariantNumeric: 'tabular-nums',
          }}>
            ₱{tipAmt.toFixed(2)}
          </span>
        </span>

        {/* Tip % segmented */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TIP_PRESETS.map(pct => {
            const active = customTip == null && tipPct === pct
            return (
              <button key={pct} onClick={() => { setTipPct(pct); setCustomTip(null); setCustomInput(false) }} style={{
                padding: '4px 10px', fontSize: 12, fontFamily: 'inherit',
                background: active ? `${T.accent}24` : 'transparent',
                color:      active ? T.accent : T.textDim,
                border:     `1px solid ${active ? T.accent : T.line2}`,
                borderRadius: T.radius, cursor: 'pointer', fontWeight: active ? 600 : 400,
                transition:   'background 0.12s ease, border-color 0.12s ease',
              }}>
                {pct}%
              </button>
            )
          })}
          {/* Custom */}
          {customInput ? (
            <input
              autoFocus
              value={customVal}
              onChange={e => setCustomVal(e.target.value)}
              onBlur={applyCustom}
              onKeyDown={e => { if (e.key === 'Enter') applyCustom(); if (e.key === 'Escape') setCustomInput(false); e.stopPropagation() }}
              placeholder="0.00"
              style={{
                width: 68, padding: '4px 8px', fontSize: 12,
                background: T.surface2, border: `1px solid ${T.accent}`,
                color: T.text, fontFamily: T.mono, borderRadius: T.radius, outline: 'none',
              }}
            />
          ) : (
            <button onClick={() => { setCustomInput(true); setCustomVal(customTip?.toFixed(2) ?? '') }} style={{
              padding: '4px 10px', fontSize: 12, fontFamily: 'inherit',
              background: customTip != null ? `${T.accent}24` : 'transparent',
              color:      customTip != null ? T.accent : T.textDim,
              border:     `1px solid ${customTip != null ? T.accent : T.line2}`,
              borderRadius: T.radius, cursor: 'pointer',
              transition:   'background 0.12s ease',
            }}>
              Custom
            </button>
          )}
        </div>
      </div>

      {/* ── Total row ───────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 10, marginBottom: 16 }}>
        <TotalsRow
          label="Total"
          value={`₱${total.toFixed(2)}`}
          large accent
        />
      </div>

      {/* ── Action buttons — 1fr 1fr 2fr ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
        {/* Hold */}
        <button onClick={onHold} disabled={disabled} style={{
          padding: '13px 0', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          background: 'transparent',
          border: `1px solid ${T.line2}`, color: disabled ? T.textMute : T.textDim,
          borderRadius: T.radius, cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'border-color 0.12s ease, color 0.12s ease',
        }}>
          Hold
          <span style={{
            fontSize: 10, fontFamily: T.mono, color: T.textMute,
            border: `1px solid ${T.line2}`, padding: '1px 4px', borderRadius: 2,
          }}>H</span>
        </button>

        {/* Split */}
        <button onClick={onSplit} disabled={disabled} style={{
          padding: '13px 0', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          background: 'transparent',
          border: `1px solid ${T.line2}`, color: disabled ? T.textMute : T.textDim,
          borderRadius: T.radius, cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'border-color 0.12s ease, color 0.12s ease',
        }}>
          Split
          <span style={{
            fontSize: 10, fontFamily: T.mono, color: T.textMute,
            border: `1px solid ${T.line2}`, padding: '1px 4px', borderRadius: 2,
          }}>S</span>
        </button>

        {/* Charge — primary CTA */}
        <button onClick={onCharge} disabled={disabled} style={{
          padding: '13px 0', fontFamily: 'inherit', fontSize: 16,
          fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase',
          background: disabled ? T.chip : T.accent,
          color:      disabled ? T.textMute : T.accentInk,
          border: 'none', borderRadius: T.radius,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, transition: 'background 0.12s ease',
        }}>
          <span>Charge · ₱{total.toFixed(2)}</span>
          <span style={{
            fontSize: 10, fontFamily: T.mono, color: disabled ? T.textMute : `${T.accentInk}88`,
            fontWeight: 400, letterSpacing: '0.04em',
          }}>
            ↵ ENTER
          </span>
        </button>
      </div>
    </div>
  )
}
