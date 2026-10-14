import 'fake-indexeddb/auto';
import { afterAll, expect, it } from 'vitest';
// @ts-expect-error Optional Vitest report writer; the app has no Node type dependency.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createCareerGame } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { configureIdentity } from '../src/identity';
import { PROFESSION_IDS } from '../src/professions';
import { setStartingLength } from '../src/pacing';
import { elapsedMonths } from '../src/random-life';
import { validState, openGameDatabase, persistGame, loadGame } from '../src/storage';
import { chooseProfessionEvent } from './helpers/profession-play';

const measurements: unknown[] = [];
declare const process: { env: Record<string, string | undefined> };
const output = process.env.PROFESSION_QA_OUTPUT;
afterAll(() => { if (output) { mkdirSync(output, { recursive: true }); writeFileSync(`${output}/comparison.json`, JSON.stringify(measurements, null, 2)); } });

it.each([3,42].flatMap(seed => PROFESSION_IDS.flatMap(profession => (['short', 'standard'] as const).map(length => ({ profession, length, seed })))) )('$profession / $length / $seed completes with restorable decisions and a comparable play log', async ({ profession, length, seed }) => {
  let s = configureIdentity(setStartingLength(createCareerGame(`quality-${profession}-${length}-${seed}`, seed, profession), length), 'female');
  s.life!.paused = false; s.life!.speed = 16;
  const events: { key: string; month: number; stage: number; choices: number }[] = [];
  const stages = new Set<number>();
  const checkpoints = new Set<number>();
  const active = [0, 0, 0, 0];
  const db = await openGameDatabase(`comparison-${profession}-${length}-${crypto.randomUUID()}`);
  let previousRevision: { runId: string; revision: number } | null = null;
  try {
    for (let i = 0; i < 6000 && s.status !== 'completed'; i++) {
      stages.add(s.stageIndex);
      if (s.pendingEvent) {
        const e = s.pendingEvent, key = e.randomKey!;
        events.push({ key, month: elapsedMonths(s), stage: s.stageIndex, choices: e.choices.length });
        if (!checkpoints.has(s.stageIndex)) {
          expect(validState(s)).toBe(true);
          await persistGame(db, s, previousRevision); previousRevision = { runId: s.runId, revision: s.revision };
          const restored = (await loadGame(db))!.state;
          expect(restored).toEqual(s); s = restored;
          checkpoints.add(s.stageIndex);
          if (output) { mkdirSync(output, { recursive: true }); writeFileSync(`${output}/${profession}-${length}-${seed}-stage${s.stageIndex}.json`, JSON.stringify(s)); }
        }
        if (profession !== 'medicine') s = chooseProfessionEvent(s);
        else {
          const pick = (...ids: string[]) => ids.find(id => e.choices.some(c => c.id === id)) ?? e.choices[0].id;
          const id = key === 'funding' ? pick('education-plan') : key === 'marriage-required' ? pick('single') : key === 'practice-required' ? pick('employed') : key === 'depth-application' ? pick('submit') : key === 'journey:route' ? pick('general') : key.startsWith('offer-') ? pick('decline') : e.choices[0].id;
          s = reduceGame(s, { type: 'choose', id: `quality:choose:${s.revision}`, eventId: e.id, choiceId: id });
        }
      } else {
        const stage = s.stageIndex;
        const before = s.progress!.activeMs.reduce((a,b) => a+b,0);
        s = reduceGame(s, { type: 'tick', id: `quality:tick:${s.revision}`, elapsedMs: 1000 });
        active[stage] += (s.progress!.activeMs.reduce((a,b) => a+b,0) - before) * 16 / 1000;
      }
    }
    expect(s.status).toBe('completed'); expect(validState(s)).toBe(true);
    expect([...stages]).toEqual([0,1,2,3]);
    const authored = events.filter(e => e.key.startsWith('profession:story:'));
    expect(new Set(authored.map(e => e.key)).size).toBe(authored.length);
    await persistGame(db, s, previousRevision);
    expect((await loadGame(db))!.state).toEqual(s);
    if (profession !== 'medicine') {
      expect(authored.filter(e=>e.stage===3)).toHaveLength(length==='short'?1:2);
      expect(authored.filter(e=>e.stage===0).length).toBeLessThanOrEqual(length==='short'?1:7);
    }
    measurements.push({ profession, length, seed, activeSeconds: active, totalChoices: events.length, choicesByStage: [0,1,2,3].map(stage => events.filter(e => e.stage === stage).length), authoredStories: authored.length, finalStats: s.stats, cash: s.economy!.cash, debt: s.economy!.debt, events });
  } finally { db.close(); }
}, 120000);

