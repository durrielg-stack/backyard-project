/** Format a number as Philippine Peso, e.g. fmtPeso(1234.5) → "₱1,234.50" */
export function fmtPeso(amount: number, decimals = 2): string {
  return '₱' + amount.toLocaleString('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
