'use client'

import { useState, useEffect } from 'react'
import { THEME } from '@/lib/theme'
import ModalBase from './ModalBase'
import type { PayMethod } from '@/lib/types'

const T = THEME

// ── Quick tender calculator ────────────────────────────────────────────────
function quickTenders(total: number): number[] {
  const base = Math.ceil(total)
  const roundTo = (n: number, to: number) => Math.ceil(n / to) * to
  const candidates = [
    roundTo(base, 50),
    roundTo(base, 100),
    roundTo(base, 500),
    roundTo(base, 1000),
  ]
  return [...new Set(candidates)].filter(n => n >= total).slice(0, 4)
}

// ── Num pad ────────────────────────────────────────────────────────────────
function NumPad({ onDigit }: { onDigit: (d: string) => void }) {
  const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫']
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {keys.map(k => (
        <button
          key={k}
          onClick={() => onDigit(k)}
          style={{
            height: 52, fontFamily: T.mono, fontSize: 20, fontWeight: 600,
            background: T.surface2, border: `1px solid ${T.line2}`,
            color: k === '⌫' ? T.warn : T.text,
            borderRadius: T.radius, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.12s ease',
          }}
        >
          {k}
        </button>
      ))}
    </div>
  )
}

// ── QR code visual (non-scannable decoration) ──────────────────────────────
function QRCodeVisual({ size = 160 }: { size?: number }) {
  const N    = 21
  const cell = size / N

  // Deterministic bit grid — looks like a QR code
  const grid = (() => {
    const g: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false))

    // Finder pattern 7×7
    function finder(r: number, c: number) {
      for (let dr = 0; dr < 7; dr++) for (let dc = 0; dc < 7; dc++) {
        if (r + dr >= N || c + dc >= N) continue
        const border = dr === 0 || dr === 6 || dc === 0 || dc === 6
        const dot    = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
        g[r + dr][c + dc] = border || dot
      }
    }
    finder(0, 0); finder(0, 14); finder(14, 0)

    // Timing strips
    for (let i = 8; i <= 12; i++) {
      g[6][i] = i % 2 === 0
      g[i][6] = i % 2 === 0
    }
    // Small alignment pattern (bottom-right finder area)
    for (let dr = 0; dr < 5; dr++) for (let dc = 0; dc < 5; dc++) {
      const b = dr === 0 || dr === 4 || dc === 0 || dc === 4
      const d = dr === 2 && dc === 2
      g[16 + dr]?.[16 + dc] && (g[16 + dr][16 + dc] = b || d)
      if (16 + dr < N && 16 + dc < N) g[16 + dr][16 + dc] = b || d
    }

    // Pseudo-random data fill (xorshift32)
    let s = 0x5F375A86 >>> 0
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const inFinder =
        (r < 8 && c < 8) || (r < 8 && c >= 13) || (r >= 13 && c < 8)
      const inTiming = r === 6 || c === 6
      if (!inFinder && !inTiming) {
        s = (s ^ (s << 13)) >>> 0
        s = (s ^ (s >> 17)) >>> 0
        s = (s ^ (s << 5))  >>> 0
        if (!g[r][c]) g[r][c] = (s & 3) < 2
      }
    }
    return g
  })()

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ borderRadius: T.radius, border: `1px solid ${T.line2}` }}
    >
      <rect width={size} height={size} fill={T.surface2} />
      {grid.flatMap((row, r) =>
        row.map((on, c) =>
          on
            ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={T.text} />
            : null
        )
      )}
    </svg>
  )
}

// ── Card step indicator ────────────────────────────────────────────────────
type CardStep = 'insert' | 'processing' | 'approved'
const CARD_STEPS: { id: CardStep; label: string }[] = [
  { id: 'insert',     label: 'Insert Card'  },
  { id: 'processing', label: 'Processing…'  },
  { id: 'approved',   label: 'Approved'     },
]

