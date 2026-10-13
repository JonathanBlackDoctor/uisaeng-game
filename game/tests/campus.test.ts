import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/contracts';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { CLUBS, advanceCampus, initialCampus, validCampus } from '../src/campus';
import { ECONOMY_RULES, fundEducationDue, initialEconomy, settleEconomyMonth } from '../src/economy';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';

const tick = (s: GameState) => reduceGame(s, { type: 'tick', id: `t:${s.revision}`, elapsedMs: 1000 });
const choose = (s: GameState, id: string) => reduceGame(s, { type: 'choose', id: `c:${s.revision}`, eventId: s.pendingEvent!.id, choiceId: id });
function answer(s: GameState, club = 'pass') {
  const e = s.pendingEvent!, k = e.randomKey;
  if (k === 'club-required' || k === 'campus-club-kind') return club;
  if (k === 'funding') return e.choices.some(c => c.id === 'education-plan') ? 'education-plan' : 'loan';
  if (k === 'campus-invitation') return 'lead';
  if (k === 'campus-next-step') return 'specialty';
  if (k === 'campus-final') return 'study';
  if (k === 'specialty-required') return 'untrained';
  if (k === 'marriage-required') return 'single';
  if (k?.startsWith('offer-')) return 'decline';
  return e.choices[0].id;
}
function start(seed = 42, speed: 1 | 8 = 8) {
  return reduceGame(createCareerGame('campus-test', seed), { type: 'control', id: 'start', paused: false, speed });
}
function until(s: GameState, done: (s: GameState) => boolean, club = 'pass') {
  for (let i = 0; i < 12000; i++) {
    if (done(s)) return s;
    s = s.pendingEvent ? choose(s, answer(s, club)) : tick(s);
    const diagnostic = `invalid month ${s.life!.elapsedMs / 1000}: ${s.pendingEvent?.randomKey}`;
    if (!validState(s)) throw new Error(diagnostic);
  }
  throw new Error('target not reached');
}
const news = (s: GameState) => s.journal.filter(j => j.id.startsWith('auto:campus:ambient:'));

describe('campus life', () => {
  it.each(CLUBS.map(c => [c.id, c.specialty, c.project]))('connects %s to a project, mentor and %s opportunity', async (id: string, specialty: string, project: string) => {
    let s = until(start(), s => s.campus?.milestones.includes('campus-next-step') === true, id);
    expect(s.campus!.club).toBe(id);
    expect(s.campus!.project).toBe('finished');
    expect(s.campus!.mentorMeetings).toBeGreaterThanOrEqual(4);
    expect(s.career!.interest).toBe(specialty);
    expect(s.career!.explored).toContain(specialty);
    expect(s.journal.some(j => j.title.includes(project))).toBe(true);
    const club = CLUBS.find(c => c.id === id)!;
    expect(s.career!.experience[club.experience]).toBeGreaterThanOrEqual(20);
    const db = await openGameDatabase(`campus-${id}`);
    try {
      await persistGame(db, s, null);
      const restored = (await loadGame(db))!.state;
      expect(restored).toEqual(s);
      s = until(s, x => x.stageIndex === 1, id);
      expect(until(restored, x => x.stageIndex === 1, id)).toEqual(s);
      expect(s.campus!.automaticFunding).toBe(false);
    } finally { db.close(); }
  });
  it('keeps automatic news through late university and retirement, with no exhausted pool', () => {
    const s = until(start(), s => s.status === 'completed');
    const months = news(s).map(j => Number(j.id.split(':').at(-1)));
    expect(months.filter(m => m <= 72).length).toBeGreaterThan(35);
    expect(months.some(m => m >= 68 && m <= 72)).toBe(true);
    expect(months.some(m => m >= 650)).toBe(true);
    // Monthly campus news and six-month adult news both guarantee at most two slots of silence.
    for (let i = 1; i < months.length; i++) expect(months[i] - months[i - 1]).toBeLessThanOrEqual(months[i] <= 72 ? 2 : 12);
    expect(new Set(news(s).map(j => j.title)).size).toBeGreaterThan(25);
    expect(new Set(news(s).map(j => j.id)).size).toBe(news(s).length);
  });
  it('reuses long-running stories after the preferred count instead of going silent', () => {
    const s = createCareerGame('cycles', 19);
    s.stageIndex = 2;
    for (let m = 6; m <= 3000; m += 6) { s.life!.elapsedMs = m * 1000; advanceCampus(s); }
    expect(news(s).length).toBeGreaterThan(250);
    expect(news(s).at(-1)!.id).toMatch(/:(2994|3000)$/);
    expect(Object.values(s.campus!.seen).some(e => e.count > 8)).toBe(true);
    expect(validCampus(s.campus, 3000)).toBe(true);
  });
  it('uses reproducible seeds and identical events at 1x and 8x', () => {
    const a = until(start(42, 1), s => s.stageIndex === 1, 'research');
    const b = until(start(42, 8), s => s.stageIndex === 1, 'research');
    expect(news(a)).toEqual(news(b));
    expect(a.campus).toEqual(b.campus);
    expect(a.stats).toEqual(b.stats);
    expect(a.career).toEqual(b.career);
    expect(a.seed).toBe(b.seed);
    const c = until(start(77), s => s.stageIndex === 1, 'research');
    expect(news(c).map(j => j.title)).not.toEqual(news(b).map(j => j.title));
  });
  it('applies automatic stat and experience changes once without opening a choice', () => {
    const s = createCareerGame('effects', 42);
    let prior = { ...s.stats }, experience = { ...s.career!.experience };
    for (let m = 1; m <= 20; m++) { s.life!.elapsedMs = m * 1000; advanceCampus(s); }
    expect(s.pendingEvent).toBeNull();
    expect(s.stats).not.toEqual(prior);
    expect(s.career!.experience).not.toEqual(experience);
    const once = structuredClone(s); advanceCampus(s); expect(s).toEqual(once);
  });
  it('freezes both clock and news when paused or a choice is pending', () => {
    const paused = createCareerGame('paused', 2);
    expect(tick(paused)).toBe(paused);
    const pending = until(start(), s => !!s.pendingEvent);
    expect(tick(pending)).toBe(pending);
  });
  it.each(['club-required', 'funding', 'rotation-5'])('restores legacy %s pending and upgrades after resolving it', async (key: string) => {
    let s = until(start(), s => s.life!.elapsedMs >= 1_000);
    delete s.campus;
    s.pendingEvent = careerEvent(s, key);
    expect(validState(s)).toBe(true);
    const db = await openGameDatabase(`legacy-${key}`);
    try {
      await persistGame(db, s, null); s = (await loadGame(db))!.state;
      s = choose(s, key === 'club-required' ? 'join' : key === 'funding' ? 'loan' : 'emergency');
      expect(validState(s)).toBe(true);
      expect(s.campus).toBeDefined();
      if (key === 'club-required') {
        expect(s.pendingEvent!.randomKey).toBe('campus-club-kind');
        s = choose(s, 'band'); expect(s.campus!.club).toBe('band');
      }
      if (key === 'rotation-5') expect(s.career!.explored).toContain('emergency');
    } finally { db.close(); }
  });
});

