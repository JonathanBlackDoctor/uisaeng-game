import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { GameState, CareerProgress } from '../src/contracts';
import { createCareerGame } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { advanceDynamics } from '../src/life-dynamics';
import { advanceAbilities, initialAbilities } from '../src/abilities';
import { familyFunding } from '../src/background';
import { archives, loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import { resultShareData } from '../src/result-share';
import legacySaves from './fixtures/finance-v1-saves.json';

describe('long life and combined save compatibility', () => {
  it('avoids routine depletion over a full life while retaining meaningful gains and losses', () => {
    const finalValues: number[] = [];
    for (const focus of ['study', 'research', 'clinical', 'work', 'people', 'rest'] as CareerProgress['focus'][]) {
      for (const seed of [4, 42, 84, 2026]) {
        const s = createCareerGame(`long-${focus}-${seed}`, seed);
        s.progress!.focus = focus;
        let up = false, down = false;
        for (let m = 1; m <= 684; m++) {
          s.stageIndex = m < 72 ? 0 : m < 144 ? 1 : m < 564 ? 2 : 3;
          s.life!.elapsedMs = m * 1000;
          const before = { ...s.stats }; advanceAbilities(s); advanceDynamics(s);
          for (const k of Object.keys(before) as (keyof typeof before)[]) {
            up ||= s.stats[k] > before[k]; down ||= s.stats[k] < before[k];
          }
        }
        expect(up, `${focus}/${seed}: gains`).toBe(true);
        // Rest with strong self-management need not manufacture a random loss.
        if (focus !== 'rest') expect(down, `${focus}/${seed}: losses`).toBe(true);
        for (const v of Object.values(s.stats)) expect(v).toBeGreaterThan(0);
        finalValues.push(...Object.values(s.stats));
      }
    }
    expect(finalValues.some(v => v < 50)).toBe(true);
    expect(finalValues.some(v => v > 75)).toBe(true);
  });
  it('lets depleted health recover through rest without resetting existing stats', () => {
    const s = createCareerGame('recover-old', 42);
    s.stats = { health: 0, happiness: 0, knowledge: 0, relationships: 0 };
    s.dynamics!.fatigue = 24; s.progress!.focus = 'rest';
    for (let m = 1; m <= 12; m++) { s.life!.elapsedMs = m * 1000; advanceDynamics(s); }
    expect(s.stats.health).toBeGreaterThan(8);
    expect(s.stats.health).toBeLessThan(50);
    expect(s.stats.happiness).toBeGreaterThan(0);
    expect(s.dynamics!.fatigue).toBe(0);
  });
  it('does not erase every unused detailed ability over decades', () => {
    const s = createCareerGame('retained-ability', 42), original = initialAbilities(s);
    s.progress!.focus = 'study';
    for (let m = 1; m <= 684; m++) { s.life!.elapsedMs = m * 1000; advanceAbilities(s); }
    expect(s.abilities!.values.communication).toBeLessThan(original.values.communication);
    expect(s.abilities!.values.communication).toBeGreaterThan(original.values.communication * 0.4);
    expect(s.abilities!.values.judgment).toBeGreaterThan(original.values.judgment);
  });
  it.each(legacySaves)('restores an actual finance-v1 save at revision $revision without reassigning background or balances', async (fixture: unknown) => {
    const s = structuredClone(fixture) as GameState;
    expect(validState(s)).toBe(true);
    expect(s.life!.background.profile).toBeUndefined();
    expect(familyFunding(s.life!.background).monthly).toBe(0);
    const db = await openGameDatabase(`legacy-${s.revision}-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      const restored = (await loadGame(db))!.state;
      expect(restored).toEqual(s);
      const next = restored.pendingEvent
        ? reduceGame(restored, { type: 'choose', id: 'resume', eventId: restored.pendingEvent.id, choiceId: restored.pendingEvent.choices[0].id })
        : reduceGame(restored, { type: 'next-choice', id: 'resume' });
      expect(next.revision).toBeGreaterThan(s.revision); expect(validState(next)).toBe(true);
      await persistGame(db, next, restored); expect((await loadGame(db))!.state).toEqual(next);
    } finally { db.close(); }
  });
  it('preserves combined background, finances and abilities through retirement and archived sharing', async () => {
    let s = createCareerGame('combined-retirement', 42);
    s = reduceGame(s, { type: 'lifestyle', id: 'sleep', key: 'sleep', enabled: true });
    s = reduceGame(s, { type: 'money-plan', id: 'saving-plan', field: 'autoSave', amount: 100_000 });
    const background = structuredClone(s.life!.background);
    const db = await openGameDatabase(`combined-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      for (let i = 0; i < 1000 && s.status !== 'completed'; i++) {
        const previous = s, e = s.pendingEvent;
        if (e) {
          const preferred = e.randomKey === 'funding' ? 'education-plan' : ['specialty-required','practice-required'].includes(e.randomKey!) ? 'untrained' : e.randomKey?.startsWith('offer-') ? 'decline' : e.randomKey === 'marriage-required' ? 'single' : e.choices[0].id;
          s = reduceGame(s, { type: 'choose', id: `choice:${s.revision}`, eventId: e.id, choiceId: e.choices.some(c=>c.id===preferred) ? preferred : e.choices[0].id });
        } else s = reduceGame(s, { type: 'next-choice', id: `next:${s.revision}` });
        expect(validState(s), `month ${s.life!.elapsedMs / 1000}, ${s.pendingEvent?.randomKey}`).toBe(true);
        if (i % 20 === 0 || s.status === 'completed') {
          const saved = (await loadGame(db))!.state;
          await persistGame(db, s, saved); s = (await loadGame(db))!.state;
        }
        expect(s.revision).toBeGreaterThan(previous.revision);
      }
      expect(s.status).toBe('completed'); expect(s.life!.background).toEqual(background);
      expect(s.lifestyle!.enabled.sleep).toBe(true); expect(s.portfolio!.autoSave).toBe(100_000);
      const ids = s.economy!.ledger.filter(t=>t.id.includes('family-')).map(t=>t.id);
      expect(new Set(ids).size).toBe(ids.length);
      const stored = (await archives(db))[0].state; expect(stored).toEqual(s);
      expect(stored.identity?.service.route).toBe('army');
      expect(resultShareData(stored).text).toContain('77세');
      expect(reduceGame(stored, { type: 'next-choice', id: 'after-end' })).toBe(stored);
    } finally { db.close(); }
  }, 60_000);
});
