'use client'

import { THEME } from '@/lib/theme'

const T = THEME

interface ModalBaseProps {
  width:              number | string
  onBackdropClick?:   () => void
  children:           React.ReactNode
}

/**
 * Shared modal shell.
 * Backdrop: rgba(0,0,0,0.55) + 8px blur.
 * Card:     surface bg · 1px line2 border · 4px radius · heavy shadow · bp-modal-pop animation.
 */
export default function ModalBase({ width, onBackdropClick, children }: ModalBaseProps) {
  return (
    <div
      onClick={onBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'none',        // backdrop fades in via opacity in globals
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width,
          background:   T.surface,
          border:       `1px solid ${T.line2}`,
          borderRadius: T.radiusLg,
          boxShadow:    T.shadowModal,
          animation:    'bp-modal-pop 0.22s ease forwards',
          overflow:     'hidden',
          maxHeight:    '90vh',
          display:      'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  )
}
