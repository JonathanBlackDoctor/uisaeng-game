import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { SPECIALTIES } from '../src/career';
import { SPECIALTY_PATHS, RESEARCH_DEPARTMENTS } from '../src/specialty-paths';
import { academicCredits, academicRank, advanceJourney, fellowshipComplete, initialJourney, journeyEvent, journeySummary, requiredJourney, settleJourney, upgradeJourney, validJourney } from '../src/specialty-journey';
import SpecialtyJourneyPanel from '../src/SpecialtyJourneyPanel';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import type { GameState } from '../src/contracts';

function trainee(id = 'internal', since = 72) {
  const s = createCareerGame(`journey-${id}`, 42);
  s.stageIndex = 1;
  Object.assign(s.career!, { specialty: id, institution: 'snuh', application: 'accepted', attempts: 1, practice: 'undecided' });
  Object.assign(s.progress!, { trainingStartMonth: 72, club: 'declined', marriage: 'settled' });
  Object.assign(s.life!, { elapsedMs: since * 1000, paused: false });
  s.journey = initialJourney(since);
  return s;
}
function month(s: GameState, m: number) {
  s.life!.elapsedMs = m * 1000;
  s.stageIndex = m < 144 ? 1 : m < 564 ? 2 : 3;
  if (s.stageIndex === 2 && s.career!.practice === 'undecided') s.career!.practice = 'employed';
  advanceJourney(s);
}
function take(s: GameState, key: string, id: string) {
  expect(requiredJourney(s)).toBe(`journey:${key}`);
  expect(settleJourney(s, `journey:${key}`, id), `${key}:${id}`).toBe(true);
  expect(validJourney(s), `invalid ${key}:${id} at ${s.life!.elapsedMs}`).toBe(true);
}
function run(s: GameState, pick: (key: string, s: GameState) => string | undefined = () => undefined, until = 550) {
  for (let m = Math.floor(s.life!.elapsedMs / 1000) + 1; m <= until; m++) {
    month(s, m);
    const full = requiredJourney(s); if (!full) continue;
    const event = journeyEvent(s, full)!;
    const key = full.slice(8), id = pick(key, s) ?? event.choices[0].id;
    expect(event.choices.some(c => c.id === id), `${key}:${id}`).toBe(true);
    expect(settleJourney(s, full, id)).toBe(true);
    expect(validJourney(s), `${key} at ${m}`).toBe(true);
  }
  return s;
}
describe('specialty stories, fellowships and academic careers', () => {
  it('covers all 26 clinical specialties with four authored chapters and unique fields', () => {
    expect(Object.keys(SPECIALTY_PATHS).sort()).toEqual(SPECIALTIES.map(s => s.id).sort());
    const titles = Object.values(SPECIALTY_PATHS).flatMap(p => p.scenes.map(s => s.title));
    expect(titles).toHaveLength(104); expect(new Set(titles).size).toBe(104);
    for (const p of Object.values(SPECIALTY_PATHS)) {
      expect(p.scenes).toHaveLength(4); expect(p.fields.length).toBeGreaterThanOrEqual(3);
      expect(new Set(p.fields.map(f => f.id)).size).toBe(p.fields.length);
      for (const s of p.scenes) { expect(s.body).toBeTruthy(); expect(s.choices).toHaveLength(4); expect(s.choices.every(Boolean)).toBe(true); }
    }
    expect(RESEARCH_DEPARTMENTS).toHaveLength(10);
  });
  it.each(SPECIALTIES.map(s => s.id))('%s reaches its own fellowship, all four chapters and full professor', (id: string) => {
    const s = run(trainee(id));
    expect(Object.keys(s.journey!.decisions).filter(k => k.startsWith('scene:'))).toHaveLength(4);
    expect(fellowshipComplete(s)).toBe(true);
    expect(academicRank(s)).toBe(3);
    expect(s.journey!.decisions.legacy).toBeDefined();
    expect(journeySummary(s).field).toBe(SPECIALTY_PATHS[id].fields[0].name);
    expect(s.journal.filter(e => e.id.startsWith('auto:journey:'))).toHaveLength(4);
    expect(renderToStaticMarkup(<SpecialtyJourneyPanel game={s}/>)).toContain('정교수');
  });
  it('each field creates its own case and survives a JSON round trip', () => {
    for (const id of Object.keys(SPECIALTY_PATHS)) for (const f of SPECIALTY_PATHS[id].fields) {
      const s = run(trainee(id), (key, state) => {
        if (key === 'fellow-case') expect(journeyEvent(state, `journey:${key}`)!.body).toContain(f.problem);
        return key === 'field' ? f.id : undefined;
      }, 166);
      month(s, 167);
      // Reach case without consuming it; different fields must retain different problems.
      const caseKey = requiredJourney(s);
      const entry = s.journey!.decisions['fellow-case'];
      expect(entry || caseKey === 'journey:fellow-case').toBeTruthy();
      expect(journeySummary(s).field).toBe(f.name);
      expect(validJourney(JSON.parse(JSON.stringify(s)))).toBe(true);
    }
  });
  it.each(RESEARCH_DEPARTMENTS.map(d => d.id))('new %s research department supports the professor route without a clinical qualification', (id: string) => {
    const s = trainee(); s.career!.specialty = null; s.career!.application = 'untrained'; s.career!.practice = 'research';
    month(s, 144); s.journey = initialJourney(144);
    run(s, key => key === 'route' ? 'research' : key === 'department' ? id : undefined);
    expect(academicRank(s)).toBe(3); expect(fellowshipComplete(s)).toBe(false);
    expect(journeySummary(s).field).toBe(RESEARCH_DEPARTMENTS.find(d => d.id === id)!.name);
  });
  it('earlier choices change later prose and unlock the experience choice', () => {
    for (const choice of ['lead', 'team', 'rest']) {
      const s = trainee(); month(s, 82); take(s, 'scene:0', choice); month(s, 104);
      const event = journeyEvent(s, requiredJourney(s)!)!;
      expect(event.body).toContain(SPECIALTY_PATHS.internal.scenes[0].title);
      expect(event.choices.some(c => c.id === 'reuse')).toBe(choice !== 'rest');
    }
  });
  it('requires additional fellowship work and academic evidence after lighter commitments', () => {
    const s = run(trainee(), key => key === 'fellow-case' || key === 'fellow-project' ? 'team' : key.startsWith('academic:') ? 'rest' : undefined);
    expect(s.journey!.decisions['fellow-review:0'].choice).toBe('prepare');
    expect(s.journey!.decisions['fellow-review:1'].choice).toBe('qualify');
    expect(academicRank(s)).toBe(3);
    for (let rank = 0; rank < 3; rank++) expect(academicCredits(s, rank)).toEqual({ research: 2, teaching: 2, clinical: 2 });
    const forged = structuredClone(s); forged.journey!.decisions['fellow-review:0'].choice = 'qualify';
    expect(validJourney(forged)).toBe(false);
    const skipped = structuredClone(s); delete skipped.journey!.decisions['academic:0:teaching'];
    expect(validJourney(skipped)).toBe(false);
  });
  it('general practice, fellowship withdrawal and leaving academia stop later credentials', () => {
    for (const [key, id] of [['route', 'general'], ['fellow-case', 'exit'], ['academic:0:research', 'leave']]) {
      const s = run(trainee(), k => k === key ? id : undefined);
      expect(academicRank(s)).toBeLessThan(1);
      expect(s.journey!.decisions.legacy).toBeUndefined();
      if (id === 'exit') expect(fellowshipComplete(s)).toBe(false);
    }
  });
  it('old saves start now, cannot gain retrospective progress, and reject malformed histories', () => {
    const s = trainee(); month(s, 300); delete s.journey;
    expect(validJourney(s)).toBe(true); upgradeJourney(s);
    expect(requiredJourney(s)).toBeNull(); expect(s.journey!.since).toBe(300);
    month(s, 306); expect(requiredJourney(s)).toBe('journey:route');
    const malformed = structuredClone(s); (malformed.journey as unknown as { decisions: unknown }).decisions = [];
    expect(validJourney(malformed)).toBe(false);
  });
  it('supports research after repeated rejected applications with a retained specialty', () => {
    const s = trainee(); s.career!.application = 'rejected'; s.career!.practice = 'research';
    s.progress!.trainingStartMonth = 156; month(s, 228); s.stageIndex = 2; s.journey = initialJourney(228);
    run(s, key => key === 'route' ? 'research' : undefined);
    expect(academicRank(s)).toBe(3); expect(fellowshipComplete(s)).toBe(false);
  });
  it('restores a training decision chosen exactly at the transition boundary', () => {
    const s = trainee('internal', 134); s.life!.elapsedMs = 144000;
    take(s, 'scene:0', 'lead');
    expect(validJourney(JSON.parse(JSON.stringify(s)))).toBe(true);
  });
  it('can keep an existing research career without entering the professor track', () => {
    const s = trainee(); s.career!.application = 'untrained'; s.career!.specialty = null; s.career!.practice = 'research';
    month(s, 144); s.journey = initialJourney(144);
    run(s, key => key === 'route' ? 'general' : undefined);
    expect(academicRank(s)).toBe(-1); expect(s.career!.practice).toBe('research');
  });
  it('plays a full professor career through the real reducer with pause, reload and speed parity', () => {
    const play = (speed: 1 | 16) => {
      let s = trainee(); s.life!.speed = speed;
      let restoredReview = false;
      for (let i = 0; i < 8000 && s.status !== 'completed'; i++) {
        const event = s.pendingEvent;
        if (event) {
          if (event.randomKey?.startsWith('journey:review:')) {
            const copy = JSON.parse(JSON.stringify(s)); expect(validState(copy)).toBe(true); s = copy; restoredReview = true;
          }
          const preferred = event.randomKey === 'funding' ? event.choices.some(c => c.id === 'pay-due') ? 'pay-due' : 'loan' : event.randomKey === 'marriage-required' ? 'single' : event.randomKey?.startsWith('offer-') ? 'decline' : event.choices[0].id;
          s = reduceGame(s, { type: 'choose', id: `c:${s.revision}`, eventId: event.id, choiceId: preferred });
        } else s = reduceGame(s, { type: 'tick', id: `t:${s.revision}`, elapsedMs: 500 });
        expect(validState(s), `invalid at ${s.life!.elapsedMs} ${s.pendingEvent?.randomKey}`).toBe(true);
      }
      expect(s.status).toBe('completed'); expect(academicRank(s)).toBe(3); expect(restoredReview).toBe(true);
      expect(s.journal.some(e => e.id === 'auto:journey:recap')).toBe(true);
      return s;
    };
    const normal = play(1), fast = play(16);
    expect(normal.journey).toEqual(fast.journey); expect(normal.economy).toEqual(fast.economy); expect(normal.stats).toEqual(fast.stats); expect(normal.seed).toBe(fast.seed);
  }, 60000);
  it('actual reducer pauses for a story, prevents replay and restores an open decision from IndexedDB', async () => {
    const s = trainee(); month(s, 82); s.pendingEvent = careerEvent(s, 'journey:scene:0');
    expect(s.pendingEvent).not.toBeNull(); expect(validState(s)).toBe(true);
    expect(reduceGame(s, { type: 'tick', id: 'tick', elapsedMs: 500 })).toBe(s);
    const db = await openGameDatabase(`journey-${Date.now()}`); await persistGame(db, s, null);
    const restored = (await loadGame(db))!.state; expect(restored).toEqual(s);
    const action = { type: 'choose' as const, id: 'choose-once', eventId: restored.pendingEvent!.id, choiceId: 'lead' };
    const after = reduceGame(restored, action);
    expect(after.journey!.decisions['scene:0'].choice).toBe('lead');
    expect(reduceGame(after, action)).toBe(after);
    expect(validState(after)).toBe(true); db.close();
  });
});
