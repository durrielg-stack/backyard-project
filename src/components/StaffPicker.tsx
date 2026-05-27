'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from '@/lib/ThemeContext'

const STAFF_LIST = [
  { name: 'Marvin',  initials: 'MV', role: 'Staff',    password: 'marvin'  },
  { name: 'Durriel', initials: 'DG', role: 'Owner',    password: 'durriel' },
  { name: 'Booba',   initials: 'BB', role: 'Staff',    password: 'booba'   },
]

interface StaffPickerProps {
  onSelect: (name: string, initials: string, role: string) => void
}

export default function StaffPicker({ onSelect }: StaffPickerProps) {
  const { T } = useTheme()
  const [selected, setSelected] = useState<typeof STAFF_LIST[0] | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selected) {
      setPassword('')
      setError(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [selected])

  function handleLogin() {
    if (!selected) return
    if (password === selected.password) {
      onSelect(selected.name, selected.initials, selected.role)
    } else {
      setError(true)
      setPassword('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: T.bg,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 36, maxWidth: 480, width: '100%', padding: '0 40px',
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
              POS · Sign In
            </div>
          </div>
        </div>

        {!selected ? (
          /* ── User selection ── */
          <div style={{ width: '100%' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: T.textMute, marginBottom: 12,
            }}>
              Who's working?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STAFF_LIST.map(s => (
                <button
                  key={s.name}
                  onClick={() => setSelected(s)}
                  style={{
                    padding: '14px 16px',
                    background: T.surface, border: `1px solid ${T.line2}`,
                    borderRadius: T.radiusLg, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'background 0.12s ease, border-color 0.12s ease',
                    fontFamily: 'inherit', textAlign: 'left',
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
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: T.chip, border: `1px solid ${T.line2}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: T.text,
                  }}>
                    {s.initials}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: T.textMute, marginTop: 1 }}>{s.role}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Password entry ── */
          <div style={{ width: '100%' }}>
            {/* Back + user header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <button
                onClick={() => { setSelected(null); setError(false) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: T.textMute, fontSize: 13, padding: '4px 0',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                ← Back
              </button>
              <div style={{ width: 1, height: 16, background: T.line }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: T.chip, border: `1px solid ${T.line2}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: T.text,
                }}>
                  {selected.initials}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{selected.name}</div>
              </div>
            </div>

            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: T.textMute, marginBottom: 8,
            }}>
              Password
            </div>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false) }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Enter password…"
              style={{
                width: '100%', padding: '12px 14px', fontSize: 14, boxSizing: 'border-box',
                background: T.surface, border: `1px solid ${error ? T.bad : T.line2}`,
                color: T.text, fontFamily: 'inherit', borderRadius: T.radius, outline: 'none',
              }}
            />
            {error && (
              <div style={{ marginTop: 8, fontSize: 12, color: T.bad, fontFamily: T.mono }}>
                Incorrect password. Try again.
              </div>
            )}
            <button
              onClick={handleLogin}
              disabled={!password}
              style={{
                marginTop: 16, width: '100%', padding: '12px', fontSize: 14, fontWeight: 700,
                background: password ? T.accent : T.chip,
                color: password ? T.accentInk : T.textMute,
                border: 'none', borderRadius: T.radius,
                cursor: password ? 'pointer' : 'default',
                fontFamily: 'inherit', transition: 'background 0.12s ease',
              }}
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
