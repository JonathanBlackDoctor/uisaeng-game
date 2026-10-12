import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ECONOMY_RULES as r, initialEconomy, settleEconomyMonth, economyAction, validEconomy, netWorth,
} from '../src/economy.ts';

const university = { stage: 'university', practice: 'undecided', working: false, scholarship: false };
const context = (stage, practice = 'undecided') => ({ ...university, stage, practice });
const restore = state => JSON.parse(JSON.stringify(state));
const action = (state, id, kind, month = Math.max(0, state.lastMonth)) => {
  const result = economyAction(state, id, kind, month);
  assert.equal(result.ok, true, result.reason);
  assert.equal(validEconomy(result.state), true);
  return result.state;
};

test('initial finances and net worth include cash exactly once', () => {
  for (const [finances, expected] of [['tight', 1_200_000], ['steady', 8_000_000], ['comfortable', 30_000_000]]) {
    const state = initialEconomy(finances);
    assert.equal(state.cash, expected);
    assert.equal(state.assets, expected);
    assert.equal(netWorth(state), expected);
    assert.equal(validEconomy(restore(state)), true);
  }
});

test('university receives work and scholarship, and charges tuition every six months', () => {
  let state = initialEconomy('comfortable');
  for (let month = 0; month <= 6; month++) {
    state = settleEconomyMonth(state, month, { ...university, working: true, scholarship: true });
  }
  assert.equal(state.income, 1_000_000);
  assert.equal(state.expenses, 4_900_000);
  assert.equal(state.cash, 22_700_000);
  assert.deepEqual(state.ledger.filter(tx => tx.label === '학비').map(tx => tx.month), [0, 6]);
  assert.equal(state.debt, 0);
});

test('shortfall is due, blocks further months, and never creates negative cash or debt', () => {
  const state = settleEconomyMonth(initialEconomy('tight'), 0, university);
  assert.equal(state.cash, 0);
  assert.equal(state.assets, 0);
  assert.equal(state.expenses, 1_200_000);
  assert.equal(state.due, 3_700_000);
  assert.equal(state.debt, 0);
  assert.equal(state.lastMonth, 0);
  assert.equal(settleEconomyMonth(state, 1, context('training')), state);
  const failed = economyAction(state, 'tuition-payment', 'pay-due', 0);
  assert.equal(failed.ok, false);
  assert.equal(failed.state, state);
  assert.equal(state.ledger.some(tx => tx.id === 'tuition-payment'), false);
});

test('explicit loan and due payment recover a blocked month without double charging', () => {
  let state = settleEconomyMonth(initialEconomy('tight'), 0, university);
  state = action(state, 'loan-1', 'loan');
  assert.equal(state.cash, 5_000_000);
  assert.equal(state.debt, 5_000_000);
  assert.equal(netWorth(state), 0);
  state = action(state, 'tuition-payment', 'pay-due');
  assert.equal(state.cash, 1_300_000);
  assert.equal(state.due, 0);
  const sameMonth = settleEconomyMonth(restore(state), 0, university);
  assert.deepEqual(sameMonth, state);
  state = settleEconomyMonth(state, 1, context('training'));
  assert.equal(state.cash, 3_400_000);
  assert.equal(state.income, 3_000_000);
  assert.equal(state.expenses, 900_000);
});

test('monthly duplicates, reverse order and skipped months are no-ops, including after JSON restore', () => {
  let state = settleEconomyMonth(initialEconomy('steady'), 2, context('training'));
  state = restore(state);
  for (const month of [2, 1, 4, 100]) assert.equal(settleEconomyMonth(state, month, context('career', 'employed')), state);
  const next = settleEconomyMonth(state, 3, context('training'));
  assert.equal(next.cash - state.cash, 2_100_000);
});

test('all action IDs are global and replay safe after JSON restore', () => {
  for (const kind of ['loan', 'grant', 'work', 'open-clinic']) {
    const state = restore(action(initialEconomy('comfortable'), 'once', kind));
    for (const replayKind of ['loan', 'grant', 'work']) {
      const replay = economyAction(state, 'once', replayKind, 10);
      assert.equal(replay.ok, false);
      assert.equal(replay.state, state);
    }
  }
});

test('grant limit and monthly work limit persist; separate months retain all history', () => {
  let state = action(initialEconomy('tight'), 'grant', 'grant');
  for (let i = 0; i < 150; i++) { const r = economyAction(state, `work-${i}`, 'work', i); assert.equal(r.ok, true); state = r.state; }
  assert.equal(economyAction(state, 'same-month-new-id', 'work', 149).ok, false);
  state = restore(state);
  assert.equal(economyAction(state, 'second-grant', 'grant', 0).ok, false);
  assert.equal(economyAction(state, 'work-0', 'work', 0).ok, false);
  assert.equal(state.ledger.length, 151);
  assert.equal(state.debt, 0);
  assert.equal(state.cash, 63_200_000);
});

