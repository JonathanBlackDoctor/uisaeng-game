import type { CareerProgress, GameEvent, GameState, Stats } from './contracts';
import { ABILITIES, ABILITY_SITUATIONS, FOCUS_ABILITIES, SPECIALTY_SYNERGY, abilityPerformance, practiceAbilities, specialtySynergy } from './abilities';
import { isLegacyAbilities, type AbilityId } from './ability-schema';

type Focus = CareerProgress['focus'];
export const IMPACT_RULES = { version: 1, provisional: true, difficulty: [30, 45, 55, 30], noise: 12, advanced: 15 } as const;
const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const label = (id: AbilityId) => ABILITIES.find(a => a.id === id)!.label;
export interface AbilityRoute { base: string; focus: Focus; skill: AbilityId; support?: boolean; advanced?: boolean; label?: string }
export interface Performance {
  focus: Focus;
  skill: AbilityId; score: number; difficulty: number; margin: number;
  tier: string; condition: number; fatigue: number;
}
export function performancePreview(s: GameState, focus: Focus, route?: AbilityRoute): Performance {
  const skill = route?.skill ?? (focus === 'clinical' ? (SPECIALTY_SYNERGY[s.career?.specialty ?? '']?.[0] ?? 'technique') : FOCUS_ABILITIES[focus][0]);
  const p = abilityPerformance(s, skill);
  const others = FOCUS_ABILITIES[focus].filter(id => id !== skill);
  const score = others.length ? p.current * 0.75 + others.reduce((n, id) => n + abilityPerformance(s, id).current, 0) / others.length * 0.25 : p.current;
  const difficulty = IMPACT_RULES.difficulty[s.stageIndex] + (route?.advanced ? IMPACT_RULES.advanced : 0);
  const margin = score + (route?.support ? 16 : 0) - difficulty;
  const tier = route?.support ? '도움받아 진행' : margin >= 25 ? '어려운 일도 맡을 실력' : margin >= 8 ? '혼자 안정적으로 수행' : margin >= -10 ? '반복하며 익히는 중' : '도움받으며 익히는 중';
  const fatigue = focus === 'rest' ? -Math.round(3 + score / 25 + (route?.support ? 2 : 0)) : route?.support ? 0 : margin >= 8 ? (route?.advanced ? 1 : 0) : margin >= -10 ? 1 : 2;
  return { focus, skill, score, difficulty, margin, tier, condition: p.condition, fatigue };
}
/** Skill establishes the level; bounded variation cannot erase a large skill gap.
 * A well-practised routine cannot randomly become a failure. */
export function performanceGrade(p: Performance, roll: number, momentum = 0): number {
  const value = p.margin + (roll * 2 - 1) * IMPACT_RULES.noise + clamp(momentum * 0.3, -3, 3);
  const grade = value < -22 ? -2 : value < -8 ? -1 : value < 10 ? 0 : value < 28 ? 1 : 2;
  return p.margin >= 8 ? Math.max(0, grade) : grade;
}
export function performanceExplanation(p: Performance, grade: number): string {
  const outcomes: Record<Focus, string[]> = {
    study: ['기초 내용을 다시 살폈습니다.', '이해되지 않은 부분을 더 복습했습니다.', '계획한 분량을 익혔습니다.', '막히던 내용을 스스로 풀었습니다.', '심화 내용까지 정리했습니다.'],
    clinical: ['과정을 나눠 다시 확인했습니다.', '추가 확인을 거쳐 마쳤습니다.', '필요한 과정을 마쳤습니다.', '재작업을 줄여 마쳤습니다.', '어려운 부분까지 정리했습니다.'],
    research: ['자료의 기초부터 다시 확인했습니다.', '분석 범위를 줄여 검토했습니다.', '정한 범위의 검토를 마쳤습니다.', '자료의 오류를 찾아 수정했습니다.', '후속 검토에 쓸 근거까지 정리했습니다.'],
    people: ['의견 차이가 남아 다시 이야기하기로 했습니다.', '서로의 요구를 더 확인했습니다.', '서로 할 일을 정했습니다.', '협조를 얻어 일을 나눴습니다.', '다른 의견을 모아 함께할 계획을 세웠습니다.'],
    work: ['작업 순서를 다시 정했습니다.', '밀린 작업부터 처리했습니다.', '정한 범위의 일을 마쳤습니다.', '중복 작업을 줄였습니다.', '복잡한 일정까지 정리했습니다.'],
    rest: ['일정을 줄여 회복에 집중했습니다.', '회복에 시간이 더 필요했습니다.', '생활 리듬을 되찾았습니다.', '피로를 덜고 일정을 이어갔습니다.', '회복 시간을 충분히 확보했습니다.'],
  };
  const outcome = outcomes[p.focus][grade + 2];
  return `${label(p.skill)} 중심 수행력 ${Math.round(p.score)} · 과제 수준 ${p.difficulty}. ${outcome}${p.condition <= -5 ? ` 컨디션으로 ${label(p.skill)} ${Math.round(p.condition)}.` : ''}`;
}

