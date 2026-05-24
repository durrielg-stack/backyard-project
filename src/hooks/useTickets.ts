'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { getClient } from '@/lib/supabase'
import type { KdsTicket } from '@/lib/types'

// ── Station routing ──────────────────────────────────────────────────────────
// Categories that go to the bar station
const BAR_CATS = new Set(['Beer', 'Cocktails/Hard', 'Non-Alcohol'])

// Categories that need no prep — excluded from KDS entirely
const NO_PREP_CATS = new Set(['Cigarettes', 'Charges'])

function getStation(category: string): 'kitchen' | 'bar' {
  return BAR_CATS.has(category) ? 'bar' : 'kitchen'
}

// ── Internal raw item snapshot ───────────────────────────────────────────────
// Stores DB values; elapsedSec is derived per-render from `tick`.
interface RawItem {
  id:          number
  orderId:     number
  tableId:     string
  openedAtMs:  number          // fallback if fired_at is null
  firedAtMs:   number | null   // epoch ms when item was fired
  itemName:    string
  category:    string
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
  bump: (orderId: number, station: 'kitchen' | 'bar') => Promise<void>
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
        id, order_id, status, fired_at,
        orders(id, table_id, opened_at, status),
        menu_items(name, category)
      `)
      .in('status', ['pending', 'preparing', 'ready']) as { data: any[] | null; error: any }

    if (error || !data) return

    const items: RawItem[] = []
    for (const row of data) {
      const order = Array.isArray(row.orders) ? row.orders[0] : row.orders
      const mi    = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items

      // Only show tickets for open orders; skip no-prep items
      if (!order || order.status !== 'open') continue
      if (!mi) continue
      if (NO_PREP_CATS.has(mi.category as string)) continue

      items.push({
        id:         row.id as number,
        orderId:    row.order_id as number,
        tableId:    order.table_id as string,
        openedAtMs: new Date(order.opened_at as string).getTime(),
        firedAtMs:  row.fired_at ? new Date(row.fired_at as string).getTime() : null,
        itemName:   mi.name as string,
        category:   mi.category as string,
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
        () => {
          // Full refetch on any change — data volume is small (active items only)
          fetchAll()
        }
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [fetchAll])

  // ── Derive KdsTicket[] from rawItems + current time ──────────────────────────
  // Re-runs on every `tick` so elapsedSec stays live.
  const tickets = useMemo(() => {
    const now = Date.now()

    // Group by orderId + station
    type Group = {
      orderId:    number
      tableId:    string
      station:    'kitchen' | 'bar'
      startMs:    number      // earliest start among items in this group
      itemNames:  string[]
    }
    const groups = new Map<string, Group>()

    for (const item of rawItems) {
      const station = getStation(item.category)
      const key     = `${item.orderId}-${station}`
      const startMs = item.firedAtMs ?? item.openedAtMs

      if (!groups.has(key)) {
        groups.set(key, {
          orderId:   item.orderId,
          tableId:   item.tableId,
          station,
          startMs,
          itemNames: [],
        })
      }

      const g = groups.get(key)!
      // Use the earliest start time across items in this ticket
      if (startMs < g.startMs) g.startMs = startMs
      g.itemNames.push(item.itemName)
    }

    // Convert groups → KdsTicket[], compute live elapsedSec
    const result: KdsTicket[] = []
    for (const [, g] of groups) {
      const elapsedSec = Math.max(0, Math.floor((now - g.startMs) / 1_000))
      const status: KdsTicket['status'] =
        elapsedSec > 600 ? 'late' : elapsedSec > 360 ? 'aging' : 'firing'

      result.push({
        id:         `#${g.orderId}-${g.station === 'kitchen' ? 'K' : 'B'}`,
        orderId:    g.orderId,
        tableId:    g.tableId,
        station:    g.station,
        server:     'Server',   // TODO: pull from orders.opened_by when auth lands
        items:      g.itemNames,
        elapsedSec,
        status,
      })
    }

    // Sort: oldest (highest elapsed) first — most urgent at top
    result.sort((a, b) => b.elapsedSec - a.elapsedSec)
    return result

  // tick is the dependency that makes elapsedSec update every second
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawItems, tick])

  // ── Bump: mark all items for (orderId, station) as 'served' ─────────────────
  const bump = useCallback(async (orderId: number, station: 'kitchen' | 'bar') => {
    const sb = getClient()

    // Find the item IDs to bump
    const ids = rawItems
      .filter(i => i.orderId === orderId && getStation(i.category) === station)
      .map(i => i.id)

    if (ids.length === 0) return

    // Optimistic: remove from local state immediately
    setRawItems(prev => prev.filter(i => !(i.orderId === orderId && getStation(i.category) === station)))

    // Persist
    const { error } = await (sb as any)
      .from('order_items')
      .update({ status: 'served', completed_at: new Date().toISOString() })
      .in('id', ids)

    if (error) {
      // Rollback: refetch
      fetchAll()
    }
  }, [rawItems, fetchAll])

  return { tickets, bump }
}
