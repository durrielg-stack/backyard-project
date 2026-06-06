'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { getClient } from '@/lib/supabase'
import type { KdsTicket } from '@/lib/types'

// ── Station routing ──────────────────────────────────────────────────────────
// Categories that go to the bar station
const BAR_CATS = new Set(['Beer', 'Cocktails', 'Hard Drinks', 'Palit Bote', 'Non-Alcohol'])

// Categories that need no prep — excluded from KDS entirely
const NO_PREP_CATS = new Set(['Cigarettes', 'Charges', 'Others'])

// Specific items excluded from KDS even if their category is not in NO_PREP_CATS
// (Extra Egg and Take-Out Box are in 'Extra' but need no kitchen action)
const NO_PREP_ITEMS = new Set(['Extra Egg', 'Take-Out Box'])

function getStation(category: string): 'kitchen' | 'bar' {
  return BAR_CATS.has(category) ? 'bar' : 'kitchen'
}

// Per-category thresholds in seconds
// aging (amber): drinks 5 min, food 10 min
// late  (red):   drinks 10 min, food 20 min
function getThresholds(category: string): { agingSec: number; lateSec: number } {
  if (BAR_CATS.has(category)) return { agingSec: 300, lateSec: 600 }
  return { agingSec: 600, lateSec: 1200 }
}

// ── Internal raw item snapshot ───────────────────────────────────────────────
// Stores DB values; elapsedSec is derived per-render from `tick`.
interface RawItem {
  id:          number
  orderId:     number
  tableId:     string
  createdAtMs: number
  firedAtMs:   number | null
  itemName:    string
  qty:         number
  category:    string
  orderType:   'dine_in' | 'takeout'
  server?:     string
}

// ── useTickets ────────────────────────────────────────────────────────────────
/**
 * Fetches all active (pending | preparing | ready) order_items, groups them
 * into KDS tickets by (order_id × station), subscribes to Realtime for live
 * updates, and recomputes elapsedSec on every `tick` (the 1s root interval).
 *
 * Returns:
 *   tickets — KdsTicket[] sorted oldest-first (highest elapsed)
 *   bump    — marks all items for a given (orderId, station) as 'served'
 */
export function useTickets(tick: number): {
  tickets: KdsTicket[]
  bump: (itemIds: number[]) => Promise<void>
} {
  const [rawItems, setRawItems] = useState<RawItem[]>([])

  // ── Fetch helper ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const sb = getClient()

    // Fetch active items + joined order + menu_item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await sb
      .from('order_items')
      .select(`
        id, order_id, qty, status, fired_at, created_at, order_type,
        orders(id, table_id, opened_at, status, opened_by, users(name)),
        menu_items(name, category)
      `)
      .in('status', ['pending', 'preparing', 'ready'])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) as { data: any[] | null; error: any }

    if (error || !data) return

    const items: RawItem[] = []
    for (const row of data) {
      const order  = Array.isArray(row.orders) ? row.orders[0] : row.orders
      const mi     = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
      const opener = Array.isArray(order?.users) ? order.users[0] : order?.users

      // Only show tickets for open orders; skip no-prep items
      if (!order || order.status !== 'open') continue
      if (!mi) continue
      if (NO_PREP_CATS.has(mi.category as string)) continue
      if (NO_PREP_ITEMS.has(mi.name as string)) continue

      items.push({
        id:          row.id as number,
        orderId:     row.order_id as number,
        tableId:     order.table_id as string,
        createdAtMs: new Date(row.created_at as string).getTime(),
        firedAtMs:   row.fired_at ? new Date(row.fired_at as string).getTime() : null,
        itemName:    mi.name as string,
        qty:         (row.qty as number) ?? 1,
        category:    mi.category as string,
        orderType:   (row.order_type ?? 'dine_in') as 'dine_in' | 'takeout',
        server:      (opener?.name as string | null) ?? undefined,
      })
    }

    setRawItems(items)
  }, [])

  // ── Initial fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Realtime subscription ────────────────────────────────────────────────────
  useEffect(() => {
    const sb      = getClient()
    const channel = sb
      .channel('kds-order-items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => fetchAll()
      )
      .subscribe()

    function onVisible() { if (document.visibilityState === 'visible') fetchAll() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      sb.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchAll])

  // ── Derive KdsTicket[] from rawItems + current time ──────────────────────────
  // Items with the same (orderId, itemName) within the same order are merged
  // into one ticket with summed qty and the oldest elapsed time.
  const tickets = useMemo(() => {
    const now = Date.now()

    // Merge map keyed by "orderId\0itemName"
    const mergeMap = new Map<string, KdsTicket>()

    for (const item of rawItems) {
      const station    = getStation(item.category)
      const startMs    = item.firedAtMs ?? item.createdAtMs
      const elapsedSec = Math.max(0, Math.floor((now - startMs) / 1_000))
      const { agingSec, lateSec } = getThresholds(item.category)
      const status: KdsTicket['status'] =
        elapsedSec >= lateSec ? 'late' : elapsedSec >= agingSec ? 'aging' : 'firing'

      // Include orderType in key: same item with different types = separate tickets
      const key = `${item.orderId}\0${item.itemName}\0${item.orderType}`
      const existing = mergeMap.get(key)

      if (existing) {
        existing.itemIds.push(item.id)
        existing.qty += item.qty
        if (elapsedSec > existing.elapsedSec) {
          existing.elapsedSec = elapsedSec
          existing.status = status
        }
      } else {
        mergeMap.set(key, {
          id:         `#${item.id}`,
          itemId:     item.id,
          itemIds:    [item.id],
          orderId:    item.orderId,
          tableId:    item.tableId,
          station,
          server:     item.server ?? 'Staff',
          itemName:   item.itemName,
          qty:        item.qty,
          elapsedSec,
          status,
          orderType:  item.orderType,
        })
      }
    }

    const result = Array.from(mergeMap.values())
    // Sort: oldest (highest elapsed) first — most urgent at top
    result.sort((a, b) => b.elapsedSec - a.elapsedSec)
    return result

  // tick is the dependency that makes elapsedSec update every second
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawItems, tick])

  // ── Bump: mark all items in a merged group as 'served' ──────────────────────
  const bump = useCallback(async (itemIds: number[]) => {
    const sb = getClient()

    // Optimistic: remove all from local state immediately
    setRawItems(prev => prev.filter(i => !itemIds.includes(i.id)))

    const { error } = await (sb as any)
      .from('order_items')
      .update({ status: 'served', completed_at: new Date().toISOString() })
      .in('id', itemIds)

    if (error) fetchAll()
  }, [fetchAll])

  return { tickets, bump }
}