function routes(s: GameState, e: GameEvent): Record<string, AbilityRoute> {
  const key = e.randomKey ?? '';
  const situation = ABILITY_SITUATIONS.find(a => a.key === key);
  if (situation) {
    const secondary = situation.skills.find(id => id !== situation.gate) ?? situation.gate;
    return {
      attempt: { base: 'attempt', focus: situation.focus, skill: situation.gate },
      supported: { base: 'supported', focus: situation.focus, skill: secondary, support: true },
      advanced: { base: 'advanced', focus: situation.focus, skill: situation.gate, advanced: true },
    };
  }
  if (key === 'campus-team') return {
    study: { base: 'study', focus: 'study', skill: 'judgment' },
    people: { base: 'people', focus: 'people', skill: 'communication', support: true },
    research: { base: 'research', focus: 'research', skill: 'research' },
    'skill-management': { base: 'people', focus: 'work', skill: 'management', advanced: true, label: '일정과 역할을 다시 짜기' },
  };
  if (key === 'campus-practice') return {
    clinical: { base: 'clinical', focus: 'clinical', skill: 'judgment', support: true },
    research: { base: 'research', focus: 'research', skill: 'research' },
    people: { base: 'people', focus: 'people', skill: 'communication', support: true },
    'skill-judgment': { base: 'clinical', focus: 'clinical', skill: 'judgment', advanced: true, label: '핵심 질문을 정리해 선배와 검토하기' },
  };
  if (key === 'clinical-case') return {
    team: { base: 'team', focus: 'clinical', skill: 'communication', support: true },
    review: { base: 'review', focus: 'clinical', skill: 'judgment' },
    'skill-judgment': { base: 'review', focus: 'clinical', skill: 'judgment', advanced: true, label: '판단 근거를 정리해 팀 검토 이끌기' },
  };
  if (key === 'depth-training' || key === 'depth-work') {
    const focus = s.career?.practice === 'research' ? 'research' : 'clinical';
    const skills = SPECIALTY_SYNERGY[s.career?.specialty ?? ''] ?? FOCUS_ABILITIES[focus];
    const result: Record<string, AbilityRoute> = Object.fromEntries(e.choices.filter(c => !c.id.startsWith('skill-')).map(c => {
      const text = c.label;
      const skill: AbilityId = /일정|예산|분담|조율/.test(text) ? 'management' : /설명|동료|팀|상의|가족/.test(text) ? 'communication'
        : /연구|자료|논문|분석/.test(text) ? 'research' : /술기|시술|수술|처치/.test(text) ? 'technique' : skills[0];
      return [c.id, { base: c.id, focus, skill, support: /함께|상의|도움|지도/.test(text) }];
    }));
    const best = Object.values(result).sort((a, b) => abilityPerformance(s, b.skill).current - abilityPerformance(s, a.skill).current)[0];
    if (best) result[`skill-${best.base}`] = { ...best, support: false, advanced: true, label: '계획을 세워 직접 진행하기' };
    return result;
  }
  return {};
}
export function abilityRoute(s: GameState, e: GameEvent, id: string): AbilityRoute | undefined {
  return e.abilityImpactVersion === 1 ? routes(s, e)[id] : undefined;
}
export function routeDescription(s: GameState, route: AbilityRoute): string {
  const p = performancePreview(s, route.focus, route);
  return `${label(route.skill)} ${Math.round(abilityPerformance(s, route.skill).current)} · ${p.tier} · ${p.fatigue < 0 ? `피로 ${p.fatigue}` : p.fatigue ? `피로 +${p.fatigue}` : '추가 피로 없음'}${route.support ? ' · 직접 연습량 감소' : route.advanced ? route.focus === 'rest' ? ' · 일정 조정 연습' : ' · 높은 과제 수준, 추가 경험' : ''}`;
}
export function designAbilityImpact(s: GameState, e: GameEvent, legacy = false): GameEvent {
  if (legacy || !s.abilities || isLegacyAbilities(s.abilities)) return e;
  const all = routes(s, e);
  if (!Object.keys(all).length) return e;
  const choices = e.choices.map(c => ({ ...c, description: all[c.id] ? [e.randomKey?.startsWith('ability-') ? '' : c.description, routeDescription(s, all[c.id])].filter(Boolean).join(' ') : c.description }));
  for (const [id, r] of Object.entries(all)) {
    if (!r.label || abilityPerformance(s, r.skill).current < IMPACT_RULES.difficulty[s.stageIndex] + IMPACT_RULES.advanced) continue;
    const base = e.choices.find(c => c.id === r.base);
    if (base) choices.push({ ...base, id, label: r.label, description: `${base.label}. ${routeDescription(s, r)}` });
  }
  return { ...e, abilityImpactVersion: 1, choices };
}

