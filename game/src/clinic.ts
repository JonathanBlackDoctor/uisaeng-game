import type { GameState, GameEvent } from './contracts';
import { ECONOMY_RULES } from './economy';
import { elapsedMonths, nextRandom } from './random-life';

// Fictional tuning only. No real hospital costs, credit terms or risk probabilities.
export const CLINIC_RULES = { version: 'clinic-leverage-provisional-v2', provisional: true,
  // Further expansion doubles capacity without adding another management system.
  maxLevel: 12, growthCostFloor: 0.75, growthCostStep: 0.85,
  cooldown: 12, repaymentMonths: 120, saleRatio: 0.45, shockMonths: 6,
  tiers: [
    { name: '동네 의원', equity: 0, loan: 0, book: 0, revenue: 12_000_000, cost: 7_000_000, bps: 500, shock: 1 },
    { name: '확장 의원', equity: 20_000_000, loan: 180_000_000, book: 140_000_000, revenue: 36_000_000, cost: 24_000_000, bps: 900, shock: 0.6 },
    { name: '중형 병원', equity: 60_000_000, loan: 600_000_000, book: 450_000_000, revenue: 140_000_000, cost: 67_000_000, bps: 1300, shock: 0.45 },
    { name: '대형 병원', equity: 150_000_000, loan: 1_800_000_000, book: 1_100_000_000, revenue: 420_000_000, cost: 175_000_000, bps: 1800, shock: 0.3 },
  ],
};
export interface ClinicState {
  version: 1; level: number; seed: number; since: number; lastMonth: number;
  changedAt: number; shockUntil: number; losses: number; crisis: boolean;
  reviewAt: number; lastService: number; lastOperating: number;
}
const r = CLINIC_RULES;
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
export const clinicLevel = (s: GameState) => s.clinic?.level ?? 0;
export function clinicTierAt(level: number) {
  if (level <= 3) return r.tiers[level];
  const base = r.tiers[3], growth = level - 3, scale = 2 ** growth;
  return { ...base, name: `대형 병원 · ${scale}배`, equity: base.equity * scale / 2,
    loan: base.loan * scale / 2, book: base.book * scale / 2,
    revenue: base.revenue * scale,
    cost: Math.round(base.cost * scale * Math.max(r.growthCostFloor, r.growthCostStep ** growth)) };
}
export const clinicTier = (s: GameState) => clinicTierAt(clinicLevel(s));
export const nextClinicTier = (s: GameState) => clinicLevel(s) < r.maxLevel ? clinicTierAt(clinicLevel(s) + 1) : undefined;
export function clinicCapital(level: number, field: 'book' | 'loan') {
  let total = 0;
  for (let n = 1; n <= level; n++) total += clinicTierAt(n)[field];
  return total;
}
export const clinicOpen = (s: GameState) => s.stageIndex === 2 && s.career?.practice === 'clinic'
  && !!s.economy?.ledger.some(t => t.kind === 'open-clinic');
