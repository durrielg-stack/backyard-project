'use client'

import { useState, useEffect } from 'react'
import ModalBase from './ModalBase'
import { useTheme } from '@/lib/ThemeContext'
import { getClient } from '@/lib/supabase'
import { addUser, setUserStatus, resetOtherUserPassword } from '@/app/actions/auth'

interface StaffUser {
  id: string
  name: string
  role: string
  account_status: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const ROLES = ['owner', 'manager', 'waiter', 'kitchen']
function roleLabel(role: string) { return role.charAt(0).toUpperCase() + role.slice(1) }

interface Props {
  actorId: string
  actorRole: string
  onClose: () => void
}

export default function ManageUsersModal({ actorId, actorRole, onClose }: Props) {
  const { T } = useTheme()
  const isOwner = actorRole === 'owner'

  const [users, setUsers]               = useState<StaffUser[]>([])
  const [tab, setTab]                   = useState<'active' | 'all'>('active')
  const [resetTarget, setResetTarget]   = useState<StaffUser | null>(null)
  const [resetPw, setResetPw]           = useState('')
  const [resetError, setResetError]     = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [showAddForm, setShowAddForm]   = useState(false)
  const [addName, setAddName]           = useState('')
  const [addRole, setAddRole]           = useState('waiter')
  const [addPw, setAddPw]               = useState('')
  const [addError, setAddError]         = useState<string | null>(null)
  const [addLoading, setAddLoading]     = useState(false)
  const [statusLoading, setStatusLoading] = useState<string | null>(null)

  async function fetchUsers() {
    const { data } = await getClient().from('users').select('id, name, role, account_status').order('name')
    setUsers(data ?? [])
  }

  useEffect(() => { fetchUsers() }, [])

  const displayed = tab === 'active'
    ? users.filter(u => u.account_status === 'active')
    : users

  async function handleToggleStatus(user: StaffUser) {
    setStatusLoading(user.id)
    const newStatus = user.account_status === 'active' ? 'disabled' : 'active'
    const { error } = await setUserStatus(user.id, newStatus, actorId)
    if (!error) await fetchUsers()
    setStatusLoading(null)
  }

  async function handleResetPassword() {
    if (!resetTarget || !resetPw) return
    if (resetPw.length < 8) { setResetError('Password must be at least 8 characters.'); return }
    setResetLoading(true)
    setResetError(null)
    const { error } = await resetOtherUserPassword(resetTarget.id, resetPw, actorId)
    if (error) { setResetError(error); setResetLoading(false); return }
    setResetSuccess(true)
    setResetLoading(false)
  }

  function closeReset() {
    setResetTarget(null)
    setResetPw('')
    setResetError(null)
    setResetSuccess(false)
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (addPw.length < 8) { setAddError('Password must be at least 8 characters.'); return }
    setAddLoading(true)
    setAddError(null)
    const { error } = await addUser(addName.trim(), addRole, addPw)
    if (error) { setAddError(error); setAddLoading(false); return }
    setAddName('')
    setAddRole('waiter')
    setAddPw('')
    setShowAddForm(false)
    setAddLoading(false)
    await fetchUsers()
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: T.textMute, marginBottom: 8, display: 'block',
  }

  function inputStyle(err?: boolean): React.CSSProperties {
    return {
      width: '100%', padding: '9px 12px', fontSize: 13, boxSizing: 'border-box',
      background: T.bg, border: `1px solid ${err ? T.bad : T.line2}`,
      color: T.text, fontFamily: 'inherit', borderRadius: T.radius, outline: 'none',
    }
  }

  return (
    <ModalBase width={520} onBackdropClick={onClose}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px', borderBottom: `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Manage Users</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['active', 'all'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '5px 12px', fontSize: 12, fontWeight: 600,
              background: tab === t ? T.accent : T.surface2,
              color: tab === t ? T.accentInk : T.textMute,
              border: `1px solid ${tab === t ? T.accent : T.line2}`,
              borderRadius: T.radius, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {t === 'active' ? 'Active' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Reset password sub-panel */}
      {resetTarget && (
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
              Reset password for {resetTarget.name}
            </div>
            <button onClick={closeReset} style={{
              background: 'none', border: 'none', color: T.textMute,
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
          </div>
          {resetSuccess ? (
            <div style={{ fontSize: 13, color: T.text }}>
              Password reset. {resetTarget.name} has been signed out.
              <button onClick={closeReset} style={{
                marginLeft: 12, background: 'none', border: 'none',
                color: T.accent, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>Done</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password" value={resetPw} autoFocus
                onChange={e => { setResetPw(e.target.value); setResetError(null) }}
                onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                placeholder="New password (min. 8 characters)"
                style={{ ...inputStyle(!!resetError), flex: 1 }}
              />
              <button onClick={handleResetPassword} disabled={!resetPw || resetLoading} style={{
                padding: '9px 16px', fontSize: 13, fontWeight: 700,
                background: resetPw && !resetLoading ? T.accent : T.chip,
                color: resetPw && !resetLoading ? T.accentInk : T.textMute,
                border: 'none', borderRadius: T.radius,
                cursor: resetPw && !resetLoading ? 'pointer' : 'default',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>
                {resetLoading ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          )}
          {resetError && (
            <div style={{ fontSize: 12, color: T.bad, fontFamily: T.mono, marginTop: 8 }}>{resetError}</div>
          )}
        </div>
      )}

      {/* User list */}
      <div className="bp-no-scrollbar" style={{ overflowY: 'auto', flex: 1 }}>
        {displayed.map(user => (
          <div key={user.id} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 24px', borderBottom: `1px solid ${T.line}`,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: user.account_status === 'disabled' ? T.chip : T.surface2,
              border: `1px solid ${T.line2}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              color: user.account_status === 'disabled' ? T.textMute : T.text,
              opacity: user.account_status === 'disabled' ? 0.5 : 1,
            }}>
              {initials(user.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: user.account_status === 'disabled' ? T.textMute : T.text,
              }}>
                {user.name}
              </div>
              <div style={{ fontSize: 11, color: T.textMute, marginTop: 1 }}>
                {roleLabel(user.role)}
                {user.account_status === 'disabled' && (
                  <span style={{
                    marginLeft: 6, fontSize: 10, fontFamily: T.mono,
                    color: T.bad, textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>Disabled</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {user.id !== actorId && (
                <button
                  onClick={() => { setResetTarget(user); setResetPw(''); setResetError(null); setResetSuccess(false) }}
                  style={{
                    padding: '5px 10px', fontSize: 11, fontWeight: 600,
                    background: T.surface2, color: T.textDim,
                    border: `1px solid ${T.line2}`, borderRadius: T.radius,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Reset PW
                </button>
              )}
              {isOwner && user.id !== actorId && (
                <button
                  onClick={() => handleToggleStatus(user)}
                  disabled={statusLoading === user.id}
                  style={{
                    padding: '5px 10px', fontSize: 11, fontWeight: 600,
                    background: user.account_status === 'active' ? T.surface2 : T.surface,
                    color: user.account_status === 'active' ? T.bad : T.accent,
                    border: `1px solid ${T.line2}`, borderRadius: T.radius,
                    cursor: statusLoading === user.id ? 'default' : 'pointer',
                    fontFamily: 'inherit', opacity: statusLoading === user.id ? 0.5 : 1,
                  }}
                >
                  {user.account_status === 'active' ? 'Disable' : 'Enable'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add user (owners only) */}
      {isOwner && (
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)} style={{
              width: '100%', padding: '10px', fontSize: 13, fontWeight: 700,
              background: T.surface2, color: T.textDim,
              border: `1px dashed ${T.line2}`, borderRadius: T.radius,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + Add User
            </button>
          ) : (
            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>New User</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={sectionLabel}>Name</label>
                  <input
                    type="text" value={addName} required autoFocus
                    onChange={e => { setAddName(e.target.value); setAddError(null) }}
                    placeholder="Full name"
                    style={inputStyle()}
                  />
                </div>
                <div style={{ width: 130 }}>
                  <label style={sectionLabel}>Role</label>
                  <select
                    value={addRole} onChange={e => setAddRole(e.target.value)}
                    style={{ ...inputStyle(), appearance: 'none', WebkitAppearance: 'none' }}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{roleLabel(r)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={sectionLabel}>Initial Password</label>
                <input
                  type="password" value={addPw} required
                  onChange={e => { setAddPw(e.target.value); setAddError(null) }}
                  placeholder="Min. 8 characters"
                  style={inputStyle(!!addError)}
                />
              </div>
              {addError && (
                <div style={{ fontSize: 12, color: T.bad, fontFamily: T.mono }}>{addError}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setShowAddForm(false); setAddError(null) }} style={{
                  flex: 1, padding: '9px', fontSize: 13, fontWeight: 600,
                  background: T.surface2, color: T.textDim, border: `1px solid ${T.line2}`,
                  borderRadius: T.radius, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Cancel
                </button>
                <button type="submit" disabled={addLoading || !addName || !addPw} style={{
                  flex: 1, padding: '9px', fontSize: 13, fontWeight: 700,
                  background: (addLoading || !addName || !addPw) ? T.chip : T.accent,
                  color: (addLoading || !addName || !addPw) ? T.textMute : T.accentInk,
                  border: 'none', borderRadius: T.radius,
                  cursor: (addLoading || !addName || !addPw) ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}>
                  {addLoading ? 'Adding...' : 'Add User'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </ModalBase>
  )
}
