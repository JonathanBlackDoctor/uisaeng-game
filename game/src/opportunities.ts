import type { GameState } from './contracts';
import { SPECIALTIES, INSTITUTIONS, careerPreparation } from './career';

// Fictional opportunities, independent of the live RNG and UI actions.
export const OPPORTUNITY_RULES = { version: 'limited-opportunities-provisional-1', provisional: true, clubs: 3, explore: 4, specialties: 6, institutions: 3, semesterMonths: 6 } as const;
export function opportunityRank(seed: number, key: string): number {
  let h = (seed ^ 2166136261) >>> 0;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15;
  return h >>> 0;
}
export function opportunitySubset<T extends { id: string }>(s: GameState, pool: readonly T[], kind: string, count: number, epoch = 0): T[] {
  return [...pool].sort((a, b) => opportunityRank(s.life!.initialSeed, `${kind}:${epoch}:${a.id}`) - opportunityRank(s.life!.initialSeed, `${kind}:${epoch}:${b.id}`) || a.id.localeCompare(b.id)).slice(0, count);
}
export function explorationOptions(s: GameState) {
  return opportunitySubset(s, SPECIALTIES, 'explore', OPPORTUNITY_RULES.explore, Math.floor(s.life!.elapsedMs / 1000 / OPPORTUNITY_RULES.semesterMonths));
}
export function specialtyOptions(s: GameState) {
  const c = s.career!;
  const known = SPECIALTIES.filter(x => c.explored.includes(x.id)).sort((a, b) => careerPreparation(c, b.id).total - careerPreparation(c, a.id).total || a.id.localeCompare(b.id));
  const pinned = [SPECIALTIES.find(x => x.id === c.interest), ...known].filter((x): x is (typeof SPECIALTIES)[number] => !!x).filter((x, i, all) => all.findIndex(y => y.id === x.id) === i).slice(0, 2);
  const rest = opportunitySubset(s, SPECIALTIES.filter(x => !pinned.some(y => y.id === x.id)), 'application', OPPORTUNITY_RULES.specialties - pinned.length, c.attempts);
  return [...pinned, ...rest];
}
export function institutionOptions(s: GameState) {
  return opportunitySubset(s, INSTITUTIONS, `institutions:${s.progress!.selectedSpecialty}`, OPPORTUNITY_RULES.institutions, s.career!.attempts);
}
