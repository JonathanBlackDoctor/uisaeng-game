import type { LifeBackground, Stats } from './contracts';

// Fictional, adjustable starting conditions. Percentiles are game ranks, not Korean household statistics.
export const BACKGROUND_RULES = { version: 3, provisional: true, percentileStep: 0.1, statSpread: 20, statEffectMultiplier: 1.2, abilityEffectMultiplier: 1.2 } as const;
export const FAMILY_STYLES = { generous: '넉넉히 보태주는 집', shared: '가능한 만큼 보태주는 집', independent: '일찍 자립을 권하는 집' } as const;
export const CLIMATES = { warm: '서로 이야기를 자주 나눈 가족', distant: '각자 바쁘게 지낸 가족', demanding: '성적에 대한 기대가 컸던 가족', independent: '스스로 결정하도록 맡긴 가족', steady: '필요할 때 서로 도운 가족' } as const;
export const LEARNING = { library: '도서관에서 혼자 공부', tutoring: '개인 지도를 받으며 공부', peers: '친구들과 함께 공부', moving: '전학이 잦았던 학창 시절', practical: '직접 만들고 실험하며 공부' } as const;
export const CHILDHOOD_HEALTH = { robust: '잔병치레가 적었던 성장기', ordinary: '무난했던 성장기 건강', recovering: '몸을 돌보며 보낸 성장기', active: '야외 활동이 많았던 성장기' } as const;
export const EXPERIENCES = [
  '도서관에서 보내던 방과 후', '운동으로 버틴 수험 생활', '친구들과 꾸리던 작은 모임', '가족을 도우며 쌓은 생활 경험',
  '아르바이트로 모은 생활비', '악기를 연습하던 시간', '과학 동아리에서 해본 실험', '꾸준히 써온 글과 기록',
  '이웃을 도왔던 봉사 활동', '토론과 발표를 즐기던 학교생활',
] as const;
export interface BackgroundProfile {
  version: 2 | 3;
  wealthTopPercent: number;
  familyStyle: keyof typeof FAMILY_STYLES;
  climate: keyof typeof CLIMATES;
  learning: keyof typeof LEARNING;
  childhoodHealth: keyof typeof CHILDHOOD_HEALTH;
}
export function expandBackground(original: LifeBackground, draw: () => number, version: 2 | 3 = 3): LifeBackground {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(draw() * a.length)];
  const key = <T extends Record<string, string>>(o: T) => pick(Object.keys(o)) as keyof T;
  const profile: BackgroundProfile = { version, wealthTopPercent: (1 + Math.floor(draw() * 1000)) / 10,
    familyStyle: key(FAMILY_STYLES), climate: key(CLIMATES), learning: key(LEARNING), childhoodHealth: key(CHILDHOOD_HEALTH) };
  return { ...original,
    environment: pick([...(original.region === '제주' || original.region === '강원권' ? [] : ['대도시에서 성장']), '중소도시에서 성장', '농촌에서 성장', '바닷가 마을에서 성장', '여러 지역을 옮겨 다니며 성장']),
    finances: profile.wealthTopPercent <= 25 ? 'comfortable' : profile.wealthTopPercent > 75 ? 'tight' : 'steady',
    support: profile.climate === 'warm' ? 'close' : ['distant', 'demanding'].includes(profile.climate) ? 'limited' : 'steady',
    experience: pick(EXPERIENCES), profile };
}

