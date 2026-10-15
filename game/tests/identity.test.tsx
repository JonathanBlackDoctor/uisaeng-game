import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../src/contracts';
import { createCareerGame } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { calendarMonths, configureIdentity, initialIdentity, isServing, medicalPlacement, serviceDuration, serviceMonths, SERVICE_RULES } from '../src/identity';
import { lifeAge, elapsedMonths } from '../src/random-life';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import { financeView } from '../src/finance-view';
import { resultShareData } from '../src/result-share';
import IdentityPanel from '../src/IdentityPanel';
import Opening from '../src/Opening';
import LifeScene from '../src/LifeScene';

const choose = (s: GameState, id: string) => reduceGame(s, { type: 'choose', id: `choose:${s.revision}`, eventId: s.pendingEvent!.id, choiceId: id });
const skip = (s: GameState) => reduceGame(s, { type: 'next-choice', id: `skip:${s.revision}` });
type Picks = Record<string, string>;
function next(s: GameState, picks: Picks = {}) {
  if (!s.pendingEvent) return skip(s);
  const e = s.pendingEvent, preferred = picks[e.randomKey!] ?? ({ funding: 'education-plan', 'club-required': 'pass', 'service:plan': 'medical', 'service:timing': 'after-training', 'service:volunteer': 'civilian', 'specialty-required': 'untrained', 'practice-required': 'untrained', 'marriage-required': 'single' } as Picks)[e.randomKey!];
  return choose(s, e.choices.some(c => c.id === preferred) ? preferred : e.choices[0].id);
}
function until(s: GameState, done: (s: GameState) => boolean, picks: Picks = {}) {
  for (let i = 0; i < 250 && !done(s); i++) {
    s = next(s, picks);
    expect(validState(s), `invalid at ${elapsedMonths(s)} / ${s.pendingEvent?.randomKey} / ${JSON.stringify(s.identity)}`).toBe(true);
  }
  expect(done(s)).toBe(true);
  return s;
}
const male = (seed = 42) => configureIdentity(createCareerGame(`identity-${seed}`, seed), 'male');

