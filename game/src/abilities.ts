import type { CareerProgress, GameEvent, GameState, Stats } from './contracts';
import { compactPacing, PACING_RULES } from './pacing';
import { SPECIALTIES } from './career';


import { ABILITIES, abilityBackgroundBonuses, isLegacyAbilities, legacyGame, migrateAbilities } from './ability-schema';
import type { AbilityId, AbilityValues, AbilityState } from './ability-schema';
import { abilityEvent as legacyAbilityEvent, settleAbilityEvent as legacySettleAbilityEvent, validAbilities as validLegacyAbilities } from './abilities-legacy';
import { abilityApproach } from './event-design';
export { ABILITIES, abilityBackgroundBonuses, migrateAbilities } from './ability-schema';
export type { AbilityId, AbilityValues, AbilityState, AbilityChange } from './ability-schema';
type Focus = CareerProgress['focus'];
// All parameters are fictional, adjustable playtest settings, not clinical measurements.
export const ABILITY_RULES = { version: 'abilities-six-provisional-2', provisional: true,
  monthlyGain: 0.75, eventGain: 1.2, decayAfter: 12, decay: 0.35, retainedStart: 0.5,
  eventSpacing: 6, eventChance: 0.3, eventCooldown: 18, applicationRange: 8 };
const month = (s: GameState) => Math.floor((s.life?.elapsedMs ?? 0) / 1000);
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const round = (n: number) => Math.round(n * 10) / 10;
const draw = (a: AbilityState) => {
  a.seed = (Math.imul(a.seed, 1664525) + 1013904223) >>> 0;
  return a.seed / 4294967296;
};
export const FOCUS_ABILITIES: Record<Focus, AbilityId[]> = {
  study: ['judgment', 'selfManagement'], research: ['research', 'judgment', 'selfManagement'],
  clinical: ['judgment', 'technique', 'communication'], people: ['communication', 'management'],
  rest: ['selfManagement'], work: ['management', 'communication', 'selfManagement'],
};
const CLUB_ABILITIES: Record<string, AbilityId[]> = {
  basketball: ['selfManagement', 'communication'], climbing: ['selfManagement', 'management'],
  band: ['technique', 'communication'], volunteer: ['communication', 'management'],
  photo: ['judgment', 'technique'], research: ['research', 'judgment'],
};
export function initialAbilities(s: GameState): AbilityState {
  const m = month(s);
  const bonuses = abilityBackgroundBonuses(s.life?.background);
  const wide = s.life?.background.profile?.version === 3;
  const a: AbilityState = { version: 2, seed: ((s.life?.initialSeed ?? s.seed) ^ 0x3c6ef372) >>> 0,
    since: m, lastMonth: m, values: {} as AbilityValues, used: {} as Record<AbilityId, number>, changes: {}, specialties: {}, seen: {} };
  for (const def of ABILITIES) {
    const professional = ['technique', 'research', 'management'].includes(def.id);
    const base = wide ? (professional ? 6 : 20) : (professional ? 8 : 25);
    const spread = wide ? (professional ? 26 : 45) : (professional ? 22 : 35);
    a.values[def.id] = round(clamp(base + draw(a) * spread + (bonuses[def.id] ?? 0)));
    a.used[def.id] = m;
  }
  // Old saves begin here; do not invent past skill gains or completed training.
  return a;
}
export function upgradeAbilities(s: GameState) {
  s.abilities = s.abilities ? isLegacyAbilities(s.abilities) ? migrateAbilities(s.abilities) : s.abilities : initialAbilities(s);
}
export function abilityState(s: GameState): AbilityState {
  return s.abilities ? isLegacyAbilities(s.abilities) ? migrateAbilities(s.abilities) : s.abilities : initialAbilities(s);
}
const conditionWeights: Record<AbilityId, [number, number, number, number]> = {
  judgment: [0.05, 0.025, 0.1, 0.015], technique: [0.16, 0.025, 0.04, 0.01],
  communication: [0.025, 0.07, 0.01, 0.08], research: [0.03, 0.04, 0.1, 0.02],
  management: [0.04, 0.05, 0.06, 0.05], selfManagement: [0.1, 0.09, 0.015, 0.025],
};
export function abilityPerformance(s: GameState, id: AbilityId): { base: number; current: number; condition: number } {
  const a = abilityState(s), weights = conditionWeights[id];
  const stats = [s.stats.health, s.stats.happiness, s.stats.knowledge, s.stats.relationships];
  const condition = clamp(stats.reduce((sum, n, i) => sum + (n - 50) * weights[i], 0)
    - (s.dynamics?.fatigue ?? 0) * (id === 'technique' || id === 'judgment' ? 0.65 : 0.45), -35, 10);
  const base = a.values[id], current = round(clamp(base + condition));
  return { base, current, condition: round(current - base) };
}
export function abilityScore(s: GameState, ids: readonly AbilityId[]): number {
  return ids.reduce((sum, id) => sum + abilityPerformance(s, id).current, 0) / ids.length;
}
export const focusAbilityModifier = (s: GameState, focus: Focus) => s.abilities ? (abilityScore(s, FOCUS_ABILITIES[focus]) - 45) / 180 : 0;
export const SYNERGY_RULES = { version: 'specialty-synergy-exponential-provisional-2', provisional: true,
  base: 2, fitPower: 2, masteryInteraction: 3 };
