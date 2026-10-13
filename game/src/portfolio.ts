import type { GameState } from './contracts';
import { elapsedMonths, nextRandom } from './random-life';

export const FINANCE_RULES = { version: 'finance-provisional-1', provisional: true, depositBps: 300, debtBps: 500,
  inflationBps: 300, annualWageBps: 200, monthsPerYear: 12, unit: 1_000_000 };
export type InvestmentRisk = 'bonds' | 'balanced' | 'stocks';
export interface PortfolioState {
  version: 1; since: number; lastMonth: number; lastTransfers: number; seed: number;
  savings: number; investments: number; priceIndex: number; wageIndex: number;
  depositCarry: number; debtCarry: number; priceCarry: number; wageCarry: number;
  lastInterest: number; lastDebtInterest: number; lastInvestmentReturn: number;
  autoSave: number; autoInvest: number; autoRepay: number; useSavings: boolean; risk: InvestmentRisk;
  phase: 'steady' | 'growth' | 'slump';
}
export const PLAN_AMOUNTS = [0, 100_000, 300_000, 1_000_000];
export function initialPortfolio(seed: number, month = 0): PortfolioState {
  return { version: 1, since: month, lastMonth: month, lastTransfers: month, seed: (seed ^ 0xbb67ae85) >>> 0,
    savings: 0, investments: 0, priceIndex: 1_000_000, wageIndex: 1_000_000,
    depositCarry: 0, debtCarry: 0, priceCarry: 0, wageCarry: 0, lastInterest: 0, lastDebtInterest: 0, lastInvestmentReturn: 0,
    autoSave: 0, autoInvest: 0, autoRepay: 0, useSavings: true, risk: 'balanced', phase: 'steady' };
}
// Integer remainder is persisted. No sub-won interest is lost on each monthly round-off.
export function accrueInterest(balance: number, bps: number, remainder = 0, denominator = 120_000) {
  const n = BigInt(balance) * BigInt(bps) + BigInt(remainder);
  const amount = Number(n / BigInt(denominator));
  if (!Number.isSafeInteger(amount)) throw new RangeError('금액이 처리 범위를 벗어났습니다.');
  return { amount, remainder: Number(n % BigInt(denominator)) };
}
function entry(s: GameState, suffix: string, label: string, cashDelta: number, assetsDelta = cashDelta, debtDelta = 0, dueDelta = 0) {
  const e = s.economy!, m = elapsedMonths(s);
  if (![e.cash + cashDelta, e.assets + assetsDelta, e.debt + debtDelta, e.due + dueDelta].every(n => Number.isSafeInteger(n) && n >= 0)) throw new RangeError('금액이 처리 범위를 벗어났습니다.');
  e.cash += cashDelta; e.assets += assetsDelta; e.debt += debtDelta; e.due += dueDelta;
  e.ledger.push({ id: `portfolio:${m}:${suffix}`, month: m, label, cashDelta, assetsDelta, debtDelta, dueDelta, kind: 'monthly' });
}
export function preparePortfolio(s: GameState) {
  const p = s.portfolio!, m = elapsedMonths(s); if (m <= p.lastMonth) return;
  p.lastMonth = m;
  const r = FINANCE_RULES;
  // Prices start at the existing price level; later months compound from it.
  if (m > p.since + 1) { const a = accrueInterest(p.priceIndex, r.inflationBps, p.priceCarry); p.priceIndex += a.amount; p.priceCarry = a.remainder; }
  if ((m - p.since) % 12 === 0) { const a = accrueInterest(p.wageIndex, r.annualWageBps, p.wageCarry, 10_000); p.wageIndex += a.amount; p.wageCarry = a.remainder; }
  const deposit = accrueInterest(p.savings, r.depositBps, p.depositCarry); p.depositCarry = deposit.remainder; p.lastInterest = deposit.amount;
  if (deposit.amount) { p.savings += deposit.amount; entry(s, 'interest', '예금 이자', 0, deposit.amount); }
  const debt = accrueInterest(s.economy!.debt, r.debtBps, p.debtCarry); p.debtCarry = debt.remainder; p.lastDebtInterest = debt.amount;
  if (debt.amount) entry(s, 'debt-interest', '대출 이자 누적', 0, 0, debt.amount);
  const draw = nextRandom(p.seed); p.seed = draw.seed;
  if ((m - p.since) % 12 === 1) p.phase = draw.value < 0.25 ? 'slump' : draw.value > 0.75 ? 'growth' : 'steady';
  const noise = nextRandom(p.seed); p.seed = noise.seed;
  const volatility = { bonds: 0.008, balanced: 0.025, stocks: 0.06 }[p.risk];
  const rate = 0.002 + (p.phase === 'slump' ? -0.008 : p.phase === 'growth' ? 0.008 : 0) + (noise.value * 2 - 1) * volatility;
  p.lastInvestmentReturn = Math.round(p.investments * rate) || 0;
  if (p.lastInvestmentReturn) { p.investments += p.lastInvestmentReturn; entry(s, 'return', '투자 평가 손익', 0, p.lastInvestmentReturn); }
}
export function transferPortfolio(s: GameState, kind: 'save' | 'withdraw' | 'invest' | 'sell', amount: number, id: string): boolean {
  const p = s.portfolio!, e = s.economy!;
  if (!Number.isSafeInteger(amount) || amount <= 0 || e.ledger.some(t => t.id === `portfolio:${elapsedMonths(s)}:${id}`)) return false;
  if ((kind === 'save' || kind === 'invest') && (amount > e.cash || e.due > 0)) return false;
  if (kind === 'withdraw' && amount > p.savings || kind === 'sell' && amount > p.investments) return false;
  if (kind === 'save' || kind === 'withdraw') p.savings += kind === 'save' ? amount : -amount;
  else p.investments += kind === 'invest' ? amount : -amount;
  entry(s, id, { save: '예금으로 이동', withdraw: '예금 인출', invest: '투자금 납입', sell: '투자금 매도' }[kind], kind === 'save' || kind === 'invest' ? -amount : amount, 0);
  return true;
}
export function coverDueFromSavings(s: GameState) {
  const p = s.portfolio!, e = s.economy!;
  if (!p.useSavings || !e.due || !p.savings) return;
  const amount = Math.min(e.due, p.savings); p.savings -= amount;
  entry(s, 'bills', '예금에서 미납 납부', 0, -amount, 0, -amount); e.expenses += amount;
}
export function finishPortfolio(s: GameState) {
  const p = s.portfolio!, e = s.economy!, m = elapsedMonths(s); if (m <= p.lastTransfers) return;
  p.lastTransfers = m;
  if (e.due) return;
  // Keep a cash buffer for next month's essential costs before discretionary transfers.
  const reserve = Math.round(900_000 * p.priceIndex / 1_000_000);
  const repay = Math.min(p.autoRepay, e.debt, Math.max(0, e.cash - reserve));
  if (repay) entry(s, 'repay', '자동 대출 상환', -repay, -repay, -repay);
  for (const [kind, requested] of [['save', p.autoSave], ['invest', p.autoInvest]] as const) {
    const amount = Math.min(requested, Math.max(0, e.cash - reserve)); if (amount) transferPortfolio(s, kind, amount, `auto-${kind}`);
  }
}
export function validPortfolio(value: unknown, s: GameState): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const p = value as PortfolioState, month = elapsedMonths(s);
  return p.version === 1 && ['since','lastMonth','lastTransfers','seed','savings','investments','priceIndex','wageIndex','depositCarry','debtCarry','priceCarry','wageCarry','lastInterest','lastDebtInterest'].every(k => Number.isSafeInteger(p[k as keyof PortfolioState]) && Number(p[k as keyof PortfolioState]) >= 0)
    && p.since <= p.lastMonth && p.lastMonth <= month && p.lastTransfers <= month && p.seed <= 0xffffffff
    && p.priceIndex >= 1_000_000 && p.wageIndex >= 1_000_000
    && p.depositCarry < 120_000 && p.debtCarry < 120_000 && p.priceCarry < 120_000 && p.wageCarry < 10_000
    && [p.autoSave, p.autoInvest, p.autoRepay].every(x => PLAN_AMOUNTS.includes(x))
    && typeof p.useSavings === 'boolean' && ['bonds','balanced','stocks'].includes(p.risk) && ['steady','growth','slump'].includes(p.phase)
    && Number.isSafeInteger(p.lastInvestmentReturn) && !!s.economy && s.economy.cash + p.savings + p.investments <= s.economy.assets;
}