// [top %, admission gift, monthly support, semester support]. Linear interpolation between anchors.
const LEGACY_FUNDING_ANCHORS = [
  [0.1, 300_000_000, 5_000_000, 10_000_000], [1, 100_000_000, 3_000_000, 8_000_000],
  [5, 50_000_000, 2_000_000, 6_000_000], [10, 30_000_000, 1_600_000, 4_000_000],
  [25, 12_000_000, 1_000_000, 2_000_000], [50, 5_000_000, 600_000, 1_000_000],
  [75, 1_800_000, 250_000, 300_000], [90, 600_000, 80_000, 0], [100, 200_000, 0, 0],
] as const;
export const FUNDING_ANCHORS = [
  [0.1, 600_000_000, 6_000_000, 12_000_000], [1, 200_000_000, 3_500_000, 9_000_000],
  [5, 70_000_000, 2_200_000, 6_000_000], [10, 40_000_000, 1_700_000, 4_000_000],
  [25, 12_000_000, 1_000_000, 2_000_000], [50, 4_000_000, 500_000, 800_000],
  [75, 1_200_000, 150_000, 150_000], [90, 300_000, 40_000, 0], [100, 100_000, 0, 0],
] as const;
export function familyFunding(b?: LifeBackground) {
  const p = b?.profile;
  if (!p) return { initialCash: undefined, monthly: 0, semester: 0 };
  const rank = p.wealthTopPercent;
  const anchors = p.version === 2 ? LEGACY_FUNDING_ANCHORS : FUNDING_ANCHORS;
  const upper = anchors.findIndex(a => a[0] >= rank);
  const hi = anchors[Math.max(0, upper)], lo = anchors[Math.max(0, upper - 1)];
  const ratio = hi[0] === lo[0] ? 0 : (rank - lo[0]) / (hi[0] - lo[0]);
  const factor = (p.version === 2 ? { generous: 1.3, shared: 1, independent: 0.45 } : { generous: 1.5, shared: 1, independent: 0.35 })[p.familyStyle];
  const amount = (column: 1 | 2 | 3) => Math.round((lo[column] + (hi[column] - lo[column]) * ratio) * factor / 10_000) * 10_000;
  return { initialCash: amount(1), monthly: amount(2), semester: amount(3) };
}
export function backgroundStatEffects(b: LifeBackground, trace?: (reason: string, effects: Partial<Stats>) => void): Partial<Stats> {
  const p = b.profile; if (!p) return {};
  const effects = { health: 0, happiness: 0, knowledge: 0, relationships: 0 };
  let index = 0;
  const reasons = [CHILDHOOD_HEALTH[p.childhoodHealth], CLIMATES[p.climate], LEARNING[p.learning], b.experience];
  const add = (x: Partial<Stats>) => { trace?.(reasons[index++], x); for (const k of Object.keys(x) as (keyof Stats)[]) effects[k] += x[k]!; };
  add(({ robust: { health: 12 }, ordinary: {}, recovering: { health: -12, happiness: -3 }, active: { health: 8, happiness: 3 } })[p.childhoodHealth]);
  add(({ warm: { happiness: 10, relationships: 12 }, distant: { happiness: -5, relationships: -8 }, demanding: { happiness: -9, knowledge: 4 }, independent: { happiness: 3 }, steady: { happiness: 3, relationships: 4 } })[p.climate]);
  add(({ library: { knowledge: 9 }, tutoring: { knowledge: 10 }, peers: { knowledge: 5, relationships: 7 }, moving: { relationships: -4, happiness: -3 }, practical: { knowledge: 6 } })[p.learning]);
  const byExperience: Partial<Stats>[] = [
    { knowledge: 8 }, { health: 12 }, { relationships: 12 }, { relationships: 5, health: -3 },
    { health: -5, knowledge: -3 }, { happiness: 8 }, { knowledge: 10 }, { knowledge: 5, happiness: 3 },
    { relationships: 8, happiness: 4 }, { relationships: 7, knowledge: 5 },
  ];
  add(byExperience[EXPERIENCES.indexOf(b.experience as typeof EXPERIENCES[number])] ?? {});
  if (p.version === 3) for (const k of Object.keys(effects) as (keyof Stats)[]) effects[k] = Math.round(effects[k] * BACKGROUND_RULES.statEffectMultiplier);
  return effects;
}
export function backgroundAbilityBonuses(b?: LifeBackground, trace?: (reason: string, skills: string[], amount: number) => void): Record<string, number> {
  if (!b?.profile) return {};
  const p = b.profile, values: Record<string, number> = {};
  let reason = b.experience;
  const add = (skills: string[], n: number) => { trace?.(reason, skills, n); skills.forEach(k => { values[k] = (values[k] ?? 0) + n; }); };
  const experiences = [ ['memory', 'concentration', 'persistence'], ['stamina', 'strength', 'reflexes'], ['sociability', 'leadership', 'mediation'],
    ['empathy', 'planning', 'adaptability'], ['business', 'planning', 'persuasion'], ['dexterity', 'concentration', 'persistence'],
    ['researchDesign', 'analysis', 'observation'], ['writing', 'comprehension', 'regulation'], ['empathy', 'teamwork', 'explanation'], ['explanation', 'reasoning', 'composure'] ];
  add(experiences[EXPERIENCES.indexOf(b.experience as typeof EXPERIENCES[number])] ?? [], 15);
  const learning = { library: ['memory', 'concentration'], tutoring: ['comprehension', 'planning'], peers: ['teamwork', 'explanation'], moving: ['adaptability', 'composure'], practical: ['spatial', 'dexterity'] };
  reason = LEARNING[p.learning];
  add(learning[p.learning], 10);
  reason = CHILDHOOD_HEALTH[p.childhoodHealth];
  if (p.childhoodHealth === 'robust' || p.childhoodHealth === 'active') add(['stamina', 'recovery'], 10);
  if (p.childhoodHealth === 'recovering') { add(['stamina', 'strength'], -10); add(['planning', 'observation'], 8); }
  reason = CLIMATES[p.climate];
  if (p.climate === 'warm') add(['empathy', 'regulation'], 8);
  if (p.climate === 'distant') { add(['sociability'], -8); add(['persistence'], 8); }
  if (p.climate === 'demanding') { add(['regulation', 'composure'], -8); add(['persistence'], 10); }
  if (p.climate === 'independent') add(['adaptability', 'planning'], 10);
  if (p.climate === 'steady') add(['teamwork', 'mediation'], 8);
  if (p.version === 3) for (const k of Object.keys(values)) values[k] = Math.round(values[k] * BACKGROUND_RULES.abilityEffectMultiplier);
  return values;
}
export function familyFatigueModifier(b?: LifeBackground): number {
  if (!b?.profile) return 0;
  return { warm: -2, distant: 1, demanding: 2, independent: -1, steady: -1 }[b.profile.climate];
}
export function backgroundDescription(b: LifeBackground): string | undefined {
  const p = b.profile; if (!p) return;
  return `${b.region} · ${b.environment} · 가정 형편 상위 ${p.wealthTopPercent}% · ${FAMILY_STYLES[p.familyStyle]} · ${CLIMATES[p.climate]} · ${LEARNING[p.learning]} · ${CHILDHOOD_HEALTH[p.childhoodHealth]} · ${b.experience}`;
}
