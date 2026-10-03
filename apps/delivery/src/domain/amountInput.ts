/**
 * Turns what someone typed into a cell into a number, or null if it is not a plain amount.
 * Accepts thousands separators as typed in the case study ("7,880.00") and a leading or
 * trailing space. Rejects blanks, signs, exponents and anything else, so a typo never
 * silently becomes a value.
 */
export function parseAmountInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d*)?$|^\.\d+$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}
