'use client'

import { useState } from 'react'
import { THEME } from '@/lib/theme'

const T = THEME

const STAFF_LIST = [
  { name: 'Albert',  initials: 'AB', role: 'Owner' },
  { name: 'Arvin',   initials: 'AV', role: 'Owner' },
  { name: 'Benok',   initials: 'BK', role: 'Owner' },
  { name: 'Bimbo',   initials: 'BB', role: 'Owner' },
  { name: 'Durriel', initials: 'DG', role: 'Owner' },
  { name: 'Ramon',   initials: 'RM', role: 'Owner' },
  { name: 'Lia',     initials: 'LM', role: 'Server' },
  { name: 'Rose',    initials: 'RB', role: 'Server' },
  { name: 'Jun',     initials: 'JP', role: 'Server' },
  { name: 'Karl',    initials: 'KD', role: 'Bartender' },
  { name: 'Maya',    initials: 'MY', role: 'Server' },
]

interface StaffPickerProps {
  onSelect: (name: string, initials: string, role: string) => void
}

export default function StaffPicker({ onSelect }: StaffPickerProps) {
  const [custom, setCustom] = useState('')

  function handleCustom() {
    const name = custom.trim()
    if (!name) return
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    onSelect(name, initials, 'Staff')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: T.bg,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 32, maxWidth: 600, width: '100%', padding: '0 40px',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, background: T.accent, color: T.accentInk,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em', borderRadius: 3,
          }}>
            B
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: T.text }}>
              The Backyard Project
            </div>
            <div style={{ fontSize: 11, color: T.textMute, fontFamily: T.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              POS · Select Staff
            </div>
          </div>
        </div>

        {/* Staff grid */}
        <div style={{ width: '100%' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: T.textMute, marginBottom: 12,
          }}>
            Who's working?
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
          }}>
            {STAFF_LIST.map(s => (
              <button
                key={s.name}
                onClick={() => onSelect(s.name, s.initials, s.role)}
                style={{
                  padding: '14px 12px',
                  background: T.surface, border: `1px solid ${T.line2}`,
                  borderRadius: T.radiusLg, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'background 0.12s ease, border-color 0.12s ease',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = T.surface2
                  ;(e.currentTarget as HTMLElement).style.borderColor = T.accent
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = T.surface
                  ;(e.currentTarget as HTMLElement).style.borderColor = T.line2
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: T.chip, border: `1px solid ${T.line2}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: T.text,
                }}>
                  {s.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, textAlign: 'center' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMute, textAlign: 'center', marginTop: 1 }}>
                    {s.role}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom name */}
        <div style={{ width: '100%' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textMute, marginBottom: 8 }}>
            Or enter name
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustom()}
              placeholder="Full name…"
              style={{
                flex: 1, padding: '10px 14px', fontSize: 14,
                background: T.surface, border: `1px solid ${T.line2}`,
                color: T.text, fontFamily: 'inherit', borderRadius: T.radius, outline: 'none',
              }}
            />
            <button
              onClick={handleCustom}
              disabled={!custom.trim()}
              style={{
                padding: '10px 20px', fontSize: 13, fontWeight: 700,
                background: custom.trim() ? T.accent : T.chip,
                color: custom.trim() ? T.accentInk : T.textMute,
                border: 'none', borderRadius: T.radius, cursor: custom.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
