'use client'

import { useState } from 'react'
import { THEME } from '@/lib/theme'
import ModalBase from './ModalBase'

const T = THEME

const VOID_REASONS = ['Wrong item', 'Changed mind', 'Unavailable', 'Duplicate'] as const

interface BulkVoidModalProps {
  count:     number
  onConfirm: (reason: string) => void
  onClose:   () => void
}

export default function BulkVoidModal({ count, onConfirm, onClose }: BulkVoidModalProps) {
  const [reason, setReason] = useState<string | null>(null)

  return (
    <ModalBase width={400} onBackdropClick={onClose}>
      <div style={{ padding: '28px 32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.bad, letterSpacing: '-0.01em' }}>
          Void {count} item{count !== 1 ? 's' : ''}
        </div>

        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
          textTransform: 'uppercase', color: T.textMute,
        }}>
          Reason
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {VOID_REASONS.map(r => {
            const active = reason === r
            return (
              <button
                key={r}
                onClick={() => setReason(r)}
                style={{
                  padding: '6px 14px', fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
                  background: active ? `${T.bad}18` : T.chip,
                  border:     `1px solid ${active ? T.bad : T.line2}`,
                  color:      active ? T.bad : T.textDim,
                  borderRadius: T.radius, cursor: 'pointer',
                  transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
                }}
              >
                {r}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px 0',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              background: 'transparent', border: `1px solid ${T.line2}`,
              color: T.textDim, borderRadius: T.radius, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => reason && onConfirm(reason)}
            disabled={!reason}
            style={{
              flex: 2, padding: '12px 0',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              background: reason ? T.bad : T.chip,
              color:      reason ? '#fff' : T.textMute,
              border: 'none', borderRadius: T.radius,
              cursor: reason ? 'pointer' : 'not-allowed',
              transition: 'background 0.12s ease, color 0.12s ease',
            }}
          >
            Confirm Void
          </button>
        </div>
      </div>
    </ModalBase>
  )
}
