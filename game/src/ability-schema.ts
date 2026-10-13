import type { GameState, LifeBackground } from './contracts';
import { backgroundAbilityBonuses } from './background';
import type { AbilityState as LegacyAbilityState } from './abilities-legacy';

export const ABILITIES = [
  { id: 'judgment', label: '판단력', use: '상황을 파악하고 진료·위기 대응 방법을 고릅니다.' },
  { id: 'technique', label: '술기', use: '반복 실습으로 처치·수술을 익히고 수행합니다.' },
  { id: 'communication', label: '소통', use: '설명·설득·협업과 갈등 해결에 쓰입니다.' },
  { id: 'research', label: '연구력', use: '자료를 검토하고 연구 질문과 검증 방법을 만듭니다.' },
  { id: 'management', label: '운영력', use: '일정·예산·팀을 조율하고 개원을 운영합니다.' },
  { id: 'selfManagement', label: '자기관리', use: '피로를 관리하고 무리한 일정의 부담을 줄입니다.' },
] as const;
export type AbilityId = typeof ABILITIES[number]['id'];
export type AbilityValues = Record<AbilityId, number>;
export interface AbilityChange { month: number; delta: number; reason: string }
export interface AbilityState {
  version: 2; seed: number; since: number; lastMonth: number;
  values: AbilityValues; used: Record<AbilityId, number>;
  changes: Partial<Record<AbilityId, AbilityChange>>;
  specialties: Record<string, number>; seen: Record<string, number>;
}
// Every former ability contributes to exactly one new ability.
export const LEGACY_ABILITY_MEMBERS = {
  judgment: ['memory', 'comprehension', 'concentration', 'reasoning', 'spatial', 'observation', 'clinicalReasoning', 'triage'],
  technique: ['dexterity', 'procedures', 'reflexes'],
  communication: ['empathy', 'explanation', 'persuasion', 'sociability', 'mediation', 'teamwork'],
  research: ['researchDesign', 'analysis', 'writing'],
  management: ['business', 'leadership', 'planning'],
  selfManagement: ['stamina', 'strength', 'recovery', 'persistence', 'regulation', 'composure', 'adaptability'],
} as const;
const round = (n: number) => Math.round(n * 10) / 10;
export const isLegacyAbilities = (value: unknown): value is LegacyAbilityState =>
  !!value && typeof value === 'object' && (value as { version?: number }).version === 1;

export function migrateAbilities(old: LegacyAbilityState): AbilityState {
  const values = {} as AbilityValues, used = {} as Record<AbilityId, number>;
  const changes: AbilityState['changes'] = {};
  for (const { id } of ABILITIES) {
    const members = LEGACY_ABILITY_MEMBERS[id];
    values[id] = round(members.reduce((sum, key) => sum + old.values[key], 0) / members.length);
    used[id] = Math.max(...members.map(key => old.used[key]));
    const recent = members.map(key => old.changes[key]).filter((c): c is AbilityChange => !!c);
    if (recent.length) {
      const month = Math.max(...recent.map(c => c.month));
      const sameMonth = recent.filter(c => c.month === month);
      changes[id] = { month, delta: round(sameMonth.reduce((sum, c) => sum + c.delta, 0) / members.length),
        reason: [...new Set(sameMonth.map(c => c.reason))].length === 1 ? sameMonth[0].reason : '활동과 경험' };
    }
  }
  return { version: 2, seed: old.seed, since: old.since, lastMonth: old.lastMonth, values, used, changes,
    specialties: { ...old.specialties }, seen: { ...old.seen } };
}

export function abilityBackgroundBonuses(background?: LifeBackground): Partial<AbilityValues> {
  const old = backgroundAbilityBonuses(background), result: Partial<AbilityValues> = {};
  for (const { id } of ABILITIES) {
    const members = LEGACY_ABILITY_MEMBERS[id];
    const bonus = round(members.reduce((sum, key) => sum + (old[key] ?? 0), 0) / members.length);
    if (bonus) result[id] = bonus;
  }
  return result;
}

// Runtime saves may still contain the old schema until the next accepted action.
export function legacyGame(game: GameState) {
  return game as unknown as Omit<GameState, 'abilities'> & { abilities?: LegacyAbilityState };
}
