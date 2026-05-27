/** Layman inline qualifier for meal and plan prices (not checkout totals). */
export function formatEstimatedCurrency(amount: number): string {
  return `Est. $${amount.toFixed(2)}`;
}