function CardFlow({ total, onPaid }: { total: number; onPaid: () => void }) {
  const [step, setStep] = useState<CardStep>('insert')

  useEffect(() => {
    const delays: Record<CardStep, number> = { insert: 1400, processing: 1600, approved: 1200 }
    const next:   Record<CardStep, CardStep | null> = {
      insert: 'processing', processing: 'approved', approved: null,
    }
    const t = setTimeout(() => {
      const n = next[step]
      if (n) setStep(n)
      else   onPaid()
    }, delays[step])
    return () => clearTimeout(t)
  }, [step, onPaid])

  const idx = CARD_STEPS.findIndex(s => s.id === step)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '24px 0',
    }}>
      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {CARD_STEPS.map((s, i) => {
          const done    = i < idx
          const current = i === idx
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background:  done ? T.ok : current ? T.accent : T.chip,
                  border:      done || current ? 'none' : `1px solid ${T.line2}`,
                  color:       done || current ? T.accentInk : T.textMute,
                  display:     'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  transition:  'background 0.4s ease',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: current ? 600 : 400,
                  color: current ? T.text : done ? T.ok : T.textMute,
                  whiteSpace: 'nowrap',
                }}>
                  {s.label}
                </span>
              </div>
              {i < CARD_STEPS.length - 1 && (
                <div style={{
                  width: 80, height: 1, marginBottom: 18,
                  background: i < idx ? T.ok : T.line2,
                  transition: 'background 0.4s ease',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Card terminal graphic */}
      <div style={{
        width: 180, height: 128, borderRadius: 6,
        background: T.surface2, border: `2px solid ${step === 'approved' ? T.ok : T.line2}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, transition: 'border-color 0.4s ease',
      }}>
        <svg viewBox="0 0 48 32" width={48} height={32} fill="none">
          <rect width={48} height={32} rx={3} stroke={step === 'approved' ? T.ok : T.line2} strokeWidth={1.5} />
          <rect x={0} y={8} width={48} height={8} fill={step === 'approved' ? T.ok : T.line2} opacity={0.3} />
          <rect x={6} y={20} width={18} height={6} rx={1} fill={step === 'approved' ? T.ok : T.textMute} opacity={0.5} />
        </svg>
        <span style={{
          fontFamily: T.mono, fontSize: 10, letterSpacing: '0.08em',
          color: step === 'approved' ? T.ok : T.textMute,
        }}>
          {step === 'insert' ? 'INSERT CARD' : step === 'processing' ? 'READING…' : 'APPROVED ✓'}
        </span>
      </div>

      {step === 'approved' && (
        <div style={{
          fontFamily: T.mono, fontSize: 12, color: T.ok,
          letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.8,
        }}>
          VISA •••• 4729 · auth #A4521A<br />
          <span style={{ color: T.accent, fontSize: 14, fontWeight: 700 }}>
            ₱{total.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── QR / GCash flow ────────────────────────────────────────────────────────
type QRStep = 'waiting' | 'scanned' | 'received'

function QRFlow({ total, onPaid }: { total: number; onPaid: () => void }) {
  const [step, setStep] = useState<QRStep>('waiting')

  useEffect(() => {
    if (step === 'waiting') {
      const t = setTimeout(() => setStep('scanned'),   3200)
      return () => clearTimeout(t)
    }
    if (step === 'scanned') {
      const t = setTimeout(() => setStep('received'),  1600)
      return () => clearTimeout(t)
    }
    if (step === 'received') {
      const t = setTimeout(onPaid, 1400)
      return () => clearTimeout(t)
    }
  }, [step, onPaid])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '12px 0',
    }}>
      <QRCodeVisual size={156} />

      <div style={{
        padding: '12px 24px',
        background: step === 'received' ? `${T.ok}14` : T.surface2,
        border:     `1px solid ${step === 'received' ? T.ok : step === 'scanned' ? T.warn : T.line2}`,
        borderRadius: T.radius,
        fontFamily: T.mono, fontSize: 12, letterSpacing: '0.04em',
        color: step === 'received' ? T.ok : step === 'scanned' ? T.warn : T.textDim,
        display: 'flex', alignItems: 'center', gap: 10,
        transition: 'all 0.3s ease',
      }}>
        {step === 'waiting' && (
          <>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: T.accent, flexShrink: 0,
              animation: 'bp-pulse 2s ease-out infinite',
              display: 'inline-block',
            }} />
            Waiting for scan…
          </>
        )}
        {step === 'scanned'  && 'Scanned · confirming…'}
        {step === 'received' && 'Payment received via Maya · ref MX-2814'}
      </div>

      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMute, textAlign: 'center' }}>
        Open GCash / Maya and scan
      </div>
    </div>
  )
}

// ── PayModal ───────────────────────────────────────────────────────────────
interface PayModalProps {
  total:    number
  subtotal: number
  tax:      number
  tipAmt:   number
  onPaid:   (method: PayMethod, amount: number) => void
  onClose:  () => void
}

type Method = 'cash' | 'card' | 'qr'

export default function PayModal({ total, subtotal, tax, tipAmt, onPaid, onClose }: PayModalProps) {
  const [method, setMethod] = useState<Method>('cash')
  const [input,  setInput]  = useState('')

  const tendered = parseFloat(input) || 0
  const change   = tendered - total
  const canCharge = tendered >= total
  const tenders  = quickTenders(total)

  function handleDigit(d: string) {
    if (d === '⌫') { setInput(p => p.slice(0, -1)); return }
    if (d === '.' && input.includes('.')) return
    const next = input + d
    const [, dec] = next.split('.')
    if (dec && dec.length > 2) return
    setInput(next)
  }

  const methodLabel: Record<Method, string> = {
    cash: 'Cash', card: 'Card', qr: 'QR / GCash',
  }

  return (
    <ModalBase width={780} onBackdropClick={onClose}>

      {/* ── Amount header ──────────────────────────────────────────────── */}
      <div style={{
        padding: '28px 32px 20px',
        borderBottom: `1px solid ${T.line}`,
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: T.mono, fontSize: 40, fontWeight: 700,
          color: T.accent, letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums', marginBottom: 8,
          lineHeight: 1,
        }}>
          ₱{total.toFixed(2)}
        </div>
        <div style={{
          display: 'flex', gap: 20,
          fontFamily: T.mono, fontSize: 11, color: T.textMute, letterSpacing: '0.04em',
        }}>
          <span>Subtotal ₱{subtotal.toFixed(2)}</span>
          <span>Tax ₱{tax.toFixed(2)}</span>
          <span>Tip ₱{tipAmt.toFixed(2)}</span>
        </div>
      </div>

      {/* ── Method tabs ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 8, padding: '14px 32px',
        borderBottom: `1px solid ${T.line}`,
        flexShrink: 0,
      }}>
        {(['cash','card','qr'] as Method[]).map(m => {
          const active = method === m
          return (
            <button
              key={m}
              onClick={() => setMethod(m)}
              style={{
                flex: 1, padding: '11px 0',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                background: active ? `${T.accent}18` : T.chip,
                color:      active ? T.accent : T.textDim,
                border:     `1px solid ${active ? T.accent : T.line2}`,
                borderRadius: T.radius, cursor: 'pointer',
                transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
              }}
            >
              {methodLabel[m]}
            </button>
          )
        })}
      </div>

      {/* ── Method body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

        {/* Cash ──────────────────────────────────────────────────────── */}
        {method === 'cash' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 24, alignItems: 'start' }}>

            {/* Left: tendered display + num pad */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                height: 60, background: T.surface2,
                border: `1px solid ${input ? T.accent : T.line2}`,
                borderRadius: T.radius, padding: '0 16px',
                display: 'flex', alignItems: 'center',
                transition: 'border-color 0.12s ease',
              }}>
                <span style={{
                  fontFamily: T.mono, fontSize: 28, fontWeight: 700,
                  color: input ? T.text : T.textMute,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.02em',
                }}>
                  {input ? `₱${input}` : '₱0.00'}
                </span>
              </div>
              <NumPad onDigit={handleDigit} />
            </div>

            {/* Right: quick tenders + change */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
                textTransform: 'uppercase', color: T.textMute, marginBottom: 2,
              }}>
                Quick Tender
              </span>
              {tenders.map(amt => (
                <button
                  key={amt}
                  onClick={() => setInput(amt.toFixed(2))}
                  style={{
                    padding: '11px 0', fontFamily: T.mono,
                    fontSize: 16, fontWeight: 600,
                    background: T.chip, border: `1px solid ${T.line2}`,
                    color: T.text, borderRadius: T.radius, cursor: 'pointer',
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'background 0.12s ease',
                  }}
                >
                  ₱{amt.toLocaleString()}
                </button>
              ))}

              {/* Change display */}
              <div style={{
                marginTop: 8, padding: '14px 16px',
                background: change > 0 ? `${T.accent}14` : T.surface2,
                border:     `1px solid ${change > 0 ? T.accent : T.line2}`,
                borderRadius: T.radius,
                transition: 'all 0.15s ease',
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: change > 0 ? T.accent : T.textMute, marginBottom: 4,
                }}>
                  Change
                </div>
                <div style={{
                  fontFamily: T.mono, fontSize: 22, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: change > 0 ? T.accent : T.textMute,
                }}>
                  {change > 0 ? `₱${change.toFixed(2)}` : '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card ──────────────────────────────────────────────────────── */}
        {method === 'card' && (
          <CardFlow
            key="card"   // remount on tab switch to reset stepper
            total={total}
            onPaid={() => onPaid('card', total)}
          />
        )}

        {/* QR ────────────────────────────────────────────────────────── */}
        {method === 'qr' && (
          <QRFlow
            key="qr"
            total={total}
            onPaid={() => onPaid('gcash', total)}
          />
        )}
      </div>

      {/* ── Footer (cash only — card/QR self-complete) ─────────────────── */}
      {method === 'cash' && (
        <div style={{
          padding: '16px 32px 24px',
          borderTop: `1px solid ${T.line}`,
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '14px 0',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              background: 'transparent', border: `1px solid ${T.line2}`,
              color: T.textDim, borderRadius: T.radius, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => canCharge && onPaid('cash', tendered)}
            disabled={!canCharge}
            style={{
              flex: 2, padding: '14px 0',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
              letterSpacing: '-0.01em', textTransform: 'uppercase',
              background: canCharge ? T.accent : T.chip,
              color:      canCharge ? T.accentInk : T.textMute,
              border: 'none', borderRadius: T.radius,
              cursor: canCharge ? 'pointer' : 'not-allowed',
              transition: 'background 0.12s ease, color 0.12s ease',
            }}
          >
            {canCharge ? `Charge · ₱${total.toFixed(2)}` : 'Enter amount'}
          </button>
        </div>
      )}

      {method !== 'cash' && (
        <div style={{
          padding: '16px 32px 24px',
          borderTop: `1px solid ${T.line}`,
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '14px 0',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              background: 'transparent', border: `1px solid ${T.line2}`,
              color: T.textDim, borderRadius: T.radius, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </ModalBase>
  )
}