// Fictional gameplay profiles. Complementary skills multiply; one strong skill alone is insufficient.
export const SPECIALTY_SYNERGY: Record<string, readonly AbilityId[]> = {
  internal: ['judgment', 'communication'], surgery: ['technique', 'judgment'],
  pediatrics: ['communication', 'judgment'], obgyn: ['technique', 'communication'],
  psychiatry: ['communication', 'selfManagement'], orthopedics: ['technique', 'selfManagement'],
  neurosurgery: ['technique', 'judgment', 'selfManagement'], thoracic: ['technique', 'judgment', 'communication'],
  plastic: ['technique', 'communication'], ophthalmology: ['technique', 'judgment'],
  ent: ['technique', 'communication'], dermatology: ['judgment', 'technique'],
  urology: ['technique', 'communication'], radiology: ['judgment', 'research'],
  radiation: ['research', 'judgment', 'communication'], anesthesia: ['judgment', 'technique', 'selfManagement'],
  neurology: ['judgment', 'research', 'communication'], rehabilitation: ['communication', 'management'],
  tuberculosis: ['communication', 'management', 'judgment'], laboratory: ['research', 'management'],
  pathology: ['research', 'judgment'], preventive: ['research', 'management', 'communication'],
  family: ['communication', 'judgment', 'selfManagement'], occupational: ['research', 'communication'],
  nuclear: ['research', 'technique'], emergency: ['judgment', 'management', 'selfManagement'],
};
export function specialtySynergy(s: GameState, focus: Focus): number {
  const id = s.career?.specialty;
  if (!s.abilities || !id || s.career?.application !== 'accepted' || ![1, 2].includes(s.stageIndex)
    || !['clinical', 'research', 'work'].includes(focus)) return 1;
  const skills = SPECIALTY_SYNERGY[id];
  if (!skills) return 1;
  const fit = skills.reduce((product, skill) => product * clamp(
    abilityPerformance(s, skill).current / 100, 0, 1), 1) ** (1 / skills.length);
  const mastery = clamp((abilityState(s).specialties[id] ?? 0) / 100, 0, 1);
  const exponent = fit ** SYNERGY_RULES.fitPower * (1 + SYNERGY_RULES.masteryInteraction * fit * mastery);
  // Keep full precision until the reward is settled; UI rounding must not create growth steps.
  return SYNERGY_RULES.base ** exponent;
}
export function abilityFatigueRelief(s: GameState): number {
  return s.abilities ? Math.floor(abilityScore(s, ['selfManagement']) / 35) : 0;
}
function change(s: GameState, id: AbilityId, amount: number, reason: string) {
  const a = s.abilities!, before = a.values[id];
  const cap = s.stageIndex === 0 && id === 'technique' ? 45 : 100;
  // Existing values above a stage cap are never removed by practice.
  const after = round(amount > 0 ? Math.min(Math.max(before, cap), before + amount * (1 - before / 120)) : clamp(before + amount));
  a.values[id] = after;
  if (amount > 0) a.used[id] = month(s);
  if (after !== before) {
    const last = a.changes[id];
    a.changes[id] = { month: month(s), delta: round(after - before + (last?.month === month(s) ? last.delta : 0)), reason };
  }
}
export function practiceAbilities(s: GameState, ids: readonly AbilityId[], amount: number, reason: string) {
  upgradeAbilities(s);
  const learning = clamp(0.55 + s.stats.health / 400 + s.stats.happiness / 400
    + s.stats.knowledge / 600 + s.stats.relationships / 800 - (s.dynamics?.fatigue ?? 0) / 60, 0.3, 1.4);
  const synergy = specialtySynergy(s, s.progress?.focus ?? 'study');
  const aligned = SPECIALTY_SYNERGY[s.career?.specialty ?? ''] ?? [];
  for (const id of new Set(ids)) change(s, id, amount > 0 ? amount * learning * (aligned.includes(id) ? synergy : 1) : amount, reason);
}
export function learnSpecialty(s: GameState, id: string, gain: number) {
  if (!SPECIALTIES.some(x => x.id === id)) return;
  upgradeAbilities(s);
  const before = s.abilities!.specialties[id] ?? 0;
  const synergy = id === s.career?.specialty ? specialtySynergy(s, 'clinical') : 1;
  s.abilities!.specialties[id] = round(Math.min(s.stageIndex === 0 ? 20 : 100, before + gain * synergy * (1 - before / 120)));
}
export function advanceAbilities(s: GameState) {
  upgradeAbilities(s);
  const a = s.abilities!, m = month(s);
  if (m <= a.lastMonth) return;
  a.lastMonth = m;
  const focus = s.progress!.focus;
  const gain = ABILITY_RULES.monthlyGain * (0.65 + draw(a) * 0.7);
  practiceAbilities(s, FOCUS_ABILITIES[focus], gain, { study: '공부', research: '연구 참여', clinical: '실습과 업무', people: '모임과 대화', rest: '휴식과 가벼운 운동', work: '일과 일정 관리' }[focus]);
  if (s.stageIndex === 0 && s.campus?.club) practiceAbilities(s, CLUB_ABILITIES[s.campus.club] ?? [], gain * (focus === 'people' ? 0.65 : 0.25), '동아리 활동');
  if (s.stageIndex === 1 && s.career?.application === 'accepted' || s.stageIndex === 2 && (['employed', 'clinic', 'untrained'].includes(s.career?.practice ?? '') || s.career?.practice === 'research' && s.career.application === 'accepted')) {
    const professionalFocus = s.career?.practice === 'research' ? 'research' : 'clinical';
    practiceAbilities(s, [...FOCUS_ABILITIES[professionalFocus], ...(SPECIALTY_SYNERGY[s.career?.specialty ?? ''] ?? [])], gain * 0.45, professionalFocus === 'research' ? '전공 연구 경험' : '수련과 진료 경험');
    if (s.career?.specialty) learnSpecialty(s, s.career.specialty, 0.6);
  }
  if (focus === 'clinical' && s.career?.interest && s.career.explored.includes(s.career.interest)) learnSpecialty(s, s.career.interest, 0.3);
  if (m % 3 === 0) {
    const starting = initialAbilities(s).values;
    for (const { id } of ABILITIES) if (m - a.used[id] >= ABILITY_RULES.decayAfter) {
      // Disuse erodes acquired fluency, rather than subtracting a fixed amount forever.
      const excess = a.values[id] - starting[id] * ABILITY_RULES.retainedStart;
      if (excess > 0) change(s, id, -Math.min(ABILITY_RULES.decay, excess * 0.03), '오랫동안 쓰지 않은 능력');
    }
  }
}

