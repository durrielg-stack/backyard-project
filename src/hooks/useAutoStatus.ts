'use client'

import { useMemo } from 'react'
import type { RestaurantTable, Order, KdsTicket, TableWithStatus, CartLine } from '@/lib/types'

const STATUS_RANK = { firing: 0, aging: 1, late: 2 } as const

// Pure derivation — no fetching. Runs every time `tick` changes (1s interval).
//
// Status precedence:
//   reserved   → table.status = 'reserved' in DB (manager-set, overrides all)
//   attention  → any KDS ticket on table has status 'late'
//   aging      → any KDS ticket on table has status 'aging'
//   occupied   → has open order or cart items
//   available  → otherwise
export function useAutoStatus(
  tables: RestaurantTable[],
  orders: Order[],
  tickets: KdsTicket[],
  carts: Map<string, CartLine[]>,
  cartStartTimes: Map<string, number>,
  dbTotals: Map<string, number>,   // from useOpenOrders — survives page refresh
  _tick: number
): TableWithStatus[] {
  return useMemo(() => {
    const now = Date.now()

    const orderByTable = new Map<string, Order>()
    for (const o of orders) {
      if (!orderByTable.has(o.table_id)) orderByTable.set(o.table_id, o)
    }

    // Worst ticket status per table (firing < aging < late)
    const worstTicket = new Map<string, KdsTicket['status']>()
    for (const t of tickets) {
      const prev = worstTicket.get(t.tableId)
      if (!prev || STATUS_RANK[t.status] > STATUS_RANK[prev]) {
        worstTicket.set(t.tableId, t.status)
      }
    }

    return tables.map(table => {
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
      // Active when cart has items OR an open order exists in DB (survives refresh)
      const hasActivity = cart.length > 0 || !!order

      const ticketStatus = worstTicket.get(table.id)

      let status: TableWithStatus['status']
      if      (ticketStatus === 'late')             status = 'attention'
      else if (ticketStatus === 'aging')            status = 'aging'
      else if (hasActivity)                         status = 'occupied'
      else if (table.status === 'occupied')         status = 'occupied'  // manual override: no open order but staff marked occupied
      else                                          status = 'available'

      const cartStart = cartStartTimes.get(table.id)
      const startMs   = cartStart ?? (order ? new Date(order.opened_at).getTime() : null)
      const openMin   = hasActivity && startMs ? Math.floor((now - startMs) / 60_000) : 0

      // Prefer live cart total; fall back to DB total on refresh before cart is hydrated
      const cartTotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0)
      const checkTotal = cartTotal > 0 ? cartTotal : (dbTotals.get(table.id) ?? 0)

      return {
        id: table.id, label: table.label, section: table.section,
        capacity: table.capacity, pos_x: table.pos_x, pos_y: table.pos_y,
        status, openMin, checkTotal, server: null,
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, orders, tickets, carts, cartStartTimes, dbTotals, _tick])
}
