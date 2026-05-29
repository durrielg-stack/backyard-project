'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import WaiterLogin from './WaiterLogin'
import WaiterFloorView from './WaiterFloorView'
import WaiterTableView from './WaiterTableView'
import WaiterMenuPicker from './WaiterMenuPicker'

type Screen =
  | { kind: 'floor' }
  | { kind: 'table'; tableId: string }
  | { kind: 'addItems'; tableId: string }

interface WaiterSession { userId: string; name: string }

export default function WaiterApp() {
  const { T } = useTheme()
  const [session, setSession]       = useState<WaiterSession | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [screen, setScreen]         = useState<Screen>({ kind: 'floor' })

  useEffect(() => {
    const sb = getClient()
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s) {
        const { data: user } = await sb
          .from('users').select('name, role').eq('id', s.user.id).single()
        if (user?.role === 'waiter') {
          setSession({ userId: s.user.id, name: user.name })
        }
      }
      setAuthLoading(false)
    })
  }, [])

  function handleLogin(userId: string, name: string) {
    setSession({ userId, name })
    setScreen({ kind: 'floor' })
  }

  async function handleSignOut() {
    await getClient().auth.signOut()
    setSession(null)
    setScreen({ kind: 'floor' })
  }

  if (authLoading) return (
    <div style={{
      background: T.bg, height: '100dvh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: T.textMute, fontSize: 13, fontFamily: T.mono }}>Loading…</div>
    </div>
  )

  if (!session) return <WaiterLogin onLogin={handleLogin} />

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
