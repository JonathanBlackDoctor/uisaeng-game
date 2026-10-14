import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { measureRun } from './helpers/pacing';
import { ECONOMY_RULES, initialEconomy, settleEconomyMonth } from '../src/economy';
import FinanceSummary from '../src/FinanceSummary';

it('pays the pension once per month at the wage multiplier without borrowing or deleting due', () => {
  const e = initialEconomy('tight');
  const context = { stage: 'retirement' as const, practice: 'untrained' as const, working: false, scholarship: false, wageIndex: 2, priceIndex: 1 };
  const next = settleEconomyMonth(e, 0, context);
  expect(next.income).toBe(3_000_000);
  expect(next.cash).toBe(e.cash + 3_000_000 - ECONOMY_RULES.livingCost);
  expect(next.debt).toBe(e.debt);
  expect(next.ledger.filter(t => t.kind === 'loan')).toHaveLength(0);
  expect(settleEconomyMonth(next, 0, context)).toBe(next);
  const due = { ...e, due: 400_000 };
  expect(settleEconomyMonth(due, 0, context)).toBe(due);
});

it('completes the formerly repeating untrained route with a visible pension and its full ledger', () => {
  const result = measureRun(3, 'untrained', true, 16, 'short');
  expect(result.keys.filter(k => k === 'funding')).toHaveLength(1);
  const state = result.state;
  expect(state.status).toBe('completed');
  expect(state.economy!.ledger.some(t => t.label === '연금' && t.cashDelta > 0)).toBe(true);
  const retired = { ...state, status: 'active' as const };
  expect(renderToStaticMarkup(<FinanceSummary game={retired}/>)).toContain('연금 기준액 월 150만 원');
}, 30000);
