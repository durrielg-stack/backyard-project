'use client'

import { useState, useEffect } from 'react'
import { getClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [tokenHash, setTokenHash] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hash = params.get('token_hash')
    const type = params.get('type')
    if (!hash || type !== 'recovery') {
      setVerifyError('Invalid or expired reset link.')
      return
    }
    setTokenHash(hash)
    getClient()
      .auth.verifyOtp({ token_hash: hash, type: 'recovery' })
      .then(({ error: err }) => {
        if (err) setVerifyError('Reset link is invalid or has expired.')
        else setSessionReady(true)
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    setError(null)
    const { error: updateErr } = await getClient().auth.updateUser({ password: newPw })
    if (updateErr) { setError(updateErr.message); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
    setTimeout(() => { window.location.href = '/' }, 2000)
  }

  const bg = '#0f1117'
  const surface = '#1a1d27'
  const accent = '#c87941'
  const accentInk = '#fff'
  const text = '#e8e6e1'
  const textMute = '#6b6f7a'
  const bad = '#e05454'
  const line2 = '#2a2d3a'
  const radius = '2px'
  const mono = 'ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace'
  const sans = 'Inter, system-ui, sans-serif'

  return (
    <div style={{
      minHeight: '100dvh', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: sans, padding: '0 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 44, height: 44, background: accent, color: accentInk,
            borderRadius: '6px', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, marginBottom: 12,
          }}>B</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: text }}>The Backyard Project</div>
          <div style={{ fontSize: 11, color: textMute, fontFamily: mono, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
            Reset Password
          </div>
        </div>

        {!tokenHash && !verifyError ? (
          <div style={{ textAlign: 'center', color: textMute, fontSize: 13, fontFamily: mono }}>
            Verifying link...
          </div>
        ) : verifyError ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: bad, marginBottom: 20 }}>{verifyError}</div>
            <a href="/" style={{ color: accent, fontSize: 13 }}>Back to sign in</a>
          </div>
        ) : success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: text, marginBottom: 8 }}>Password updated successfully.</div>
            <div style={{ fontSize: 12, color: textMute, fontFamily: mono }}>Redirecting to sign in...</div>
          </div>
        ) : sessionReady ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: textMute, marginBottom: 8 }}>
                New Password
              </div>
              <input
                type="password"
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setError(null) }}
                placeholder="Min. 8 characters"
                required
                autoFocus
                style={{
                  width: '100%', padding: '13px 14px', fontSize: 15, boxSizing: 'border-box',
                  background: surface, border: `1px solid ${line2}`,
                  color: text, borderRadius: radius, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: textMute, marginBottom: 8 }}>
                Confirm New Password
              </div>
              <input
                type="password"
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setError(null) }}
                placeholder="Repeat new password"
                required
                style={{
                  width: '100%', padding: '13px 14px', fontSize: 15, boxSizing: 'border-box',
                  background: surface, border: `1px solid ${error ? bad : line2}`,
                  color: text, borderRadius: radius, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            {error && (
              <div style={{ fontSize: 12, color: bad, fontFamily: mono }}>{error}</div>
            )}
            <button
              type="submit"
              disabled={loading || !newPw || !confirmPw}
              style={{
                marginTop: 4, padding: '14px', fontSize: 15, fontWeight: 700,
                background: (loading || !newPw || !confirmPw) ? '#2a2d3a' : accent,
                color: (loading || !newPw || !confirmPw) ? textMute : accentInk,
                border: 'none', borderRadius: radius, cursor: (loading || !newPw || !confirmPw) ? 'default' : 'pointer',
                fontFamily: 'inherit', transition: 'background 0.12s',
              }}
            >
              {loading ? 'Updating...' : 'Set New Password'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