export const clinicDebtBps = (s: GameState) => clinicOpen(s) ? clinicTier(s).bps : r.tiers[0].bps;
export function clinicRevenue(s: GameState) {
  return Math.round(clinicTier(s).revenue * (s.clinic && elapsedMonths(s) < s.clinic.shockUntil ? clinicTier(s).shock : 1));
}
export function clinicService(s: GameState) {
  if (!clinicOpen(s) || !clinicLevel(s)) return 0;
  const principal = clinicCapital(clinicLevel(s), 'loan');
  return Math.min(s.economy!.debt, Math.round(principal / r.repaymentMonths) + Math.floor(s.economy!.debt * clinicDebtBps(s) / 120_000));
}
export function canExpandClinic(s: GameState) {
  const next = nextClinicTier(s);
  return clinicOpen(s) && !!next && !s.economy!.due && !s.clinic?.crisis
    && [s.economy!.debt + next.loan, s.economy!.assets + next.book - next.equity].every(Number.isSafeInteger)
    && s.economy!.cash >= next.equity && (!s.clinic || elapsedMonths(s) >= s.clinic.changedAt + r.cooldown);
}
function ensure(s: GameState) {
  const m = elapsedMonths(s);
  return s.clinic ??= { version: 1, level: 0, seed: (s.life!.initialSeed ^ 0x3c6ef372) >>> 0,
    since: m, lastMonth: m, changedAt: m, shockUntil: 0, losses: 0, crisis: false, reviewAt: 0, lastService: 0, lastOperating: 0 };
}
function post(s: GameState, key: string, label: string, cash: number, assets = cash, debt = 0, due = 0) {
  const e = s.economy!, m = elapsedMonths(s);
  e.cash += cash; e.assets += assets; e.debt += debt; e.due += due;
  e.ledger.push({ id: `clinic:${m}:${s.revision}:${key}`, month: m, label, cashDelta: cash, assetsDelta: assets, debtDelta: debt, dueDelta: due, kind: 'monthly' });
}
function note(s: GameState, key: string, title: string, detail: string) {
  s.journal.push({ id: `clinic:${elapsedMonths(s)}:${s.revision}:${key}`, stage: 'career', title, detail, effects: {} });
}
export function prepareClinic(s: GameState) {
  const c = s.clinic, m = elapsedMonths(s);
  if (!c || !clinicOpen(s) || !c.level || m <= c.lastMonth) return;
  c.lastMonth = m;
  if (m >= c.shockUntil && (m - c.since) % 3 === 0) {
    const draw = nextRandom(c.seed); c.seed = draw.seed;
    if (draw.value < 0.12 + Math.min(c.level, 3) * 0.07) {
      c.shockUntil = m + r.shockMonths;
      note(s, 'shock', '병원 예약이 줄었습니다', `${r.shockMonths}개월 동안 기본 매출이 ${Math.round((1 - clinicTier(s).shock) * 100)}% 줄어듭니다. 인건비와 시설비는 그대로 나갑니다.`);
    }
  }
}
export function settleClinic(s: GameState) {
  const c = s.clinic, e = s.economy!, m = elapsedMonths(s);
  if (!c || !clinicOpen(s) || !c.level || c.lastMonth !== m || e.ledger.some(t => t.id === `clinic:${m}:settled`)) return;
  const scheduled = clinicService(s), paid = e.due > 0 ? 0 : Math.min(e.cash, scheduled);
  if (paid) post(s, 'service', '병원 대출 원리금 상환', -paid, -paid, -paid);
  c.lastService = paid; c.lastOperating = e.income - e.expenses - e.due;
  c.losses = c.lastOperating - scheduled < 0 ? c.losses + 1 : 0;
  c.crisis = e.due > 0 || paid < scheduled || (c.losses >= 3 && m >= c.reviewAt);
  e.ledger.push({ id: `clinic:${m}:settled`, month: m, label: '병원 월 결산', cashDelta: 0, debtDelta: 0, kind: 'monthly' });
}
export function requiredClinic(s: GameState): string | null {
  return clinicOpen(s) && clinicLevel(s) > 0 && s.clinic!.crisis ? 'clinic:crisis' : null;
}
function saleValue(level: number) {
  return Math.round(clinicTierAt(level).book * r.saleRatio);
}
function liquidate(s: GameState, close: boolean) {
  const c = s.clinic!, level = c.level;
  const book = close ? clinicCapital(level, 'book') + ECONOMY_RULES.clinicNonCashAssets : clinicTierAt(level).book;
  const proceeds = Math.round(book * r.saleRatio);
  post(s, 'sale', close ? '폐업 시설 처분' : '확장 시설 처분', proceeds, proceeds - book);
  const due = Math.min(s.economy!.due, s.economy!.cash);
  if (due) { post(s, 'due', '병원 정리 후 미납 납부', -due, -due, 0, -due); s.economy!.expenses += due; }
  const repay = Math.min(Math.max(0, proceeds - due), s.economy!.debt);
  if (repay) post(s, 'repay', '시설 처분금으로 대출 상환', -repay, -repay, -repay);
  c.level = close ? 0 : level - 1;
  c.changedAt = elapsedMonths(s); c.losses = 0; c.crisis = false; c.reviewAt = 0; c.lastService = 0;
  if (close) { s.career!.practice = 'employed'; if (s.depth) s.depth.workload = 'balanced'; }
  note(s, 'loss', close ? '병원을 정리했습니다' : '병원 규모를 줄였습니다', `시설 처분 손실 ${won(book - proceeds)} · 남은 부채 ${won(s.economy!.debt)}. ${close ? '봉직의로 일하며 남은 빚을 갚습니다.' : '다음 달부터 줄어든 규모로 운영합니다.'}`);
}
type ClinicEvent = Pick<GameEvent, 'title' | 'body' | 'choices'>;
/** Only the old revenue quote differs; keep exact open v1 contracts readable. */
export function legacyClinicQuote(s: GameState, event: GameEvent): GameEvent | null {
  const level = clinicLevel(s);
  if (event.randomKey !== 'clinic:expand' || level < 1 || level > 2) return null;
  const oldRevenue = level === 1 ? 100_000_000 : 260_000_000;
  return { ...event, body: event.body.replace(`월 매출 ${won(clinicTierAt(level + 1).revenue)}`, `월 매출 ${won(oldRevenue)}`) };
}
export function clinicEvent(s: GameState, key: string): ClinicEvent | null {
  if (!clinicOpen(s)) return null;
  const level = clinicLevel(s), next = nextClinicTier(s);
  const nextService = next ? Math.round(clinicCapital(level + 1, 'loan') / r.repaymentMonths)
    + Math.floor((s.economy!.debt + next.loan) * next.bps / 120_000) : 0;
  const choice = (id: string, label: string, description = '') => ({ id, label, description, effects: {} });
  if (key === 'clinic:expand' && next && canExpandClinic(s)) return {
    title: `${next.name} 운영 준비`,
    body: `내 돈 ${won(next.equity)}과 신규 대출 ${won(next.loan)}을 투입합니다. 확장 후 기본 월 매출 ${won(next.revenue)}, 운영비 ${won(next.cost)}. 물가·급여 변동은 별도로 반영됩니다. 전체 대출 금리는 연 ${next.bps / 100}%가 됩니다. 매달 원리금을 갚아야 하며, 불황에는 기본 매출이 ${Math.round((1 - next.shock) * 100)}% 줄어듭니다. 시설을 팔아도 빚이 남을 수 있습니다.`,
    choices: [choice('borrow', '대출받고 확장하기', `월 원리금 약 ${won(nextService)}부터 시작합니다. 대출금은 시설에 바로 투입됩니다.`), choice('cancel', '지금 규모 유지하기')],
  };
  if (['clinic:crisis', 'clinic:manage', 'clinic:retire'].includes(key) && level > 0) return {
    title: key === 'clinic:crisis' ? '병원 운영이 어려워졌습니다' : key === 'clinic:retire' ? '은퇴 전 병원 정리' : '병원 규모 조정',
    body: `현금 ${won(s.economy!.cash)} · 부채 ${won(s.economy!.debt)} · 미납 ${won(s.economy!.due)}. 최근 월 영업수지 ${won(s.clinic!.lastOperating)}. 시설 처분 시 장부가의 ${Math.round(r.saleRatio * 100)}%를 회수해 미납과 빚부터 갚습니다. 남은 빚은 없어지지 않습니다.`,
    choices: [
      ...(key !== 'clinic:retire' ? [choice('shrink', '규모 줄이기', `시설 ${won(saleValue(level))} 회수 · 처분 손실 ${won(clinicTierAt(level).book - saleValue(level))}`)] : []),
      choice('close', key === 'clinic:retire' ? '병원 정리하고 은퇴 준비하기' : '폐업하고 봉직의로 일하기', '시설을 모두 처분하고 남은 빚을 갚아 나갑니다.'),
      ...(key === 'clinic:manage' ? [choice('cancel', '현재 규모 유지하기')] : []),
      ...(key === 'clinic:crisis' && !s.economy!.due && s.economy!.cash >= clinicService(s) + Math.round(clinicTier(s).cost * (s.portfolio?.priceIndex ?? 1e6) / 1e6)
        ? [{ ...choice('hold', '현금으로 더 버티기', '적자가 이어지면 석 달 뒤 다시 판단합니다.'), effects: { health: -3, happiness: -5 } }] : []),
    ],
  };
  return null;
}
export function settleClinicChoice(s: GameState, key: string, id: string) {
  if (!clinicEvent(s, key)?.choices.some(c => c.id === id)) return false;
  if (id === 'cancel') return true;
  const c = ensure(s);
  if (id === 'borrow') {
    const t = clinicTierAt(c.level + 1);
    post(s, 'expand', '병원 확장 계약', -t.equity, t.book - t.equity, t.loan);
    c.level++; c.changedAt = elapsedMonths(s); c.lastMonth = elapsedMonths(s); c.losses = 0;
  } else if (id === 'hold') {
    c.crisis = false; c.reviewAt = elapsedMonths(s) + 3;
  } else liquidate(s, id === 'close');
  return true;
}
export function validClinic(s: GameState) {
  const c = s.clinic;
  if (c === undefined) return true;
  if (!c || c.version !== 1 || !Number.isInteger(c.level) || c.level < 0 || c.level > r.maxLevel || typeof c.crisis !== 'boolean') return false;
  if (!['seed', 'since', 'lastMonth', 'changedAt', 'shockUntil', 'losses', 'reviewAt', 'lastService'].every(k => Number.isSafeInteger(c[k as keyof ClinicState]) && Number(c[k as keyof ClinicState]) >= 0)
    || !Number.isSafeInteger(c.lastOperating) || c.seed > 0xffffffff || c.since > c.lastMonth || c.lastMonth > elapsedMonths(s) || c.changedAt > elapsedMonths(s)
    || c.shockUntil > elapsedMonths(s) + r.shockMonths || c.reviewAt > elapsedMonths(s) + 3) return false;
  const books = clinicCapital(c.level, 'book') + (s.career?.practice === 'clinic' ? ECONOMY_RULES.clinicNonCashAssets : 0);
  return (!c.level || (s.stageIndex === 2 && s.career?.practice === 'clinic' && !!s.economy?.ledger.some(t => t.kind === 'open-clinic')))
    && (!c.crisis || c.level > 0) && !!s.economy
    && s.economy.assets - s.economy.cash - (s.portfolio?.savings ?? 0) - (s.portfolio?.investments ?? 0) >= books;
}
