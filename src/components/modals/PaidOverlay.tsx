'use client'

import { useEffect } from 'react'
import { THEME } from '@/lib/theme'

const T = THEME

interface PaidOverlayProps {
  total:   number
  onDone:  () => void   // called after 1.5s — navigate back to floor
}

/**
 * Fullscreen blurred overlay that pops a "Paid · ₱X.XX" card with a green check,
 * then auto-closes after 1.5s and calls onDone (which returns to Floor view).
 */
export default function PaidOverlay({ total, onDone }: PaidOverlayProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      style={{
        position:  'fixed', inset: 0, zIndex: 2000,
        display:   'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'bp-fade-in 0.15s ease forwards',
      }}
    >
      <div style={{
        background:   T.surface,
        border:       `1px solid ${T.ok}44`,
        borderRadius: T.radiusLg,
        boxShadow:    `${T.shadowModal}, 0 0 60px ${T.ok}22`,
        padding:      '48px 64px',
        display:      'flex', flexDirection: 'column',
        alignItems:   'center', gap: 20,
        animation:    'bp-modal-pop 0.22s ease forwards',
        minWidth:     320,
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
          fontFamily: T.mono, fontSize: 48, fontWeight: 700,
          color: T.accent, letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
          ₱{total.toFixed(2)}
        </div>

        {/* Auto-dismiss hint */}
        <div style={{
          fontFamily: T.mono, fontSize: 11, color: T.textMute,
          letterSpacing: '0.06em',
        }}>
          Returning to floor…
        </div>
      </div>
    </div>
  )
}
