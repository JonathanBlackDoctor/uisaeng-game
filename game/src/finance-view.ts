import { isAddedProfession, professionDefinition, professionOf } from './professions';
import { clinicRevenue, clinicService, clinicTier } from './clinic';
import type { GameState } from './contracts';
import { ECONOMY_RULES as R } from './economy';
import { DEPTH_RUNTIME } from './career-depth';
import { variableEarnings } from './life-dynamics';
import { dietFactor, lifestyleBudget } from './lifestyle';
import { familyFunding } from './background';
import { isServing, SERVICE_RULES } from './identity';

export { exactWon, formatWon as compactWon } from './money-format';
export function financeView(s: GameState) {
  const e = s.economy!, c = s.career!, school = s.stageIndex === 0;
  const definition = professionDefinition(s);
  const settings = isAddedProfession(s) ? { ...R, tuition: definition.tuition, employedSalary: definition.salary, untrainedIncome: definition.salary, trainingSalary: professionOf(s) === 'nursing' ? definition.salary : R.trainingSalary } : R;
  if (isServing(s)) {
    const { income, expenses } = SERVICE_RULES[s.identity!.service.route!];
    return { netAssets: e.assets - e.debt - e.due, salary: income * 12, income, expenses, disposable: income - expenses,
      familyMonthly: 0, familySemester: 0, repayment: 0, afterPlans: income - expenses, annual: income * 12, label: '복무 중 연 수입' };
  }
  const training = s.stageIndex === 1 && c.application === 'accepted';
  const working = s.stageIndex === 2 || (s.stageIndex === 1 && !training);
  const clinic = working && c.practice === 'clinic' && e.ledger.some(t => t.kind === 'open-clinic');
  let income = school ? (s.progress!.focus === 'work' ? R.universityWorkMonthly : 0) + (s.life!.flags.includes('scholarship') ? R.scholarshipMonthly : 0)
    : training ? settings.trainingSalary : s.stageIndex === 3 ? R.retirementIncome
    : c.practice === 'employed' ? settings.employedSalary : c.practice === 'research' ? R.researchIncome
    : c.practice === 'untrained' ? settings.untrainedIncome : clinic ? clinicRevenue(s) : 0;
  const price = (s.portfolio?.priceIndex ?? 1_000_000) / 1_000_000, wage = (s.portfolio?.wageIndex ?? 1_000_000) / 1_000_000;
  const scholarship = school && s.life!.flags.includes('scholarship') ? R.scholarshipMonthly : 0;
  income = Math.round((income - scholarship) * wage) + scholarship;
  if (professionOf(s) === 'nursing' && s.professional?.shift === 'rotating' && s.stageIndex > 0 && s.stageIndex < 3 && c.practice === 'employed') income += 400_000;
  const salary = income * 12, lifestyle = lifestyleBudget(s);
  const funding = familyFunding(s.life?.background);
  const familyMonthly = school ? funding.monthly : 0, familySemester = school ? funding.semester : 0;
  income += familyMonthly + Math.round(familySemester / R.tuitionInterval);
  let expenses = Math.round(R.livingCost * price * dietFactor(s.lifestyle?.diet ?? 'balanced')) + (school ? Math.round(settings.tuition * price / R.tuitionInterval) : 0) + (clinic ? Math.round(clinicTier(s).cost * price) : 0);
  if (s.stageIndex === 2 && s.depth?.workload === 'extended' && c.practice !== 'research') {
    income += clinic ? DEPTH_RUNTIME.extendedRevenue : DEPTH_RUNTIME.extendedSalary;
    if (clinic) expenses += DEPTH_RUNTIME.extendedCost;
  }
  if (s.stageIndex === 2 && s.depth?.workload === 'learning') expenses += DEPTH_RUNTIME.learningCost;
  if (s.professional?.certificateStart !== null && s.professional?.certificateStart !== undefined && !s.professional.certificateEarned && !s.professional.decisions['certificate-review'] && s.stageIndex > 0 && s.stageIndex < 3) expenses += 120_000;
  income += variableEarnings(s);
  income += lifestyle.income; expenses += lifestyle.cost;
  const impactMonth = Math.floor((s.life?.elapsedMs ?? 0) / 1000);
  const impacts = s.incidents?.impacts.filter(i => i.start <= impactMonth && i.until > impactMonth) ?? [];
  const impactIncome = income;
  income = Math.max(0, income - impacts.reduce((sum, i) => sum + Math.round(impactIncome * i.cut), 0));
  expenses += impacts.reduce((sum, i) => sum + i.monthly, 0);
  const requiredRepayment = clinicService(s);
  const repayment = requiredRepayment + Math.min(s.portfolio?.autoRepay ?? 0, Math.max(0, e.debt - requiredRepayment));
  return { netAssets: e.assets - e.debt - e.due, salary, income, expenses, disposable: income - expenses - requiredRepayment, familyMonthly, familySemester,
    repayment, afterPlans: income - expenses - repayment - (s.portfolio?.autoSave ?? 0) - (s.portfolio?.autoInvest ?? 0),
    annual: school || clinic || c.practice === 'research' || s.stageIndex === 3 ? income * 12 : salary,
    label: clinic ? '연 매출 예상' : school || c.practice === 'research' || s.stageIndex === 3 ? '연 수입 예상' : '현재 연봉' };
}
