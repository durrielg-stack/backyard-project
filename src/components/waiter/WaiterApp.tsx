'use client'

import { useState } from 'react'
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

  function handleSignOut() {
    localStorage.removeItem('bp_waiter')
    window.location.href = '/'
  }

  if (!session) {
    return (
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
  }

  if (screen.kind === 'floor') return (
    <WaiterFloorView
      waiterName={session.name}
      onTableSelect={tableId => setScreen({ kind: 'table', tableId })}
      onSignOut={handleSignOut}
    />
  )

  if (screen.kind === 'table') return (
    <WaiterTableView
      tableId={screen.tableId}
      waiterName={session.name}
      onAddItems={() => setScreen({ kind: 'addItems', tableId: screen.tableId })}
      onBack={() => setScreen({ kind: 'floor' })}
    />
  )

  if (screen.kind === 'addItems') return (
    <WaiterMenuPicker
      tableId={screen.tableId}
      waiterName={session.name}
      onBack={() => setScreen({ kind: 'table', tableId: screen.tableId })}
      onSent={() => setScreen({ kind: 'table', tableId: screen.tableId })}
    />
  )

  return null
}
