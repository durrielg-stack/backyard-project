'use client'

import { useEffect, useReducer, useCallback } from 'react'
import { getClient } from '@/lib/supabase'
import type { ViewMode } from '@/lib/dateNav'
import { localDateStr, parseLocalDate, shiftLocalDate, shiftHoursUpToNow } from '@/lib/dateNav'

// ── Output shapes ────────────────────────────────────────────────────────────
export interface RevenueBar {
  label:  string
  value:  number
  isPeak: boolean
}

export interface TransactionRow {
  id:        number
  time:      string
  tableId:   string
  server:    string
  itemCount: number
  method:    string
  amount:    number
  isRefund:  boolean
}

export interface VoidedRow {
  id:        number
  time:      string
  tableId:   string
  itemName:  string
  qty:       number
  unitPrice: number
  amount:    number
  reason:    string | null
}

export interface ExpenseRow {
  id:          number
  time:        string
  date:        string
  category:    string
  name:        string
  qty:         number
  unit:        string | null
  unitPrice:   number | null
  amount:      number
  paidTo:      string | null
}

export interface CatBreakdown {
  category: string
  amount:   number
}

export interface ReportsData {
  revenue:         number
  cost:            number
  expenses:        number
  avgOrder:        number
  txCount:         number
  avgTurnMin:      number | null
  bars:            RevenueBar[]
  expenseDayBars:  RevenueBar[]
  transactions:    TransactionRow[]
  voidedRows:      VoidedRow[]
  expenseRows:     ExpenseRow[]
  expCatBreakdown: CatBreakdown[]
  loading:         boolean
}

// ── Reducer ───────────────────────────────────────────────────────────────────
type Action =
  | { type: 'loading' }
  | { type: 'data'; payload: Omit<ReportsData, 'loading'> }

const EMPTY: ReportsData = {
  revenue: 0, cost: 0, expenses: 0,
  avgOrder: 0, txCount: 0, avgTurnMin: null,
  bars: [], expenseDayBars: [],
  transactions: [], voidedRows: [], expenseRows: [],
  expCatBreakdown: [],
  loading: true,
}

function reducer(state: ReportsData, action: Action): ReportsData {
  switch (action.type) {
    case 'loading': return { ...state, loading: true }
    case 'data':    return { ...action.payload, loading: false }
  }
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

const EXP_CATS = ['OPEX','Food','Beer','Cocktails/Hard','Non-Alcohol','Cigarettes']

// Build daily bars for a range of days (start inclusive, count = days)
function buildDailyBars(
  startDate: Date,
  count: number,
  dayBuckets: Record<string, number>,
): Omit<RevenueBar, 'isPeak'>[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const dk = localDateStr(d)
    return { label: DAY_LABELS[d.getDay()], value: dayBuckets[dk] ?? 0 }
  })
}

// Build month daily bars for all days in year/month
function buildMonthBars(
  year: number,
  month: number,
  dayBuckets: Record<string, number>,
): Omit<RevenueBar, 'isPeak'>[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1)
    const dk = localDateStr(d)
    return { label: String(i + 1), value: dayBuckets[dk] ?? 0 }
  })
}

