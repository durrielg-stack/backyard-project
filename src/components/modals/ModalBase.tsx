'use client'

import { useEffect, useRef } from 'react'
import { THEME } from '@/lib/theme'

const T = THEME

interface ModalBaseProps {
  width:              number | string
  onBackdropClick?:   () => void
  children:           React.ReactNode
}

export default function ModalBase({ width, onBackdropClick, children }: ModalBaseProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'

    function trapFocus(e: KeyboardEvent) {
      if (e.key === 'Escape') { onBackdropClick?.(); return }
      if (e.key !== 'Tab') return
      const el = cardRef.current
      if (!el) return
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!nodes.length) return
      const first = nodes[0]
      const last  = nodes[nodes.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus() }
      }
    }

    // Move focus into modal on open
    const first = cardRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()

    document.addEventListener('keydown', trapFocus)
    return () => document.removeEventListener('keydown', trapFocus)
  }, [onBackdropClick])

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
        ref={cardRef}
        onClick={e => e.stopPropagation()}
        style={{
          width,
          maxWidth:     'calc(100vw - 24px)',
          background:   T.surface,
          border:       `1px solid ${T.line2}`,
          borderRadius: T.radiusLg,
          boxShadow:    T.shadowModal,
          animation:    'bp-modal-pop 0.22s ease forwards',
          overflow:     'hidden',
          maxHeight:    '92vh',
          display:      'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  )
}
