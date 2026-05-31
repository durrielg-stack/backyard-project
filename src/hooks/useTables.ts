'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase'
import type { RestaurantTable, DbTableStatus } from '@/lib/types'

const PREFIX_ORDER: Record<string, number> = { T: 0, A: 1, B: 2, OT: 3 }

function sortTables<R extends { id: string }>(rows: R[]): R[] {
  return rows.slice().sort((a, b) => {
    const [, ap, an] = a.id.match(/^([A-Za-z]+)(\d+)$/) ?? ['', a.id, '0']
    const [, bp, bn] = b.id.match(/^([A-Za-z]+)(\d+)$/) ?? ['', b.id, '0']
    const ao = PREFIX_ORDER[ap] ?? 99
    const bo = PREFIX_ORDER[bp] ?? 99
    return ao !== bo ? ao - bo : parseInt(an) - parseInt(bn)
  })
}

// Returns raw table rows from Supabase + realtime subscription.
// Status derivation lives in useAutoStatus — NOT here.
export function useTables() {
  const [tables, setTables]   = useState<RestaurantTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    const sb = getClient()

    async function load() {
      const { data, error } = await sb
        .from('restaurant_tables')
        .select('*')

      if (error) { setError(error.message) }
      else { setTables(sortTables(data ?? [])) }
      setLoading(false)
    }

    load()

    const channel = sb
      .channel('tables-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setTables(prev => prev.map(t =>
            t.id === (payload.new as RestaurantTable).id ? (payload.new as RestaurantTable) : t
          ))
        } else if (payload.eventType === 'INSERT') {
          setTables(prev => sortTables([...prev, payload.new as RestaurantTable]))
        } else if (payload.eventType === 'DELETE') {
          setTables(prev => prev.filter(t => t.id !== (payload.old as RestaurantTable).id))
        }
      })
      .subscribe()

    // Refetch when tab/app returns to foreground (mobile WebSocket reconnect)
    function onVisible() { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      sb.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Only manual operator actions: set a table's base status.
  // occupied/reserved persist in DB; auto-status overrides when an order is open.
  async function setStatus(tableId: string, status: 'available' | 'occupied' | 'reserved') {
    const sb = getClient()
    const { error } = await sb
      .from('restaurant_tables')
      .update({ status: status as DbTableStatus })
      .eq('id', tableId)
    if (error) setError(error.message)
  }

  async function setReserved(tableId: string, reserved: boolean) {
    return setStatus(tableId, reserved ? 'reserved' : 'available')
  }

  return { tables, loading, error, setReserved, setStatus }
}