test('repayment can be partial, reduces cash and debt together, and preserves net worth', () => {
  let state = action(initialEconomy('tight'), 'loan', 'loan');
  state = settleEconomyMonth(state, 0, university);
  const before = netWorth(state);
  const paid = action(state, 'repay', 'repay');
  assert.equal(paid.cash, 0);
  assert.equal(paid.debt, 3_700_000);
  assert.equal(netWorth(paid), before);
  assert.equal(economyAction(paid, 'repay-more', 'repay', 0).ok, false);
  const full = action(action(initialEconomy('steady'), 'loan', 'loan'), 'repay', 'repay');
  assert.equal(full.cash, 8_000_000);
  assert.equal(full.debt, 0);
  assert.equal(economyAction(full, 'repay-again', 'repay', 0).ok, false);
});

test('training, employment, research, untrained, undecided and retirement have distinct monthly flows', () => {
  for (const [stage, practice, expectedIncome] of [
    ['training', 'undecided', 3_000_000], ['career', 'employed', 6_000_000],
    ['career', 'research', 3_500_000], ['career', 'untrained', 2_500_000],
    ['career', 'undecided', 0], ['retirement', 'employed', 0],
  ]) {
    const state = settleEconomyMonth(initialEconomy('comfortable'), 1,
      { ...context(stage, practice), working: true, scholarship: true });
    assert.equal(state.income, expectedIncome);
    assert.equal(state.expenses, 900_000);
    assert.equal(state.cash, 30_000_000 + expectedIncome - 900_000);
  }
});

test('clinic opening pays cash, preserves only noncash investment, and cannot run twice', () => {
  const initial = initialEconomy('comfortable');
  const opened = restore(action(initial, 'open', 'open-clinic'));
  assert.equal(opened.cash, 10_000_000);
  assert.equal(opened.assets, 22_000_000);
  assert.equal(netWorth(opened), 22_000_000);
  assert.equal(opened.assets - opened.cash, 12_000_000);
  assert.equal(economyAction(opened, 'open-again', 'open-clinic', 0).ok, false);
  const state = settleEconomyMonth(opened, 0, context('career', 'clinic'));
  assert.equal(state.income, 12_000_000);
  assert.equal(state.expenses, 7_900_000);
  assert.equal(state.cash, 14_100_000);
  assert.equal(state.assets, 26_100_000);
  assert.equal(state.assets - state.cash, 12_000_000);
  assert.deepEqual(state.ledger.slice(1).map(tx => tx.label), ['개원 매출', '생활비', '개원 운영비']);
});

test('clinic opening rejects insufficient funds and unresolved due; no unearned clinic revenue', () => {
  const poor = initialEconomy('tight');
  assert.equal(economyAction(poor, 'open', 'open-clinic', 0).ok, false);
  const unopened = settleEconomyMonth(poor, 1, context('career', 'clinic'));
  assert.equal(unopened.income, 0);
  assert.equal(unopened.expenses, 900_000);
  let overdue = settleEconomyMonth(poor, 0, university);
  for (let i = 0; i < 5; i++) overdue = action(overdue, `loan-${i}`, 'loan');
  assert.equal(economyAction(overdue, 'open', 'open-clinic', 0).ok, false);
  overdue = action(overdue, 'pay', 'pay-due');
  assert.equal(action(overdue, 'open', 'open-clinic').cash, 1_300_000);
});

test('university through training, employment and clinic keeps balances and identity after restore', () => {
  let state = initialEconomy('comfortable');
  const stages = [university, context('training'), context('career', 'employed')];
  for (let month = 0; month < stages.length; month++) state = settleEconomyMonth(restore(state), month, stages[month]);
  assert.equal(state.cash, 32_300_000);
  state = action(restore(state), 'clinic', 'open-clinic', 2);
  state = settleEconomyMonth(restore(state), 3, context('career', 'clinic'));
  assert.equal(state.cash, 16_400_000);
  assert.equal(state.assets, 28_400_000);
  assert.equal(state.debt, 0);
  assert.equal(netWorth(state), 28_400_000);
});

