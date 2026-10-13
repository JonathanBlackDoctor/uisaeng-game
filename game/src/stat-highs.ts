import { STAT_LABELS, type GameState, type Stats } from './contracts';

export interface StatHighs { values: Stats; fromStart: boolean }
export const STAT_KEYS = Object.keys(STAT_LABELS) as (keyof Stats)[];
export function validStatHighs(value: unknown): value is StatHighs {
  const h = value as StatHighs;
  return !!h && typeof h.fromStart === 'boolean' && !!h.values
    && STAT_KEYS.every(k => Number.isFinite(h.values[k]) && h.values[k] >= 0 && h.values[k] <= 100);
}
export function mergeStatHighs(a: StatHighs | undefined, b: StatHighs): StatHighs {
  return { fromStart: !!a?.fromStart || b.fromStart, values: Object.fromEntries(STAT_KEYS.map(k => [k, Math.max(a?.values[k] ?? 0, b.values[k])])) as Stats };
}
export function observedHighs(s: GameState): StatHighs {
  return mergeStatHighs(s.statHighs, { values: s.stats, fromStart: s.revision === 0 });
}
// Mutate only the reducer's new state, never its input. Sample settled months as
// well as actions so fast-forward cannot skip a peak between saved snapshots.
export function captureHighs(next: GameState, previous: GameState = next) {
  next.statHighs = mergeStatHighs(observedHighs(previous), observedHighs(next));
}
