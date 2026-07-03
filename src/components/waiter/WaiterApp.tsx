'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { getClient } from '@/lib/supabase'
import { useSessionGuard } from '@/hooks/useSessionGuard'
import WaiterFloorView from './WaiterFloorView'
import WaiterTableView from './WaiterTableView'
import WaiterMenuPicker from './WaiterMenuPicker'
import WaiterLogin from './WaiterLogin'

type Screen =
  | { kind: 'floor' }
  | { kind: 'table'; tableId: string }
  | { kind: 'addItems'; tableId: string }

interface WaiterSession { userId: string; name: string }

function loadSession(): WaiterSession | null {
  try {
    const raw = localStorage.getItem('bp_waiter')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export default function WaiterApp() {
  const { T } = useTheme()
  const [session, setSession] = useState<WaiterSession | null>(() => loadSession())
  const [screen, setScreen] = useState<Screen>({ kind: 'floor' })

  useSessionGuard('bp_waiter', () => setSession(null))

  useEffect(() => {
    // Try to lock orientation via API (supported in most mobile browsers)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.screen.orientation as any)?.lock?.('portrait').catch(() => {})
    } catch { /* silently ignore if browser doesn't support */ }
  }, [])

  async function handleSignOut() {
    await getClient().auth.signOut()
    localStorage.removeItem('bp_waiter')
    window.location.href = '/'
  }

  function handleLogin(userId: string, name: string) {
    const s = { userId, name }
    localStorage.setItem('bp_waiter', JSON.stringify(s))
    setSession(s)
  }

  // CSS-based landscape block — shown via @media when API lock isn't supported
  const landscapeOverlay = (
    <div style={{
      display: 'none',
      position: 'fixed', inset: 0, zIndex: 9999,
      background: T.bg, flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}
      className="bp-landscape-block"
    >
      <div style={{ fontSize: 40 }}>↩️</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Rotate your device</div>
      <div style={{ fontSize: 13, color: T.textMute, textAlign: 'center', maxWidth: 240 }}>
        This view is designed for portrait mode only.
      </div>
    </div>
  )

  let content: React.ReactNode

  if (!session) {
    content = <WaiterLogin onLogin={handleLogin} />
  } else if (screen.kind === 'floor') {
    content = (
      <WaiterFloorView
        waiterName={session.name}
        onTableSelect={tableId => setScreen({ kind: 'table', tableId })}
        onSignOut={handleSignOut}
      />
    )
  } else if (screen.kind === 'table') {
    content = (
      <WaiterTableView
        tableId={screen.tableId}
        waiterId={session.userId}
        waiterName={session.name}
        onAddItems={() => setScreen({ kind: 'addItems', tableId: screen.tableId })}
        onBack={() => setScreen({ kind: 'floor' })}
      />
    )
  } else if (screen.kind === 'addItems') {
    content = (
      <WaiterMenuPicker
        tableId={screen.tableId}
        waiterId={session.userId}
        waiterName={session.name}
        onBack={() => setScreen({ kind: 'table', tableId: screen.tableId })}
        onSent={() => setScreen({ kind: 'table', tableId: screen.tableId })}
      />
    )
  }

  return (
    <>
      {landscapeOverlay}
      {content}
    </>
  )
}
