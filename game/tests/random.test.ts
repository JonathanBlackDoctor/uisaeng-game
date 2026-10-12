import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameAction, GameState, Person } from '../src/contracts';
import { createGame, reduceGame } from '../src/engine';
import { createRandomGame, eligibleEvents, generateStart, nextRandom, randomEvent, RANDOM_RULES } from '../src/random-life';
import { archives, loadGame, openGameDatabase, persistGame, validState } from '../src/storage';

const connections: IDBDatabase[] = [];
afterEach(() => { connections.splice(0).forEach(db => db.close()); });
async function database(name = `random-${crypto.randomUUID()}`) {
  const db = await openGameDatabase(name); connections.push(db); return db;
}
const running = (seed = 42, speed: 1 | 2 | 4 | 8 = 1) => reduceGame(createRandomGame('run', seed), { type: 'control', id: 'start', paused: false, speed });
function choose(state: GameState, choiceId: string): GameState {
  return reduceGame(state, { type: 'choose', id: `choice:${state.revision}`, eventId: state.pendingEvent!.id, choiceId });
}
function untilEvent(state: GameState, chunk = 1000): GameState {
  for (let i = 0; i < 150 && !state.pendingEvent; i++) {
    state = reduceGame(state, { type: 'tick', id: `tick:${state.revision}`, elapsedMs: chunk });
  }
  expect(state.pendingEvent).not.toBeNull(); return state;
}
function scene(state: GameState, key: string, person?: Person): GameState {
  const pendingEvent = randomEvent(state, key, person);
  expect(pendingEvent).not.toBeNull(); return { ...state, pendingEvent };
}
const invited: Person = { id: 'run:person:0', name: '지우', temperament: '차분히 듣는 편', occupation: '다른 학교 학생' };
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function world(state: GameState) {
  const { revision: _revision, processedActionIds: _actions, life, ...rest } = state;
  const { speed: _speed, ...lifeWithoutSpeed } = life!;
  return { ...rest, life: lifeWithoutSpeed };
}
function findSeed(predicate: (state: GameState) => boolean): GameState {
  for (let seed = 0; seed < 1000; seed++) { const state = running(seed); if (predicate(state)) return state; }
  throw new Error('No deterministic example within 1000 seeds');
}

describe('random life starting conditions and deterministic progression', () => {
  it('starts the default game paused with a varied, recorded background and four valid stats', () => {
    const starts = Array.from({ length: 64 }, (_, seed) => createGame('run', seed));
    expect(new Set(starts.map(s => JSON.stringify(s.life!.background))).size).toBeGreaterThan(10);
    expect(new Set(starts.map(s => JSON.stringify(s.stats))).size).toBeGreaterThan(10);
    for (const state of starts) {
      expect(state.rulesVersion).toBe('random-preview-v1');
      expect(state.life!.paused).toBe(true);
      expect(state.pendingEvent).toBeNull();
      expect(state.journal[0].detail).toContain(state.life!.background.region);
      if (['제주', '강원권'].includes(state.life!.background.region)) {
        expect(state.life!.background.environment).not.toBe('대도시에서 성장');
      }
      expect(Object.keys(state.stats).sort()).toEqual(['happiness', 'health', 'knowledge', 'relationships']);
      expect(Object.values(state.stats).every(v => v >= 0 && v <= 100)).toBe(true);
      expect(validState(state)).toBe(true);
    }
    expect(generateStart(42)).toEqual(generateStart(42));
    expect(createGame('legacy', 42, 'fixture-v1').life).toBeUndefined();
    expect(createGame('legacy', 42, 'family-preview-v1').life).toBeUndefined();
  });

  it('replays the same seed and actions exactly, never mutates input, and ignores duplicate actions', () => {
    const initial = freeze(running());
    const snapshot = structuredClone(initial);
    const action: GameAction = { type: 'tick', id: 'frame', elapsedMs: 1000 };
    const next = reduceGame(initial, action);
    expect(initial).toEqual(snapshot);
    expect(next).toEqual(reduceGame(snapshot, action));
    expect(reduceGame(next, action)).toBe(next);
    const pending = freeze(untilEvent(next));
    const pendingSnapshot = structuredClone(pending);
    const settled = choose(pending, pending.pendingEvent!.choices[0].id);
    expect(pending).toEqual(pendingSnapshot);
    expect(settled).toEqual(choose(pendingSnapshot, pendingSnapshot.pendingEvent!.choices[0].id));
  });

  it('allows quiet months while still advancing age and the seeded random stream', () => {
    const state = findSeed(s => nextRandom(s.seed).value >= 0.16);
    const next = reduceGame(state, { type: 'tick', id: 'quiet', elapsedMs: 1000 });
    expect(next.pendingEvent).toBeNull();
    expect(next.life!.elapsedMs).toBe(1000);
    expect(next.seed).not.toBe(state.seed);
    expect(next.journal).toEqual(state.journal);
  });

  it('blocks elapsed time during pause or a pending decision, including attempts to change focus', () => {
    const paused = createRandomGame('run', 1);
    expect(reduceGame(paused, { type: 'tick', id: 'paused', elapsedMs: 1000 })).toBe(paused);
    const pending = untilEvent(running());
    expect(reduceGame(pending, { type: 'tick', id: 'blocked', elapsedMs: 1000 })).toBe(pending);
    expect(reduceGame(pending, { type: 'activity', id: 'focus', main: 'connect', supporting: 'rest' })).toBe(pending);
    for (const elapsedMs of [0, -1, 1.5, 1001, NaN]) {
      const state = running();
      expect(reduceGame(state, { type: 'tick', id: 'invalid', elapsedMs })).toBe(state);
    }
  });

  it('draws at simulated monthly boundaries regardless of frame chunks, batching, or speed', () => {
    const monthly = untilEvent(running(42), 1000);
    const frames = untilEvent(running(42), 250);
    const fastFrames = untilEvent(running(42, 8), 125);
    const fastBatch = untilEvent(running(42, 8), 1000);
    expect(world(frames)).toEqual(world(monthly));
    expect(world(fastFrames)).toEqual(world(monthly));
    expect(world(fastBatch)).toEqual(world(monthly));
    expect(monthly.life!.elapsedMs % RANDOM_RULES.monthMs).toBe(0);
  });
});

