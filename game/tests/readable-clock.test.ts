import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { reduceGame } from '../src/engine';
import { createCareerGame } from '../src/career-runtime';
import { careerMonthMs } from '../src/pacing';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import { clinicScenario } from './helpers/clinic-scenario';

describe('readable 1x clock', () => {
  it.each([0, 2])('restores the largest previous default residue at a month boundary (stage %s)', async stage => {
    const old = stage === 0 ? createCareerGame('old-default', 42) : clinicScenario();
    old.progress!.runLength = 'short';
    old.life!.paused = false;
    old.life!.speed = 1;
    old.life!.elapsedMs += 999;
    old.progress!.remainder = stage === 0 ? 3899 : 1999;
    expect(validState(old)).toBe(true);
    const invalid = structuredClone(old); invalid.progress!.remainder++;
    expect(validState(invalid)).toBe(false);
    const db = await openGameDatabase(`shorter-default-${stage}-${crypto.randomUUID()}`);
    try {
      await persistGame(db, old, null);
      const restored = (await loadGame(db))!.state;
      expect(restored).toEqual(old);
      const next = reduceGame(restored, { type: 'tick', id: 'resume', elapsedMs: 500 });
      expect(validState(next)).toBe(true);
      expect(next.life!.elapsedMs).toBeGreaterThanOrEqual(old.life!.elapsedMs);
      expect(next.life!.elapsedMs - old.life!.elapsedMs).toBeLessThan(1000);
      expect(next.progress!.activeMs[stage]).toBeGreaterThanOrEqual(old.progress!.activeMs[stage]);
      expect(next.progress!.remainder).toBeLessThan(careerMonthMs(next));
      await persistGame(db, next, { runId: old.runId, revision: old.revision });
      expect((await loadGame(db))!.state).toEqual(next);
    } finally { db.close(); }
  });

  it.each(['short', 'standard'] as const)('does not skip a month in one UI frame (%s)', length => {
    let s = clinicScenario(); s.progress!.runLength = length;
    const start = s.life!.elapsedMs, duration = length === 'short' ? 2000 : 4000;
    for (let ms = 500; ms <= duration; ms += 500) {
      s = reduceGame(s, { type: 'tick', id: `frame:${ms}`, elapsedMs: 500 });
      expect(s.life!.elapsedMs - start).toBe(Math.floor(ms * 1000 / duration));
      expect(validState(s)).toBe(true);
    }
    expect(s.life!.elapsedMs - start).toBe(1000);
    expect(s.progress!.activeMs[2]).toBe(duration);
  });

  it.each(['short', 'standard'] as const)('loads a pre-change fractional month and continues without a jump (%s)', async length => {
    const old = clinicScenario(); old.progress!.runLength = length;
    old.life!.elapsedMs += 233;
    old.progress!.remainder = length === 'short' ? 162 : 324;
    const db = await openGameDatabase(`readable-clock-${crypto.randomUUID()}`);
    try {
      await persistGame(db, old, null);
      const restored = (await loadGame(db))!.state;
      expect(restored).toEqual(old);
      const next = reduceGame(restored, { type: 'tick', id: 'continue', elapsedMs: 500 });
      expect(next.life!.elapsedMs - old.life!.elapsedMs).toBe(Math.floor((500_000 + old.progress!.remainder) / careerMonthMs(old)));
      expect(validState(next)).toBe(true);
      const paused = reduceGame(next, { type: 'control', id: 'pause', paused: true });
      expect(reduceGame(paused, { type: 'tick', id: 'wait', elapsedMs: 1000 })).toBe(paused);
    } finally { db.close(); }
  });
});
