// Date navigation utilities for Sales and Expenses tabs.
// Work week: Wednesday → Monday (closed Tuesday).

export type ViewMode = "today" | "week" | "month";

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
}

// Business-day cutoff: everything before 6am belongs to the previous night.
// Owner decision 2026-07-12 after the Jul 11 Saturday (₱15,568 of ₱17,028 was
// billed after midnight and landed on Sunday's calendar date).
export const SHIFT_CUTOFF_HOUR = 6;

// Returns the shift-date string for a timestamp: hours 0–5 belong to the previous day's shift.
export function shiftLocalDate(d: Date): string {
  if (d.getHours() < SHIFT_CUTOFF_HOUR) {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    return localDateStr(prev);
  }
  return localDateStr(d);
}

// Business-day hours in order: 6am cutoff → 5am the next calendar day.
export const SHIFT_HOURS = [
  6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2,
  3, 4, 5,
];

// Regular opening hour. Hourly charts start here unless there were earlier sales.
export const SHIFT_OPEN_HOUR = 14;

// Returns the business-day hours to chart, up to the current moment.
// Hours before the regular 2pm opening are only included from the first one
// that has a value in `buckets`, so a normal night still charts from 2pm.
export function shiftHoursUpToNow(
  buckets: Record<number, number> = {},
): number[] {
  const openIdx = SHIFT_HOURS.indexOf(SHIFT_OPEN_HOUR);
  const idx = SHIFT_HOURS.indexOf(new Date().getHours());
  // Before the regular opening, show the whole day (as the 2pm-start chart did).
  const upToNow = idx < openIdx ? SHIFT_HOURS : SHIFT_HOURS.slice(0, idx + 1);
  const first = upToNow.findIndex(
    (h, i) => i >= openIdx || (buckets[h] ?? 0) !== 0,
  );
  return upToNow.slice(first);
}

// Returns the calendar date the current shift started on.
// If it's before the 6am cutoff, the business day started yesterday.
export function currentShiftDate(): string {
  const now = new Date();
  if (now.getHours() < SHIFT_CUTOFF_HOUR) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return localDateStr(d);
  }
  return localDateStr(now);
}

// ISO boundaries for a business day: 6am on dateStr → 6am the following calendar day.
// Owner decision 2026-10-04: anything sold after 6am belongs to that day (a
// T1 order opened 11:40am fell between the old 2pm start and 6am end).
export function dayBounds(dateStr: string): { start: string; end: string } {
  const [y, m, day] = dateStr.split("-").map(Number);
  return {
    start: new Date(y, m - 1, day, SHIFT_CUTOFF_HOUR, 0, 0, 0).toISOString(),
    end: new Date(y, m - 1, day + 1, SHIFT_CUTOFF_HOUR, 0, 0, 0).toISOString(),
  };
}

// Inclusive expense_date range (YYYY-MM-DD, local) for ISO bounds from
// dayBounds/weekBounds/monthBounds. Never slice the ISO string: it is UTC,
// so the 6am Manila start reads as the previous date.
export function expenseDateRange(
  start: string,
  end: string,
): { from: string; to: string } {
  return {
    from: shiftLocalDate(new Date(start)),
    to: shiftLocalDate(new Date(new Date(end).getTime() - 1)),
  };
}

// Work week: Wed–Tue (closed Tuesday). Given a reference date, find the Wednesday that starts that week.
function weekStart(ref: Date): Date {
  const d = new Date(ref);
  // day: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  // offset back to Wednesday
  const offset = (d.getDay() + 7 - 3) % 7; // days since last Wed
  d.setDate(d.getDate() - offset);
  // Start at the business-day cutoff so Tuesday-night spillover (bar closed
  // Tuesday anyway) can't leak into Wednesday's week.
  d.setHours(SHIFT_CUTOFF_HOUR, 0, 0, 0);
  return d;
}

// Ends just before the next Wednesday's 6am cutoff so the closed Tuesday
// business day (e.g. a Tuesday supply run) still belongs to a week.
function weekEnd(wed: Date): Date {
  const d = new Date(wed);
  d.setDate(d.getDate() + 7);
  d.setHours(SHIFT_CUTOFF_HOUR - 1, 59, 59, 999);
  return d;
}

export function weekBounds(ref: Date): {
  start: string;
  end: string;
  label: string;
} {
  const ws = weekStart(ref);
  const we = weekEnd(ws);
  const lastDay = new Date(we);
  lastDay.setDate(lastDay.getDate() - 1); // Tuesday, for the label
  const label = `${ws.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – ${lastDay.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
  return { start: ws.toISOString(), end: we.toISOString(), label };
}

export function monthBounds(
  year: number,
  month: number,
): { start: string; end: string } {
  // Both edges sit at the 6am business-day cutoff: the last day of the month
  // keeps its after-midnight closes, and the 1st doesn't double-count them.
  return {
    start: new Date(year, month, 1, SHIFT_CUTOFF_HOUR, 0, 0, 0).toISOString(),
    end: new Date(
      year,
      month + 1,
      1,
      SHIFT_CUTOFF_HOUR - 1,
      59,
      59,
      999,
    ).toISOString(),
  };
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ── Navigation helpers ────────────────────────────────────────────────────────

export function navigateDay(dateStr: string, dir: 1 | -1): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + dir);
  return localDateStr(d);
}

export function navigateWeek(ref: Date, dir: 1 | -1): Date {
  const ws = weekStart(ref);
  ws.setDate(ws.getDate() + dir * 7);
  return ws;
}

export function navigateMonth(
  year: number,
  month: number,
  dir: 1 | -1,
): { year: number; month: number } {
  let m = month + dir;
  let y = year;
  if (m > 11) {
    m = 0;
    y++;
  }
  if (m < 0) {
    m = 11;
    y--;
  }
  return { year: y, month: m };
}

// Label shown in the center of the nav bar
export function todayLabel(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const todayStr = localDateStr(new Date());
  if (dateStr === todayStr) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === localDateStr(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// First business date (YYYY-MM-DD) shown by a ledger range filter, or null
// for "all". `today` is the current business date (currentShiftDate()).
export type LedgerRange = "week" | "2weeks" | "month" | "all";

export function ledgerRangeStart(
  range: LedgerRange,
  today: string,
): string | null {
  if (range === "all") return null;
  if (range === "month") return `${today.slice(0, 7)}-01`;
  if (range === "week") {
    const { start, end } = weekBounds(parseLocalDate(today));
    return expenseDateRange(start, end).from;
  }
  const d = parseLocalDate(today);
  d.setDate(d.getDate() - 13);
  return localDateStr(d);
}
