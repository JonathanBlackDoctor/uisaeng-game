/** All amounts are provisional game settings in whole KRW, not real-world data. */
export type EconomyContext = {
  stage: 'university' | 'training' | 'career' | 'retirement';
  practice: 'undecided' | 'employed' | 'clinic' | 'research' | 'untrained';
  working: boolean;
  scholarship: boolean;
  /** Explicit, revocable player instruction, valid only while at university. */
  automaticEducationLoan?: boolean;
};

export type EconomyActionKind = 'loan' | 'grant' | 'work' | 'pay-due' | 'repay' | 'open-clinic';
export interface MoneyTransaction {
  id: string;
  month: number;
  label: string;
  cashDelta: number;
  debtDelta: number;
  /** Optional for contract-only saves; generated transactions include these fields. */
  dueDelta?: number;
  assetsDelta?: number;
  kind?: EconomyActionKind | 'monthly';
}

export interface EconomyState {
  cash: number;
  /** Total assets, including cash. */
  assets: number;
  debt: number;
  income: number;
  expenses: number;
  lastMonth: number;
  due: number;
  ledger: MoneyTransaction[];
}

export const ECONOMY_RULES = {
  provisional: true,
  version: 'career-money-provisional-1',
  initialCash: { tight: 1_200_000, steady: 8_000_000, comfortable: 30_000_000 },
  livingCost: 900_000,
  tuition: 4_000_000,
  tuitionInterval: 6,
  scholarshipMonthly: 300_000,
  universityWorkMonthly: 700_000,
  trainingSalary: 3_000_000,
  employedSalary: 6_000_000,
  researchIncome: 3_500_000,
  untrainedIncome: 2_500_000,
  retirementIncome: 0,
  clinicRevenue: 12_000_000,
  clinicOperatingCost: 7_000_000,
  clinicOpeningCost: 20_000_000,
  clinicNonCashAssets: 12_000_000,
  loanAmount: 5_000_000,
  grantAmount: 2_000_000,
  grantLimit: 1,
  workAmount: 400_000,
};

const integer = (value: unknown): value is number => Number.isSafeInteger(value);
const money = (value: unknown): value is number => integer(value) && value >= 0;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const actionKinds: EconomyActionKind[] = ['loan', 'grant', 'work', 'pay-due', 'repay', 'open-clinic'];

export function validEconomy(value: unknown): value is EconomyState {
  if (!record(value)) return false;
  if (!['cash', 'assets', 'debt', 'income', 'expenses', 'due'].every(key => money(value[key]))) return false;
  if ((value.assets as number) < (value.cash as number) || !integer(value.lastMonth) || value.lastMonth < -1) return false;
  if (!Array.isArray(value.ledger)) return false;
  const ids = new Set<string>();
  for (const tx of value.ledger) {
    if (!record(tx) || typeof tx.id !== 'string' || !tx.id.trim() || ids.has(tx.id)) return false;
    if (!money(tx.month) || typeof tx.label !== 'string' || !tx.label.trim()) return false;
    if (!integer(tx.cashDelta) || !integer(tx.debtDelta)) return false;
    if (tx.dueDelta !== undefined && !integer(tx.dueDelta)) return false;
    if (tx.assetsDelta !== undefined && !integer(tx.assetsDelta)) return false;
    if (tx.kind !== undefined && tx.kind !== 'monthly' && !actionKinds.includes(tx.kind as EconomyActionKind)) return false;
    ids.add(tx.id);
  }
  return true;
}

function assertState(state: EconomyState): void {
  if (!validEconomy(state)) throw new TypeError('경제 상태가 올바르지 않습니다.');
}

function assertRules(): void {
  const { initialCash, provisional: _provisional, version: _version, ...amounts } = ECONOMY_RULES;
  if (!Object.values(initialCash).every(money) || !Object.values(amounts).every(money) || amounts.tuitionInterval === 0) {
    throw new RangeError('경제 설정은 0 이상의 안전한 정수여야 합니다.');
  }
}

