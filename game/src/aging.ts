import type { GameState } from './contracts';
import { calendarMonths, serviceMonths } from './identity';
import { elapsedMonths, lifeStartAge } from './random-life';

// Fictional game balance, not a biological-age or medical prediction model.
export const AGING_RULES = {
  version: 'aging-provisional-1', provisional: true,
  retirementAge: 67, recapAge: 77, onsetAge: 45,
  lowHealth: 40, severeHealth: 20, maxBurdenMonths: 120,
} as const;
export interface AgingState {
  version: 1; lastMonth: number; burdenMonths: number; retirementMonth: number;
}
export const agingAge = (s: GameState) => lifeStartAge(s) + (calendarMonths(s) + (s.aging?.burdenMonths ?? 0)) / 12;
export const retirementDetail = (s: GameState) => s.aging && s.aging.burdenMonths >= 12
  ? '건강 부담이 쌓여 일을 일찍 마무리합니다. 남은 업무를 인계하고 쉬는 시간을 늘립니다.'
  : '맡았던 일을 인계하고 은퇴 후 생활을 준비합니다.';
export function initialAging(s: GameState): AgingState {
  return { version: 1, lastMonth: calendarMonths(s), burdenMonths: 0,
    retirementMonth: Math.max(elapsedMonths(s), (AGING_RULES.retirementAge - lifeStartAge(s)) * 12 - serviceMonths(s)) };
}
export function agingStageEnds(s: GameState, base: number[]): number[] {
  if (!s.aging) return base;
  const retirement = Math.max(base[1] + 1, s.aging.retirementMonth);
  return [base[0], base[1], retirement,
    Math.max(retirement + 12, (AGING_RULES.recapAge - lifeStartAge(s)) * 12 - serviceMonths(s))];
}
export function advanceAging(s: GameState): void {
  const a = s.aging;
  if (!a) return;
  const now = calendarMonths(s);
  for (let month = a.lastMonth + 1; month <= now; month++) {
    const extra = s.stats.health < AGING_RULES.severeHealth ? 2 : s.stats.health < AGING_RULES.lowHealth ? 1 : 0;
    a.burdenMonths = Math.min(AGING_RULES.maxBurdenMonths, a.burdenMonths + extra);
    const effectiveAge = lifeStartAge(s) + (month + a.burdenMonths) / 12;
    if (month % 12 === 0 && effectiveAge >= AGING_RULES.onsetAge) {
      const loss = Math.min(s.stats.health, 1 + Math.floor((effectiveAge - AGING_RULES.onsetAge) / 10));
      s.stats.health -= loss;
      if (loss > 0) s.journal.push({ id: `aging:${month}`, stage: (['university', 'training', 'career', 'retirement'] as const)[s.stageIndex],
        title: '몸의 변화', detail: `${lifeStartAge(s) + Math.floor(month / 12)}세 ${month % 12}개월 · 예전보다 회복에 시간이 걸립니다.${a.burdenMonths >= 12 ? ' 건강이 좋지 않았던 시간이 몸에 부담으로 남았습니다.' : ''}`,
        effects: { health: -loss } });
    }
  }
  a.lastMonth = now;
  if (s.stageIndex < 3) a.retirementMonth = Math.max(elapsedMonths(s), Math.min(a.retirementMonth,
    (AGING_RULES.retirementAge - lifeStartAge(s)) * 12 - serviceMonths(s) - a.burdenMonths));
}
export function validAging(s: GameState): boolean {
  const a = s.aging;
  if (a === undefined) return true;
  return !!a && a.version === 1 && Number.isInteger(a.lastMonth) && a.lastMonth >= 0 && a.lastMonth <= calendarMonths(s)
    && Number.isInteger(a.burdenMonths) && a.burdenMonths >= 0 && a.burdenMonths <= AGING_RULES.maxBurdenMonths
    && Number.isInteger(a.retirementMonth) && a.retirementMonth >= 0 && a.retirementMonth <= Math.max(elapsedMonths(s), (AGING_RULES.retirementAge - 19) * 12);
}
