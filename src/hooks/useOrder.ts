'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getClient } from '@/lib/supabase'
import type { CartLine, MenuItem, PayMethod } from '@/lib/types'

interface UseOrderReturn {
  orderId:     number | null
  lines:       CartLine[]
  loading:     boolean
  error:       string | null
  addItem:     (item: MenuItem, qty?: number, mods?: string[], seat?: number) => Promise<void>
  updateQty:   (lineId: string, delta: number) => Promise<void>
  removeItem:  (lineId: string) => Promise<void>
  voidItem:    (lineId: string, reason: string) => Promise<void>
  setNote:     (lineId: string, note: string) => Promise<void>
  toggleMod:   (lineId: string, mod: string) => void
  closeOrder:  (method: PayMethod, tendered: number, total: number, tip: number) => Promise<boolean>
}

export function useOrder(tableId: string): UseOrderReturn {
  const [orderId, setOrderId]   = useState<number | null>(null)
  const [lines, setLines]       = useState<CartLine[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const lineCount               = useRef(1)

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
        .select('id, menu_item_id, qty, unit_price, modifiers, notes, status, seat, menu_items(id, name)')
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
    if (orderId) return orderId
    const sb = getClient()

    const { data: order, error } = await sb
      .from('orders')
      .insert({ table_id: tableId, status: 'open' })
      .select('id')
      .single()

    if (error) { setError(error.message); return null }

    const oid = order.id as number
    setOrderId(oid)
    // Mark table occupied in DB (realtime propagates to other devices)
    await sb.from('restaurant_tables').update({ status: 'occupied' }).eq('id', tableId)
    return oid
  }, [orderId, tableId])

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
    } else {
      // Optimistic: add immediately with a temp lineId, swap dbId on confirm
      const tempLineId = 'L' + (lineCount.current++)
      const optimistic: CartLine = {
        lineId: tempLineId, itemId: item.id, itemName: item.name,
        unitPrice: item.price, qty, mods, note: '', seat,
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
    }
  }, [lines, ensureOrder])

  // ── Update qty (+delta; removes line at 0) ───────────────────────────────
  const updateQty = useCallback(async (lineId: string, delta: number) => {
    const sb   = getClient()
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    const newQty = line.qty + delta

    if (newQty <= 0) {
      if (line.dbId) {
        const { error } = await sb.from('order_items').update({ status: 'voided' }).eq('id', line.dbId)
        if (error) { setError(error.message); return }
      }
      setLines(prev => prev.filter(l => l.lineId !== lineId))
    } else {
      if (line.dbId) {
        const { error } = await sb.from('order_items').update({ qty: newQty }).eq('id', line.dbId)
        if (error) { setError(error.message); return }
      }
      setLines(prev => prev.map(l => l.lineId === lineId ? { ...l, qty: newQty } : l))
    }
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
    setLines(prev => prev.filter(l => l.lineId !== lineId))
  }, [lines])

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

  // ── Toggle modifier (local only — persisted on next item-level save) ─────
  const toggleMod = useCallback((lineId: string, mod: string) => {
    setLines(prev => prev.map(l => {
      if (l.lineId !== lineId) return l
      const mods = l.mods.includes(mod) ? l.mods.filter(m => m !== mod) : [...l.mods, mod]
      return { ...l, mods }
    }))
  }, [])

  // ── Close order: insert payment, close order, free table ────────────────
  const closeOrder = useCallback(async (
    method: PayMethod,
    tendered: number,
    total: number,
    tip: number,
  ): Promise<boolean> => {
    if (!orderId) return false
    const sb = getClient()

    // 1. Insert payment row
    const { error: payErr } = await sb.from('payments').insert({
      order_id:   orderId,
      method,
      amount:     total,
      tendered:   method === 'cash' ? tendered : total,
      change_due: method === 'cash' ? Math.max(0, tendered - total) : 0,
      notes:      tip > 0 ? `Tip: ₱${tip.toFixed(2)}` : null,
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

  return { orderId, lines, loading, error, addItem, updateQty, removeItem, voidItem, setNote, toggleMod, closeOrder }
}