export function initialEconomy(finances: 'tight' | 'steady' | 'comfortable'): EconomyState {
  assertRules();
  if (!Object.hasOwn(ECONOMY_RULES.initialCash, finances)) throw new TypeError('초기 재정 조건이 올바르지 않습니다.');
  const cash = ECONOMY_RULES.initialCash[finances];
  return { cash, assets: cash, debt: 0, income: 0, expenses: 0, lastMonth: -1, due: 0, ledger: [] };
}

export function netWorth(state: EconomyState): number {
  assertState(state);
  return state.assets - state.debt;
}

function clone(state: EconomyState): EconomyState {
  return { ...state, ledger: state.ledger.map(tx => ({ ...tx })) };
}

function post(state: EconomyState, tx: MoneyTransaction): void {
  if (state.ledger.some(entry => entry.id === tx.id)) throw new Error('거래 번호가 중복되었습니다.');
  state.cash += tx.cashDelta;
  state.assets += tx.assetsDelta ?? tx.cashDelta;
  state.debt += tx.debtDelta;
  state.due += tx.dueDelta ?? 0;
  state.ledger.push(tx);
  // Reject overflow rather than storing imprecise balances. Only a private clone is changed.
  if (![state.cash, state.assets, state.debt, state.due].every(money) || state.assets < state.cash) {
    throw new RangeError('거래 금액이 처리 범위를 벗어났습니다.');
  }
}

function clinicOwned(state: EconomyState): boolean {
  return state.ledger.some(tx => tx.kind === 'open-clinic');
}

function assertContext(context: EconomyContext): void {
  if (!record(context) || !['university', 'training', 'career', 'retirement'].includes(context.stage)
    || !['undecided', 'employed', 'clinic', 'research', 'untrained'].includes(context.practice)
    || typeof context.working !== 'boolean' || typeof context.scholarship !== 'boolean') {
    throw new TypeError('경제 경로가 올바르지 않습니다.');
  }
}

/** Caller supplies each month in order. Due blocks later settlement; no catch-up is generated. */
export function settleEconomyMonth(state: EconomyState, month: number, context: EconomyContext): EconomyState {
  assertState(state);
  if (!money(month)) throw new TypeError('월은 0 이상의 안전한 정수여야 합니다.');
  if (month <= state.lastMonth || state.due > 0) return state;
  if (state.lastMonth >= 0 && month !== state.lastMonth + 1) return state;
  assertContext(context);
  assertRules();
  const next = clone(state);
  next.income = 0;
  next.expenses = 0;
  const r = ECONOMY_RULES;
  const receive = (key: string, label: string, amount: number) => {
    if (amount === 0) return;
    post(next, { id: `month:${month}:${key}`, month, label, cashDelta: amount, debtDelta: 0, kind: 'monthly' });
    next.income += amount;
  };
  const spend = (key: string, label: string, amount: number) => {
    if (amount === 0) return;
    if (context.stage === 'university' && context.automaticEducationLoan === true && next.cash < amount) {
      const gap = amount - next.cash;
      post(next, { id: `month:${month}:${key}:education-loan`, month, label: '선택한 학비·생활비 대출', cashDelta: gap, debtDelta: gap, kind: 'loan' });
    }
    const paid = Math.min(next.cash, amount);
    post(next, { id: `month:${month}:${key}`, month, label, cashDelta: -paid, debtDelta: 0,
      dueDelta: amount - paid, kind: 'monthly' });
    next.expenses += paid;
  };
  if (context.stage === 'university') {
    if (context.working) receive('work', '아르바이트', r.universityWorkMonthly);
    if (context.scholarship) receive('scholarship', '장학금', r.scholarshipMonthly);
  } else if (context.stage === 'training') {
    receive('salary', '수련 급여', r.trainingSalary);
  } else if (context.stage === 'career') {
    if (context.practice === 'employed') receive('salary', '봉직 급여', r.employedSalary);
    if (context.practice === 'research') receive('research', '연구 수입', r.researchIncome);
    if (context.practice === 'untrained') receive('untrained', '미수련 경로 수입', r.untrainedIncome);
    if (context.practice === 'clinic' && clinicOwned(state)) receive('revenue', '개원 매출', r.clinicRevenue);
  } else {
    receive('retirement', '은퇴 수입', r.retirementIncome);
  }
  spend('living', '생활비', r.livingCost);
  if (context.stage === 'university' && month % r.tuitionInterval === 0) spend('tuition', '학비', r.tuition);
  if (context.stage === 'career' && context.practice === 'clinic' && clinicOwned(state)) {
    spend('operating', '개원 운영비', r.clinicOperatingCost);
  }
  next.lastMonth = month;
  assertState(next);
  return next;
}

