import { describe, expect, it } from 'vitest';
import { createCareerGame } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { validState } from '../src/storage';
import { accrueInterest, preparePortfolio, transferPortfolio, coverDueFromSavings, finishPortfolio } from '../src/portfolio';
import { accrueLifestyle, settleLifestyle, lifestyleSchedule, monthlyDietFactor } from '../src/lifestyle';
import { financeView } from '../src/finance-view';

describe('compound finance and conservation', () => {
  it('preserves sub-won interest and compounds only once each month across restores', () => {
    let carry = 0, earned = 0;
    for (let i = 0; i < 400; i++) { const x = accrueInterest(1, 300, carry); earned += x.amount; carry = x.remainder; }
    expect(earned).toBe(1); expect(carry).toBe(0);
    const s = createCareerGame('compound', 42); s.economy!.cash = s.economy!.assets = 10_000_000;
    expect(transferPortfolio(s, 'save', 1_000_000, 'deposit')).toBe(true);
    const assets = s.economy!.assets; expect(s.economy!.cash + s.portfolio!.savings).toBe(assets);
    for (let m = 1; m <= 12; m++) { s.life!.elapsedMs = m * 1000; preparePortfolio(s); const snap = JSON.parse(JSON.stringify(s)); preparePortfolio(s); expect(s).toEqual(snap); }
    expect(s.portfolio!.savings).toBeGreaterThan(1_030_000);
    expect(s.economy!.assets).toBe(assets + s.portfolio!.savings - 1_000_000);
    const restored = JSON.parse(JSON.stringify(s)); s.life!.elapsedMs = restored.life.elapsedMs = 13_000;
    preparePortfolio(s); preparePortfolio(restored); expect(s).toEqual(restored);
  });
  it('capitalizes loan interest without inventing cash and changes prices separately from salary', () => {
    const s = createCareerGame('rates', 12); s.economy!.debt = 5_000_000;
    const cash = s.economy!.cash;
    for (let m = 1; m <= 12; m++) { s.life!.elapsedMs = m * 1000; preparePortfolio(s); }
    expect(s.economy!.debt).toBeGreaterThan(5_250_000); expect(s.economy!.cash).toBe(cash);
    expect(s.portfolio!.priceIndex).toBeGreaterThan(s.portfolio!.wageIndex);
    expect(s.portfolio!.wageIndex).toBe(1_020_000);
    expect(financeView(s).expenses).toBeGreaterThan(1_566_667);
  });
  it('records positive and negative investment returns, never counts transfers as earned income', () => {
    let gains = 0, losses = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const s = createCareerGame('market', seed); s.economy!.cash = s.economy!.assets = 10_000_000;
      const before = s.economy!.assets; transferPortfolio(s, 'invest', 1_000_000, 'buy');
      expect(s.economy!.assets).toBe(before); expect(s.economy!.income).toBe(0);
      s.life!.elapsedMs = 1000; preparePortfolio(s);
      if (s.portfolio!.lastInvestmentReturn > 0) gains++; if (s.portfolio!.lastInvestmentReturn < 0) losses++;
      expect(s.economy!.assets).toBe(before + s.portfolio!.lastInvestmentReturn);
      expect(transferPortfolio(s, 'sell', s.portfolio!.investments, 'sell')).toBe(true);
      expect(s.portfolio!.investments).toBe(0); expect(s.economy!.cash).toBe(s.economy!.assets);
    }
    expect(gains).toBeGreaterThan(10); expect(losses).toBeGreaterThan(10);
  });
  it('uses opt-in savings for bills and handles insufficient automatic transfer budgets', () => {
    const s = createCareerGame('bills', 4); s.economy!.cash = s.economy!.assets = 3_000_000;
    transferPortfolio(s, 'save', 1_000_000, 'save'); s.economy!.cash = 0; s.economy!.assets = 1_000_000; s.economy!.due = 400_000;
    s.portfolio!.useSavings = false; coverDueFromSavings(s); expect(s.economy!.due).toBe(400_000);
    s.portfolio!.useSavings = true; coverDueFromSavings(s); expect(s.economy!.due).toBe(0); expect(s.portfolio!.savings).toBe(600_000); expect(s.economy!.cash).toBe(0);
    s.portfolio!.autoSave = s.portfolio!.autoInvest = s.portfolio!.autoRepay = 1_000_000;
    s.life!.elapsedMs = 1000; finishPortfolio(s); expect(s.economy!.cash).toBe(0);
    expect(s.portfolio!.savings).toBe(600_000); expect(s.portfolio!.investments).toBe(0);
  });
});

