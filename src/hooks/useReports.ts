'use client'

import { useEffect, useState, useCallback } from 'react'
import { getClient } from '@/lib/supabase'

// ── Output shapes ────────────────────────────────────────────────────────────
export interface RevenueBar {
  label:   string   // '08:00' (hourly) or 'Mon' (daily)
  value:   number   // ₱ revenue
  isPeak:  boolean  // true for the tallest bar
}

export interface TransactionRow {
  id:         number
  time:       string   // 'HH:MM'
  tableId:    string
  server:     string
  itemCount:  number
  method:     string   // 'cash' | 'card' | 'gcash' | etc
  amount:     number
  isRefund:   boolean
}

export interface ReportsData {
  todayRevenue:  number
  avgOrder:      number
  txCount:       number
  hourlyBars:    RevenueBar[]
  weeklyBars:    RevenueBar[]
  transactions:  TransactionRow[]
  loading:       boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function makePeak(bars: Omit<RevenueBar, 'isPeak'>[]): RevenueBar[] {
  const max = Math.max(...bars.map(b => b.value), 0.01)
  return bars.map(b => ({ ...b, isPeak: b.value === max && b.value > 0 }))
}

// ── useReports ────────────────────────────────────────────────────────────────
export function useReports(): ReportsData {
  const [loading,      setLoading]      = useState(true)
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [avgOrder,     setAvgOrder]     = useState(0)
  const [txCount,      setTxCount]      = useState(0)
  const [hourlyBars,   setHourlyBars]   = useState<RevenueBar[]>([])
  const [weeklyBars,   setWeeklyBars]   = useState<RevenueBar[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])

  const fetchAll = useCallback(async () => {
    const sb  = getClient()
    const now = new Date()

    // ── Today's payments ───────────────────────────────────────────────────
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: todayPmts } = await (sb as any)
      .from('payments')
      .select('id, amount, method, processed_at, notes, order_id, orders(table_id, opened_by)')
      .gte('processed_at', todayStart.toISOString())
      .order('processed_at', { ascending: false })

    const pmts: any[] = todayPmts ?? []

    // KPI totals
    const todayTotal = pmts.reduce((s: number, p: any) => s + (p.amount as number), 0)
    setTodayRevenue(todayTotal)
    setTxCount(pmts.length)
    setAvgOrder(pmts.length > 0 ? todayTotal / pmts.length : 0)

    // Hourly bars — 24 slots (0–23), only show up to current hour + 1
    const hourBuckets: Record<number, number> = {}
    for (const p of pmts) {
      const h = new Date(p.processed_at as string).getHours()
      hourBuckets[h] = (hourBuckets[h] ?? 0) + (p.amount as number)
    }
    const maxHour = now.getHours()
    const hourly = Array.from({ length: maxHour + 1 }, (_, h) => ({
      label: fmtHour(h),
      value: hourBuckets[h] ?? 0,
    }))
    setHourlyBars(makePeak(hourly))

    // ── This week's payments (last 7 days) ─────────────────────────────────
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: weekPmts } = await (sb as any)
      .from('payments')
      .select('amount, processed_at')
      .gte('processed_at', weekStart.toISOString())

    const wPmts: any[] = weekPmts ?? []
    const dayBuckets: Record<number, number> = {}
    for (const p of wPmts) {
      const d = new Date(p.processed_at as string).getDay()  // 0=Sun
      dayBuckets[d] = (dayBuckets[d] ?? 0) + (p.amount as number)
    }
    // Build 7 day slots anchored to today
    const weekly = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      const dow = d.getDay()
      return { label: DAY_LABELS[dow], value: dayBuckets[dow] ?? 0 }
    })
    setWeeklyBars(makePeak(weekly))

    // ── Recent transactions (last 100) ─────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentPmts } = await (sb as any)
      .from('payments')
      .select(`
        id, amount, method, processed_at, notes,
        orders!inner(table_id, opened_by)
      `)
      .order('processed_at', { ascending: false })
      .limit(100)

    const rp: any[] = recentPmts ?? []

    // Also fetch item counts per order
    const orderIds: number[] = [...new Set(rp.map((p: any) => p.order_id as number).filter(Boolean))]
    let itemCountMap: Record<number, number> = {}

    if (orderIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: iCounts } = await (sb as any)
        .from('order_items')
        .select('order_id')
        .in('order_id', orderIds)
        .neq('status', 'voided')

      const ic: any[] = iCounts ?? []
      for (const row of ic) {
        const oid = row.order_id as number
        itemCountMap[oid] = (itemCountMap[oid] ?? 0) + 1
      }
    }

    const txRows: TransactionRow[] = rp.map((p: any) => {
      const order  = Array.isArray(p.orders) ? p.orders[0] : p.orders
      const dt     = new Date(p.processed_at as string)
      const hh     = String(dt.getHours()).padStart(2, '0')
      const mm     = String(dt.getMinutes()).padStart(2, '0')
      const isRef  = (p.notes as string | null)?.toLowerCase().includes('refund') ?? false
      return {
        id:        p.id as number,
        time:      `${hh}:${mm}`,
        tableId:   order?.table_id ?? '—',
        server:    order?.opened_by ?? 'Server',
        itemCount: itemCountMap[p.order_id as number] ?? 0,
        method:    (p.method as string).toUpperCase(),
        amount:    p.amount as number,
        isRefund:  isRef,
      }
    })
    setTransactions(txRows)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return {
    todayRevenue, avgOrder, txCount,
    hourlyBars, weeklyBars, transactions, loading,
  }
}
