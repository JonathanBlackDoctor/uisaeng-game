import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCareerGame } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { setStartingLength, condensedStory, careerMonthMs } from '../src/pacing';
import { academicCredits, academicRank, validJourney } from '../src/specialty-journey';
import { openGameDatabase, persistGame, loadGame, validState } from '../src/storage';
import { measureRun } from './helpers/pacing';
import type { GameState } from '../src/contracts';

function academicStart(condensed = true) {
  let s = createCareerGame('condensed-academic', 3);
  if (condensed) s = setStartingLength(s, 'short');
  else s.progress!.runLength = 'short'; // Existing version-2 save.
  return s;
}
function until(s: GameState, stop: (s: GameState) => boolean): GameState {
  for (let n = 0; n < 150; n++) {
    if (stop(s)) return s;
    if (!s.pendingEvent) s = reduceGame(s, { type: 'next-choice', id: `jump:${s.revision}` });
    else {
      const e = s.pendingEvent, key = e.randomKey!, pick = (...ids: string[]) => ids.find(id => e.choices.some(c => c.id === id)) ?? e.choices[0].id;
      const choiceId = key === 'funding' ? pick('education-plan', 'loan')
        : key === 'practice-required' || key === 'journey:route' ? pick('research')
        : key === 'marriage-required' ? pick('single', 'stay')
        : key.startsWith('offer-') ? pick('decline') : e.choices[0].id;
      s = reduceGame(s, { type: 'choose', id: `choice:${s.revision}`, eventId: e.id, choiceId });
    }
    expect(validState(s), `${s.life!.elapsedMs}:${s.pendingEvent?.randomKey}`).toBe(true);
  }
  throw Error('Expected academic decision was not reached');
}

describe('condensed default story', () => {
  it('opts new drafts in while preserving the long option, old saves and clock', () => {
    const base = createCareerGame('draft', 3), short = setStartingLength(base, 'short');
    expect(condensedStory(short)).toBe(true); expect(base.journey!.version).toBe(2);
    expect(careerMonthMs(short)).toBe(3900);
    const long = setStartingLength(short, 'standard'); expect(long.journey!.version).toBe(2);
    expect(careerMonthMs(long)).toBe(7800);
    const old = academicStart(false); expect(condensedStory(old)).toBe(false); expect(validState(old)).toBe(true);
    const started = reduceGame(short, { type: 'control', id: 'start', paused: false });
    expect(setStartingLength(started, 'standard')).toBe(started);
  });

  it('offers one combined term, restores it exactly and leaves rest/exit as real choices', async () => {
    const pending = until(academicStart(), s => s.pendingEvent?.randomKey === 'journey:academic:0:term');
    const db = await openGameDatabase(`condensed-${crypto.randomUUID()}`);
    try {
      await persistGame(db, pending, null);
      const restored = (await loadGame(db))!.state; expect(restored).toEqual(pending);
      expect(reduceGame(restored, { type: 'tick', id: 'blocked', elapsedMs: 1000 })).toBe(restored);
      for (const id of ['lead', 'team', 'rest', 'leave']) {
        const chosen = reduceGame(restored, { type: 'choose', id: `term-${id}`, eventId: restored.pendingEvent!.id, choiceId: id });
        expect(validState(chosen)).toBe(true);
        expect(academicCredits(chosen, 0)).toEqual(['lead', 'team'].includes(id) ? { research: 2, teaching: 2, clinical: 2 } : { research: 0, teaching: 0, clinical: 0 });
        expect(Object.keys(chosen.journey!.decisions).filter(k => k.startsWith('academic:0:'))).toEqual(['academic:0:term']);
        if (id === 'rest') {
          const review = until(chosen, s => s.pendingEvent?.randomKey === 'journey:review:0:0');
          expect(review.pendingEvent!.choices.some(c => c.id === 'promote')).toBe(false);
        }
        if (id === 'leave') expect(academicRank(until(chosen, s => s.status === 'completed'))).toBe(0);
      }
      const forged = structuredClone(restored);
      forged.journey!.decisions['review:0:0'] = { choice: 'promote', month: Math.floor(forged.life!.elapsedMs / 1000), followed: false };
      expect(validJourney(forged)).toBe(false);
    } finally { db.close(); }
  }, 30000);

  it('keeps an existing version-2 academic episode on its original three-part sequence', async () => {
    const pending = until(academicStart(false), s => s.pendingEvent?.randomKey === 'journey:academic:0:research');
    const db = await openGameDatabase(`old-academic-${crypto.randomUUID()}`);
    try {
      await persistGame(db, pending, null); const restored = (await loadGame(db))!.state;
      expect(restored.pendingEvent).toEqual(pending.pendingEvent);
      const next = reduceGame(restored, { type: 'choose', id: 'old-research', eventId: restored.pendingEvent!.id, choiceId: 'lead' });
      const teaching = until(next, s => s.pendingEvent?.randomKey === 'journey:academic:0:teaching');
      expect(teaching.journey!.version).toBe(2); expect(validState(teaching)).toBe(true);
    } finally { db.close(); }
  }, 30000);

  it('finishes the professor path with three terms, three promotions and the connected ending', () => {
    const result = measureRun(3, 'academic', true, 16, 'short');
    expect(result.keys.filter(k => /^journey:academic:\d:term$/.test(k))).toHaveLength(3);
    expect(result.keys.filter(k => /^journey:academic:\d:(teaching|clinical|research)$/.test(k))).toHaveLength(0);
    expect(academicRank(result.state)).toBe(3); expect(result.keys).toContain('journey:legacy');
    expect(result.keys).toContain('story:peer-retirement');
    expect(Object.values(result.state.journey!.decisions).every(d => d.followed)).toBe(true);
    expect(result.keys.length).toBeLessThanOrEqual(34);
  }, 30000);
});