describe('revocable university funding plan', () => {
  it('requires explicit opt-in, borrows only shortfalls, never duplicates settlement and stops after graduation', () => {
    const ctx = { stage: 'university' as const, practice: 'undecided' as const, working: false, scholarship: false };
    const initial = initialEconomy('tight');
    const first = settleEconomyMonth(initial, 1, ctx);
    const manual = settleEconomyMonth(first, 2, ctx);
    expect(manual.debt).toBe(0); expect(manual.due).toBe(600_000);
    const automatic = settleEconomyMonth(first, 2, { ...ctx, automaticEducationLoan: true });
    expect(automatic.debt).toBe(600_000); expect(automatic.due).toBe(0); expect(automatic.cash).toBe(0);
    expect(settleEconomyMonth(automatic, 2, { ...ctx, automaticEducationLoan: true })).toBe(automatic);
    const stopped = settleEconomyMonth(automatic, 3, ctx);
    expect(stopped.debt).toBe(automatic.debt); expect(stopped.due).toBe(ECONOMY_RULES.livingCost);
    const after = settleEconomyMonth(automatic, 3, { ...ctx, stage: 'retirement', automaticEducationLoan: true });
    expect(after.debt).toBe(automatic.debt); expect(after.due).toBeGreaterThan(0);
  });
  it('settles an existing due with available cash and only the remaining gap', () => {
    const s = initialEconomy('tight'); s.cash = s.assets = 300_000; s.due = 900_000;
    const paid = fundEducationDue(s, 'plan', 1);
    expect(paid.cash).toBe(0); expect(paid.due).toBe(0); expect(paid.debt).toBe(600_000);
    expect(fundEducationDue(paid, 'plan', 1)).toBe(paid);
  });
  it('persists player consent, allows stopping and prevents repeated actions', async () => {
    let s = createCareerGame('consent', 42);
    expect(s.campus!.automaticFunding).toBe(false);
    const action = { type: 'school-funding' as const, id: 'consent', automatic: true };
    s = reduceGame(s, action); expect(s.campus!.automaticFunding).toBe(true);
    expect(reduceGame(s, action)).toBe(s);
    const db = await openGameDatabase('funding-consent');
    try { await persistGame(db, s, null); expect((await loadGame(db))!.state.campus!.automaticFunding).toBe(true); }
    finally { db.close(); }
    s = reduceGame(s, { ...action, id: 'stop', automatic: false }); expect(s.campus!.automaticFunding).toBe(false);
    s.stageIndex = 1; expect(reduceGame(s, { ...action, id: 'after-grad' })).toBe(s);
  });
});