export function abilityEventWeight(s: GameState, key: string): number {
  if (!s.abilities) return 1;
  const ids: AbilityId[] = key.includes('research') ? ['research']
    : /offer|friend|introduction|mentor|relationship/.test(key) ? ['communication']
    : key === 'rest' ? ['selfManagement'] : ['selfManagement', 'management'];
  const score = abilityScore(s, ids);
  return clamp(key === 'rest' ? 1.5 - score / 100 : 0.6 + score / 70, 0.5, 2);
}
export function weightedAbilityPick<T>(items: T[], roll: number, weight: (item: T) => number): T {
  const weights = items.map(item => Math.max(0.01, weight(item)));
  let cursor = roll * weights.reduce((sum, n) => sum + n, 0);
  return items.find((_, i) => (cursor -= weights[i]) < 0) ?? items[items.length - 1];
}
export function specialtyAbilityBonus(s: GameState, id: string): number {
  if (!s.abilities) return 0;
  const track = SPECIALTIES.find(x => x.id === id)?.track;
  const ids: AbilityId[] = track === 'surgical' ? ['technique', 'judgment', 'selfManagement', 'communication']
    : track === 'diagnostic' ? ['judgment', 'research']
    : track === 'community' ? ['communication', 'research', 'management']
    : ['judgment', 'communication', 'selfManagement'];
  return round(clamp((abilityScore(s, ids) - 40) / 6 + (s.abilities.specialties[id] ?? 0) / 15, -ABILITY_RULES.applicationRange, ABILITY_RULES.applicationRange));
}

