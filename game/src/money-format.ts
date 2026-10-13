// Display only. Saved amounts and canonical event text retain their original values.
export const exactWon = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

export function formatWon(amount: number): string {
  if (!Number.isSafeInteger(amount)) return exactWon(amount);
  const sign = amount < 0 ? '−' : '';
  let remaining = Math.abs(amount);
  if (remaining < 10_000) return `${sign}${remaining.toLocaleString('ko-KR')}원`;
  const parts: string[] = [];
  for (const [unit, label] of [[1e12, '조'], [1e8, '억'], [1e4, '만']] as const) {
    const count = Math.floor(remaining / unit);
    if (count) parts.push(`${count.toLocaleString('ko-KR')}${label}`);
    remaining -= count * unit;
  }
  return sign + (remaining ? [...parts, `${remaining.toLocaleString('ko-KR')}원`].join(' ') : `${parts.join(' ')} 원`);
}

// Convert only complete won amounts; percentages, dates and already-written units stay intact.
export function formatMoneyText(text: string): string {
  return text.replace(/(?<![\d,.])([+−-]?)(\d{1,3}(?:,\d{3})+|\d+)\s*원/g, (original, sign: string, digits: string) => {
    const amount = Number(digits.replaceAll(',', ''));
    if (!Number.isSafeInteger(amount)) return original;
    return (sign === '+' ? '+' : '') + formatWon(sign === '-' || sign === '−' ? -amount : amount);
  });
}