describe('event eligibility, focus and voluntary relationships', () => {
  it('filters by life stage, family situation, prerequisites and elapsed cooldown', () => {
    const state = running();
    const keys = (s: GameState) => eligibleEvents(s).map(d => d.key);
    expect(keys(state)).toContain('offer-gwating');
    expect(keys(state)).not.toContain('offer-campus');
    expect(keys(state)).not.toContain('marriage');
    const campus = structuredClone(state); campus.life!.flags.push('club');
    expect(keys(campus)).toContain('offer-campus'); expect(keys(campus)).not.toContain('club');
    const career = structuredClone(campus); career.stageIndex = 2; career.life!.elapsedMs = 180_000;
    expect(keys(career)).not.toContain('offer-gwating'); expect(keys(career)).not.toContain('offer-campus');
    career.family = { ...career.family!, status: 'dating', partner: invited, meeting: 'gwating' };
    expect(keys(career)).toContain('marriage'); expect(keys(career)).toContain('parenthood');
    expect(keys(career).some(k => k.startsWith('offer-'))).toBe(false);
    career.life!.seen.marriage = 180;
    expect(keys(career)).not.toContain('marriage');
    career.life!.elapsedMs += RANDOM_RULES.cooldownMonths * RANDOM_RULES.monthMs;
    expect(keys(career)).toContain('marriage');
    career.life!.flags.push('unmarried', 'childfree');
    expect(keys(career)).not.toContain('marriage'); expect(keys(career)).not.toContain('parenthood');
    career.stageIndex = 3;
    expect(keys(career)).toContain('retirement-hobby'); expect(keys(career)).not.toContain('research');
  });

  it('changes candidate weights with focus without immediately generating a choice', () => {
    const study = running();
    const connect = reduceGame(study, { type: 'activity', id: 'connect', main: 'connect', supporting: 'rest' });
    const weight = (s: GameState, key: string) => eligibleEvents(s).find(d => d.key === key)!.weight(s);
    expect(connect.pendingEvent).toBeNull(); expect(connect.seed).toBe(study.seed);
    expect(weight(connect, 'offer-gwating')).toBeGreaterThan(weight(study, 'offer-gwating'));
    expect(weight(study, 'research')).toBeGreaterThan(weight(connect, 'research'));
    expect(eligibleEvents(connect).map(d => d.key)).toEqual(eligibleEvents(study).map(d => d.key));
  });

  it('offers study costs only with constrained finances during education and resolves support by seeded outcome', () => {
    const costKeys = (s: GameState) => eligibleEvents(s).map(d => d.key);
    const apply = (s: GameState, id = 'scholarship') => choose(scene(s, 'study-cost'), id);
    const successful = findSeed(s => s.life!.background.finances === 'tight' && apply(s).life!.flags.includes('scholarship'));
    const unsuccessful = findSeed(s => s.life!.background.finances === 'tight' && !apply(s).life!.flags.includes('scholarship'));
    expect(costKeys(successful)).toContain('study-cost');
    const training = { ...successful, stageIndex: 1, life: { ...successful.life!, elapsedMs: 72_000 } };
    expect(costKeys(training)).toContain('study-cost');
    expect(costKeys({ ...training, stageIndex: 2 })).not.toContain('study-cost');
    const comfortable = findSeed(s => s.life!.background.finances === 'comfortable');
    expect(costKeys(comfortable)).not.toContain('study-cost');
    const supported = apply(successful);
    expect(supported.seed).not.toBe(successful.seed);
    expect(costKeys(supported)).not.toContain('study-cost');
    expect(supported.journal.at(-1)!.detail).toContain('지원을 받아');
    const declined = apply(unsuccessful);
    expect(declined.life!.flags).not.toContain('scholarship');
    expect(costKeys(declined)).toContain('study-cost');
    expect(apply(successful, 'share').life!.flags).not.toContain('scholarship');
    expect(apply(successful)).toEqual(supported);
    expect(apply(unsuccessful)).toEqual(declined);
    expect(validState(supported)).toBe(true);
  });

  it('makes close family support affect the chance of contact without deciding a response', () => {
    const close = findSeed(s => s.life!.background.support === 'close');
    const limited = findSeed(s => s.life!.background.support === 'limited');
    const homeWeight = (s: GameState) => eligibleEvents(s).find(d => d.key === 'home')!.weight(s);
    expect(homeWeight(close)).toBeGreaterThan(homeWeight(limited));
    expect(randomEvent(close, 'home')!.choices.map(c => c.id)).toEqual(randomEvent(limited, 'home')!.choices.map(c => c.id));
    expect(close.family!.status).toBe('single');
  });

  it.each(['offer-gwating', 'offer-blind-date', 'offer-campus'])('%s presents one concrete invitation and declining preserves independence', (key: string) => {
    const state = scene(running(), key, invited);
    expect(state.pendingEvent!.person).toEqual(invited);
    expect(state.pendingEvent!.choices.map(c => c.id)).toEqual(['accept', 'brief', 'decline']);
    expect(state.pendingEvent!.choices.some(c => ['gwating', 'blind-date', 'campus'].includes(c.id))).toBe(false);
    const declined = choose(state, 'decline');
    expect(declined.family!.status).toBe('single'); expect(declined.family!.partner).toBeUndefined();
    expect(declined.seed).toBe(state.seed);
    expect(declined.pendingEvent).toBeNull();
  });

  it('can retain contact after an invitation or end without interest, deterministically', () => {
    const settle = (s: GameState) => choose(scene(s, 'offer-gwating', invited), 'accept');
    const interested = findSeed(s => !!settle(s).family!.partner);
    const uninterested = findSeed(s => !settle(s).family!.partner);
    expect(settle(interested).family).toMatchObject({ status: 'single', partner: invited, meeting: 'gwating' });
    expect(settle(uninterested).family).toMatchObject({ status: 'single', meeting: null });
    expect(settle(interested)).toEqual(settle(interested));
    expect(settle(uninterested)).toEqual(settle(uninterested));
  });

  it('requires mutual interest and retains the same partner through dating and family decisions', () => {
    const acquaintance = (s: GameState) => scene({ ...s, family: { ...s.family!, meeting: 'gwating', partner: invited } }, 'acquaintance');
    const mutual = findSeed(s => choose(acquaintance(s), 'date').family!.status === 'dating');
    const noInterest = findSeed(s => choose(acquaintance(s), 'date').family!.status === 'single');
    let dating = choose(acquaintance(mutual), 'date');
    expect(dating.family!.partner).toEqual(invited);
    expect(choose(acquaintance(noInterest), 'date').family!.partner).toBeUndefined();
    expect(choose(acquaintance(mutual), 'friends').family!.status).toBe('single');
    dating = choose(scene(dating, 'relationship'), 'talk');
    expect(dating.family!.partner).toEqual(invited);
    dating = { ...dating, stageIndex: 1, life: { ...dating.life!, elapsedMs: 72_000 } };
    dating = choose(scene(dating, 'marriage'), 'stay');
    dating = choose(scene(dating, 'parenthood'), 'childfree');
    expect(dating.family).toMatchObject({ status: 'dating', children: 'none', partner: invited });
    expect(eligibleEvents(dating).map(d => d.key)).not.toContain('marriage');
    expect(eligibleEvents(dating).map(d => d.key)).not.toContain('parenthood');
    const married = choose(scene({ ...dating, life: { ...dating.life!, flags: [] } }, 'marriage'), 'marry');
    const parent = choose(scene(married, 'parenthood'), 'child');
    expect(parent.family).toMatchObject({ status: 'married', children: 'young', partner: invited });
  });
});

