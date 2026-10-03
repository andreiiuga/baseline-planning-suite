/** Amounts are stored in EUR; the shell chooses the display currency. */
export function formatMoney(eur: number, perEur: number): string {
  return (eur * perEur).toFixed(2);
}
