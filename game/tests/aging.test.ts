import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { advanceAging, agingAge, initialAging, validAging } from '../src/aging';
import { careerStageEnds, createCareerGame } from '../src/career-runtime';
import { calendarMonths, configureIdentity, serviceMonths, SERVICE_RULES } from '../src/identity';
import { lifeStartAge } from '../src/random-life';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import { continueProfession } from './helpers/profession-play';

describe('age and accumulated health burden', () => {
  it('keeps retirement at the same age for late entrants and counts service time', () => {
    const young = createCareerGame('young', 3), late = createCareerGame('late', 3);
    late.life!.startAge = 24; late.aging = initialAging(late);
    expect(careerStageEnds(young)[2] - careerStageEnds(late)[2]).toBe(48);
    for (const s of [young, late]) expect(lifeStartAge(s) + careerStageEnds(s)[2] / 12).toBe(67);
    const serving = configureIdentity(late, 'male');
    serving.identity!.service.elapsedMs = 18 * SERVICE_RULES.monthMs;
    advanceAging(serving);
    expect(lifeStartAge(serving) + (careerStageEnds(serving)[2] + serviceMonths(serving)) / 12).toBe(67);
  });

  it('ages earlier after prolonged poor health, stops adding burden on recovery and never double-applies', () => {
    const healthy = createCareerGame('healthy', 3), poor = createCareerGame('poor', 3);
    for (let month = 1; month <= 240; month++) {
      for (const [s, health] of [[healthy, 80], [poor, 10]] as const) {
        s.life!.elapsedMs = month * 1000; s.stats.health = health; advanceAging(s);
      }
    }
    expect(agingAge(healthy)).toBe(40);
    expect(agingAge(poor)).toBe(50);
    expect(healthy.journal.some(j => j.id.startsWith('aging:'))).toBe(false);
    expect(poor.journal.some(j => j.id.startsWith('aging:'))).toBe(true);
    expect(careerStageEnds(healthy)[2] - careerStageEnds(poor)[2]).toBe(120);
    const snapshot = structuredClone(poor); advanceAging(poor); expect(poor).toEqual(snapshot);
    poor.stats.health = 80; poor.life!.elapsedMs += 1000; advanceAging(poor);
    expect(poor.aging!.burdenMonths).toBe(120);
    expect(validAging(poor)).toBe(true);
    poor.aging!.burdenMonths = 121; expect(validAging(poor)).toBe(false);
    const recovering = createCareerGame('recovering', 3);
    recovering.stats.health = 10; recovering.life!.elapsedMs = 12_000; advanceAging(recovering);
    expect(recovering.aging!.burdenMonths).toBe(24);
    recovering.stats.health = 80; recovering.life!.elapsedMs = 24_000; advanceAging(recovering);
    expect(recovering.aging!.burdenMonths).toBe(24);
  });

  it('retires a late entrant with accumulated burden early, continues retirement and restores its save', async () => {
    let s = configureIdentity(createCareerGame('early-nurse', 3, 'nursing'), 'female');
    s.life!.startAge = 24; s.aging = initialAging(s);
    const started = continueProfession(s, { stop: state => state.stageIndex === 2 }).s;
    started.aging!.burdenMonths = 120; advanceAging(started);
    const retired = continueProfession(started, { stop: state => state.stageIndex === 3 }).s;
    expect(lifeStartAge(retired) + (careerStageEnds(retired)[2] + serviceMonths(retired)) / 12).toBe(57);
    expect(retired.journal.find(j => j.title === '은퇴 이후')!.detail).toMatch(/^57세 0개월/);
    expect(retired.journal.some(j => j.title === '은퇴 이후' && j.detail.includes('건강 부담'))).toBe(true);
    expect(validState(retired)).toBe(true);
    const db = await openGameDatabase(`aging-${crypto.randomUUID()}`);
    try {
      await persistGame(db, retired, null);
      s = (await loadGame(db))!.state;
      expect(s).toEqual(retired);
    } finally { db.close(); }
    const finished = continueProfession(s).s;
    expect(finished.status).toBe('completed');
    expect(lifeStartAge(finished) + calendarMonths(finished) / 12).toBe(77);
  }, 120000);
});
