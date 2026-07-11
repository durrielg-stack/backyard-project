'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getClient } from '@/lib/supabase'
import type { CartLine, MenuItem, PayMethod } from '@/lib/types'
import { type DiscountType, selectSeniorPwdUnits, seniorPwdUnitPrice } from '@/lib/discounts'

interface UseOrderReturn {
  orderId:      number | null
  lines:        CartLine[]
  loading:      boolean
  error:        string | null
  clearError:   () => void
  addItem:      (item: MenuItem, qty?: number, mods?: string[], seat?: number, orderType?: 'dine_in' | 'takeout') => Promise<void>
  updateQty:    (lineId: string, delta: number) => Promise<void>
  removeItem:   (lineId: string) => Promise<void>
  voidItem:     (lineId: string, reason: string) => Promise<void>
  setNote:      (lineId: string, note: string) => Promise<void>
  setOrderType: (lineId: string, orderType: 'dine_in' | 'takeout') => Promise<void>
  closeOrder:   (method: PayMethod, tendered: number, total: number, tip: number, discount?: number, discountType?: DiscountType, seniorCount?: number) => Promise<boolean>
  payPartial:   (lineIds: string[], method: PayMethod, amount: number, tendered: number, autoClose?: boolean) => Promise<'partial' | 'closed' | 'error'>
  moveItems:    (lineIds: string[], targetTableId: string) => Promise<boolean>
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
        .select('id, menu_item_id, qty, unit_price, unit_cost, modifiers, notes, status, seat, order_type, menu_items(id, name, category, category2)')
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
        unitCost:  row.unit_cost,
        isFood:    row.menu_items?.category2 === 'Food',
        qty:       row.qty,
        mods:      row.modifiers ?? [],
        note:      row.notes ?? '',
        seat:      row.seat ?? 0,
        orderType: (row.order_type ?? 'dine_in') as 'dine_in' | 'takeout',
        status:    (row.status ?? 'pending') as CartLine['status'],
      }))

      if (!cancelled) { setLines(loaded); setLoading(false) }
    }

    init()
    return () => { cancelled = true }
  }, [tableId])

  // ── Sync CartLine status when KDS bumps items ────────────────────────────
  // Without this, addItem stacks re-orders onto served rows — those rows never
  // resurface in KDS because useTickets only shows pending/preparing/ready items.
  useEffect(() => {
    if (!orderId) return
    const sb = getClient()
    const channel = sb
      .channel(`order-items-status-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any
          setLines(prev => prev.map(l =>
            l.dbId === (row.id as number)
              ? { ...l, status: row.status as CartLine['status'], qty: row.qty as number }
              : l
          ))
        }
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [orderId])

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
  // Inventory is synced by the DB trigger trg_sync_inventory_on_order_item
  // (2026-07-11): every order_items insert/update adjusts stock atomically.
  // Never call deduct_inventory/restore_inventory from the client — a second
  // writer would double-count (two-writers rule).
  const addItem = useCallback(async (
    item: MenuItem,
    qty = 1,
    mods: string[] = [],
    seat = 0,
    orderType: 'dine_in' | 'takeout' = 'dine_in',
  ) => {
    const sb  = getClient()
    const oid = await ensureOrder()
    if (!oid) return

    // Stack: same item + same mods + same seat + same orderType + not yet served
    // Served lines must not be stacked — a re-order of a served item must create
    // a fresh order_items row so KDS sees it as a new ticket.
    const match = lines.find(l =>
      l.itemId    === item.id &&
      l.seat      === seat &&
      l.orderType === orderType &&
      l.status    !== 'served' &&
      JSON.stringify(l.mods) === JSON.stringify(mods)
    )

    if (match?.dbId) {
      const newQty = match.qty + qty
      const { error } = await sb.from('order_items').update({ qty: newQty }).eq('id', match.dbId)
      if (error) { setError(error.message); return }
      setLines(prev => prev.map(l => l.lineId === match.lineId ? { ...l, qty: newQty } : l))
    } else {
      const tempLineId = 'L' + (lineCount.current++)
      const optimistic: CartLine = {
        lineId: tempLineId, itemId: item.id, itemName: item.name,
        category: item.category, unitPrice: item.price, unitCost: item.cost,
        isFood: item.category2 === 'Food', qty, mods, note: '', seat, orderType,
        status: 'pending',
      }
      setLines(prev => [...prev, optimistic])

      const { data, error } = await sb
        .from('order_items')
        .insert({
          order_id:     oid,
          menu_item_id: item.id,
          qty,
          unit_price:   item.price,
          unit_cost:    item.cost,
          modifiers:    mods,
          status:       'pending',
          order_type:   orderType,
          seat:         seat || null,
          fired_at:     new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error) {
        setError(error.message)
        setLines(prev => prev.filter(l => l.lineId !== tempLineId))
        return
      }
      setLines(prev => prev.map(l => l.lineId === tempLineId ? { ...l, dbId: data.id as number } : l))
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

  // ── Set order type on a line ─────────────────────────────────────────────
  const setOrderType = useCallback(async (lineId: string, orderType: 'dine_in' | 'takeout') => {
    const sb   = getClient()
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    if (line.dbId) {
      const { error } = await sb.from('order_items').update({ order_type: orderType }).eq('id', line.dbId)
      if (error) { setError(error.message); return }
    }
    setLines(prev => prev.map(l => l.lineId === lineId ? { ...l, orderType } : l))
  }, [lines])

  // ── Close order: insert payment, close order, free table ────────────────
  const closeOrder = useCallback(async (
    method: PayMethod,
    tendered: number,
    total: number,
    tip: number,
    discount = 0,
    discountType: DiscountType = 'none',
    seniorCount = 0,
  ): Promise<boolean> => {
    if (!orderId) return false
    const sb = getClient()

    // Guard: reject if order is already closed (prevents duplicate payments)
    const { data: currentOrder } = await sb.from('orders').select('status').eq('id', orderId).single()
    if (currentOrder?.status === 'closed') {
      setError('Order already paid')
      return false
    }

    // Both discount types rewrite order_items.unit_price directly (not just the
    // payment amount) so Sales/COGS reporting — which reads unit_price off
    // order_items, never payments — reflects what was actually charged instead
    // of silently booking a full-price sale.
    const current = linesRef.current.filter(l => l.status !== 'voided' && l.dbId)

    if (discountType === 'owner_employee') {
      // Whole order, every line, charged at cost.
      for (const line of current) {
        await sb.from('order_items').update({ unit_price: line.unitCost ?? 0 }).eq('id', line.dbId!)
      }
    } else if (discountType === 'senior_pwd') {
      // Food only, highest price first, one unit per qualifying senior/PWD.
      // A line with more units than were selected gets split: the discounted
      // portion becomes its own row so the rest of the line stays full price.
      const selected = selectSeniorPwdUnits(
        current.map(l => ({ lineId: l.lineId, unitPrice: l.unitPrice, unitCost: l.unitCost, qty: l.qty, isFood: l.isFood })),
        seniorCount,
      )
      const countByLine = new Map<string, number>()
      for (const u of selected) countByLine.set(u.lineId, (countByLine.get(u.lineId) ?? 0) + 1)

      for (const line of current) {
        const discCount = Math.min(countByLine.get(line.lineId) ?? 0, line.qty)
        if (discCount === 0) continue
        const discountedPrice = seniorPwdUnitPrice(line.unitPrice)

        if (discCount === line.qty) {
          // Whole line qualifies — no split needed.
          await sb.from('order_items').update({ unit_price: discountedPrice }).eq('id', line.dbId!)
        } else {
          // Split: shrink the original row to the remaining full-price qty,
          // insert a new row for the discounted portion.
          const { data: orig } = await sb.from('order_items').select('*').eq('id', line.dbId!).single()
          if (!orig) continue
          await sb.from('order_items').update({ qty: line.qty - discCount }).eq('id', line.dbId!)
          await sb.from('order_items').insert({
            order_id:     orig.order_id,
            menu_item_id: orig.menu_item_id,
            qty:          discCount,
            unit_price:   discountedPrice,
            unit_cost:    orig.unit_cost,
            modifiers:    orig.modifiers,
            notes:        orig.notes,
            status:       orig.status,
            order_type:   orig.order_type,
            seat:         orig.seat,
            fired_at:     orig.fired_at,
            completed_at: orig.completed_at,
          })
        }
      }
    }

    // Build notes string
    const noteParts: string[] = []
    if (tip > 0)      noteParts.push(`Tip: ₱${tip.toFixed(2)}`)
    if (discount > 0) noteParts.push(`Discount: ₱${discount.toFixed(2)}`)
    if (discountType === 'owner_employee') noteParts.push('Owner/Employee — billed at cost')
    if (discountType === 'senior_pwd')     noteParts.push(`Senior/PWD ×${seniorCount} — 20% + VAT exempt`)

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

    const remainingLines = lines.filter(l => !lineIds.includes(l.lineId) && l.status !== 'voided')
    if (remainingLines.length === 0 && orderId) {
      // All items moved out — close the source order and free the table
      await sb.from('orders').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', orderId)
      await sb.from('restaurant_tables').update({ status: 'available' }).eq('id', tableId)
      setLines([])
      setOrderId(null)
    } else {
      setLines(prev => prev.filter(l => !lineIds.includes(l.lineId)))
    }
    return true
  }, [lines, orderId, tableId])

  return { orderId, lines, loading, error, clearError: () => setError(null), addItem, updateQty, removeItem, voidItem, setNote, setOrderType, closeOrder, payPartial, moveItems }

}
