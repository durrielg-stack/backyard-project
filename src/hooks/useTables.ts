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

      if (error) { setError(error.message) }
      else {
        // Natural sort: T1,T2…T11 then B1,B2… (section prefix alpha, then numeric)
        const sorted = (data ?? []).slice().sort((a, b) => {
          const [, ap, an] = a.id.match(/^([A-Za-z]+)(\d+)$/) ?? ['', a.id, '0']
          const [, bp, bn] = b.id.match(/^([A-Za-z]+)(\d+)$/) ?? ['', b.id, '0']
          return ap !== bp ? ap.localeCompare(bp) : parseInt(an) - parseInt(bn)
        })
        setTables(sorted)
      }
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
          setTables(prev => {
            const next = [...prev, payload.new as RestaurantTable]
            return next.sort((a, b) => {
              const [, ap, an] = a.id.match(/^([A-Za-z]+)(\d+)$/) ?? ['', a.id, '0']
              const [, bp, bn] = b.id.match(/^([A-Za-z]+)(\d+)$/) ?? ['', b.id, '0']
              return ap !== bp ? ap.localeCompare(bp) : parseInt(an) - parseInt(bn)
            })
          })
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
