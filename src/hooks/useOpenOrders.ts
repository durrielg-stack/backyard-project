'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase'
import type { Order } from '@/lib/types'

// Fetches all open orders from Supabase + subscribes to changes.
// Also fetches per-table check totals from order_items so the floor grid
// shows correct amounts after a page refresh (before local carts are rebuilt).
export function useOpenOrders() {
  const [orders,  setOrders]  = useState<Order[]>([])
  // tableId → sum of active item totals from DB
  const [totals,  setTotals]  = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    const sb = getClient()

    async function load() {
      try {
        const { data: orderData, error: oErr } = await sb
          .from('orders')
          .select('*')
          .eq('status', 'open')
          .order('opened_at')
        if (oErr) throw oErr
        const openOrders: Order[] = orderData ?? []
        setOrders(openOrders)

        // Fetch item totals for all open orders in one query
        if (openOrders.length > 0) {
          const ids = openOrders.map(o => o.id)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: items } = await (sb as any)
            .from('order_items')
            .select('order_id, qty, menu_items(price)')
            .in('order_id', ids)
            .neq('status', 'voided')

          const orderTotalMap = new Map<number, number>()
          for (const item of (items ?? [])) {
            const mi    = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items
            const price = (mi?.price as number) ?? 0
            const prev  = orderTotalMap.get(item.order_id as number) ?? 0
            orderTotalMap.set(item.order_id as number, prev + price * (item.qty as number))
          }

          const tableMap = new Map<string, number>()
          for (const o of openOrders) {
            tableMap.set(o.table_id, orderTotalMap.get(o.id) ?? 0)
          }
          setTotals(tableMap)
        } else {
          setTotals(new Map())
        }

        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders')
        setLoading(false)
      }
    }

    load()

    const channel = sb
      .channel('orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, load)
      .subscribe()

    // Refetch when tab/app returns to foreground (mobile WebSocket reconnect)
    function onVisible() { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      sb.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return { orders, totals, loading, error }
}
