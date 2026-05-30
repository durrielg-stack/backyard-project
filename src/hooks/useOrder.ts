'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getClient } from '@/lib/supabase'
import type { CartLine, MenuItem, PayMethod } from '@/lib/types'

interface UseOrderReturn {
  orderId:     number | null
  lines:       CartLine[]
  loading:     boolean
  error:       string | null
  clearError:  () => void
  addItem:     (item: MenuItem, qty?: number, mods?: string[], seat?: number) => Promise<void>
  updateQty:   (lineId: string, delta: number) => Promise<void>
  removeItem:  (lineId: string) => Promise<void>
  voidItem:    (lineId: string, reason: string) => Promise<void>
  setNote:     (lineId: string, note: string) => Promise<void>
  closeOrder:  (method: PayMethod, tendered: number, total: number, tip: number, discount?: number) => Promise<boolean>
  payPartial:  (lineIds: string[], method: PayMethod, amount: number, tendered: number, autoClose?: boolean) => Promise<'partial' | 'closed' | 'error'>
  moveItems:   (lineIds: string[], targetTableId: string) => Promise<boolean>
}

export function useOrder(tableId: string, staff?: string): UseOrderReturn {
  const [orderId, setOrderId]   = useState<number | null>(null)
  const [lines, setLines]       = useState<CartLine[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const lineCount               = useRef(1)
  const linesRef                = useRef<CartLine[]>([])
  const orderIdRef              = useRef<number | null>(null)

  // Keep refs in sync so callbacks with stale closures always see current values
  useEffect(() => { linesRef.current = lines }, [lines])
  useEffect(() => { orderIdRef.current = orderId }, [orderId])

  // ── Load open order + items on mount ────────────────────────────────────
  useEffect(() => {
    if (!tableId) return
    const sb = getClient()
    let cancelled = false

    async function init() {
      setLoading(true)
      const { data: orders, error: oErr } = await sb
        .from('orders')
        .select('id, opened_at, status')
        .eq('table_id', tableId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)

      if (oErr || cancelled) { setError(oErr?.message ?? null); setLoading(false); return }

      const order = orders?.[0]
      if (!order) { setLoading(false); return }

      setOrderId(order.id as number)

      const { data: items, error: iErr } = await sb
        .from('order_items')
        .select('id, menu_item_id, qty, unit_price, modifiers, notes, status, seat, menu_items(id, name, category)')
        .eq('order_id', order.id)
        .neq('status', 'voided')
        .order('id')

      if (iErr || cancelled) { setError(iErr?.message ?? null); setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loaded: CartLine[] = (items ?? []).map((row: any) => ({
        lineId:    'L' + (lineCount.current++),
        dbId:      row.id,
        itemId:    row.menu_item_id,
        itemName:  row.menu_items?.name ?? '—',
        category:  row.menu_items?.category ?? '',
        unitPrice: row.unit_price,
        qty:       row.qty,
        mods:      row.modifiers ?? [],
        note:      row.notes ?? '',
        seat:      row.seat ?? 0,
      }))

      if (!cancelled) { setLines(loaded); setLoading(false) }
    }

    init()
    return () => { cancelled = true }
  }, [tableId])

  // ── Ensure open order exists, return its id ──────────────────────────────
  const ensureOrder = useCallback(async (): Promise<number | null> => {
    const existing = orderIdRef.current
    if (existing) return existing
    const sb = getClient()

    const { data: order, error } = await sb
      .from('orders')
      .insert({ table_id: tableId, status: 'open', opened_by: staff ?? null })
      .select('id')
      .single()

    if (error) { setError(error.message); return null }

    const oid = order.id as number
    orderIdRef.current = oid   // update ref immediately so concurrent addItem calls see it
    setOrderId(oid)
    // Mark table occupied in DB (realtime propagates to other devices)
    await sb.from('restaurant_tables').update({ status: 'occupied' }).eq('id', tableId)
    return oid
  }, [tableId, staff])

  // ── Add item ─────────────────────────────────────────────────────────────
  const addItem = useCallback(async (
    item: MenuItem,
    qty = 1,
    mods: string[] = [],
    seat = 0,
  ) => {
    const sb  = getClient()
    const oid = await ensureOrder()
    if (!oid) return

    // Stack: same item + same mods + same seat (pending lines only)
    const match = lines.find(l =>
      l.itemId === item.id &&
      l.seat   === seat &&
      JSON.stringify(l.mods) === JSON.stringify(mods)
    )

    if (match?.dbId) {
      const newQty = match.qty + qty
      const { error } = await sb.from('order_items').update({ qty: newQty }).eq('id', match.dbId)
      if (error) { setError(error.message); return }
      setLines(prev => prev.map(l => l.lineId === match.lineId ? { ...l, qty: newQty } : l))
      await sb.rpc('deduct_inventory', { p_menu_item_id: item.id, p_qty: qty })
    } else {
      // Optimistic: add immediately with a temp lineId, swap dbId on confirm
      const tempLineId = 'L' + (lineCount.current++)
      const optimistic: CartLine = {
        lineId: tempLineId, itemId: item.id, itemName: item.name,
        category: item.category, unitPrice: item.price, qty, mods, note: '', seat,
      }
      setLines(prev => [...prev, optimistic])

      const { data, error } = await sb
        .from('order_items')
        .insert({
          order_id:     oid,
          menu_item_id: item.id,
          qty,
          unit_price:   item.price,
          modifiers:    mods,
          status:       'pending',
          seat:         seat || null,
        })
        .select('id')
        .single()

      if (error) {
        setError(error.message)
        setLines(prev => prev.filter(l => l.lineId !== tempLineId))
        return
      }
      setLines(prev => prev.map(l => l.lineId === tempLineId ? { ...l, dbId: data.id as number } : l))
      await sb.rpc('deduct_inventory', { p_menu_item_id: item.id, p_qty: qty })
    }
  }, [lines, ensureOrder])

  // ── Update qty (+delta; floor at 1 — use voidItem to remove) ────────────
  const updateQty = useCallback(async (lineId: string, delta: number) => {
    const sb   = getClient()
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    const newQty = Math.max(1, line.qty + delta)
    if (newQty === line.qty) return

    if (line.dbId) {
      const { error } = await sb.from('order_items').update({ qty: newQty }).eq('id', line.dbId)
      if (error) { setError(error.message); return }
    }
    setLines(prev => prev.map(l => l.lineId === lineId ? { ...l, qty: newQty } : l))
  }, [lines])

  // ── Remove line entirely ─────────────────────────────────────────────────
  const removeItem = useCallback(async (lineId: string) => {
    await updateQty(lineId, -999)
  }, [updateQty])

  // ── Void item with reason ────────────────────────────────────────────────
  const voidItem = useCallback(async (lineId: string, reason: string) => {
    const sb   = getClient()
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    if (line.dbId) {
      const { error } = await sb.from('order_items').update({
        status:      'voided',
        void_reason: reason,
      }).eq('id', line.dbId)
      if (error) { setError(error.message); return }
    }

    const remaining = lines.filter(l => l.lineId !== lineId)
    setLines(remaining)
    await sb.rpc('restore_inventory', { p_menu_item_id: line.itemId, p_qty: line.qty })

    // Auto-close order and free table when last item is voided
    if (remaining.length === 0 && orderIdRef.current) {
      await sb.from('orders').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', orderIdRef.current)
      await sb.from('restaurant_tables').update({ status: 'available' }).eq('id', tableId)
      orderIdRef.current = null
      setOrderId(null)
    }
  }, [lines, tableId])

  // ── Set note on a line ───────────────────────────────────────────────────
  const setNote = useCallback(async (lineId: string, note: string) => {
    const sb   = getClient()
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    if (line.dbId) {
      const { error } = await sb.from('order_items').update({ notes: note }).eq('id', line.dbId)
      if (error) { setError(error.message); return }
    }
    setLines(prev => prev.map(l => l.lineId === lineId ? { ...l, note } : l))
  }, [lines])

  // ── Close order: insert payment, close order, free table ────────────────
  const closeOrder = useCallback(async (
    method: PayMethod,
    tendered: number,
    total: number,
    tip: number,
    discount = 0,
  ): Promise<boolean> => {
    if (!orderId) return false
    const sb = getClient()

    // Build notes string
    const noteParts: string[] = []
    if (tip > 0)      noteParts.push(`Tip: ₱${tip.toFixed(2)}`)
    if (discount > 0) noteParts.push(`Discount: ₱${discount.toFixed(2)}`)

    // 1. Insert payment row
    const { error: payErr } = await sb.from('payments').insert({
      order_id:   orderId,
      method,
      amount:     total,
      tendered:   method === 'cash' ? tendered : total,
      change_due: method === 'cash' ? Math.max(0, tendered - total) : 0,
      notes:      noteParts.length > 0 ? noteParts.join(' · ') : null,
    })
    if (payErr) { setError(payErr.message); return false }

    // 2. Close the order
    const { error: orderErr } = await sb
      .from('orders')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', orderId)
    if (orderErr) { setError(orderErr.message); return false }

    // 3. Free the table
    await sb.from('restaurant_tables').update({ status: 'available' }).eq('id', tableId)

    // 4. Clear local state
    setLines([])
    setOrderId(null)
    return true
  }, [orderId, tableId])

  // ── Pay partial — marks items paid, closes order when all items covered ──
  const payPartial = useCallback(async (
    lineIds: string[],
    method: PayMethod,
    amount: number,
    tendered: number,
    autoClose = true,
  ): Promise<'partial' | 'closed' | 'error'> => {
    if (!orderId) return 'error'
    const sb = getClient()

    // Insert payment row
    const { data: payment, error: payErr } = await sb
      .from('payments')
      .insert({
        order_id:   orderId,
        method,
        amount,
        tendered:   method === 'cash' ? tendered : amount,
        change_due: method === 'cash' ? Math.max(0, tendered - amount) : 0,
      })
      .select('id')
      .single()

    if (payErr || !payment) { setError(payErr?.message ?? 'Payment failed'); return 'error' }

    // Get dbIds for the lineIds being paid
    const dbIds = lines.filter(l => lineIds.includes(l.lineId) && l.dbId).map(l => l.dbId!)
    if (dbIds.length > 0) {
      await sb.from('order_items').update({ payment_id: payment.id }).in('id', dbIds)
    }

    // Close order when all lines are paid, regardless of autoClose flag
    const unpaidLines = lines.filter(l => !lineIds.includes(l.lineId))
    if (unpaidLines.length === 0) {
      await sb.from('orders').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', orderId)
      await sb.from('restaurant_tables').update({ status: 'available' }).eq('id', tableId)
      setLines([])
      setOrderId(null)
      return 'closed'
    }

    // Remove paid lines from local state
    setLines(prev => prev.filter(l => !lineIds.includes(l.lineId)))
    return 'partial'
  }, [orderId, tableId, lines])

  // ── Move items to another table's order ──────────────────────────────────
  const moveItems = useCallback(async (lineIds: string[], targetTableId: string): Promise<boolean> => {
    const sb = getClient()

    // Find or create open order on target table
    const { data: targetOrders, error: toErr } = await sb
      .from('orders')
      .select('id')
      .eq('table_id', targetTableId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)

    if (toErr) { setError(toErr.message); return false }

    let targetOrderId: number
    if (targetOrders && targetOrders.length > 0) {
      targetOrderId = targetOrders[0].id as number
    } else {
      const { data: newOrder, error: noErr } = await sb
        .from('orders')
        .insert({ table_id: targetTableId, status: 'open', opened_by: null })
        .select('id')
        .single()
      if (noErr || !newOrder) { setError(noErr?.message ?? 'Could not create order'); return false }
      targetOrderId = newOrder.id as number
      await sb.from('restaurant_tables').update({ status: 'occupied' }).eq('id', targetTableId)
    }

    const dbIds = lines.filter(l => lineIds.includes(l.lineId) && l.dbId).map(l => l.dbId!)
    if (dbIds.length > 0) {
      const { error: updErr } = await sb
        .from('order_items')
        .update({ order_id: targetOrderId })
        .in('id', dbIds)
      if (updErr) { setError(updErr.message); return false }
    }

    setLines(prev => prev.filter(l => !lineIds.includes(l.lineId)))
    return true
  }, [lines])

  return { orderId, lines, loading, error, clearError: () => setError(null), addItem, updateQty, removeItem, voidItem, setNote, closeOrder, payPartial, moveItems }

}
