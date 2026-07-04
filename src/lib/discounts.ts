// ── Discount engine ──────────────────────────────────────────────────────────
// The POS supports exactly two structured discount types — no free-form peso
// discount. Both are computed here so the live checkout preview (OrderView)
// and the actual DB commit (useOrder.closeOrder) can never drift apart.

export type DiscountType = 'none' | 'owner_employee' | 'senior_pwd'

export interface DiscountableLine {
  lineId:    string
  unitPrice: number
  unitCost:  number | null
  qty:       number
  isFood:    boolean
}

// RA 9994 (Senior Citizens) / RA 10754 (PWD): strip the 12% VAT, then apply
// the 20% discount. Prices in this system are VAT-inclusive at the register.
export function seniorPwdUnitPrice(price: number): number {
  return (price / 1.12) * 0.80
}

// Picks which individual units get the Senior/PWD treatment: food items only,
// highest price first, one unit per qualifying senior/PWD (per RA 9994/10754 —
// each person's discount covers their own single order, not the whole table's
// quantity of a shared dish).
export function selectSeniorPwdUnits(
  lines: DiscountableLine[],
  count: number,
): { lineId: string; unitPrice: number }[] {
  const units: { lineId: string; unitPrice: number }[] = []
  for (const l of lines) {
    if (!l.isFood) continue
    for (let i = 0; i < l.qty; i++) units.push({ lineId: l.lineId, unitPrice: l.unitPrice })
  }
  units.sort((a, b) => b.unitPrice - a.unitPrice)
  return units.slice(0, Math.max(0, count))
}

export function computeSeniorPwdDiscount(lines: DiscountableLine[], count: number): number {
  return selectSeniorPwdUnits(lines, count)
    .reduce((sum, u) => sum + (u.unitPrice - seniorPwdUnitPrice(u.unitPrice)), 0)
}

// Owner/Employee: whole order, every line, charged at cost (₱0 if never costed).
export function computeOwnerEmployeeDiscount(lines: DiscountableLine[]): number {
  return lines.reduce((sum, l) => sum + (l.unitPrice - (l.unitCost ?? 0)) * l.qty, 0)
}

export function computeDiscount(
  type: DiscountType,
  lines: DiscountableLine[],
  seniorCount: number,
): number {
  if (type === 'owner_employee') return computeOwnerEmployeeDiscount(lines)
  if (type === 'senior_pwd')     return computeSeniorPwdDiscount(lines, seniorCount)
  return 0
}
