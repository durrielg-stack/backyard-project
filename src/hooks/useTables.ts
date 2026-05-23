'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase'
import type { RestaurantTable, DbTableStatus } from '@/lib/types'

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
        .order('id')

      if (error) { setError(error.message) }
      else        { setTables(data ?? []) }
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
          setTables(prev => [...prev, payload.new as RestaurantTable])
        } else if (payload.eventType === 'DELETE') {
          setTables(prev => prev.filter(t => t.id !== (payload.old as RestaurantTable).id))
        }
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [])

  // Only manual operator action: mark a table reserved (or clear it).
  // All other statuses are derived — never written from the client.
  async function setReserved(tableId: string, reserved: boolean) {
    const sb = getClient()
    const { error } = await sb
      .from('restaurant_tables')
      .update({ status: (reserved ? 'reserved' : 'available') as DbTableStatus })
      .eq('id', tableId)
    if (error) setError(error.message)
  }

  return { tables, loading, error, setReserved }
}