describe('simultaneous lifestyle controls', () => {
  it('keeps enabled activities, compound returns and allocations identical at 1x and 16x', () => {
    function play(speed: 1 | 16) {
      let s = createCareerGame('enabled-replay', 23);
      s.economy!.cash = s.economy!.assets = 50_000_000;
      for (const key of ['exercise','friends','study'] as const) s = reduceGame(s, { type: 'lifestyle', id: key, key, enabled: true });
      s = reduceGame(s, { type: 'money-plan', id: 'saving', field: 'autoSave', amount: 300_000 });
      s = reduceGame(s, { type: 'money-plan', id: 'investing', field: 'autoInvest', amount: 100_000 });
      s = reduceGame(s, { type: 'control', id: 'start', paused: false, speed });
      for (let i = 0; i < 1000 && s.life!.elapsedMs < 6000; i++) {
        s = s.pendingEvent ? reduceGame(s, { type: 'choose', id: `c:${s.revision}`, eventId: s.pendingEvent.id, choiceId: s.pendingEvent.choices[0].id })
          : reduceGame(s, { type: 'tick', id: `t:${s.revision}`, elapsedMs: 1000 });
        s = JSON.parse(JSON.stringify(s));
      }
      expect(s.life!.elapsedMs).toBe(6000); expect(validState(s)).toBe(true); return s;
    }
    const slow = play(1), fast = play(16);
    expect(slow.stats).toEqual(fast.stats); expect(slow.portfolio).toEqual(fast.portfolio); expect(slow.lifestyle).toEqual(fast.lifestyle);
    expect(slow.economy).toEqual(fast.economy); expect(slow.portfolio!.savings).toBeGreaterThan(1_800_000);
  });
  it('rejects overcommitting or invalid actions and does not apply immediate stat bonuses', () => {
    let s = createCareerGame('time-budget', 42); const stats = { ...s.stats };
    for (const key of ['exercise','friends','sleep'] as const) s = reduceGame(s, { type: 'lifestyle', id: key, key, enabled: true });
    expect(lifestyleSchedule(s).active).toHaveLength(3); expect(lifestyleSchedule(s).remaining).toBe(2);
    expect(reduceGame(s, { type: 'lifestyle', id: 'too-much', key: 'study', enabled: true })).toBe(s);
    expect(s.stats).toEqual(stats); expect(validState(s)).toBe(true);
    expect(reduceGame(s, { type: 'money-plan', id: 'bad', field: 'autoSave', amount: -1 })).toBe(s);
    s.stageIndex = 1; expect(lifestyleSchedule(s).suspended.length).toBeGreaterThan(0);
  });
  it('prorates mid-month settings, charges actual time and awards nothing for unaffordable paid activities', () => {
    const s = createCareerGame('prorated', 42); s.economy!.cash = s.economy!.assets = 10_000_000;
    accrueLifestyle(s, 500); s.lifestyle!.enabled.exercise = true; s.lifestyle!.diet = 'comfortable'; accrueLifestyle(s, 500);
    expect(monthlyDietFactor(s)).toBe(1.1); s.life!.elapsedMs = 1000; s.economy!.lastMonth = 1;
    const before = s.economy!.cash; settleLifestyle(s); expect(before - s.economy!.cash).toBe(20_000);
    const once = structuredClone(s); settleLifestyle(s); expect(s).toEqual(once);
    s.life!.elapsedMs = 2000; s.economy!.lastMonth = 2; s.economy!.cash = 0; accrueLifestyle(s, 1000);
    const carry = s.lifestyle!.effectCarry.health; settleLifestyle(s);
    // Comfortable diet still has its own time effect; the unpaid exercise adds none.
    expect(s.lifestyle!.effectCarry.health).toBe((carry + 1000) % 3000);
    expect(s.journal.at(-1)!.detail).toContain('비용이 부족');
  });
  it('restores active switches and rejects malformed saved finance and time state', () => {
    let s = createCareerGame('save-switches', 8);
    s = reduceGame(s, { type: 'lifestyle', id: 'sport', key: 'exercise', enabled: true });
    s = reduceGame(s, { type: 'money-plan', id: 'plan', field: 'autoSave', amount: 100_000 });
    expect(validState(JSON.parse(JSON.stringify(s)))).toBe(true);
    for (const change of [{ savings: -1 }, { investments: Number.MAX_SAFE_INTEGER }, { depositCarry: 120_000 }, { autoSave: 123 }]) {
      const bad = structuredClone(s); Object.assign(bad.portfolio!, change); expect(validState(bad)).toBe(false);
    }
    const bad = structuredClone(s); bad.lifestyle!.accrued.exercise = 1001; expect(validState(bad)).toBe(false);
    delete s.lifestyle; delete s.portfolio; expect(validState(s)).toBe(true);
  });
});