/** Apply the player's newly selected university funding plan to an existing shortfall. */
export function fundEducationDue(state: EconomyState, id: string, month: number): EconomyState {
  assertState(state);
  if (!state.due || state.ledger.some(t => t.id === id)) return state;
  const next = clone(state), gap = Math.max(0, state.due - state.cash);
  post(next, { id, month, label: '선택한 학비·생활비 대출 및 납부', cashDelta: gap - state.due, debtDelta: gap, dueDelta: -state.due, kind: 'loan' });
  next.expenses += state.due;
  return next;
}

export function economyAction(state: EconomyState, id: string, kind: EconomyActionKind, month: number):
  { state: EconomyState; ok: boolean; reason?: string } {
  assertState(state);
  const fail = (reason: string) => ({ state, ok: false, reason });
  if (typeof id !== 'string' || !id.trim() || id.startsWith('month:')) return fail('거래 번호가 올바르지 않습니다.');
  if (!money(month) || month < state.lastMonth) return fail('거래 월이 올바르지 않습니다.');
  if (!actionKinds.includes(kind)) return fail('알 수 없는 거래입니다.');
  if (state.ledger.some(tx => tx.id === id)) return fail('이미 처리한 거래입니다.');
  assertRules();
  const r = ECONOMY_RULES;
  let cashDelta = 0;
  let debtDelta = 0;
  let dueDelta = 0;
  let nonCashDelta = 0;
  let label = '';
  switch (kind) {
    case 'loan': cashDelta = r.loanAmount; debtDelta = r.loanAmount; label = '대출'; break;
    case 'grant':
      if (state.ledger.filter(tx => tx.kind === 'grant').length >= r.grantLimit) return fail('지원을 이미 받았습니다.');
      cashDelta = r.grantAmount; label = '지원금'; break;
    case 'work':
      if (state.ledger.some(tx => tx.kind === 'work' && tx.month === month)) return fail('이번 달 단기 일은 이미 마쳤습니다.');
      cashDelta = r.workAmount; label = '단기 일'; break;
    case 'pay-due':
      if (state.due === 0) return fail('미납액이 없습니다.');
      if (state.cash < state.due) return fail('잔액이 부족합니다.');
      cashDelta = -state.due; dueDelta = -state.due; label = '미납 납부'; break;
    case 'repay':
      if (state.debt === 0) return fail('상환할 부채가 없습니다.');
      if (state.cash === 0) return fail('잔액이 부족합니다.');
      cashDelta = -Math.min(state.cash, state.debt); debtDelta = cashDelta; label = '대출 상환'; break;
    case 'open-clinic':
      if (clinicOwned(state)) return fail('이미 개원했습니다.');
      if (state.due > 0) return fail('미납액을 먼저 납부하세요.');
      if (state.cash < r.clinicOpeningCost) return fail('잔액이 부족합니다.');
      cashDelta = -r.clinicOpeningCost; nonCashDelta = r.clinicNonCashAssets; label = '개원 비용'; break;
  }
  const next = clone(state);
  try {
    post(next, { id, month, label, cashDelta, debtDelta, dueDelta, assetsDelta: cashDelta + nonCashDelta, kind });
  } catch (error) {
    if (error instanceof RangeError) return fail(error.message);
    throw error;
  }
  return { state: next, ok: true };
}
