'use client'

import { useState } from 'react'
import { getClient } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

interface Props { onLogin: (userId: string, name: string) => void }

export default function WaiterLogin({ onLogin }: Props) {
  const { T, mode, toggle } = useTheme()
  const [email, setEmail]   = useState('')
  const [pw, setPw]         = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const sb = getClient()

    const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pw,
    })

    if (authErr || !authData.user) {
      setError('Incorrect email or password.')
      setLoading(false)
      return
    }

    const { data: user } = await sb
      .from('users').select('name, role').eq('id', authData.user.id).single()

    if (!user || user.role !== 'waiter') {
      await sb.auth.signOut()
      setError('This account does not have waiter access.')
      setLoading(false)
      return
    }

    onLogin(authData.user.id, user.name)
  }

  return (
    <div style={{
      background: T.bg, minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      fontFamily: T.sansBody,
    }}>
      {/* Theme toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
        <button
          onClick={toggle}
          style={{
            background: T.surface, border: `1px solid ${T.line2}`,
            borderRadius: T.radiusLg, padding: '6px 10px',
            color: T.textDim, fontSize: 16, cursor: 'pointer', lineHeight: 1,
          }}
        >
          {mode === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Form */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 32px 48px',
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 44, height: 44, background: T.accent, color: T.accentInk,
            borderRadius: T.radiusLg, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, marginBottom: 12,
          }}>B</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>The Backyard Project</div>
          <div style={{ fontSize: 11, color: T.headerText, fontFamily: T.mono, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
            Waiter Access
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMute, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Email
            </div>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null) }}
              placeholder="name@backyard.pos"
              required
              autoComplete="email"
              style={{
                width: '100%', padding: '13px 14px', fontSize: 15,
                background: T.surface, border: `1px solid ${error ? T.bad : T.line2}`,
                color: T.text, borderRadius: T.radius, fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMute, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Password
            </div>
            <input
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setError(null) }}
              placeholder="Enter password"
              required
              autoComplete="current-password"
              style={{
                width: '100%', padding: '13px 14px', fontSize: 15,
                background: T.surface, border: `1px solid ${error ? T.bad : T.line2}`,
                color: T.text, borderRadius: T.radius, fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: T.bad, fontFamily: T.mono }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !pw}
            style={{
              marginTop: 4, padding: '14px', fontSize: 15, fontWeight: 700,
              background: (loading || !email || !pw) ? T.surface2 : T.accent,
              color: (loading || !email || !pw) ? T.textMute : T.accentInk,
              border: 'none', borderRadius: T.radius, cursor: (loading || !email || !pw) ? 'default' : 'pointer',
              fontFamily: 'inherit', transition: 'background 0.12s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
