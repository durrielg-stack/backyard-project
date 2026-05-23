'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase'
import type { Order } from '@/lib/types'

// Fetches all open orders from Supabase + subscribes to changes.
// Used by the auto-status hook to derive table state and compute openMin.
export function useOpenOrders() {
  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = getClient()

    async function load() {
      const { data } = await sb
        .from('orders')
        .select('*')
        .eq('status', 'open')
        .order('opened_at')
      setOrders(data ?? [])
      setLoading(false)
    }

    load()

    const channel = sb
      .channel('orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        load() // simple refetch — order volume is low
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [])

  return { orders, loading }
}
