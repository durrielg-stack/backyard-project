'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'

const DELAY = 4

interface PaidOverlayProps {
  total:       number
  tableLabel?: string
  orderId?:    number | null
  onDone:      () => void
}

export default function PaidOverlay({ total, tableLabel, orderId, onDone }: PaidOverlayProps) {
  const { T } = useTheme()
  const onDoneRef = useRef(onDone)
  const [remaining, setRemaining] = useState(DELAY)

  useEffect(() => {
    const dismiss = setTimeout(() => onDoneRef.current(), DELAY * 1000)
    const tick    = setInterval(() => setRemaining(r => r - 1), 1000)
    return () => { clearTimeout(dismiss); clearInterval(tick) }
  }, [])

  return (
    <div
      onClick={() => onDoneRef.current()}
      style={{
        position:  'fixed', inset: 0, zIndex: 2000,
        display:   'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'bp-fade-in 0.15s ease forwards',
        cursor: 'pointer',
      }}
    >
      <div style={{
        background:   T.surface,
        border:       `1px solid ${T.ok}44`,
        borderRadius: T.radiusLg,
        boxShadow:    `${T.shadowModal}, 0 0 60px ${T.ok}22`,
        padding:      'clamp(24px, 5vw, 48px) clamp(24px, 6vw, 64px)',
        display:      'flex', flexDirection: 'column',
        alignItems:   'center', gap: 20,
        animation:    'bp-modal-pop 0.22s ease forwards',
        width:        'min(400px, calc(100vw - 32px))',
      }}>

        {/* Check circle */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: `${T.ok}18`,
          border:     `2px solid ${T.ok}`,
          display:    'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 32 32" width={32} height={32} fill="none" stroke={T.ok} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 16L13 23L26 9" />
          </svg>
        </div>

        {/* "Paid" label */}
        <div style={{
          fontSize: 13, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: T.ok,
        }}>
          Paid
        </div>

        {/* Total */}
        <div style={{
          fontFamily: T.mono, fontSize: 'clamp(28px, 8vw, 48px)', fontWeight: 700,
          color: T.accent, letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
          ₱{total.toFixed(2)}
        </div>

        {/* Table + order info */}
        {(tableLabel || orderId) && (
          <div style={{
            fontFamily: T.mono, fontSize: 12, color: T.textMute,
            letterSpacing: '0.04em', textAlign: 'center',
          }}>
            {tableLabel && <span>{tableLabel}</span>}
            {tableLabel && orderId && <span> · </span>}
            {orderId && <span>ORDER #{orderId}</span>}
          </div>
        )}

        {/* Print button */}
        <button
          onClick={e => { e.stopPropagation(); window.print() }}
          style={{
            marginTop: 4,
            padding: '8px 20px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
            background: T.surface2, border: `1px solid ${T.line2}`,
            color: T.textDim, borderRadius: T.radius, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M4 6V2h8v4M4 12H2V7h12v5h-2M4 10h8v4H4z" />
          </svg>
          Print Receipt
        </button>

        {/* Countdown */}
        <div style={{
          fontFamily: T.mono, fontSize: 11, color: T.textMute,
          letterSpacing: '0.06em',
        }}>
          Returning to floor in {remaining}s · tap to dismiss
        </div>
      </div>
    </div>
  )
}
