import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame, reduceCareerGame } from '../src/career-runtime';
import { advanceDynamics, rollEffort, settleVariableEarnings, variableEarnings, validDynamics } from '../src/life-dynamics';
import { compactWon, financeView } from '../src/finance-view';
import FinanceSummary from '../src/FinanceSummary';
import { validState } from '../src/storage';
import { settleEconomyMonth, validEconomy } from '../src/economy';

describe('persistent effort outcomes and stat losses', () => {
  it('has five outcome degrees and prior results change the next opportunity', () => {
    const grades = new Set<number>(); let good = 0, bad = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const a = createCareerGame('paired', seed), b = structuredClone(a);
      a.dynamics!.momentum.study = 12; b.dynamics!.momentum.study = -12;
      good += rollEffort(a, 'study'); bad += rollEffort(b, 'study');
      grades.add(a.dynamics!.lastGrade); grades.add(b.dynamics!.lastGrade);
    }
    expect([...grades].sort()).toEqual([-1, -2, 0, 1, 2]);
    expect(good - bad).toBeGreaterThan(150);
  });
  it('allows both gains and losses for every stat, logs actual changes, and keeps recovery possible', () => {
    const gained = new Set<string>(), lost = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      const s = createCareerGame('stat-directions', seed);
      s.stats = { health: 60, happiness: 60, knowledge: 60, relationships: 60 };
      for (let m = 1; m <= 72; m++) {
        s.life!.elapsedMs = m * 1000;
        s.progress!.focus = (['study', 'rest', 'people', 'research'] as const)[Math.floor((m - 1) / 6) % 4];
        const before = { ...s.stats }; advanceDynamics(s);
        for (const k of Object.keys(before) as (keyof typeof before)[]) {
          if (s.stats[k] > before[k]) gained.add(k);
          if (s.stats[k] < before[k]) lost.add(k);
          expect(s.stats[k]).toBeGreaterThanOrEqual(0); expect(s.stats[k]).toBeLessThanOrEqual(100);
        }
        if (m % 3 === 0) for (const [key, delta] of Object.entries(s.journal.at(-1)!.effects)) expect(delta).toBe(s.stats[key as keyof typeof before] - before[key as keyof typeof before]);
      }
    }
    expect(gained.size).toBe(4); expect(lost.size).toBe(4);
    const s = createCareerGame('recover', 19); s.stats.health = 8; s.dynamics!.fatigue = 24; s.dynamics!.momentum.rest = -12; s.progress!.focus = 'rest';
    for (let m = 1; m <= 12; m++) { s.life!.elapsedMs = m * 1000; advanceDynamics(s); }
    expect(s.stats.health).toBeGreaterThan(8); expect(s.dynamics!.fatigue).toBe(0);
  });
  it('reproduces outcomes after JSON restore and does not reroll a settled month', () => {
    const s = createCareerGame('restore', 42); s.life!.elapsedMs = 3000; advanceDynamics(s);
    const restored = JSON.parse(JSON.stringify(s));
    advanceDynamics(s); expect(s).toEqual(restored);
    s.life!.elapsedMs = restored.life.elapsedMs = 6000; advanceDynamics(s); advanceDynamics(restored);
    expect(s).toEqual(restored); expect(validDynamics(restored.dynamics, 6)).toBe(true);
    for (const bad of [{ fatigue: -1 }, { seed: NaN }, { momentum: [] }, { lastGrade: 3 }, { lastMonth: 99 }]) expect(validDynamics({ ...s.dynamics, ...bad }, 6)).toBe(false);
  });
  it('preserves legacy saves and does not draw during pause, focus changes or pending choices', () => {
    let s = createCareerGame('controls', 42); delete s.dynamics;
    expect(validState(s)).toBe(true);
    expect(reduceCareerGame(s, { type: 'tick', id: 'paused', elapsedMs: 1000 })).toBe(s);
    s = reduceCareerGame(s, { type: 'control', id: 'start', paused: false, speed: 16 });
    s = reduceCareerGame(s, { type: 'tick', id: 'a', elapsedMs: 1000 });
    s = reduceCareerGame(s, { type: 'tick', id: 'b', elapsedMs: 1000 });
    expect(validState(s)).toBe(true); expect(s.pendingEvent).not.toBeNull();
    expect(reduceCareerGame(s, { type: 'tick', id: 'waiting', elapsedMs: 1000 })).toBe(s);
    const restored = JSON.parse(JSON.stringify(s)); expect(validState(restored)).toBe(true);
    restored.dynamics.fatigue = 999; expect(validState(restored)).toBe(false);
  });
  it('compounds different performance histories into materially different cash and handles cash shortfalls', () => {
    const a = createCareerGame('earnings', 1), b = structuredClone(a);
    for (const s of [a, b]) {
      s.stageIndex = 2; s.career!.practice = 'research'; s.economy!.cash = s.economy!.assets = 0;
    }
    a.dynamics!.momentum.research = 12; b.dynamics!.momentum.research = -12;
    for (let m = 1; m <= 24; m++) for (const s of [a, b]) {
      s.life!.elapsedMs = m * 1000;
      s.economy = settleEconomyMonth(s.economy!, m, { stage: 'career', practice: 'research', scholarship: false, working: false });
      settleVariableEarnings(s); expect(validEconomy(s.economy)).toBe(true);
      const before = structuredClone(s.economy); settleVariableEarnings(s); expect(s.economy).toEqual(before);
    }
    expect(a.economy!.cash - b.economy!.cash).toBeGreaterThan(20_000_000);
    b.economy!.cash = b.economy!.assets = 0; b.economy!.lastMonth = 25; b.life!.elapsedMs = 25_000;
    settleVariableEarnings(b); expect(b.economy!.due).toBe(-variableEarnings(b)); expect(validEconomy(b.economy)).toBe(true);
  });
});

describe('readable assets and current pay', () => {
  it('formats Korean units without changing the exact value and handles boundaries', () => {
    expect(compactWon(540_000_000)).toBe('5.4억 원'); expect(compactWon(3_842_716)).toBe('384만 원');
    expect(compactWon(-3_842_716)).toBe('−384만 원'); expect(compactWon(99_999_999)).toBe('1억 원');
    expect(compactWon(0)).toBe('0원'); expect(compactWon(9999)).toBe('9,999원');
  });
  it('deducts debt and unpaid bills, estimates current salary immediately and distinguishes clinic revenue', () => {
    const s = createCareerGame('finance', 7); s.stageIndex = 2; s.career!.practice = 'employed';
    s.economy!.assets = 8_000_000; s.economy!.cash = 8_000_000; s.economy!.debt = 10_000_000; s.economy!.due = 400_000;
    const f = financeView(s); expect(f.netAssets).toBe(-2_400_000); expect(f.annual).toBe(72_000_000);
    expect(f.expenses).toBe(900_000); expect(f.disposable).toBe(5_100_000);
    const html = renderToStaticMarkup(<FinanceSummary game={s}/>);
    expect(html).toContain('현재 연봉'); expect(html).toContain('월수입'); expect(html).toContain('월지출'); expect(html).toContain('매달 남는 돈'); expect(html).toContain('−240만 원'); expect(html).toContain('8,000,000원');
    s.career!.practice = 'clinic'; s.economy!.ledger.push({ id: 'opened', month: 0, label: '개원', kind: 'open-clinic', cashDelta: 0, debtDelta: 0 });
    expect(financeView(s).label).toBe('연 매출 예상'); expect(financeView(s).expenses).toBe(7_900_000);
  });
});
