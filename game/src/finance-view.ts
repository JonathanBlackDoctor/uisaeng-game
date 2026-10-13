import type { GameState } from './contracts';
import { ECONOMY_RULES as R } from './economy';
import { DEPTH_RUNTIME } from './career-depth';
import { variableEarnings } from './life-dynamics';
import { dietFactor, lifestyleBudget } from './lifestyle';

export const exactWon = (n: number) => `${n.toLocaleString('ko-KR')}원`;
export function compactWon(n: number): string {
  const a = Math.abs(n), sign = n < 0 ? '−' : '';
  // Avoid misleading 10,000만/10,000억 labels at rounded unit boundaries.
  if (a >= 999_950_000_000) return `${sign}${Number((a / 1e12).toFixed(1))}조 원`;
  if (a >= 99_995_000) return `${sign}${Number((a / 1e8).toFixed(1))}억 원`;
  if (a >= 10_000) return `${sign}${Number((a / 1e4).toFixed(a >= 1e6 ? 0 : 1)).toLocaleString('ko-KR')}만 원`;
  return exactWon(n);
}
export function financeView(s: GameState) {
  const e = s.economy!, c = s.career!, school = s.stageIndex === 0;
  const training = s.stageIndex === 1 && c.application === 'accepted';
  const working = s.stageIndex === 2 || (s.stageIndex === 1 && !training);
  const clinic = working && c.practice === 'clinic' && e.ledger.some(t => t.kind === 'open-clinic');
  let income = school ? (s.progress!.focus === 'work' ? R.universityWorkMonthly : 0) + (s.life!.flags.includes('scholarship') ? R.scholarshipMonthly : 0)
    : training ? R.trainingSalary : s.stageIndex === 3 ? R.retirementIncome
    : c.practice === 'employed' ? R.employedSalary : c.practice === 'research' ? R.researchIncome
    : c.practice === 'untrained' ? R.untrainedIncome : clinic ? R.clinicRevenue : 0;
  const price = (s.portfolio?.priceIndex ?? 1_000_000) / 1_000_000, wage = (s.portfolio?.wageIndex ?? 1_000_000) / 1_000_000;
  const scholarship = school && s.life!.flags.includes('scholarship') ? R.scholarshipMonthly : 0;
  income = Math.round((income - scholarship) * wage) + scholarship;
  const salary = income * 12, lifestyle = lifestyleBudget(s);
  let expenses = Math.round(R.livingCost * price * dietFactor(s.lifestyle?.diet ?? 'balanced')) + (school ? Math.round(R.tuition * price / R.tuitionInterval) : 0) + (clinic ? Math.round(R.clinicOperatingCost * price) : 0);
  if (s.stageIndex === 2 && s.depth?.workload === 'extended' && c.practice !== 'research') {
    income += clinic ? DEPTH_RUNTIME.extendedRevenue : DEPTH_RUNTIME.extendedSalary;
    if (clinic) expenses += DEPTH_RUNTIME.extendedCost;
  }
  if (s.stageIndex === 2 && s.depth?.workload === 'learning') expenses += DEPTH_RUNTIME.learningCost;
  income += variableEarnings(s);
  income += lifestyle.income; expenses += lifestyle.cost;
  const repayment = Math.min(s.portfolio?.autoRepay ?? 0, e.debt);
  return { netAssets: e.assets - e.debt - e.due, salary, income, expenses, disposable: income - expenses,
    repayment, afterPlans: income - expenses - repayment - (s.portfolio?.autoSave ?? 0) - (s.portfolio?.autoInvest ?? 0),
    annual: school || clinic || c.practice === 'research' || s.stageIndex === 3 ? income * 12 : salary,
    label: clinic ? '연 매출 예상' : school || c.practice === 'research' || s.stageIndex === 3 ? '연 수입 예상' : '현재 연봉' };
}