interface Situation {
  key: string; title: string; body: string; focus: Focus; skills: AbilityId[];
  attempt: string; supported: string; success: string; setback: string;
  gate: AbilityId; threshold: number; advanced: string; clue: string;
  eligible: (s: GameState) => boolean;
}
export const ABILITY_SITUATIONS: Situation[] = [
  { key: 'ability-technique', title: '지도자와 함께하는 처치', body: '연습해 온 처치를 지도자와 함께 진행합니다. 시작 전에 준비 상태와 순서를 확인합니다.', focus: 'clinical', skills: ['technique', 'judgment', 'selfManagement'], attempt: '한 단계씩 확인하며 맡기', supported: '지도자와 나눠서 진행하기', success: '준비한 순서대로 처치를 마치고 지도자와 과정을 복기했습니다.', setback: '어려운 단계에서 지도자의 도움을 받아 마무리했습니다.', gate: 'technique', threshold: 50, advanced: '준비부터 마무리까지 맡아보기', clue: '반복해서 익힌 순서가 손에 익었습니다.', eligible: s => s.stageIndex === 0 ? month(s) >= 36 && s.progress?.focus === 'clinical' : s.stageIndex < 3 && s.career?.practice !== 'research' && (s.career?.application === 'accepted' || ['employed', 'clinic', 'untrained'].includes(s.career?.practice ?? '')) },
  { key: 'ability-schedule', title: '발표와 시험이 겹쳤다', body: '시험 전날까지 조별 발표 자료를 내야 합니다. 팀원들의 가능한 시간이 서로 다릅니다.', focus: 'study', skills: ['management', 'judgment', 'selfManagement'], attempt: '내 몫을 먼저 마무리하기', supported: '팀원과 분량을 다시 나누기', success: '발표 준비와 복습 시간을 모두 확보했습니다.', setback: '예상보다 오래 걸려 복습 계획을 줄였습니다.', gate: 'management', threshold: 55, advanced: '일정을 다시 짜서 팀에 제안하기', clue: '겹치는 작업을 한 번에 처리할 여지가 보입니다.', eligible: s => s.stageIndex === 0 },
  { key: 'ability-team', title: '모임 준비를 두고 의견이 갈렸다', body: '한쪽은 규모를 키우고 싶어 하고, 다른 쪽은 지금 일정도 벅차다고 합니다.', focus: 'people', skills: ['communication', 'management'], attempt: '내 의견을 설명하기', supported: '각자 맡을 수 있는 일을 듣기', success: '할 일과 책임을 나눠 다음 모임을 준비했습니다.', setback: '합의하지 못해 모임 규모를 줄였습니다.', gate: 'communication', threshold: 55, advanced: '두 의견을 묶어 중재안 내기', clue: '원하는 규모보다 부담을 나누는 방식이 쟁점입니다.', eligible: s => s.stageIndex < 3 },
  { key: 'ability-research', title: '분석표의 숫자가 맞지 않는다', body: '함께 정리한 자료에서 표와 본문의 숫자가 다릅니다. 발표 전에 확인할 시간이 많지 않습니다.', focus: 'research', skills: ['research', 'judgment'], attempt: '원자료부터 다시 살펴보기', supported: '지도자와 검토 범위를 정하기', success: '불일치의 원인을 찾아 발표 자료를 고쳤습니다.', setback: '확인할 항목이 늘어 발표 범위를 줄였습니다.', gate: 'research', threshold: 50, advanced: '검증 절차를 만들어 함께 확인하기', clue: '같은 항목이 서로 다른 기준으로 묶여 있습니다.', eligible: s => s.progress?.focus === 'research' || s.campus?.club === 'research' || s.career?.practice === 'research' },
  { key: 'ability-practice', title: '실습 기록의 빠진 부분', body: '지도자와 사례를 복기하다 인계 기록에 빠진 내용이 있다는 걸 알게 됐습니다.', focus: 'clinical', skills: ['judgment', 'technique', 'communication'], attempt: '앞뒤 기록을 맞춰 정리하기', supported: '지도자에게 확인을 요청하기', success: '빠진 내용을 확인해 다음 인계에 반영했습니다.', setback: '혼자 확인하기 어려워 추가 검토 시간을 잡았습니다.', gate: 'judgment', threshold: 55, advanced: '발견한 단서를 정리해 팀에 제시하기', clue: '기록 순서와 실제 전달 시간이 어긋나 있습니다.', eligible: s => s.stageIndex === 0 ? month(s) >= 36 && s.progress?.focus === 'clinical' : s.stageIndex < 3 && ['accepted', 'untrained'].includes(s.career?.application ?? '') && s.career?.practice !== 'research' },
  { key: 'ability-recovery', title: '계속하기엔 몸이 무겁다', body: '운동과 약속이 이어졌습니다. 오늘도 예정대로 움직일지 일정을 줄일지 정합니다.', focus: 'rest', skills: ['selfManagement'], attempt: '강도를 낮춰 이어가기', supported: '쉬고 다음 일정을 조정하기', success: '무리하지 않고 생활 리듬을 되찾았습니다.', setback: '생각보다 지쳐 약속 하나를 미뤘습니다.', gate: 'selfManagement', threshold: 55, advanced: '회복 시간을 나눠 일정 바꾸기', clue: '잠과 이동 시간을 먼저 확보할 수 있습니다.', eligible: () => true },
  { key: 'ability-budget', title: '계획보다 늘어난 비용', body: '함께 맡은 일의 비용이 예상보다 늘었습니다. 남은 예산으로 범위를 다시 정해야 합니다.', focus: 'work', skills: ['management', 'communication'], attempt: '항목별 비용 다시 따져보기', supported: '동료와 우선순위 정하기', success: '필요한 일을 남기고 불필요한 지출 계획을 줄였습니다.', setback: '조정이 늦어 일부 계획을 다음으로 미뤘습니다.', gate: 'management', threshold: 50, advanced: '대안을 비교해 예산 다시 짜기', clue: '반복해서 잡힌 준비 항목이 보입니다.', eligible: s => s.campus?.project === 'accepted' || s.progress?.focus === 'work' || s.career?.practice === 'clinic' },
];
export function abilityEvent(s: GameState, key: string): Pick<GameEvent, 'title' | 'body' | 'choices'> | null {
  if (isLegacyAbilities(s.abilities)) return legacyAbilityEvent(legacyGame(s), key);
  const e = ABILITY_SITUATIONS.find(x => x.key === key);
  if (!e || !s.abilities || !e.eligible(s)) return null;
  const score = abilityPerformance(s, e.gate).current;
  return { title: e.title, body: e.body + (score >= e.threshold ? ` ${e.clue}` : ''), choices: [
    { id: 'attempt', label: e.attempt, description: e.skills.map(id => ABILITIES.find(x => x.id === id)!.label).join('·') + '에 따라 진행과 부담이 달라집니다.', effects: {} },
    { id: 'supported', label: e.supported, description: '도움을 받으며 부담을 줄입니다.', effects: {} },
    ...(score >= e.threshold ? [{ id: 'advanced', label: e.advanced, description: `${ABILITIES.find(x => x.id === e.gate)!.label}을 활용합니다.`, effects: {} }] : []),
  ] };
}
export function nextAbilityEvent(s: GameState): string | null {
  const a = s.abilities, m = month(s);
  if (compactPacing(s) && Object.keys(a?.seen ?? {}).length >= PACING_RULES.abilityLimit) return null;
  if (!a || m % ABILITY_RULES.eventSpacing) return null;
  const eligible = ABILITY_SITUATIONS.filter(e => e.eligible(s) && a.seen[e.key] === undefined);
  if (!eligible.length || draw(a) >= ABILITY_RULES.eventChance) return null;
  const chosen = weightedAbilityPick(eligible, draw(a), e => (e.focus === s.progress?.focus ? 2 : 1) * (0.7 + abilityScore(s, e.skills) / 100));
  a.seen[chosen.key] = m;
  return chosen.key;
}
export function settleAbilityEvent(s: GameState, key: string, choice: string, actionId: string, choiceVersion?: 1): boolean {
  if (choiceVersion === 1) upgradeAbilities(s);
  if (isLegacyAbilities(s.abilities)) {
    const legacy = legacyGame(s);
    if (!legacySettleAbilityEvent(legacy, key, choice, actionId)) return false;
    s.abilities = migrateAbilities(legacy.abilities!);
    return true;
  }
  const e = ABILITY_SITUATIONS.find(x => x.key === key);
  if (!e || !abilityEvent(s, key)?.choices.some(x => x.id === choice)) return false;
  const score = abilityScore(s, e.skills);
  const approach = abilityApproach(choice);
  const chance = clamp(0.25 + score / 160 + approach.chance, 0.2, 0.9);
  const success = draw(s.abilities!) < chance;
  const effects: Partial<Stats> = choiceVersion === 1 ? {
    happiness: success ? 2 : -2,
    health: e.focus === 'rest' ? approach.recovery - (success ? 0 : 2) : approach.health - (choice === 'attempt' && score < 35 ? 1 : 0),
    ...(e.focus !== 'rest' ? choice === 'supported' ? { relationships: 2 } : choice === 'advanced' ? { relationships: 1, knowledge: success ? 1 : 0 } : { knowledge: success ? 2 : 1 } : {}),
  } : { happiness: success ? 2 : -2, ...(e.focus === 'rest' ? { health: success ? 3 : 1 } : { health: choice === 'supported' ? 0 : -(1 + Number(score < 35)) }),
    ...(e.focus === 'people' || choice === 'supported' ? { relationships: 1 } : { knowledge: success ? 1 : 0 }) };
  for (const k of Object.keys(effects) as (keyof Stats)[]) { const before = s.stats[k]; s.stats[k] = clamp(before + effects[k]!); effects[k] = s.stats[k] - before; }
  practiceAbilities(s, e.skills, ABILITY_RULES.eventGain * (success ? 1.25 : 0.65) * (choiceVersion === 1 ? approach.practice : 1), e.title);
  if (!success) practiceAbilities(s, ['judgment', 'selfManagement'], -0.2, '계획이 어긋난 뒤 재정비');
  s.journal.push({ id: `${actionId}:abilities`, stage: ['university', 'training', 'career', 'retirement'][s.stageIndex] as GameEvent['stage'], title: e.title + ' · 결과',
    detail: `${success ? e.success : e.setback} ${choiceVersion === 1 ? choice === 'supported' ? '직접 연습할 양을 줄이고 도움을 받았습니다. ' : choice === 'advanced' ? '익힌 방법을 공동 작업에 적용했습니다. ' : '직접 해보며 연습량을 늘렸습니다. ' : ''}${e.skills.map(id => ABILITIES.find(x => x.id === id)!.label).join('·')}과 현재 컨디션이 영향을 줬습니다.`, effects });
  return true;
}
export function practiceAbilityChoice(s: GameState, key: string, choice: string) {
  if (key.startsWith('ability-')) return;
  let focus: Focus | undefined;
  if (key === 'clinical-case' || key === 'campus-practice' || key === 'depth-training' || key === 'depth-work') focus = s.career?.practice === 'research' ? 'research' : 'clinical';
  else if (/research/.test(key) && !['pass', 'decline'].includes(choice)) focus = 'research';
  else if (key === 'campus-team' || key === 'campus-invitation' && choice !== 'decline' || ['friend', 'friend-request', 'relationship'].includes(key)) focus = 'people';
  else if (key === 'rest' || key === 'campus-summer' && choice === 'rest') focus = 'rest';
  if (focus) practiceAbilities(s, FOCUS_ABILITIES[focus], ABILITY_RULES.eventGain, '선택 뒤 쌓은 경험');
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const bounded = (n: unknown, max = 100): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
const integer = (n: unknown, max: number): n is number => bounded(n, max) && Number.isSafeInteger(n);
export function validAbilities(value: unknown, currentMonth: number): boolean {
  if (value === undefined) return true;
  if (isLegacyAbilities(value)) return validLegacyAbilities(value, currentMonth);
  if (!record(value)) return false;
  const a = value as unknown as AbilityState;
  const keys = ABILITIES.map(x => x.id);
  return a.version === 2 && integer(a.seed, 0xffffffff) && integer(a.since, currentMonth) && integer(a.lastMonth, currentMonth) && a.lastMonth >= a.since
    && record(a.values) && Object.keys(a.values).length === keys.length && keys.every(k => bounded(a.values[k]))
    && record(a.used) && Object.keys(a.used).length === keys.length && keys.every(k => integer(a.used[k], currentMonth) && a.used[k] >= a.since)
    && record(a.changes) && Object.entries(a.changes).every(([k, c]) => keys.includes(k as AbilityId) && record(c) && integer(c.month, currentMonth) && c.month >= a.since && typeof c.delta === 'number' && Number.isFinite(c.delta) && Math.abs(c.delta) <= 100 && typeof c.reason === 'string' && c.reason.length <= 120)
    && record(a.specialties) && Object.entries(a.specialties).every(([id, n]) => SPECIALTIES.some(x => x.id === id) && bounded(n))
    // A required follow-up may be selected immediately after a choice, before the next monthly update.
    && record(a.seen) && Object.entries(a.seen).every(([id, n]) => ABILITY_SITUATIONS.some(x => x.key === id) && integer(n, currentMonth) && n >= a.since);
}
