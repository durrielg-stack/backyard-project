'use client'

import { useState, useRef, useEffect, memo } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { getClient } from '@/lib/supabase'

interface StaffUser { id: string; name: string; role: string; password: string }

// Hardcoded staff list — ids must match public.users.id (uuid)
const STAFF: StaffUser[] = [
  { id: 'd5e857a0-2444-40b0-b770-64387d8766ea', name: 'Melvin',  role: 'owner',   password: 'melvin'  },
  { id: '5b128d82-96ee-4783-afae-704d1ef8f9d6', name: 'Albert',  role: 'owner',   password: 'albert'  },
  { id: '2589c685-b32f-430c-9317-18139c7a59c8', name: 'Ramon',   role: 'owner',   password: 'ramon'   },
  { id: '1ea6db68-b713-43ec-abed-b3e7d1ab56fb', name: 'Arvin',   role: 'owner',   password: 'arvin'   },
  { id: 'd20a8f80-68b5-4309-a79d-0c7514503851', name: 'Marvin',  role: 'owner',   password: 'marvin'  },
  { id: 'e897578e-5ffd-48f1-b80d-c4ccb3910aca', name: 'Durriel', role: 'owner',   password: 'durriel' },
  { id: '49dfc6c2-910c-46bd-9fe0-7032c03f45a7', name: 'Booba',   role: 'manager', password: 'booba'   },
  { id: '9567524a-52e7-4f33-ae2e-20af6558f714', name: 'RJ',      role: 'waiter',  password: 'rj'      },
  { id: '0bc47a89-05d1-45ec-b369-b01f453e0a67', name: 'Angeli',  role: 'waiter',  password: 'angeli'  },
]

type Category = 'owners' | 'staff'
const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'owners', label: 'Owners' },
  { id: 'staff',  label: 'Staff'  },
]
function categoryOf(u: StaffUser): Category {
  return u.role === 'waiter' ? 'staff' : 'owners'
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

interface StaffPickerProps {
  onSelect: (userId: string, name: string, initials: string, role: string) => void
}

const StaffPicker = memo(function StaffPicker({ onSelect }: StaffPickerProps) {
  const { T } = useTheme()
  const [category, setCategory] = useState<Category>('owners')
  const [selected, setSelected] = useState<StaffUser | null>(null)
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

  // Keep Supabase anon session alive (needed for DB queries elsewhere in the app)
  useEffect(() => {
    getClient() // initialise singleton
  }, [])

  function handleLogin() {
    if (!selected || !password) return
    if (password !== selected.password) {
      setError(true)
      setPassword('')
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }
    onSelect(selected.id, selected.name, initials(selected.name), selected.role)
  }

  const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1)

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
          }}>B</div>
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
          <div style={{ width: '100%' }}>
            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {CATEGORIES.map(cat => {
                const active = category === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    style={{
                      flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700,
                      background: active ? T.accent : T.surface,
                      color: active ? T.accentInk : T.textMute,
                      border: `1px solid ${active ? T.accent : T.line2}`,
                      borderRadius: T.radius, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'background 0.12s ease',
                    }}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>

            {/* Name cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STAFF.filter(u => categoryOf(u) === category).map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
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
                    {initials(u.name)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: T.textMute, marginTop: 1 }}>{roleLabel(u.role)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ width: '100%' }}>
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
                  {initials(selected.name)}
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
})

export default StaffPicker
