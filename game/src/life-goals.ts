import type { GameState } from './contracts';
import { elapsedMonths } from './random-life';

export interface EncounterRecord { version: 1; sinceMonth: number; lastMonth: number; total: number }
// Game tuning, not observed patient volumes or a ranking of specialties.
export const ENCOUNTER_RULES = { version: 'encounters-provisional-v1', provisional: true,
  training: 120, balanced: 400, extended: 600, learning: 240 } as const;
export const initialEncounters = (month = 0): EncounterRecord => ({ version: 1, sinceMonth: month, lastMonth: month, total: 0 });
export function monthlyEncounters(s: GameState): number {
  if (!s.career || s.status === 'completed' || s.stageIndex === 0 || s.stageIndex === 3) return 0;
  if (s.stageIndex === 1 && s.career.application === 'accepted') return ENCOUNTER_RULES.training;
  if (s.career.practice === 'research' || s.career.practice === 'undecided') return 0;
  if (s.career.practice === 'clinic' && !s.economy?.ledger.some(t => t.kind === 'open-clinic')) return 0;
  return ENCOUNTER_RULES[s.stageIndex === 2 ? s.depth?.workload ?? 'balanced' : 'balanced'];
}
export function settleEncounters(s: GameState) {
  const month = elapsedMonths(s), record = s.encounters;
  if (!record || record.lastMonth >= month) return;
  // Only settle this month: never reconstruct missing history using today's job.
  record.total += monthlyEncounters(s);
  record.lastMonth = month;
}
export function validEncounters(s: GameState): boolean {
  const r = s.encounters;
  return r === undefined || (!!r && r.version === 1 && Number.isSafeInteger(r.sinceMonth) && r.sinceMonth >= 0
    && Number.isSafeInteger(r.lastMonth) && r.lastMonth >= r.sinceMonth && r.lastMonth <= elapsedMonths(s)
    && Number.isSafeInteger(r.total) && r.total >= 0 && r.total <= (r.lastMonth - r.sinceMonth) * ENCOUNTER_RULES.extended);
}
export function nextGoal(value: number, first: number): number {
  let target = first;
  while (target <= value) target *= 10;
  return target;
}
export function encounterLabel(s: GameState): string {
  return s.encounters ? `${s.encounters.total.toLocaleString('ko-KR')}건${s.encounters.sinceMonth > 0 ? ' (집계 시작 이후)' : ''}` : '집계 전';
}
export const netAssets = (s: GameState) => s.economy ? s.economy.assets - s.economy.debt - s.economy.due : null;
