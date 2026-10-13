import type { GameState, Stats, CareerProgress } from './contracts';
import { adjustStats, elapsedMonths, lifeAge, nextRandom } from './random-life';
import { ECONOMY_RULES } from './economy';

type Focus = CareerProgress['focus'];
const focuses: Focus[] = ['study', 'research', 'clinical', 'people', 'rest', 'work'];
export interface LifeDynamics {
  version: 1;
  seed: number;
  since?: number;
  lastMonth: number;
  fatigue: number;
  momentum: Record<Focus, number>;
  lastGrade: number;
  attempts: string[];
}
// Fictional balance parameters. These are not personal probabilities or wage data.
export const DYNAMICS_RULES = { version: 'life-dynamics-provisional-1', provisional: true,
  momentumLimit: 12, fatigueLimit: 24, quarter: 3 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export function initialDynamics(seed: number, month = 0): LifeDynamics {
  return { version: 1, seed: (seed ^ 0x6a09e667) >>> 0, since: month, lastMonth: month, fatigue: 0,
    momentum: { study: 0, research: 0, clinical: 0, people: 0, rest: 0, work: 0 }, lastGrade: 0, attempts: [] };
}
export function upgradeDynamics(s: GameState) {
  s.dynamics ??= initialDynamics(s.life!.initialSeed, elapsedMonths(s));
}
const relevant: Record<Focus, keyof Stats> = { study: 'knowledge', research: 'knowledge', clinical: 'knowledge', people: 'relationships', rest: 'health', work: 'health' };
const labels: Record<Focus, string> = { study: '공부', research: '연구', clinical: '실습과 업무', people: '모임과 만남', rest: '휴식', work: '일' };
const outcomes = ['여러 번 어긋나 계획을 크게 줄였습니다.', '예상보다 막히는 일이 많았습니다.', '계획한 만큼 진행했습니다.', '일이 잘 풀려 다음 계획까지 준비했습니다.', '기대한 것보다 훨씬 좋은 결과를 얻었습니다.'];

/** One draw per resolved effort, never per frame or UI interaction. */
export function rollEffort(s: GameState, focus: Focus): number {
  const d = s.dynamics!;
  const draw = nextRandom(d.seed); d.seed = draw.seed;
  const readiness = (s.stats[relevant[focus]] - 50) / 150;
  const trend = clamp(readiness + d.momentum[focus] * 0.035 - d.fatigue * 0.012, -0.6, 0.6);
  const weights = [8, 22, 40, 22, 8].map((w, i) => w * Math.exp((i - 2) * trend));
  let cursor = draw.value * weights.reduce((a, b) => a + b, 0), grade = 2;
  for (let i = 0; i < weights.length; i++) { cursor -= weights[i]; if (cursor < 0) { grade = i - 2; break; } }
  d.momentum[focus] = clamp(d.momentum[focus] + grade, -12, 12);
  d.lastGrade = grade;
  return grade;
}
function record(s: GameState, id: string, title: string, detail: string, effects: Partial<Stats>) {
  const before = s.stats;
  s.stats = adjustStats(before, effects);
  const actual: Partial<Stats> = {};
  for (const k of Object.keys(s.stats) as (keyof Stats)[]) if (s.stats[k] !== before[k]) actual[k] = s.stats[k] - before[k];
  s.journal.push({ id, stage: ['university', 'training', 'career', 'retirement'][s.stageIndex] as 'university', title,
    detail: `${lifeAge(s)} · ${detail}`, effects: actual });
}
function effortEffects(focus: Focus, grade: number): Partial<Stats> {
  const target = relevant[focus];
  return { [target]: grade < 0 ? grade * 2 : grade + 1,
    ...(focus !== 'rest' ? { happiness: grade } : { happiness: Math.max(0, grade + 1) }) };
}
export function resolveChoiceEffort(s: GameState, eventKey: string, choice: string, actionId: string) {
  // Decisions about identity, relationships, money transfers and declining an offer are never rerolled.
  const focus: Focus | undefined = eventKey === 'clinical-case' ? 'clinical'
    : eventKey === 'research-followup' && choice === 'review' ? 'research'
    : eventKey === 'research' && choice === 'join' ? 'research'
    : ['campus-team', 'campus-practice'].includes(eventKey) && focuses.includes(choice as Focus) ? choice as Focus
    : eventKey === 'campus-project-result' ? 'people'
    : ['depth-training-result', 'depth-work-result'].includes(eventKey) ? (s.career?.practice === 'research' ? 'research' : 'clinical') : undefined;
  if (!focus) return;
  upgradeDynamics(s);
  const d = s.dynamics!;
  if (d.attempts.includes(actionId)) return;
  d.attempts.push(actionId);
  const grade = rollEffort(s, focus);
  if (focus in s.career!.experience) {
    const k = focus as keyof NonNullable<GameState['career']>['experience'];
    s.career!.experience[k] = clamp(s.career!.experience[k] + grade * 3, 0, 100);
  }
  if (eventKey.startsWith('depth-') && s.depth) s.depth.skill = clamp(s.depth.skill + grade * 2, 0, 100);
  record(s, `${actionId}:effort`, `${labels[focus]}의 결과`, outcomes[grade + 2], effortEffects(focus, grade));
}

/** Called once after the existing monthly content. Old saves start at their current month. */
export function advanceDynamics(s: GameState) {
  const d = s.dynamics!, m = elapsedMonths(s), focus = s.progress!.focus;
  if (m <= d.lastMonth) return;
  d.lastMonth = m;
  if (s.campus?.project === 'finished' && s.campus.projectDue > (d.since ?? 0)) resolveChoiceEffort(s, 'campus-project-result', 'complete', `project:${s.campus.club}:${s.campus.projectDue}`);
  for (const key of ['depth-training', 'depth-work']) {
    const decision = s.depth?.decisions[key];
    if (decision?.followed && decision.month + 3 > (d.since ?? 0)) resolveChoiceEffort(s, `${key}-result`, decision.choice, `followup:${key}:${decision.month}`);
  }
  const demanding = ['study', 'research', 'clinical', 'work'].includes(focus);
  d.fatigue = clamp(d.fatigue + (focus === 'rest' ? -5 : focus === 'people' ? -2 : 1)
    + (s.depth?.workload === 'extended' ? 1 : 0), 0, 24);
  if (m % 6 === 0) for (const key of focuses) if (key !== focus) d.momentum[key] -= Math.sign(d.momentum[key]);
  const grade = rollEffort(s, focus);
  if (focus in s.career!.experience) {
    const k = focus as keyof NonNullable<GameState['career']>['experience'];
    s.career!.experience[k] = clamp(s.career!.experience[k] + [-2, 0, 3, 6, 9][grade + 2], 0, 100);
  }
  s.career!.lastMonth = m;
  if (m % DYNAMICS_RULES.quarter !== 0) return;
  const effects = effortEffects(focus, grade);
  // Maintaining every stat takes time. High values have a larger upkeep burden.
  for (const key of Object.keys(s.stats) as (keyof Stats)[]) {
    const neglected = key !== relevant[focus] && !(key === 'happiness' && ['rest', 'people'].includes(focus));
    effects[key] = (effects[key] ?? 0) - (neglected ? 2 : 0) - (s.stats[key] >= 85 ? 2 : s.stats[key] >= 70 ? 1 : 0);
  }
  if (demanding) effects.health = (effects.health ?? 0) - 1 - Math.floor(d.fatigue / 8);
  if (focus === 'rest') effects.health = (effects.health ?? 0) + 5;
  if (focus === 'people') effects.happiness = (effects.happiness ?? 0) + 2;
  const debtBurden = s.economy!.due > 0 || s.economy!.debt > Math.max(s.economy!.income * 24, 10_000_000);
  if (debtBurden) effects.happiness = (effects.happiness ?? 0) - 2;
  record(s, `auto:dynamics:${m}`, `${labels[focus]}하며 보낸 석 달`,
    `${outcomes[grade + 2]}${d.fatigue >= 12 ? ' 피로가 쌓여 집중하기 어려웠습니다.' : ''}${debtBurden ? ' 갚을 돈이 생활의 부담으로 남았습니다.' : ''}`, effects);
}

/** Variable earnings only; the agreed salary itself is not randomly docked. */
export function variableEarnings(s: GameState): number {
  const d = s.dynamics;
  if (!d || !s.economy || !s.career || !s.progress) return 0;
  const f = s.progress.focus;
  const momentum = d.momentum.work + d.momentum.research + d.momentum.clinical;
  if (s.stageIndex === 0) return f === 'work' ? Math.round(ECONOMY_RULES.universityWorkMonthly * d.momentum.work / 30) : 0;
  if (s.stageIndex !== 2 && !(s.stageIndex === 1 && s.career.application !== 'accepted')) return 0;
  const practice = s.career.practice;
  if (practice === 'clinic') return s.economy.ledger.some(t => t.kind === 'open-clinic') ? Math.round(ECONOMY_RULES.clinicRevenue * clamp(momentum / 45, -0.5, 0.8)) : 0;
  if (practice === 'research') return Math.round(ECONOMY_RULES.researchIncome * clamp(momentum / 60, -0.35, 0.5));
  return 0;
}
export function settleVariableEarnings(s: GameState) {
  const e = s.economy!, m = elapsedMonths(s), id = `month:${m}:performance`;
  if (e.ledger.some(t => t.id === id) || e.lastMonth !== m) return;
  const amount = variableEarnings(s);
  if (!amount) return;
  // A cancelled variable payment is an income correction. Any already-spent part becomes due.
  const paid = amount < 0 ? Math.min(e.cash, -amount) : 0;
  const cashDelta = amount < 0 ? -paid : amount;
  const dueDelta = amount < 0 ? -amount - paid : 0;
  e.cash += cashDelta; e.assets += cashDelta; e.income = Math.max(0, e.income + amount); e.due += dueDelta;
  e.ledger.push({ id, month: m, label: amount > 0 ? '이어진 성과로 늘어난 수입' : '일감·성과 감소로 줄어든 수입', cashDelta, debtDelta: 0, dueDelta, kind: 'monthly' });
}
export function validDynamics(value: unknown, month: number): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const d = value as LifeDynamics;
  return d.version === 1 && Number.isSafeInteger(d.seed) && d.seed >= 0 && d.seed <= 0xffffffff
    && (d.since === undefined || (Number.isSafeInteger(d.since) && d.since >= 0 && d.since <= d.lastMonth))
    && Number.isSafeInteger(d.lastMonth) && d.lastMonth >= 0 && d.lastMonth <= month
    && Number.isSafeInteger(d.fatigue) && d.fatigue >= 0 && d.fatigue <= 24
    && Number.isSafeInteger(d.lastGrade) && Math.abs(d.lastGrade) <= 2
    && !!d.momentum && typeof d.momentum === 'object' && !Array.isArray(d.momentum)
    && focuses.every(k => Number.isSafeInteger(d.momentum[k]) && Math.abs(d.momentum[k]) <= 12)
    && Array.isArray(d.attempts) && d.attempts.every(x => typeof x === 'string') && new Set(d.attempts).size === d.attempts.length;
}
