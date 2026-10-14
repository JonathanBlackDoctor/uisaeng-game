import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ADMISSION_RULES, admissionRoute, createAdmissionGame } from '../src/admission';
import { PROFESSION_IDS, professionOf } from '../src/professions';
import { lifeAge } from '../src/random-life';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import Opening from '../src/Opening';

describe('random admission', () => {
  it('repeats the same draw and covers all colleges and retry ages', () => {
    const colleges = new Set<string>(), ages = new Map<number, number>();
    for (let seed = 0; seed < 1000; seed++) {
      const s = createAdmissionGame('admission', seed);
      colleges.add(professionOf(s));
      const age = s.life!.startAge!;
      ages.set(age, (ages.get(age) ?? 0) + 1);
      expect(validState(s)).toBe(true);
      expect(s.journal[0].detail.startsWith(lifeAge(s))).toBe(true);
      if (seed < 10) expect(s).toEqual(createAdmissionGame('admission', seed));
    }
    expect([...colleges].sort()).toEqual([...PROFESSION_IDS].sort());
    expect([...ages.keys()].sort()).toEqual([...ADMISSION_RULES.ages]);
    expect(ages.get(20)!).toBeGreaterThan(ages.get(21)!);
    expect(ages.get(21)!).toBeGreaterThan(ages.get(22)!);
  });

  it('shows the assigned route without a college selector and restores the exact state', async () => {
    const s = Array.from({ length: 100 }, (_, seed) => createAdmissionGame('saved-admission', seed)).find(s => s.life!.startAge! > 20)!;
    const html = renderToStaticMarkup(<Opening draft={s} busy={false} disabled={false} entering={false} onPrepare={() => {}} onEnter={() => {}} onBack={() => {}}/>);
    expect(html).toContain(admissionRoute(s.life!.startAge!));
    expect(html).not.toContain('name="profession"');
    const db = await openGameDatabase(`admission-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      expect((await loadGame(db))!.state).toEqual(s);
    } finally { db.close(); }
    expect([20, 21, 22, 23, 24].map(admissionRoute)).toEqual(['현역', '재수', '3수', '4수', '5수']);
  });
});
