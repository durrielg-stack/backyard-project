'use client'

import { useEffect, useState, useCallback } from 'react'
import { getClient } from '@/lib/supabase'

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
  today:    number
  week:     number
}

export interface ReportsData {
  todayRevenue:    number
  weekRevenue:     number
  todayCost:       number
  todayExpenses:   number
  weekExpenses:    number
  avgOrder:        number
  weekAvgOrder:    number
  txCount:         number
  weekTxCount:     number
  avgTurnMin:      number | null   // today avg table turn (minutes)
  weekAvgTurnMin:  number | null   // 7-day avg table turn
  hourlyBars:      RevenueBar[]
  weeklyBars:      RevenueBar[]
  expenseDayBars:  RevenueBar[]
  transactions:    TransactionRow[]
  weekTransactions: TransactionRow[]
  expenseRows:     ExpenseRow[]
  weekExpenseRows: ExpenseRow[]
  expCatBreakdown: CatBreakdown[]
  loading:         boolean
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

// ── useReports ────────────────────────────────────────────────────────────────
export function useReports(): ReportsData {
  const [loading,           setLoading]           = useState(true)
  const [todayRevenue,      setTodayRevenue]      = useState(0)
  const [weekRevenue,       setWeekRevenue]       = useState(0)
  const [todayCost,         setTodayCost]         = useState(0)
  const [todayExpenses,     setTodayExpenses]     = useState(0)
  const [weekExpenses,      setWeekExpenses]      = useState(0)
  const [avgOrder,          setAvgOrder]          = useState(0)
  const [weekAvgOrder,      setWeekAvgOrder]      = useState(0)
  const [txCount,           setTxCount]           = useState(0)
  const [weekTxCount,       setWeekTxCount]       = useState(0)
  const [avgTurnMin,        setAvgTurnMin]        = useState<number | null>(null)
  const [weekAvgTurnMin,    setWeekAvgTurnMin]    = useState<number | null>(null)
  const [hourlyBars,        setHourlyBars]        = useState<RevenueBar[]>([])
  const [weeklyBars,        setWeeklyBars]        = useState<RevenueBar[]>([])
  const [expenseDayBars,    setExpenseDayBars]    = useState<RevenueBar[]>([])
  const [transactions,      setTransactions]      = useState<TransactionRow[]>([])
  const [weekTransactions,  setWeekTransactions]  = useState<TransactionRow[]>([])
  const [expenseRows,       setExpenseRows]       = useState<ExpenseRow[]>([])
  const [weekExpenseRows,   setWeekExpenseRows]   = useState<ExpenseRow[]>([])
  const [expCatBreakdown,   setExpCatBreakdown]   = useState<CatBreakdown[]>([])

  const fetchAll = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb  = getClient() as any
    const now = new Date()

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const weekStart  = new Date(now); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0)
    const todayStr   = todayStart.toISOString().slice(0, 10)
    const weekStr    = weekStart.toISOString().slice(0, 10)

    // ── Sales: order-items via orders.opened_at ────────────────────────────
    const { data: allOrders } = await sb
      .from('orders').select('id, opened_at')
      .gte('opened_at', weekStart.toISOString())
    const allOrderIds = (allOrders ?? []).map((o: any) => o.id as number)
    const orderOpenedMap: Record<number, Date> = {}
    for (const o of (allOrders ?? [])) orderOpenedMap[o.id] = new Date(o.opened_at)

    let todayGross = 0; let weekGross = 0; let costToday = 0
    const hourBuckets: Record<number, number> = {}
    const dayBuckets:  Record<string, number> = {}
    const todayOrderIds: number[] = []
    const todayStartMs = todayStart.getTime()

    if (allOrderIds.length > 0) {
      const { data: lines } = await sb
        .from('order_items')
        .select('order_id, qty, unit_price, menu_items(cost)')
        .in('order_id', allOrderIds)
        .neq('status', 'voided')

      for (const row of (lines ?? [])) {
        const openedAt = orderOpenedMap[row.order_id as number]
        if (!openedAt) continue
        const ts  = openedAt.getTime()
        const val = (row.qty as number) * (row.unit_price as number)
        const mi  = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
        const dk  = openedAt.toISOString().slice(0, 10)

        weekGross += val
        dayBuckets[dk] = (dayBuckets[dk] ?? 0) + val

        if (ts >= todayStartMs) {
          todayGross += val
          costToday  += (row.qty as number) * ((mi as any)?.cost ?? 0)
          const h = openedAt.getHours()
          hourBuckets[h] = (hourBuckets[h] ?? 0) + val
        }
      }

      for (const o of (allOrders ?? [])) {
        if (new Date(o.opened_at).getTime() >= todayStartMs) todayOrderIds.push(o.id)
      }
    }