describe('gender and military paths', () => {
  it('assigns reproducible names and genders across new-game seeds without changing the game RNG', () => {
    const identities = Array.from({ length: 32 }, (_, seed) => initialIdentity(seed));
    expect(new Set(identities.map(i => i.gender))).toEqual(new Set(['male', 'female']));
    expect(new Set(identities.map(i => i.name)).size).toBeGreaterThan(16);
    for (const [seed, identity] of identities.entries()) {
      expect(identity.name).toMatch(/^[가-힣]{3}$/);
      expect(createCareerGame(`name-${seed}`, seed).identity).toEqual(identity);
      expect(initialIdentity(seed)).toEqual(identity);
    }
    const draft = male();
    expect(configureIdentity(draft, 'male', 'prior-service').identity!.name).toBe(draft.identity!.name);
    expect(configureIdentity(draft, 'male', 'prior-service').seed).toBe(draft.seed);
  });
  it('keeps nameless older identities valid and rejects malformed names', () => {
    const older = male(); delete older.identity!.name;
    expect(validState(older)).toBe(true);
    const next = reduceGame(older, { type: 'control', id: 'older-name', paused: false });
    expect(next.identity!.name).toBeUndefined();
    for (const name of ['', ' ', ' 이름', '가'.repeat(41), 42]) {
      const bad = structuredClone(older);
      Object.assign(bad.identity!, { name });
      expect(validState(bad)).toBe(false);
    }
  });
  it('sets gender without changing initial abilities, background, finance or RNG; locks it after start', () => {
    const a = male(), b = configureIdentity(a, 'female');
    expect(b.stats).toEqual(a.stats); expect(b.abilities).toEqual(a.abilities); expect(b.life).toEqual(a.life); expect(b.seed).toBe(a.seed); expect(b.economy).toEqual(a.economy);
    expect(initialIdentity(42)).toEqual(initialIdentity(42));
    const running = reduceGame(a, { type: 'control', id: 'play', paused: false });
    expect(configureIdentity(running, 'female')).toBe(running);
    expect(validState(b)).toBe(true);
  });
  it('offers exactly enlisted versus medical service and stops time at the choice', () => {
    const s = until(male(), x => x.pendingEvent?.randomKey === 'service:plan');
    expect(s.pendingEvent!.choices.map(c => c.id)).toEqual(['army', 'medical']);
    expect(reduceGame(s, { type: 'tick', id: 'blocked', elapsedMs: 1000 })).toBe(s);
    expect(choose(s, 'exempt')).toBe(s);
  });
  it('pauses school during enlistment, pays only service money and returns to the same academic month', () => {
    let s = until(male(), x => x.pendingEvent?.randomKey === 'service:plan');
    s = choose(s, 'army');
    const month = elapsedMonths(s), cash = s.economy!.cash, encounters = s.encounters!.total;
    expect(isServing(s)).toBe(true);
    expect(financeView(s).income).toBe(SERVICE_RULES.army.income);
    expect(reduceGame(s, { type: 'explore', id: 'illegal-visit', specialtyId: 'internal' })).toBe(s);
    expect(reduceGame(s, { type: 'tick', id: 'paused', elapsedMs: 1000 })).toBe(s);
    s = until(s, x => x.identity?.service.status === 'completed');
    expect(elapsedMonths(s)).toBeGreaterThanOrEqual(month); // skip continues to the next real choice after discharge
    expect(serviceMonths(s)).toBe(18);
    expect(s.encounters!.total).toBe(encounters);
    expect(s.economy!.ledger.filter(t => t.id.startsWith('service:')).length).toBe(36);
    expect(s.economy!.ledger.filter(t => t.id.startsWith('service:')).reduce((n, t) => n + t.cashDelta, 0)).toBe(18 * (1_200_000 - 250_000));
    expect(s.economy!.cash).toBeGreaterThan(cash);
    expect(s.journal.filter(j => j.id === 'identity:complete')).toHaveLength(1);
    expect(calendarMonths(s) - elapsedMonths(s)).toBe(18);
    expect(lifeAge(s)).toContain('개월');
  });
  it.each([42, 43])('finishes graduation-first medical service with stable placement (%s)', (seed: number) => {
    const picks = { 'service:timing': 'graduation' };
    let s = until(male(seed), x => x.pendingEvent?.randomKey === 'service:placement', picks);
    expect(elapsedMonths(s)).toBe(72);
    expect(s.career!.application).toBe('none');
    const route = medicalPlacement(s);
    s = choose(s, 'people');
    s = until(s, x => x.pendingEvent?.randomKey === 'specialty-required', picks);
    expect(s.identity!.service.status).toBe('completed');
    expect(s.identity!.service.route).toBe(route);
    expect(elapsedMonths(s)).toBe(72);
    expect(serviceMonths(s)).toBe(serviceDuration(route));
    expect(s.encounters!.total).toBe(SERVICE_RULES[route].months * SERVICE_RULES[route].encounters);
    const final = until(s, x => x.status === 'completed', picks);
    expect(final.identity!.service.status).toBe('completed');
    expect(resultShareData(final).text).not.toContain('복무');
  });
  it('serves after training when accepted and after graduation when not training', () => {
    const untrained = until(male(), x => x.pendingEvent?.randomKey === 'service:placement');
    expect(elapsedMonths(untrained)).toBe(72);
    let trained: GameState | undefined;
    for (let seed = 1; seed <= 12; seed++) {
      const s = until(male(seed), x => x.pendingEvent?.randomKey === 'service:placement', { 'specialty-required': 'internal' });
      if (s.career!.application === 'accepted') { trained = s; break; }
    }
    expect(trained).toBeDefined();
    expect(elapsedMonths(trained!)).toBeGreaterThanOrEqual(144);
    expect(trained!.stageIndex).toBe(1);
    expect(trained!.career!.practice).toBe('undecided');
    const final = until(trained!, x => x.status === 'completed', { 'practice-required': 'employed' });
    expect(final.identity!.service.status).toBe('completed');
    expect(final.career!.practice).toBe('employed');
  });
  it.each(['civilian', 'volunteer'])('gives women distinct events and voluntary military service: %s', (volunteer: string) => {
    let s = configureIdentity(male(), 'female');
    s = until(s, x => x.pendingEvent?.randomKey === 'identity:campus');
    expect(s.pendingEvent!.body).toContain('생리통');
    s = until(s, x => x.status === 'completed', { 'service:volunteer': volunteer });
    expect(s.identity!.resolved).not.toContain('service:plan');
    expect(s.identity!.service.status).toBe(volunteer === 'civilian' ? 'not-required' : 'completed');
    expect(serviceMonths(s)).toBe(volunteer === 'civilian' ? 0 : 38);
    expect(s.journal.some(j => j.title === '담당 의사 소개')).toBe(true);
  });
  it.each(['exempt', 'prior-service'] as const)('preserves starting military history %s without inventing a diagnosis', (status: 'exempt' | 'prior-service') => {
    const s = until(configureIdentity(male(), 'male', status), x => x.status === 'completed');
    expect(s.identity!.service.status).toBe(status);
    expect(s.identity!.resolved).not.toContain('service:plan');
    expect(serviceMonths(s)).toBe(0);
  });
  it('preserves old saves and their pending choices without injecting a gender', () => {
    let s = male(); delete s.identity;
    s = until(s, x => x.status === 'completed');
    expect(s.identity).toBeUndefined();
    expect(lifeAge(s)).toBe('77세 0개월');
  });
  it('keeps a service decision and fractional service time intact in storage; rejects corrupted service data', async () => {
    let s = until(male(), x => x.pendingEvent?.randomKey === 'service:plan');
    s = choose(s, 'army');
    s = reduceGame(s, { type: 'control', id: 'resume', paused: false, speed: 1 });
    s = reduceGame(s, { type: 'tick', id: 'fraction', elapsedMs: 123 });
    expect(s.identity!.service.elapsedMs).toBe(123);
    expect(elapsedMonths(s)).toBe(12);
    const db = await openGameDatabase(`identity-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      const restored = (await loadGame(db))!.state;
      expect(restored).toEqual(s);
      const pending = skip(s);
      expect(pending.pendingEvent?.randomKey).toBe('service:daily');
      expect(serviceMonths(pending)).toBe(3);
      await persistGame(db, pending, { runId: s.runId, revision: s.revision });
      expect((await loadGame(db))!.state.pendingEvent).toEqual(pending.pendingEvent);
      const bad = structuredClone(pending); bad.identity!.service.elapsedMs = 999999;
      expect(validState(bad)).toBe(false);
      const badGender = structuredClone(pending); badGender.identity!.gender = 'female';
      expect(validState(badGender)).toBe(false);
      expect(choose(pending, 'unknown')).toBe(pending);
    } finally { db.close(); }
  });
  it('renders short opening controls and service information', () => {
    const s = male();
    const opening = renderToStaticMarkup(<Opening draft={s} busy={false} disabled={false} entering={false} onPrepare={() => {}} onEnter={() => {}} onBack={() => {}}/>);
    expect(opening).not.toContain('starting-gender'); expect(opening).not.toContain('입학 때 병역');
    expect(opening).not.toContain('starting-service');
    expect(opening).toContain(`${s.identity!.name} · 20세`);
    expect(opening).toContain('입학 통지서');
    expect(renderToStaticMarkup(<IdentityPanel game={s}/>)).toContain('남자 · 병역 미이행');
    const scene = (route: 'army' | 'doctor' | 'public-health') => renderToStaticMarkup(<LifeScene stage="university" age={21} month={0} running={false} focus="study" seed={42} relationship="single" serviceRoute={route}/>);
    expect(scene('army')).toContain('부대 생활관');
    expect(scene('doctor')).toContain('군 진료실');
    expect(scene('public-health')).toContain('보건지소');
  });
});
