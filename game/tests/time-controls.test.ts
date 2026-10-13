import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { GameState, TimeSpeed } from '../src/contracts';
import { createGame, reduceGame } from '../src/engine';
import { lifeAge, lifeStartAge } from '../src/random-life';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';

const skip = (s: GameState, id = `skip:${s.revision}`) => reduceGame(s, { type: 'next-choice', id });
function world(s: GameState) {
  const { revision: _revision, processedActionIds: _ids, ...copy } = structuredClone(s);
  if (copy.pendingEvent) copy.pendingEvent.id = 'same-choice';
  copy.life!.paused = true;
  copy.life!.speed = 1;
  if (copy.progress) copy.progress.activeMs = [0, 0, 0, 0];
  return copy;
}
function ordinary(s: GameState, speed: TimeSpeed) {
  s = reduceGame(s, { type: 'control', id: `start:${s.revision}`, paused: false, speed });
  for (let i = 0; i < 4096 && !s.pendingEvent; i++) s = reduceGame(s, { type: 'tick', id: `frame:${s.revision}`, elapsedMs: 1000 });
  expect(s.pendingEvent).not.toBeNull();
  return s;
}

describe('time controls and admission age', () => {
  it.each(['career-preview-v1', 'random-preview-v1'] as const)('starts %s at 20 and accepts a 16x saved game', async (version: GameState['rulesVersion']) => {
    const initial = createGame('age', 42, version);
    expect(lifeAge(initial)).toBe('20세 0개월');
    const fast = reduceGame(initial, { type: 'control', id: '16x', speed: 16 });
    expect(fast.life!.speed).toBe(16);
    expect(validState(fast)).toBe(true);
    const db = await openGameDatabase(`time-${crypto.randomUUID()}`);
    try {
      await persistGame(db, fast, null);
      expect((await loadGame(db))!.state).toEqual(fast);
    } finally { db.close(); }
    const legacy = structuredClone(initial);
    delete legacy.life!.startAge;
    expect(lifeStartAge(legacy)).toBe(19);
    expect(lifeAge(legacy)).toBe('19세 0개월');
    expect(validState(legacy)).toBe(true);
    legacy.life!.startAge = 21 as never;
    expect(validState(legacy)).toBe(false);
  });

  it.each(['career-preview-v1', 'random-preview-v1'] as const)('stops %s at the same first choice at 1x, 16x and skip', (version: GameState['rulesVersion']) => {
    const initial = createGame('same-world', 42, version);
    const snapshot = structuredClone(initial);
    const skipped = skip(initial, 'skip-once');
    expect(initial).toEqual(snapshot);
    expect(world(skipped)).toEqual(world(ordinary(initial, 1)));
    expect(world(skipped)).toEqual(world(ordinary(initial, 16)));
    expect(skipped.life!.paused).toBe(true);
    expect(skipped.life!.speed).toBe(initial.life!.speed);
    expect(skipped.revision).toBe(initial.revision + 1);
    expect(skipped.processedActionIds).toEqual(['skip-once']);
    expect(skip(skipped)).toBe(skipped);
    expect(validState(skipped)).toBe(true);
    const chosen = reduceGame(skipped, { type: 'choose', id: 'choose', eventId: skipped.pendingEvent!.id, choiceId: skipped.pendingEvent!.choices[0].id });
    expect(skip(chosen, 'skip-once')).toBe(chosen);
    expect(skipped.progress?.activeMs ?? []).toEqual(initial.progress?.activeMs ?? []);
  });

  it('preserves monthly money and RNG across a complete career using only next-choice', async () => {
    let s = createGame('whole-life', 42, 'career-preview-v1');
    const keys: string[] = [];
    for (let i = 0; i < 500 && s.status !== 'completed'; i++) {
      if (!s.pendingEvent) {
        const expected = ordinary(s, 16);
        const before = structuredClone(s.progress!.activeMs);
        s = skip(s);
        expect(world(s)).toEqual(world(expected));
        expect(s.progress!.activeMs).toEqual(before);
      } else {
        const event = s.pendingEvent;
        keys.push(event.randomKey!);
        const preferred = event.randomKey === 'funding' ? 'loan'
          : event.randomKey === 'specialty-required' ? 'untrained'
          : event.randomKey === 'marriage-required' ? 'single'
          : event.randomKey?.startsWith('offer-') ? 'decline' : event.choices[0].id;
        s = reduceGame(s, { type: 'choose', id: `choice:${s.revision}`, eventId: event.id, choiceId: preferred });
      }
      expect(validState(s)).toBe(true);
    }
    expect(s.status).toBe('completed');
    expect(keys).toEqual(expect.arrayContaining(['club-required', 'funding', 'specialty-required', 'clinical-case', 'depth-workload', 'stage-end']));
    expect(keys).not.toContain('patient-loss');
    expect(keys).not.toContain('dispute');
    expect(lifeAge(s)).toBe('77세 0개월');
    expect(skip(s)).toBe(s);
    const db = await openGameDatabase(`skipped-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      expect((await loadGame(db))!.state).toEqual(s);
    } finally { db.close(); }
  });

  it('preserves fractional progress, existing active time and speed on skip and reload', async () => {
    let s = createGame('partial', 7, 'career-preview-v1');
    s = reduceGame(s, { type: 'control', id: 'run', paused: false, speed: 4 });
    s = reduceGame(s, { type: 'tick', id: 'partial', elapsedMs: 333 });
    const skipped = skip(s);
    expect(world(skipped)).toEqual(world(ordinary(s, 16)));
    expect(skipped.progress!.activeMs).toEqual(s.progress!.activeMs);
    expect(skipped.life!.speed).toBe(4);
    const db = await openGameDatabase(`partial-${crypto.randomUUID()}`);
    try {
      await persistGame(db, skipped, null);
      expect((await loadGame(db))!.state).toEqual(skipped);
    } finally { db.close(); }
  });
});
