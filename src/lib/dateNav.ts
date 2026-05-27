// Date navigation utilities for Sales and Expenses tabs.
// Work week: Wednesday → Monday (closed Tuesday).

export type ViewMode = 'today' | 'week' | 'month'

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseLocalDate(s: string): Date {
  const [y, m, day] = s.split('-').map(Number)
  return new Date(y, m - 1, day)
}

// ISO boundaries for a local-date string (full day in local time)
export function dayBounds(dateStr: string): { start: string; end: string } {
  const [y, m, day] = dateStr.split('-').map(Number)
  return {
    start: new Date(y, m - 1, day, 0, 0, 0, 0).toISOString(),
    end:   new Date(y, m - 1, day, 23, 59, 59, 999).toISOString(),
  }
}

// Work week: Wed–Mon. Given a reference date, find the Wednesday that starts that week.
function weekStart(ref: Date): Date {
  const d = new Date(ref)
  // day: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  // offset back to Wednesday
  const offset = (d.getDay() + 7 - 3) % 7   // days since last Wed
  d.setDate(d.getDate() - offset)
  d.setHours(0, 0, 0, 0)
  return d
}

function weekEnd(wed: Date): Date {
  const d = new Date(wed)
  d.setDate(d.getDate() + 5)   // Wed+5 = Mon
  d.setHours(23, 59, 59, 999)
  return d
}

export function weekBounds(ref: Date): { start: string; end: string; label: string } {
  const ws = weekStart(ref)
  const we = weekEnd(ws)
  const label = `${ws.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
  return { start: ws.toISOString(), end: we.toISOString(), label }
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  return {
    start: new Date(year, month, 1, 0, 0, 0, 0).toISOString(),
    end:   new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString(),
  }
}

export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ── Navigation helpers ────────────────────────────────────────────────────────

export function navigateDay(dateStr: string, dir: 1 | -1): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + dir)
  return localDateStr(d)
}

export function navigateWeek(ref: Date, dir: 1 | -1): Date {
  const ws = weekStart(ref)
  ws.setDate(ws.getDate() + dir * 7)
  return ws
}

export function navigateMonth(year: number, month: number, dir: 1 | -1): { year: number; month: number } {
  let m = month + dir
  let y = year
  if (m > 11) { m = 0; y++ }
  if (m < 0)  { m = 11; y-- }
  return { year: y, month: m }
}

// Label shown in the center of the nav bar
export function todayLabel(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  const todayStr = localDateStr(new Date())
  if (dateStr === todayStr) return 'Today'
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  if (dateStr === localDateStr(yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
