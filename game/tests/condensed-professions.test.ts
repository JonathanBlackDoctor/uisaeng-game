import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCareerGame } from '../src/career-runtime';
import { setStartingLength } from '../src/pacing';
import { continueProfession } from './helpers/profession-play';
import { openGameDatabase, persistGame, loadGame } from '../src/storage';
import { professionStorySchedule } from '../src/profession-experience';

describe('condensed story across professions', () => {
  for (const profession of ['dentistry', 'korean-medicine', 'nursing'] as const) {
    it(`${profession}: reduces optional scenes and preserves licenses, qualifications, endings and old saves`, async () => {
      const draft = createCareerGame(`condensed-${profession}`, 3, profession);
      const short = setStartingLength(draft, 'short');
      const old = structuredClone(short); old.journey!.version = 2;
      const long = setStartingLength(draft, 'standard');
      expect(professionStorySchedule(short, 'university').limit).toBe(1);
      expect(professionStorySchedule(old, 'university').limit).toBe(4);
      expect(professionStorySchedule(long, 'university').limit).toBe(7);
      const shortened = continueProfession(short);
      const original = continueProfession(old);
      const scenes = (events: string[]) => events.filter(k => k.startsWith('profession:story:'));
      expect(scenes(shortened.events).length).toBeLessThan(scenes(original.events).length);
      expect(scenes(shortened.events).length).toBeLessThanOrEqual(5);
      for (const key of ['profession:license', 'profession:route', 'profession:field', 'profession:institution', 'profession:work']) {
        expect(shortened.events).toContain(key);
      }
      if (profession !== 'nursing') expect(shortened.events).toContain('profession:qualification');
      expect(shortened.s.professional!.licensed).toBe(true);
      expect(shortened.s.status).toBe('completed');
      expect(shortened.s.journal.some(j => j.id === 'profession:recap')).toBe(true);
      expect(Object.values(shortened.s.professional!.decisions).every(d => d.followed)).toBe(true);
      console.log(JSON.stringify({ profession, oldShortScenes: scenes(original.events).length, condensedScenes: scenes(shortened.events).length, oldChoices: original.events.length, condensedChoices: shortened.events.length }));
      const db = await openGameDatabase(`condensed-profession-${crypto.randomUUID()}`);
      try {
        await persistGame(db, shortened.s, null);
        expect((await loadGame(db))!.state).toEqual(shortened.s);
      } finally { db.close(); }
    }, 120000);
    it(`${profession}: keeps research promotions in the shorter story`, () => {
      const initial = setStartingLength(createCareerGame(`condensed-research-${profession}`, 3, profession), 'short');
      const result = continueProfession(initial, { route: 'research', work: 'research' });
      expect(result.s.status).toBe('completed');
      expect(result.s.professional!.licensed).toBe(true);
      expect(result.s.professional!.academic).toBe(3);
      expect(result.events.filter(k => /^profession:academic-/.test(k))).toHaveLength(3);
      expect(result.events.filter(k => k.startsWith('profession:story:')).length).toBeLessThanOrEqual(5);
      expect(result.events).toContain(`profession:story:${profession}:research:start`);
      expect(Object.values(result.s.professional!.decisions).every(d => d.followed)).toBe(true);
    }, 120000);
  }
});
