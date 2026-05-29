'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import WaiterFloorView from './WaiterFloorView'
import WaiterTableView from './WaiterTableView'
import WaiterMenuPicker from './WaiterMenuPicker'

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
  const [session] = useState<WaiterSession | null>(() => loadSession())
  const [screen, setScreen] = useState<Screen>({ kind: 'floor' })

  useEffect(() => {
    // Try to lock orientation via API (supported in most mobile browsers)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.screen.orientation as any)?.lock?.('portrait').catch(() => {})
    } catch { /* silently ignore if browser doesn't support */ }
  }, [])

  function handleSignOut() {
    localStorage.removeItem('bp_waiter')
    window.location.href = '/'
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
    content = (
      <div style={{
        background: T.bg, height: '100dvh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{ color: T.textMute, fontSize: 13, fontFamily: T.mono }}>
          No active session.
        </div>
        <button
          onClick={() => { window.location.href = '/' }}
          style={{
            background: T.accent, color: T.accentInk, border: 'none',
            borderRadius: T.radius, padding: '10px 20px', fontSize: 13,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Go to Sign In
        </button>
      </div>
    )
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
        waiterName={session.name}
        onAddItems={() => setScreen({ kind: 'addItems', tableId: screen.tableId })}
        onBack={() => setScreen({ kind: 'floor' })}
      />
    )
  } else if (screen.kind === 'addItems') {
    content = (
      <WaiterMenuPicker
        tableId={screen.tableId}
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