    const txTodayN = todayOrderIds.length
    const txWeekN  = allOrderIds.length
    setTodayRevenue(todayGross)
    setWeekRevenue(weekGross)
    setTodayCost(costToday)
    setTxCount(txTodayN)
    setWeekTxCount(txWeekN)
    setAvgOrder(txTodayN > 0 ? todayGross / txTodayN : 0)
    setWeekAvgOrder(txWeekN > 0 ? weekGross / txWeekN : 0)

    // Avg turn time
    const { data: closedOrders } = await sb
      .from('orders').select('opened_at, closed_at')
      .eq('status', 'closed')
      .gte('opened_at', weekStart.toISOString())
      .not('closed_at', 'is', null)
    const allClosed: any[] = closedOrders ?? []
    const todayClosed = allClosed.filter(o => new Date(o.opened_at).getTime() >= todayStartMs)
    if (todayClosed.length > 0) {
      const totalMin = todayClosed.reduce((s: number, o: any) =>
        s + (new Date(o.closed_at).getTime() - new Date(o.opened_at).getTime()) / 60000, 0)
      setAvgTurnMin(Math.round(totalMin / todayClosed.length))
    } else {
      setAvgTurnMin(null)
    }
    if (allClosed.length > 0) {
      const totalMin = allClosed.reduce((s: number, o: any) =>
        s + (new Date(o.closed_at).getTime() - new Date(o.opened_at).getTime()) / 60000, 0)
      setWeekAvgTurnMin(Math.round(totalMin / allClosed.length))
    } else {
      setWeekAvgTurnMin(null)
    }

    const maxHour = now.getHours()
    setHourlyBars(makePeak(Array.from({ length: maxHour + 1 }, (_, h) => ({ label: fmtHour(h), value: hourBuckets[h] ?? 0 }))))
    setWeeklyBars(makePeak(Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i)
      return { label: DAY_LABELS[d.getDay()], value: dayBuckets[d.toISOString().slice(0, 10)] ?? 0 }
    })))

    // ── Expenses ───────────────────────────────────────────────────────────
    const { data: allExp } = await sb
      .from('daily_expenses')
      .select('id, expense_date, category, description, qty, unit, unit_price, amount, paid_to, created_at')
      .gte('expense_date', weekStr)
      .order('created_at', { ascending: false })

    const expAll: any[] = allExp ?? []
    const expToday = expAll.filter((r: any) => r.expense_date === todayStr)

    setTodayExpenses(expToday.reduce((s: number, r: any) => s + r.amount, 0))
    setWeekExpenses(expAll.reduce((s: number, r: any) => s + r.amount, 0))

    // Daily expense bars for the week
    const expDayBuckets: Record<string, number> = {}
    for (const r of expAll) expDayBuckets[r.expense_date] = (expDayBuckets[r.expense_date] ?? 0) + r.amount
    setExpenseDayBars(makePeak(Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i)
      const dk = d.toISOString().slice(0, 10)
      return { label: DAY_LABELS[d.getDay()], value: expDayBuckets[dk] ?? 0 }
    })))

    // Category breakdown
    const catToday:  Record<string, number> = {}
    const catWeek:   Record<string, number> = {}
    for (const r of expAll) {
      catWeek[r.category]  = (catWeek[r.category]  ?? 0) + r.amount
    }
    for (const r of expToday) {
      catToday[r.category] = (catToday[r.category] ?? 0) + r.amount
    }
    setExpCatBreakdown(EXP_CATS.map(cat => ({
      category: cat,
      today:    catToday[cat]  ?? 0,
      week:     catWeek[cat]   ?? 0,
    })))

    // Expense rows mapper
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    setExpenseRows(expToday.map(mapExpRow))
    setWeekExpenseRows(expAll.map(mapExpRow))

    // ── Transactions (week, last 500) ──────────────────────────────────────
    const { data: recentPmts } = await sb
      .from('payments')
      .select(`id, order_id, amount, method, processed_at, notes, orders!inner(table_id, opened_by, opened_at)`)
      .gte('processed_at', weekStart.toISOString())
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

    const allTx = rp.map(mapTxRow)
    const todayTx = allTx.filter((_p, i) => {
      const dt = new Date(rp[i].processed_at as string)
      return dt.getTime() >= todayStartMs
    })
    setTransactions(todayTx)
    setWeekTransactions(allTx)

    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return {
    todayRevenue, weekRevenue, todayCost,
    todayExpenses, weekExpenses,
    avgOrder, weekAvgOrder, txCount, weekTxCount,
    avgTurnMin, weekAvgTurnMin,
    hourlyBars, weeklyBars, expenseDayBars,
    transactions, weekTransactions,
    expenseRows, weekExpenseRows,
    expCatBreakdown,
    loading,
  }
}
