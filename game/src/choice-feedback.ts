import { formatWon } from './money-format';
import { roundedValue, signedValue } from './display-values';
import { STAT_LABELS, type GameState, type Stats } from './contracts';
export interface ChoiceResult { id: string; title: string; detail: string; changes: string[]; statChanges: Partial<Stats>; statChangesUntil: number; reaction: 'learning' | 'connection' | 'rest' | null }
export function choiceResult(before: GameState, after: GameState, actionId: string): ChoiceResult | null {
  if (before === after || !before.pendingEvent) return null;
  const entries = after.journal.slice(before.journal.length);
  const entry = entries.find(x => x.id === actionId && x.choice) ?? entries.find(x => x.id === `${actionId}:result`) ?? entries.find(x => x.id === actionId);
  if (!entry) return null;
  const diff = Object.keys(STAT_LABELS).map(k => { const key = k as keyof Stats; return { key, value: after.stats[key] - before.stats[key] }; });
  const changes = diff.filter(x => roundedValue(x.value) !== 0).map(({ key, value }) => `${STAT_LABELS[key]} ${signedValue(value)}`);
  const cash = (after.economy?.cash ?? 0) - (before.economy?.cash ?? 0);
  if (cash) changes.push(`현금 ${cash > 0 ? '+' : '−'}${formatWon(Math.abs(cash))}`);
  const best = [...diff].sort((a, b) => b.value - a.value)[0];
  return { id: actionId, title: entry.title, detail: entry.choice ? [entry.choice.label, entry.choice.detail].filter(Boolean).join(' · ') : entry.detail.replace(/^\d+세(?:\s*\d+개월)?\s*·\s*/, ''), changes, statChanges: Object.fromEntries(diff.filter(x => x.value !== 0).map(x => [x.key, x.value])), statChangesUntil: Date.now() + 5000,
    reaction: best.value <= 0 ? null : best.key === 'knowledge' ? 'learning' : best.key === 'relationships' ? 'connection' : 'rest' };
}
