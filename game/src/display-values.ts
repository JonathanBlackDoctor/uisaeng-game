// Presentation only: keep fractional simulation and saved values intact.
export const roundedValue = (value: number) => (Math.sign(value) * Math.round(Math.abs(value))) || 0;
export function signedValue(value: number): string {
  const rounded = roundedValue(value);
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}
export const synergyLabel = (multiplier: number) => `+${roundedValue((multiplier - 1) * 100)}%`;
