// OPEX effective dating.
// An `opex_items` row carries the amount for a span of months, so changing a
// cost never rewrites the months that already closed at the old figure.
// `effectiveFrom`/`effectiveTo` are month-start date strings ("YYYY-MM-01"),
// both INCLUSIVE; `effectiveTo === null` means open-ended.

export interface EffectiveDated {
  effectiveFrom: string;
  effectiveTo: string | null;
}

/** "YYYY-MM-01" for the given 1-indexed month. */
export function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** The month before `monthStart(year, month)`, as a month-start string. */
export function previousMonthStart(year: number, month: number): string {
  return month === 1 ? monthStart(year - 1, 12) : monthStart(year, month - 1);
}

export function isEffectiveForMonth(
  item: EffectiveDated,
  year: number,
  month: number,
): boolean {
  const m = monthStart(year, month);
  return (
    item.effectiveFrom <= m &&
    (item.effectiveTo === null || item.effectiveTo >= m)
  );
}

/** The single version of each item that governs the given month. */
export function itemsForMonth<T extends EffectiveDated>(
  items: T[],
  year: number,
  month: number,
): T[] {
  return items.filter((i) => isEffectiveForMonth(i, year, month));
}

/** Label for an effective span, e.g. "Sep 2026 →" or "— Aug 2026". */
export function effectiveLabel(item: EffectiveDated): string | null {
  const OPEN = "2000-01-01";
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
  };
  const from = item.effectiveFrom === OPEN ? null : fmt(item.effectiveFrom);
  const to = item.effectiveTo === null ? null : fmt(item.effectiveTo);
  if (!from && !to) return null;
  if (from && !to) return `${from} →`;
  if (!from && to) return `— ${to}`;
  return from === to ? from! : `${from} — ${to}`;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
