import type { GameState, Stats } from './contracts';
import { adjustStats, elapsedMonths, lifeAge } from './random-life';
import { practiceAbilities, FOCUS_ABILITIES } from './abilities';

export const LIFESTYLE_RULES = { version: 'lifestyle-provisional-1', provisional: true,
  availableHours: [20, 12, 18, 35], focusHours: 6 };
export const LIFESTYLE_OPTIONS = {
  exercise: { label: '운동', hours: 3, cost: 40_000, income: 0, effects: { health: 3, happiness: 1 } },
  friends: { label: '친구·동아리 모임', hours: 4, cost: 80_000, income: 0, effects: { relationships: 3, happiness: 2 } },
  sleep: { label: '충분히 쉬기', hours: 5, cost: 0, income: 0, effects: { health: 4, happiness: 1 } },
  study: { label: '추가 공부', hours: 5, cost: 60_000, income: 0, effects: { knowledge: 3, health: -1 } },
  research: { label: '연구 모임', hours: 6, cost: 40_000, income: 0, effects: { knowledge: 2, relationships: 1, health: -1 } },
  sidework: { label: '시간제 일', hours: 6, cost: 0, income: 240_000, effects: { health: -2, happiness: -1 } },
} as const;
export type LifestyleKey = keyof typeof LIFESTYLE_OPTIONS;
export type Diet = 'frugal' | 'balanced' | 'comfortable';
export const lifestyleKeys = Object.keys(LIFESTYLE_OPTIONS) as LifestyleKey[];
export interface LifestyleState {
  version: 1; lastMonth: number;
  enabled: Record<LifestyleKey, boolean>;
  diet: Diet;
  accrued: Record<LifestyleKey, number>;
  dietAccrued: Record<Diet, number>;
  effectCarry: Stats;
}
export function initialLifestyle(month = 0): LifestyleState {
  return { version: 1, lastMonth: month, enabled: Object.fromEntries(lifestyleKeys.map(k => [k, false])) as LifestyleState['enabled'], diet: 'balanced',
    accrued: Object.fromEntries(lifestyleKeys.map(k => [k, 0])) as LifestyleState['accrued'], dietAccrued: { frugal: 0, balanced: 0, comfortable: 0 },
    effectCarry: { health: 0, happiness: 0, knowledge: 0, relationships: 0 } };
}
export function lifestyleSchedule(s: GameState) {
  let remaining = LIFESTYLE_RULES.availableHours[s.stageIndex] - LIFESTYLE_RULES.focusHours - (s.depth?.workload === 'extended' ? 4 : 0);
  const active: LifestyleKey[] = [], suspended: LifestyleKey[] = [];
  for (const k of lifestyleKeys) if (s.lifestyle?.enabled[k]) {
    const o = LIFESTYLE_OPTIONS[k];
    if (remaining >= o.hours && !(k === 'sidework' && (s.stageIndex === 1 || s.stageIndex === 3))) { active.push(k); remaining -= o.hours; }
    else suspended.push(k);
  }
  return { active, suspended, remaining };
}
export function accrueLifestyle(s: GameState, simulatedMs: number) {
  const l = s.lifestyle; if (!l || simulatedMs <= 0) return;
  for (const k of lifestyleSchedule(s).active) l.accrued[k] += simulatedMs;
  l.dietAccrued[l.diet] += simulatedMs;
}
export function dietFactor(diet: Diet) { return diet === 'frugal' ? 0.85 : diet === 'comfortable' ? 1.2 : 1; }
export function monthlyDietFactor(s: GameState) {
  const a = s.lifestyle?.dietAccrued;
  if (!a) return 1;
  const used = a.frugal + a.balanced + a.comfortable;
  return (a.frugal * 0.85 + a.balanced + a.comfortable * 1.2 + (1000 - used)) / 1000;
}
export function lifestyleBudget(s: GameState) {
  const active = lifestyleSchedule(s).active, price = (s.portfolio?.priceIndex ?? 1_000_000) / 1_000_000;
  return { cost: active.reduce((v, k) => v + Math.round(LIFESTYLE_OPTIONS[k].cost * price), 0),
    income: active.reduce((v, k) => v + LIFESTYLE_OPTIONS[k].income, 0) };
}
export function settleLifestyle(s: GameState) {
  const l = s.lifestyle!, e = s.economy!, m = elapsedMonths(s);
  if (m <= l.lastMonth || e.lastMonth !== m) return;
  l.lastMonth = m;
  const effects: Partial<Stats> = {}, missed: string[] = [];
  for (const k of lifestyleKeys) {
    const ms = l.accrued[k]; l.accrued[k] = 0;
    if (!ms) continue;
    const o = LIFESTYLE_OPTIONS[k], price = (s.portfolio?.priceIndex ?? 1_000_000) / 1_000_000;
    const cost = Math.round(o.cost * price * ms / 1000), income = Math.round(o.income * ms / 1000);
    if (cost > e.cash || (cost > 0 && e.due > 0)) { missed.push(o.label); continue; }
    const delta = income - cost;
    e.cash += delta; e.assets += delta; e.income += income; e.expenses += cost;
    if (delta) e.ledger.push({ id: `month:${m}:lifestyle:${k}`, month: m, label: o.label, cashDelta: delta, debtDelta: 0, kind: 'monthly' });
    for (const [key, amount] of Object.entries(o.effects)) l.effectCarry[key as keyof Stats] += amount * ms;
    if (s.abilities) practiceAbilities(s,
      k === 'exercise' ? ['stamina', 'strength', 'reflexes', 'recovery']
        : k === 'sleep' ? ['recovery', 'regulation'] : FOCUS_ABILITIES[k === 'friends' ? 'people' : k === 'sidework' ? 'work' : k],
      0.45 * ms / 1000, o.label);
    if (s.dynamics && k === 'sleep') s.dynamics.fatigue = Math.max(0, s.dynamics.fatigue - Math.round(4 * ms / 1000));
    if (s.career && ['study', 'research', 'friends'].includes(k)) {
      const key = k === 'friends' ? 'people' : k as 'study' | 'research';
      s.career.experience[key] = Math.min(100, s.career.experience[key] + Math.floor(2 * ms / 1000));
    }
  }
  l.effectCarry.happiness += l.dietAccrued.comfortable - l.dietAccrued.frugal;
  l.effectCarry.health += l.dietAccrued.comfortable;
  // Effects accumulate by time actually spent, so toggling just before settlement grants no full-month reward.
  for (const key of Object.keys(l.effectCarry) as (keyof Stats)[]) {
    const amount = Math.trunc(l.effectCarry[key] / 3000); l.effectCarry[key] -= amount * 3000;
    if (amount) effects[key] = amount;
  }
  l.dietAccrued = { frugal: 0, balanced: 0, comfortable: 0 };
  const before = s.stats; s.stats = adjustStats(before, effects);
  for (const k of Object.keys(effects) as (keyof Stats)[]) effects[k] = s.stats[k] - before[k];
  if (missed.length || Object.values(effects).some(v => v)) s.journal.push({ id: `auto:lifestyle:${m}`,
    stage: ['university', 'training', 'career', 'retirement'][s.stageIndex] as 'university', title: '생활 습관',
    detail: `${lifeAge(s)} · ${missed.length ? `${missed.join('·')}은 비용이 부족해 쉬었습니다.` : '꾸준히 보낸 시간이 생활에 남았습니다.'}`, effects });
}
export function validLifestyle(value: unknown, month: number): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const l = value as LifestyleState;
  return l.version === 1 && Number.isSafeInteger(l.lastMonth) && l.lastMonth >= 0 && l.lastMonth <= month
    && ['frugal', 'balanced', 'comfortable'].includes(l.diet)
    && !!l.enabled && !!l.accrued && lifestyleKeys.every(k => typeof l.enabled[k] === 'boolean' && Number.isSafeInteger(l.accrued[k]) && l.accrued[k] >= 0 && l.accrued[k] <= 1000)
    && !!l.dietAccrued && ['frugal', 'balanced', 'comfortable'].every(k => Number.isSafeInteger(l.dietAccrued[k as Diet]) && l.dietAccrued[k as Diet] >= 0)
    && Object.values(l.dietAccrued).reduce((a, b) => a + b, 0) <= 1000
    && !!l.effectCarry && ['health', 'happiness', 'knowledge', 'relationships'].every(k => Number.isSafeInteger(l.effectCarry[k as keyof Stats]) && Math.abs(l.effectCarry[k as keyof Stats]) < 3000);
}
