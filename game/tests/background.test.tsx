import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateStart, createRandomGame } from '../src/random-life';
import { createCareerGame } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { initialAbilities } from '../src/abilities';
import { initialEconomy, settleEconomyMonth, type EconomyContext } from '../src/economy';
import { familyFunding, backgroundAbilityBonuses, backgroundStatEffects, EXPERIENCES, type BackgroundProfile } from '../src/background';
import { financeView } from '../src/finance-view';
import { openGameDatabase, persistGame, loadGame, validState } from '../src/storage';
import BackgroundDetails from '../src/BackgroundDetails';

const school: EconomyContext = { stage: 'university', practice: 'undecided', working: false, scholarship: false };
function background(rank: number, familyStyle: BackgroundProfile['familyStyle'] = 'shared') {
  const b = generateStart(42).background;
  return { ...b, profile: { ...b.profile!, wealthTopPercent: rank, familyStyle } };
}
describe('diverse starting backgrounds', () => {
  it('widens initial stat variation moderately and preserves v2 support and save validation', async () => {
    const samples = { old: [] as number[], current: [] as number[] };
    for (let seed = 0; seed < 2000; seed++) {
      const old = generateStart(seed, 2), current = generateStart(seed, 3);
      samples.old.push(old.stats.health); samples.current.push(current.stats.health);
      expect(current.background.profile!.wealthTopPercent).toBe(old.background.profile!.wealthTopPercent);
      expect(current.stats.health).toBeGreaterThan(0);
    }
    const deviation = (xs: number[]) => { const mean = xs.reduce((a,b) => a+b,0)/xs.length; return Math.sqrt(xs.reduce((a,b) => a+(b-mean)**2,0)/xs.length); };
    const ratio = deviation(samples.current) / deviation(samples.old);
    expect(ratio).toBeGreaterThan(1.1); expect(ratio).toBeLessThan(1.5);
    const legacy = generateStart(42, 2), s = createCareerGame('v2-save', 42);
    s.seed = legacy.seed; s.stats = legacy.stats; s.life!.background = legacy.background;
    s.economy = initialEconomy(legacy.background.finances, familyFunding(legacy.background).initialCash);
    s.abilities = initialAbilities(s);
    expect(validState(s)).toBe(true);
    const b = background(50); b.profile.version = 2;
    expect(familyFunding(b)).toEqual({ initialCash: 5_000_000, monthly: 600_000, semester: 1_000_000 });
    const db = await openGameDatabase(`background-v2-${crypto.randomUUID()}`);
    try { await persistGame(db,s,null); expect((await loadGame(db))!.state).toEqual(s); } finally { db.close(); }
    expect(familyFunding(background(0.1,'generous')).initialCash).toBe(900_000_000);
    expect(familyFunding(background(100,'independent')).initialCash).toBe(40_000);
  });
  it('reproduces the full start and broadly covers percentile ranks, experiences and support styles', () => {
    const ranks = new Set<number>(), experiences = new Set<string>(), styles = new Set<string>();
    for (let seed = 0; seed < 4000; seed++) {
      const s = generateStart(seed), p = s.background.profile!;
      ranks.add(p.wealthTopPercent); experiences.add(s.background.experience); styles.add(p.familyStyle);
      expect(p.wealthTopPercent).toBeGreaterThanOrEqual(0.1); expect(p.wealthTopPercent).toBeLessThanOrEqual(100);
      expect(Object.values(s.stats).every(v => v >= 0 && v <= 100)).toBe(true);
    }
    expect(ranks.size).toBeGreaterThan(950); expect(experiences.size).toBe(10); expect(styles.size).toBe(3);
    expect(generateStart(42)).toEqual(generateStart(42));
    expect(createCareerGame('seed', 42)).toEqual(createCareerGame('seed', 42));
  });
  it('varies funds continuously by rank and separately by support style', () => {
    expect(familyFunding(background(1))).toEqual({ initialCash: 200_000_000, monthly: 3_500_000, semester: 9_000_000 });
    expect(familyFunding(background(50))).toEqual({ initialCash: 4_000_000, monthly: 500_000, semester: 800_000 });
    expect(familyFunding(background(90))).toEqual({ initialCash: 300_000, monthly: 40_000, semester: 0 });
    expect(familyFunding(background(100))).toEqual({ initialCash: 100_000, monthly: 0, semester: 0 });
    let previous = familyFunding(background(0.1));
    for (let i = 2; i <= 1000; i++) {
      const f = familyFunding(background(i / 10));
      for (const key of ['initialCash', 'monthly', 'semester'] as const) {
        expect(f[key]).toBeLessThanOrEqual(previous[key]!); expect(Number.isSafeInteger(f[key])).toBe(true);
      }
      previous = f;
    }
    expect(familyFunding(background(50, 'generous')).monthly).toBe(750_000);
    expect(familyFunding(background(50, 'independent')).monthly).toBe(180_000);
    expect(familyFunding(background(49.9)).initialCash).not.toBe(familyFunding(background(50)).initialCash);
  });
  it('makes every experience affect stats and skills, while wealth itself does not determine ability', () => {
    for (const experience of EXPERIENCES) {
      const b = { ...background(50), experience };
      expect(Object.values(backgroundAbilityBonuses(b)).some(v => v >= 15)).toBe(true);
      expect(Object.values(backgroundStatEffects(b)).some(v => v !== 0)).toBe(true);
    }
    const rich = createCareerGame('skills', 4), poor = structuredClone(rich);
    rich.life!.background = background(1); poor.life!.background = background(99);
    expect(initialAbilities(rich)).toEqual(initialAbilities(poor));
    expect(backgroundStatEffects(rich.life!.background)).toEqual(backgroundStatEffects(poor.life!.background));
    poor.life!.background.experience = EXPERIENCES[1]; rich.life!.background.experience = EXPERIENCES[0];
    expect(initialAbilities(poor).values.stamina).toBeGreaterThan(initialAbilities(rich).values.stamina);
  });
  it('credits monthly and semester support exactly once, before expenses, and stops after university', () => {
    const context = { ...school, familyMonthly: 600_000, familySemester: 1_000_000, wageIndex: 2 };
    let e = initialEconomy('steady', 20_000_000);
    for (let month = 1; month <= 6; month++) e = settleEconomyMonth(e, month, context);
    expect(e.cash).toBe(15_200_000); // 20m + 3.6m + 1m - 5.4m living - 4m tuition
    expect(e.income).toBe(1_600_000);
    expect(e.ledger.filter(t => t.id.includes('family-monthly'))).toHaveLength(6);
    expect(e.ledger.filter(t => t.id.includes('family-semester'))).toHaveLength(1);
    const restored = JSON.parse(JSON.stringify(e));
    expect(settleEconomyMonth(restored, 6, context)).toEqual(e);
    const after = settleEconomyMonth(e, 7, { ...context, stage: 'training' });
    expect(after.ledger.filter(t => t.id.includes('family-'))).toHaveLength(7);
    expect(() => settleEconomyMonth(e, 7, { ...context, familyMonthly: -1 })).toThrow();
    const constrained = settleEconomyMonth(initialEconomy('tight', 0), 1, { ...school, familyMonthly: 900_000 });
    expect(constrained.due).toBe(0); expect(constrained.cash).toBe(0);
  });
  it('wires support into real game progression and budget forecasts without counting it as salary', () => {
    let s = createCareerGame('flow', 42);
    const f = familyFunding(s.life!.background);
    expect(s.economy!.cash).toBe(f.initialCash);
    const view = financeView(s);
    expect(view.income).toBe(f.monthly + Math.round(f.semester / 6));
    expect(view.salary).toBe(0);
    s.economy!.cash = s.economy!.assets = 100_000_000;
    s = reduceGame(s, { type: 'control', id: 'play', paused: false, speed: 1 });
    for (let i = 0; i < 24 && s.life!.elapsedMs < 1000 && !s.pendingEvent; i++) s = reduceGame(s, { type: 'tick', id: `tick:${i}`, elapsedMs: 1000 });
    expect(s.life!.elapsedMs).toBeGreaterThanOrEqual(1000);
    expect(s.economy!.ledger.find(t => t.id.endsWith('family-monthly'))?.cashDelta ?? 0).toBe(f.monthly);
    expect(validState(s)).toBe(true);
    s.stageIndex = 1; s.career!.application = 'accepted';
    expect(financeView(s).familyMonthly).toBe(0); expect(financeView(s).familySemester).toBe(0);
  });
  it('preserves old backgrounds and balances across IndexedDB restore and rejects altered percentiles', async () => {
    const legacy = generateStart(42, 1), old = createCareerGame('old-background', 42);
    old.seed = legacy.seed; old.stats = legacy.stats; old.life!.background = legacy.background;
    old.economy = initialEconomy(legacy.background.finances); old.abilities = initialAbilities(old);
    expect(validState(old)).toBe(true); expect(familyFunding(old.life!.background).monthly).toBe(0);
    const db = await openGameDatabase(`background-${crypto.randomUUID()}`);
    try {
      await persistGame(db, old, null); expect((await loadGame(db))!.state).toEqual(old);
      const fresh = createCareerGame('new-background', 7);
      await persistGame(db, fresh, old); expect((await loadGame(db))!.state).toEqual(fresh);
      const altered = structuredClone(fresh); altered.life!.background.profile!.wealthTopPercent = 0;
      expect(validState(altered)).toBe(false);
      const unknown = structuredClone(fresh); Object.assign(unknown.life!.background.profile!, { version: 99 });
      expect(validState(unknown)).toBe(false);
    } finally { db.close(); }
    const random = createRandomGame('old-random', 42); random.seed = legacy.seed; random.stats = legacy.stats; random.life!.background = legacy.background;
    expect(validState(random)).toBe(true);
  });
  it('renders percentile, support amounts and ability effects, with a compatible old-save view', () => {
    const markup = renderToStaticMarkup(<BackgroundDetails background={background(1)} hasEconomy />);
    for (const label of ['상위 1%', '입학 때 받은 돈', '월 생활비 지원', '학기별 학비 지원', '배경이 주는 영향']) expect(markup).toContain(label);
    const legacy = renderToStaticMarkup(<BackgroundDetails background={generateStart(42, 1).background} hasEconomy />);
    expect(legacy).not.toContain('상위'); expect(legacy).not.toContain('월 생활비 지원');
  });
});
