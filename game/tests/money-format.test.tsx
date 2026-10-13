import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatMoneyText, formatWon } from '../src/money-format';
import DecisionSheet from '../src/DecisionSheet';
import { JournalHistory } from '../src/PlayLog';
import FinanceSummary from '../src/FinanceSummary';
import { createCareerGame } from '../src/career-runtime';
import { resultShareData } from '../src/result-share';

vi.mock('react-dom', async importOriginal => ({
  ...await importOriginal<typeof import('react-dom')>(), createPortal: (children: ReactNode) => children,
}));
afterEach(() => vi.unstubAllGlobals());

describe('exact Korean money display', () => {
  it.each([
    [0, '0원'], [8_000, '8,000원'], [10_000, '1만 원'], [1_400_000, '140만 원'],
    [125_000_000, '1억 2,500만 원'], [99_999_999, '9,999만 9,999원'],
    [-3_842_716, '−384만 2,716원'], [1_000_100_010_001, '1조 1억 1만 1원'],
  ])('preserves every won in %s', (amount, label) => expect(formatWon(amount)).toBe(label));

  it('formats signed amounts in text without changing percentages, age or existing units', () => {
    expect(formatMoneyText('20세 6개월 · 금리 6.5% · 현금 +1,400,000원 · 비용 -125000000원 · 2억 원'))
      .toBe('20세 6개월 · 금리 6.5% · 현금 +140만 원 · 비용 −1억 2,500만 원 · 2억 원');
    expect(formatMoneyText('3.14원 · 1,40,000원 · 10,000명')).toBe('3.14원 · 1,40,000원 · 10,000명');
  });

  it('is idempotent and leaves amounts outside the safe integer range unchanged', () => {
    const text = formatMoneyText('손익 −3,842,716원 · 미납 1,400,000원');
    expect(formatMoneyText(text)).toBe(text);
    expect(formatMoneyText('90,071,992,547,409,920원')).toBe('90,071,992,547,409,920원');
  });

  it('renders original pending choice text in units without modifying the event', () => {
    vi.stubGlobal('document', { body: {} });
    const event = { id: 'legacy-money', title: '미납 1,400,000원', body: '금리 6.5% · 현금 0원', choices: [
      { id: 'loan', label: '125,000,000원 대출', description: '현금 +1,400,000원 · 손익 −3,842,716원' },
    ] };
    const original = JSON.stringify(event);
    const html = renderToStaticMarkup(<DecisionSheet event={event} busy={false} onChoose={() => {}}/>);
    expect(html).toContain('미납 140만 원'); expect(html).toContain('1억 2,500만 원 대출');
    expect(html).toContain('현금 +140만 원'); expect(html).toContain('−384만 2,716원');
    expect(html).not.toContain('125,000,000원'); expect(JSON.stringify(event)).toBe(original);
  });

  it('uses the same values in history, financial details and shared results', () => {
    const entries = [{ id: 'old', title: '1,400,000원 지원', detail: '20세 · 현금 +125,000,000원', stage: 'university' as const, effects: {} }];
    const before = JSON.stringify(entries);
    const journal = renderToStaticMarkup(<JournalHistory entries={entries}/>);
    expect(journal).toContain('140만 원 지원'); expect(journal).toContain('+1억 2,500만 원');
    expect(JSON.stringify(entries)).toBe(before);
    const game = createCareerGame('money-display', 42);
    game.economy!.cash = game.economy!.assets = 125_000_000;
    game.economy!.debt = game.economy!.due = 0;
    const raw = JSON.stringify(game);
    const finance = renderToStaticMarkup(<FinanceSummary game={game}/>);
    expect(finance).toContain('title="125,000,000원"');
    expect(finance.replace(/<[^>]*>/g, '')).not.toContain('125,000,000원');
    expect(finance).toContain('1억 2,500만 원');
    expect(resultShareData(game).text).toContain('순자산 1억 2,500만 원');
    expect(JSON.stringify(game)).toBe(raw);
  });
});
