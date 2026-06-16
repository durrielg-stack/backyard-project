'use client'

import { useState, useRef, useEffect, memo } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { getClient } from '@/lib/supabase'

interface StaffUser { id: string; name: string; role: string }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function staffEmail(name: string): string {
  return `thebackyardprojectph+${name.toLowerCase().replace(/\s+/g, '')}@gmail.com`
}

type Category = 'owners' | 'staff'
const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'owners', label: 'Owners' },
  { id: 'staff',  label: 'Staff'  },
]
function categoryOf(u: StaffUser): Category {
  return u.role === 'owner' ? 'owners' : 'staff'
}

interface Props {
  onSelect: (userId: string, name: string, initials: string, role: string) => void
}

const StaffPicker = memo(function StaffPicker({ onSelect }: Props) {
  const { T } = useTheme()
  const [users, setUsers]           = useState<StaffUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [category, setCategory]     = useState<Category>('staff')
  const [selected, setSelected]     = useState<StaffUser | null>(null)
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getClient()
      .from('users')
      .select('id, name, role')
      .eq('account_status', 'active')
      .order('name')
      .then(({ data }) => {
        setUsers(data ?? [])
        setLoadingUsers(false)
      })
  }, [])

  useEffect(() => {
    if (selected) {
      setPassword('')
      setError(null)
      setForgotSent(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [selected])

  async function handleLogin() {
    if (!selected || !password || submitting) return
    setSubmitting(true)
    setError(null)
    const sb = getClient()
    const { data, error: authErr } = await sb.auth.signInWithPassword({
      email: staffEmail(selected.name),
      password,
    })
    if (authErr || !data.user) {
      setError('Incorrect password.')
      setPassword('')
      setTimeout(() => inputRef.current?.focus(), 50)
      setSubmitting(false)
      return
    }
    await sb.from('audit_logs').insert({
      user_id: selected.id,
      actor_id: selected.id,
      event: 'sign_in',
    })
    onSelect(selected.id, selected.name, initials(selected.name), selected.role)
    setSubmitting(false)
  }

  async function handleForgotPassword() {
    if (!selected) return
    await getClient().auth.resetPasswordForEmail(staffEmail(selected.name), {
      redirectTo: 'https://pos.theserverprojectph.cc/reset-password',
    })
    setForgotSent(true)
  }

  const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1)
  const filtered = users.filter(u => categoryOf(u) === category)

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
            <div style={{ fontSize: 11, color: T.headerText, fontFamily: T.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              POS · Sign In
            </div>
          </div>
        </div>

        {loadingUsers ? (
          <div style={{ fontSize: 13, color: T.textMute, fontFamily: T.mono }}>Loading...</div>
        ) : !selected ? (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {CATEGORIES.map(cat => {
                const active = category === cat.id
                return (
                  <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
                    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700,
                    background: active ? T.accent : T.surface,
                    color: active ? T.accentInk : T.textMute,
                    border: `1px solid ${active ? T.accent : T.line2}`,
                    borderRadius: T.radius, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'background 0.12s ease',
                  }}>
                    {cat.label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(u => (
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
                onClick={() => { setSelected(null); setError(null) }}
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

            {forgotSent ? (
              <div style={{
                padding: 16, background: T.surface2, borderRadius: T.radiusLg,
                fontSize: 13, color: T.text, textAlign: 'center', lineHeight: 1.6,
              }}>
                Reset link sent to the admin email.
                <br />
                <button
                  onClick={() => setForgotSent(false)}
                  style={{
                    marginTop: 10, background: 'none', border: 'none',
                    color: T.accent, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    textDecoration: 'underline',
                  }}
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
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
                  onChange={e => { setPassword(e.target.value); setError(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="Enter password..."
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: 14, boxSizing: 'border-box',
                    background: T.surface, border: `1px solid ${error ? T.bad : T.line2}`,
                    color: T.text, fontFamily: 'inherit', borderRadius: T.radius, outline: 'none',
                  }}
                />
                {error && (
                  <div style={{ marginTop: 8, fontSize: 12, color: T.bad, fontFamily: T.mono }}>
                    {error}
                  </div>
                )}
                <button
                  onClick={handleLogin}
                  disabled={!password || submitting}
                  style={{
                    marginTop: 16, width: '100%', padding: '12px', fontSize: 14, fontWeight: 700,
                    background: password && !submitting ? T.accent : T.chip,
                    color: password && !submitting ? T.accentInk : T.textMute,
                    border: 'none', borderRadius: T.radius,
                    cursor: password && !submitting ? 'pointer' : 'default',
                    fontFamily: 'inherit', transition: 'background 0.12s ease',
                  }}
                >
                  {submitting ? 'Signing in...' : 'Sign In'}
                </button>
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button
                    onClick={handleForgotPassword}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: T.textMute, fontSize: 12, fontFamily: 'inherit',
                      textDecoration: 'underline',
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

export default StaffPicker