describe('random-life persistence and complete journeys', () => {
  it.each([1, 2])('generates adult blind-date invitations in stage %i and rejects a forged student occupation', async (stageIndex: number) => {
    const laterState = (s: GameState) => ({ ...s, stageIndex, life: { ...s.life!, elapsedMs: stageIndex === 1 ? 72_000 : 144_000 } });
    const seed = findSeed(s => untilEvent(laterState(s)).pendingEvent!.randomKey === 'offer-blind-date');
    const invitation = untilEvent(laterState(seed));
    expect(invitation.pendingEvent!.person!.occupation).toBe('다른 분야에서 일하는 사람');
    expect(validState(invitation)).toBe(true);
    const db = await database(); await persistGame(db, invitation, null);
    expect((await loadGame(db))!.state).toEqual(invitation);
    const forged = structuredClone(invitation); forged.pendingEvent!.person!.occupation = '같은 학교 학생';
    expect(validState(forged)).toBe(false);
    await expect(persistGame(db, forged, invitation)).rejects.toThrow();
    expect((await loadGame(db))!.state).toEqual(invitation);
  });

  it('reopens background, pending invitation, person and RNG with identical subsequent outcomes', async () => {
    let state: GameState | undefined;
    for (let seed = 0; seed < 100 && !state; seed++) {
      let candidate = running(seed);
      for (let step = 0; step < 30; step++) {
        candidate = untilEvent(candidate);
        if (candidate.pendingEvent!.person) { state = candidate; break; }
        candidate = choose(candidate, candidate.pendingEvent!.choices[0].id);
      }
    }
    expect(state).toBeDefined();
    const original = state!; const db = await database();
    await persistGame(db, original, null); const name = db.name; db.close();
    const reopened = await database(name); const restored = (await loadGame(reopened))!.state;
    expect(restored).toEqual(original);
    const next = choose(original, 'accept'); const resumed = choose(restored, 'accept');
    expect(resumed).toEqual(next);
    expect(untilEvent(resumed)).toEqual(untilEvent(next));
    await persistGame(reopened, resumed, restored);
    expect((await loadGame(reopened))!.state).toEqual(resumed);
  });

  it('rejects forged random state and pending choices without overwriting the last save', async () => {
    const db = await database(); const state = untilEvent(running());
    await persistGame(db, state, null);
    const corruptions: Array<(s: GameState) => void> = [
      s => { s.life!.elapsedMs = -1; }, s => { s.life!.elapsedMs = NaN; },
      s => { s.life!.contacts = -1; }, s => { s.life!.contacts = 21; },
      s => { s.life!.initialSeed = -1; }, s => { s.life!.speed = 3 as never; },
      s => { s.life!.focus.supporting = s.life!.focus.main; },
      s => { s.life!.background.finances = 'forged' as never; },
      s => { s.life!.seen.home = 100_000; }, s => { s.life!.seen.home = -1; },
      s => { s.pendingEvent!.randomKey = 'forged'; },
      s => { s.pendingEvent!.title = 'Forged event'; },
      s => { s.pendingEvent!.choices[0].effects = { health: 99 }; },
      s => { s.pendingEvent!.person = { ...invited, name: '' }; },
    ];
    for (const corrupt of corruptions) {
      const forged = structuredClone(state); corrupt(forged);
      expect(validState(forged)).toBe(false);
      await expect(persistGame(db, forged, state)).rejects.toThrow();
    }
    expect((await loadGame(db))!.state).toEqual(state);
  });

  it.each([1, 42, 314])('completes seed %i with valid saves, no forced marriage/children, and one durable archive', async (seed: number) => {
    let state = running(seed, 8); let decisions = 0;
    for (let guard = 0; guard < 1200 && state.status !== 'completed'; guard++) {
      expect(validState(state)).toBe(true);
      if (state.pendingEvent) {
        const key = state.pendingEvent.randomKey;
        const safeChoice = key?.startsWith('offer-') ? 'decline' : key === 'acquaintance' ? 'friends' : key === 'marriage' ? 'stay' : key === 'parenthood' ? 'childfree' : state.pendingEvent.choices[0].id;
        state = choose(state, safeChoice); decisions++;
      } else state = reduceGame(state, { type: 'tick', id: `journey:${state.revision}`, elapsedMs: 1000 });
    }
    expect(state.status).toBe('completed'); expect(decisions).toBeGreaterThan(4);
    expect(state.stageIndex).toBe(3); expect(state.life!.elapsedMs).toBe(684_000);
    expect(state.family).toMatchObject({ status: 'single', children: 'none' });
    expect(state.life!.paused).toBe(true); expect(validState(state)).toBe(true);
    expect(reduceGame(state, { type: 'control', id: 'after-end', paused: false })).toBe(state);
    const db = await database(); await persistGame(db, state, null); await persistGame(db, state, state);
    expect((await loadGame(db))!.state).toEqual(state);
    expect(await archives(db)).toHaveLength(1);
    expect((await archives(db))[0].state).toEqual(state);
  });
});
