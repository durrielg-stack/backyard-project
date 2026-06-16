'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { getClient } from '@/lib/supabase'
import KitchenView from './KitchenView'
import KitchenLogin from './KitchenLogin'

interface KitchenSession { userId: string; name: string }

function loadSession(): KitchenSession | null {
  try {
    const raw = localStorage.getItem('bp_kitchen')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export default function KitchenApp() {
  const { T } = useTheme()
  const [session, setSession] = useState<KitchenSession | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSession(loadSession())
    setReady(true)
  }, [])

  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window.screen.orientation as any)?.lock?.('portrait').catch(() => {})
    } catch { /* ignore */ }
  }, [])

  async function handleSignOut() {
    await getClient().auth.signOut()
    localStorage.removeItem('bp_kitchen')
    window.location.href = '/'
  }

  function handleLogin(userId: string, name: string) {
    const s = { userId, name }
    localStorage.setItem('bp_kitchen', JSON.stringify(s))
    setSession(s)
  }

  const landscapeOverlay = (
    <div
      style={{ display: 'none', position: 'fixed', inset: 0, zIndex: 9999, background: T.bg, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}
      className="bp-landscape-block"
    >
      <div style={{ fontSize: 40 }}>↩️</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Rotate your device</div>
      <div style={{ fontSize: 13, color: T.textMute, textAlign: 'center', maxWidth: 240 }}>Portrait mode only.</div>
    </div>
  )

  if (!ready) return null

  if (!session) {
    return (
      <>
        {landscapeOverlay}
        <KitchenLogin onLogin={handleLogin} />
      </>
    )
  }

  return (
    <>
      {landscapeOverlay}
      <KitchenView session={session} onSignOut={handleSignOut} />
    </>
  )
}
