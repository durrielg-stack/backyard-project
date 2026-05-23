'use client'

import { useMemo } from 'react'
import type { RestaurantTable, Order, KdsTicket, TableWithStatus, CartLine } from '@/lib/types'

// Pure derivation — no fetching. Runs every time `tick` changes (1s interval).
//
// Status precedence (from README):
//   reserved   → table.status = 'reserved' in DB (manager-set, overrides all)
//   attention  → any KDS ticket on table elapsed > 10:00
//   aging      → any KDS ticket on table elapsed > 6:00
//   occupied   → has cart items (cart is source of truth; empty cart = available)
//   available  → otherwise
export function useAutoStatus(
  tables: RestaurantTable[],
  orders: Order[],
  tickets: KdsTicket[],
  carts: Map<string, CartLine[]>,
  _tick: number          // just forces re-evaluation each second
): TableWithStatus[] {
  return useMemo(() => {
    const now = Date.now()

    // Index open orders by table
    const orderByTable = new Map<string, Order>()
    for (const o of orders) {
      if (!orderByTable.has(o.table_id)) orderByTable.set(o.table_id, o)
    }

    // Max elapsed ticket (in seconds) per table
    const maxElapsed = new Map<string, number>()
    for (const t of tickets) {
      const prev = maxElapsed.get(t.tableId) ?? 0
      if (t.elapsedSec > prev) maxElapsed.set(t.tableId, t.elapsedSec)
    }

    return tables.map(table => {
      // 1. Reserved — manual, pinned
      if (table.status === 'reserved') {
        return {
          id: table.id, label: table.label, section: table.section,
          capacity: table.capacity, pos_x: table.pos_x, pos_y: table.pos_y,
          status: 'reserved' as const,
          openMin: 0, checkTotal: 0, server: null,
        }
      }

      const cart    = carts.get(table.id) ?? []
      const order   = orderByTable.get(table.id)
      const elapsed = maxElapsed.get(table.id) ?? 0
      const hasActivity = cart.length > 0

      // 2–4. Derive status
      let status: TableWithStatus['status']
      if      (elapsed > 600) status = 'attention'
      else if (elapsed > 360) status = 'aging'
      else if (hasActivity)   status = 'occupied'
      else                    status = 'available'

      // Compute openMin from the oldest open order on this table
      const openMin = order
        ? Math.floor((now - new Date(order.opened_at).getTime()) / 60_000)
        : 0

      // Check total from local cart (optimistic; synced from DB on load)
      const checkTotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0)

      return {
        id: table.id, label: table.label, section: table.section,
        capacity: table.capacity, pos_x: table.pos_x, pos_y: table.pos_y,
        status, openMin, checkTotal, server: null,
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, orders, tickets, carts, _tick])
}