/** Settled after the authored action, using the immutable pre-choice snapshot.
 * Costs, identity decisions and clinical eligibility remain in their original reducers. */
export function settleAbilityImpact(s: GameState, before: GameState, e: GameEvent, choice: string, actionId: string, roll: number) {
  const r = abilityRoute(before, e, choice);
  if (!r) return false;
  const p = performancePreview(before, r.focus, r), grade = performanceGrade(p, roll);
  const synergy = specialtySynergy(before, r.focus);
  const factor = r.support ? 0.65 : r.advanced ? 1.35 : 1;
  const target: keyof Stats = r.focus === 'rest' ? 'health' : ['communication', 'management'].includes(r.skill) ? 'relationships' : 'knowledge';
  const effects: Partial<Stats> = { [target]: r.focus === 'rest' ? Math.max(1, grade + 3 + (r.support ? 2 : 0)) : Math.round((grade < 0 ? grade : (grade + 1) * synergy * factor)) };
  for (const k of Object.keys(effects) as (keyof Stats)[]) { const old = s.stats[k]; s.stats[k] = clamp(old + effects[k]!); effects[k] = s.stats[k] - old; }
  let fatigue = 0;
  if (s.dynamics) { const old = s.dynamics.fatigue; s.dynamics.fatigue = clamp(old + p.fatigue, 0, 24); fatigue = s.dynamics.fatigue - old; }
  const xp = Math.round(Math.max(0, grade + 2) * 2 * factor * synergy);
  const experience = s.career?.experience;
  const experienceFocus = r.focus === 'work' ? 'people' : r.focus;
  let gained = 0;
  if (experience && experienceFocus in experience) { const key = experienceFocus as keyof typeof experience; const old = experience[key]; experience[key] = clamp(old + xp); gained = experience[key] - old; }
  const practiceFactor = r.support ? 0.65 : r.advanced ? 1.2 : 1.8;
  practiceAbilities(s, [r.skill], (grade >= 0 ? 1.8 : 1.1) * practiceFactor, e.title, r.focus);
  s.journal.push({ id: `${actionId}:${e.randomKey?.startsWith('ability-') ? 'abilities' : 'impact'}`, stage: e.stage, title: `${e.title} · 실력과 결과`,
    detail: `${performanceExplanation(p, grade)}${r.support ? ' 도움을 받아 직접 연습할 양을 줄였습니다.' : ''} 피로 ${fatigue > 0 ? '+' : ''}${fatigue}${gained ? ` · 관련 경험 +${gained}` : ''}.`, effects });
  return true;
}