// ── useReports ────────────────────────────────────────────────────────────────
export function useReports({ start, end, mode }: { start: string; end: string; mode: ViewMode }): ReportsData {
  const [state, dispatch] = useReducer(reducer, EMPTY)

  const fetchAll = useCallback(async () => {
    dispatch({ type: 'loading' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getClient() as any

    // ── Sales: order-items via orders.opened_at ────────────────────────────
    const { data: allOrders } = await sb
      .from('orders').select('id, opened_at')
      .gte('opened_at', start)
      .lte('opened_at', end)
    const allOrderIds = (allOrders ?? []).map((o: any) => o.id as number)
    const orderOpenedMap: Record<number, Date> = {}
    for (const o of (allOrders ?? [])) orderOpenedMap[o.id] = new Date(o.opened_at)

    let gross = 0; let cost = 0
    const hourBuckets: Record<number, number> = {}
    const dayBuckets:  Record<string, number> = {}

    if (allOrderIds.length > 0) {
      const { data: lines } = await sb
        .from('order_items')
        .select('order_id, qty, unit_price, menu_items(cost)')
        .in('order_id', allOrderIds)
        .neq('status', 'voided')

      for (const row of (lines ?? [])) {
        const openedAt = orderOpenedMap[row.order_id as number]
        if (!openedAt) continue
        const val = (row.qty as number) * (row.unit_price as number)
        const mi  = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
        const dk  = shiftLocalDate(openedAt)  // hours 0–3 belong to previous day's shift

        gross += val
        cost  += (row.qty as number) * ((mi as any)?.cost ?? 0)
        dayBuckets[dk] = (dayBuckets[dk] ?? 0) + val

        if (mode === 'today') {
          const h = openedAt.getHours()
          hourBuckets[h] = (hourBuckets[h] ?? 0) + val
        }
      }
    }

    const txCount = allOrderIds.length

    // Avg turn time
    const { data: closedOrders } = await sb
      .from('orders').select('opened_at, closed_at')
      .eq('status', 'closed')
      .gte('opened_at', start)
      .lte('opened_at', end)
      .not('closed_at', 'is', null)
    const allClosed: any[] = closedOrders ?? []

    let avgTurnMin: number | null = null
    if (allClosed.length > 0) {
      const totalMin = allClosed.reduce((s: number, o: any) =>
        s + (new Date(o.closed_at).getTime() - new Date(o.opened_at).getTime()) / 60000, 0)
      avgTurnMin = Math.round(totalMin / allClosed.length)
    }

    // Build bars based on mode
    let bars: RevenueBar[]
    if (mode === 'today') {
      bars = makePeak(shiftHoursUpToNow().map(h => ({ label: fmtHour(h), value: hourBuckets[h] ?? 0 })))
    } else if (mode === 'week') {
      // Wed–Mon: 6 days starting from start date
      const startDate = new Date(start)
      bars = makePeak(buildDailyBars(startDate, 6, dayBuckets))
    } else {
      // month: all days in the month derived from start
      const startDate = new Date(start)
      const year = startDate.getFullYear()
      const month = startDate.getMonth()
      bars = makePeak(buildMonthBars(year, month, dayBuckets))
    }

    // ── Expenses ───────────────────────────────────────────────────────────
    // expense_date is a date string, derive date range from bounds
    const startDateObj = new Date(start)
    const endDateObj   = new Date(end)
    const startDateStr = localDateStr(startDateObj)
    const endDateStr   = localDateStr(endDateObj)

    const { data: allExp } = await sb
      .from('daily_expenses')
      .select('id, expense_date, category, description, qty, unit, unit_price, amount, paid_to, created_at')
      .gte('expense_date', startDateStr)
      .lte('expense_date', endDateStr)
      .order('created_at', { ascending: false })

    const expAll: any[] = allExp ?? []
    const expenses = expAll.reduce((s: number, r: any) => s + r.amount, 0)

    const expDayBuckets: Record<string, number> = {}
    for (const r of expAll) expDayBuckets[r.expense_date] = (expDayBuckets[r.expense_date] ?? 0) + r.amount

    let expenseDayBars: RevenueBar[]
    if (mode === 'today') {
      expenseDayBars = makePeak([{ label: 'Today', value: expenses }])
    } else if (mode === 'week') {
      expenseDayBars = makePeak(buildDailyBars(startDateObj, 6, expDayBuckets))
    } else {
      const year = startDateObj.getFullYear()
      const month = startDateObj.getMonth()
      expenseDayBars = makePeak(buildMonthBars(year, month, expDayBuckets))
    }

    const catMap: Record<string, number> = {}
    for (const r of expAll) catMap[r.category] = (catMap[r.category] ?? 0) + r.amount
    const expCatBreakdown: CatBreakdown[] = EXP_CATS.map(cat => ({
      category: cat,
      amount:   catMap[cat] ?? 0,
    }))

    function mapExpRow(r: any): ExpenseRow {
      const dt = new Date(r.created_at)
      return {
        id:        r.id,
        time:      `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`,
        date:      r.expense_date,
        category:  r.category,
        name:      r.description,
        qty:       r.qty ?? 1,
        unit:      r.unit ?? null,
        unitPrice: r.unit_price ?? null,
        amount:    r.amount,
        paidTo:    r.paid_to ?? null,
      }
    }

    // ── Transactions ──────────────────────────────────────────────────────
    const { data: recentPmts } = await sb
      .from('payments')
      .select(`id, order_id, amount, method, processed_at, notes, orders!inner(table_id, opened_by, opened_at)`)
      .gte('processed_at', start)
      .lte('processed_at', end)
      .order('processed_at', { ascending: false })
      .limit(500)

    const rp: any[] = recentPmts ?? []
    const orderIds: number[] = [...new Set(rp.map((p: any) => p.order_id as number).filter(Boolean))]
    const itemCountMap: Record<number, number> = {}

    if (orderIds.length > 0) {
      const { data: iCounts } = await sb
        .from('order_items').select('order_id')
        .in('order_id', orderIds).neq('status', 'voided')
      for (const row of (iCounts ?? [])) {
        const oid = row.order_id as number
        itemCountMap[oid] = (itemCountMap[oid] ?? 0) + 1
      }
    }

    function mapTxRow(p: any): TransactionRow {
      const order = Array.isArray(p.orders) ? p.orders[0] : p.orders
      const dt    = new Date(p.processed_at as string)
      return {
        id:        p.id as number,
        time:      `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`,
        tableId:   order?.table_id ?? '—',
        server:    order?.opened_by ?? 'Staff',
        itemCount: itemCountMap[p.order_id as number] ?? 0,
        method:    (p.method as string).toUpperCase(),
        amount:    p.amount as number,
        isRefund:  (p.notes as string | null)?.toLowerCase().includes('refund') ?? false,
      }
    }

    // ── Voided items ──────────────────────────────────────────────────────
    let voidedRows: VoidedRow[] = []
    if (allOrderIds.length > 0) {
      const { data: voidedItems } = await sb
        .from('order_items')
        .select('id, qty, unit_price, void_reason, completed_at, order_id, menu_items(name), orders!inner(table_id, opened_at)')
        .eq('status', 'voided')
        .in('order_id', allOrderIds)
        .order('id', { ascending: false })

      voidedRows = (voidedItems ?? []).map((row: any) => {
        const order = Array.isArray(row.orders) ? row.orders[0] : row.orders
        const mi    = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
        const dt    = new Date(row.completed_at ?? order?.opened_at ?? 0)
        return {
          id:        row.id as number,
          time:      `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`,
          tableId:   order?.table_id ?? '—',
          itemName:  (mi as any)?.name ?? '—',
          qty:       row.qty as number,
          unitPrice: row.unit_price as number,
          amount:    (row.qty as number) * (row.unit_price as number),
          reason:    (row.void_reason as string | null) ?? null,
        }
      })
    }

    dispatch({
      type: 'data',
      payload: {
        revenue:  gross,
        cost,
        expenses,
        avgOrder:  txCount > 0 ? gross / txCount : 0,
        txCount,
        avgTurnMin,
        bars,
        expenseDayBars,
        transactions: rp.map(mapTxRow),
        voidedRows,
        expenseRows:  expAll.map(mapExpRow),
        expCatBreakdown,
      },
    })
  }, [start, end, mode])

  useEffect(() => {
    fetchAll()
    const sb = getClient()
    const channel = sb
      .channel('reports-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },      fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },           fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },         fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_expenses' },   fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, fetchAll)
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [fetchAll])

  return state
}
