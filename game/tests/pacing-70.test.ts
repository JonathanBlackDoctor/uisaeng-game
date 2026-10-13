import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { careerMonthMs, pacingArc } from '../src/pacing';
import { LIFE_STORIES, initialStories, requiredStory, STORY_RULES, upgradeStoryPeople } from '../src/life-stories';
import { SPECIALTIES } from '../src/career';
import { openGameDatabase, persistGame, loadGame, validState } from '../src/storage';
import { measureRun } from './helpers/pacing';

describe('70 percent pacing with intact content', () => {
  it('keeps all authored story types reachable across seeds and specialties', () => {
    const reached = new Set<string>();
    for (let seed = 0; seed < 512; seed++) {
      const s = createCareerGame('coverage', seed); s.stories = initialStories(); upgradeStoryPeople(s);
      s.career!.application = 'accepted'; s.career!.practice = 'employed';
      s.career!.specialty = SPECIALTIES[seed % SPECIALTIES.length].id; s.campus!.club = 'basketball';
      for (let stage = 0; stage < 4; stage++) {
        s.stageIndex = stage;
        for (let slot = 0; slot < 3; slot++) {
          s.life!.elapsedMs = ([0,72,144,564][stage] + STORY_RULES.spacing[stage] * (slot+1)) * 1000;
          const key = requiredStory(s); if (!key) break;
          const id = key.slice(6), event = careerEvent(s, key)!;
          reached.add(id); s.stories!.decisions[id] = { choice: event.choices[0].id, month: s.life!.elapsedMs / 1000, followed: false };
        }
      }
    }
    expect([...reached].sort()).toEqual(LIFE_STORIES.map(s => s.id).sort());
  });

  it.each(['untrained', 'specialist', 'academic'] as const)('reduces %s while finishing its chosen arc and every follow-up', (mode: 'untrained' | 'specialist' | 'academic') => {
    const before = measureRun(3, mode, false), after = measureRun(3, mode);
    expect(after.keys.length).toBeLessThan(before.keys.length);
    const time = (x: typeof after) => x.activeSeconds + x.keys.length * 20;
    expect(time(after) / time(before)).toBeGreaterThan(0.60);
    expect(time(after) / time(before)).toBeLessThan(0.78);
    expect(after.keys).toEqual(expect.arrayContaining(['club-required', 'specialty-required', 'marriage-required', 'practice-required']));
    const arc = pacingArc(after.state) === 'peer' ? ['peer-seat','peer-distance','peer-offer','peer-retirement'] : ['shared-notebook','notebook-return','notebook-handover','notebook-ending'];
    expect(after.keys).toEqual(expect.arrayContaining(arc.map(id => `story:${id}`)));
    expect(Object.values(after.state.stories!.decisions).every(d => d.followed)).toBe(true);
    expect(after.state.progress!.activeMs[0] / after.state.progress!.activeMs.reduce((a,b)=>a+b,0)).toBeGreaterThan(0.5);
  }, 20000);

  it('keeps the same choices and outcomes at 1x and 16x', () => {
    const slow = measureRun(2, 'specialist', true, 1), fast = measureRun(2, 'specialist');
    expect(slow.keys).toEqual(fast.keys);
    expect(slow.state.stats).toEqual(fast.state.stats);
    expect(slow.state.seed).toBe(fast.state.seed);
    expect(slow.state.stories).toEqual(fast.state.stories);
    expect(slow.state.journey).toEqual(fast.state.journey);
  }, 20000);

  it.each([false, true])('restores fractional progress and an open choice (compact=%s)', async (compact: boolean) => {
    let s = createCareerGame(`restore-${compact}`, 42);
    if (!compact) delete s.progress!.pacingVersion;
    s.life!.paused = false;
    s = reduceGame(s, { type: 'tick', id: 'fraction', elapsedMs: 17 });
    const db = await openGameDatabase(`pacing-${compact}-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      const restored = (await loadGame(db))!.state;
      expect(restored).toEqual(s);
      expect(careerMonthMs(restored)).toBe(compact ? 3900 : 6000);
      const pending = reduceGame(restored, { type: 'next-choice', id: 'next' });
      await persistGame(db, pending, { runId: s.runId, revision: s.revision });
      expect((await loadGame(db))!.state).toEqual(pending);
      expect(reduceGame(pending, { type: 'tick', id: 'blocked', elapsedMs: 1000 })).toBe(pending);
      const e = pending.pendingEvent!;
      const next = reduceGame(pending, { type: 'choose', id: 'choose', eventId: e.id, choiceId: e.choices[0].id });
      expect(validState(next)).toBe(true);
      expect(next.progress!.pacingVersion).toBe(compact ? 1 : undefined);
    } finally { db.close(); }
  });

  it('rejects an unknown pacing version', () => {
    const s = createCareerGame('invalid', 1); s.progress!.pacingVersion = 2 as never;
    expect(validState(s)).toBe(false);
  });
});