test('clinic operating shortfall retains equipment, records due, and resumes after funding', () => {
  const previousRevenue = r.clinicRevenue;
  try {
    r.clinicRevenue = 0;
    let state = action(initialEconomy('comfortable'), 'open', 'open-clinic');
    state = settleEconomyMonth(state, 0, context('career', 'clinic'));
    state = settleEconomyMonth(restore(state), 1, context('career', 'clinic'));
    assert.equal(state.cash, 0);
    assert.equal(state.assets, 12_000_000);
    assert.equal(state.debt, 0);
    assert.equal(state.due, 5_800_000);
    assert.equal(state.expenses, 2_100_000);
    assert.equal(settleEconomyMonth(state, 2, context('career', 'clinic')), state);
    state = action(state, 'loan', 'loan');
    assert.equal(economyAction(state, 'payment', 'pay-due', 1).ok, false);
    state = action(state, 'grant', 'grant');
    state = action(state, 'payment', 'pay-due');
    r.clinicRevenue = previousRevenue;
    state = settleEconomyMonth(restore(state), 2, context('career', 'clinic'));
    assert.equal(state.cash, 5_300_000);
    assert.equal(state.assets, 17_300_000);
    assert.equal(state.debt, 5_000_000);
    assert.equal(state.due, 0);
  } finally {
    r.clinicRevenue = previousRevenue;
  }
});

test('functions leave inputs and nested ledger records unchanged', () => {
  const state = action(initialEconomy('comfortable'), 'loan', 'loan');
  const before = restore(state);
  Object.freeze(state.ledger[0]);
  Object.freeze(state.ledger);
  Object.freeze(state);
  const monthly = settleEconomyMonth(state, 0, university);
  const worked = action(state, 'work', 'work');
  assert.deepEqual(state, before);
  assert.notEqual(monthly.ledger[0], state.ledger[0]);
  assert.notEqual(worked.ledger[0], state.ledger[0]);
});

test('validation rejects malformed, negative, fractional, overflow and duplicate stored fields', () => {
  const base = action(initialEconomy('steady'), 'work', 'work');
  for (const value of [null, [], {}, { ...base, assets: base.cash - 1 }, { ...base, lastMonth: -2 }]) {
    assert.equal(validEconomy(value), false);
  }
  for (const key of ['cash', 'assets', 'debt', 'income', 'expenses', 'due']) {
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '100']) {
      assert.equal(validEconomy({ ...base, [key]: value }), false, key);
    }
  }
  for (const mutation of [{ month: -1 }, { id: '' }, { label: '' }, { cashDelta: 0.1 },
    { debtDelta: Infinity }, { dueDelta: NaN }, { assetsDelta: 0.5 }, { kind: 'unknown' }]) {
    assert.equal(validEconomy({ ...base, ledger: [{ ...base.ledger[0], ...mutation }] }), false);
  }
  assert.equal(validEconomy({ ...base, ledger: [...base.ledger, ...base.ledger] }), false);
  const minimal = initialEconomy('steady');
  minimal.ledger = [{ id: 'external', month: 0, label: '기록', cashDelta: 0, debtDelta: 0 }];
  assert.equal(validEconomy(restore(minimal)), true);
  assert.throws(() => settleEconomyMonth({}, 0, university), TypeError);
});

test('invalid inputs, reserved IDs, reverse action months and empty payments are rejected', () => {
  const state = settleEconomyMonth(initialEconomy('steady'), 2, context('training'));
  for (const id of ['', ' ', 'month:2:salary']) assert.equal(economyAction(state, id, 'work', 2).ok, false);
  for (const month of [-1, 1, 0.5, Infinity]) assert.equal(economyAction(state, 'work', 'work', month).ok, false);
  assert.equal(economyAction(state, 'x', 'unknown', 2).ok, false);
  assert.equal(economyAction(state, 'x', 'pay-due', 2).ok, false);
  for (const month of [-1, 0.5, Infinity]) assert.throws(() => settleEconomyMonth(state, month, university), TypeError);
  assert.throws(() => settleEconomyMonth(state, 3, { ...university, stage: 'unknown' }), TypeError);
  assert.throws(() => initialEconomy('unknown'), TypeError);
});

test('changing provisional amounts affects the next settlement and invalid settings cannot persist', () => {
  const original = r.trainingSalary;
  try {
    r.trainingSalary = 123_000;
    const state = settleEconomyMonth(initialEconomy('steady'), 0, context('training'));
    assert.equal(state.income, 123_000);
    r.trainingSalary = -1;
    assert.throws(() => initialEconomy('steady'), RangeError);
  } finally {
    r.trainingSalary = original;
  }
});

test('unsafe arithmetic rejects the entire operation without changing the input', () => {
  const state = { ...initialEconomy('comfortable'), cash: Number.MAX_SAFE_INTEGER, assets: Number.MAX_SAFE_INTEGER };
  assert.equal(economyAction(state, 'loan', 'loan', 0).ok, false);
  assert.equal(state.ledger.length, 0);
  assert.throws(() => settleEconomyMonth(state, 0, context('training')), RangeError);
  assert.equal(state.cash, Number.MAX_SAFE_INTEGER);
});
