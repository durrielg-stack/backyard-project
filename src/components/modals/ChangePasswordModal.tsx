'use client'

import { useState } from 'react'
import ModalBase from './ModalBase'
import { useTheme } from '@/lib/ThemeContext'
import { getClient } from '@/lib/supabase'
import { logAudit } from '@/app/actions/auth'

function staffEmail(name: string): string {
  return `thebackyardprojectph+${name.toLowerCase().replace(/\s+/g, '')}@gmail.com`
}

interface Props {
  staffId: string
  staffName: string
  onClose: () => void
}

export default function ChangePasswordModal({ staffId, staffName, onClose }: Props) {
  const { T } = useTheme()
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [success, setSuccess]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return }
    if (newPw.length < 8)    { setError('New password must be at least 8 characters.'); return }
    setLoading(true)
    setError(null)
    const sb = getClient()

    const { error: verifyErr } = await sb.auth.signInWithPassword({
      email: staffEmail(staffName),
      password: currentPw,
    })
    if (verifyErr) {
      setError('Current password is incorrect.')
      setLoading(false)
      return
    }

    const { error: updateErr } = await sb.auth.updateUser({ password: newPw })
    if (updateErr) {
      setError(updateErr.message)
      setLoading(false)
      return
    }

    await logAudit(staffId, 'password_changed')
    setSuccess(true)
    setLoading(false)
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: T.textMute, marginBottom: 6, display: 'block',
  }

  function inputStyle(highlight: boolean): React.CSSProperties {
    return {
      width: '100%', padding: '11px 13px', fontSize: 14, boxSizing: 'border-box',
      background: T.bg, border: `1px solid ${highlight ? T.bad : T.line2}`,
      color: T.text, fontFamily: 'inherit', borderRadius: T.radius, outline: 'none',
    }
  }

  return (
    <ModalBase width={400} onBackdropClick={onClose}>
      <div style={{ padding: '24px 28px 28px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 20 }}>
          Change Password
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 14, color: T.text, marginBottom: 20 }}>
              Password updated successfully.
            </div>
            <button onClick={onClose} style={{
              background: T.accent, color: T.accentInk, border: 'none',
              borderRadius: T.radius, padding: '10px 24px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Current Password</label>
              <input
                type="password" value={currentPw} required autoFocus
                onChange={e => { setCurrentPw(e.target.value); setError(null) }}
                placeholder="Current password"
                style={inputStyle(!!error?.includes('Current'))}
              />
            </div>
            <div>
              <label style={labelStyle}>New Password</label>
              <input
                type="password" value={newPw} required
                onChange={e => { setNewPw(e.target.value); setError(null) }}
                placeholder="Min. 8 characters"
                style={inputStyle(false)}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm New Password</label>
              <input
                type="password" value={confirmPw} required
                onChange={e => { setConfirmPw(e.target.value); setError(null) }}
                placeholder="Repeat new password"
                style={inputStyle(!!error?.includes('match'))}
              />
            </div>
            {error && (
              <div style={{ fontSize: 12, color: T.bad, fontFamily: T.mono }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={onClose} style={{
                flex: 1, padding: '11px', fontSize: 14, fontWeight: 600,
                background: T.surface2, color: T.textDim, border: `1px solid ${T.line2}`,
                borderRadius: T.radius, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !currentPw || !newPw || !confirmPw}
                style={{
                  flex: 1, padding: '11px', fontSize: 14, fontWeight: 700,
                  background: (loading || !currentPw || !newPw || !confirmPw) ? T.chip : T.accent,
                  color: (loading || !currentPw || !newPw || !confirmPw) ? T.textMute : T.accentInk,
                  border: 'none', borderRadius: T.radius,
                  cursor: (loading || !currentPw || !newPw || !confirmPw) ? 'default' : 'pointer',
                  fontFamily: 'inherit', transition: 'background 0.12s',
                }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalBase>
  )
}
