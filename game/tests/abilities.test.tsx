import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ABILITIES, ABILITY_SITUATIONS, FOCUS_ABILITIES, abilityPerformance, advanceAbilities, abilityEvent, abilityEventWeight, initialAbilities, nextAbilityEvent, practiceAbilities, specialtyAbilityBonus, validAbilities, weightedAbilityPick } from '../src/abilities';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { applySpecialty, SPECIALTIES } from '../src/career';
import { reduceGame } from '../src/engine';
import { rollEffort } from '../src/life-dynamics';
import { AbilityContent } from '../src/AbilityPanel';
import { openGameDatabase, persistGame, loadGame, validState } from '../src/storage';
import type { GameState } from '../src/contracts';

function setSkills(s: GameState, n: number) { for (const { id } of ABILITIES) s.abilities!.values[id] = n; }
function choose(s: GameState, id: string, action = 'answer') {
  return reduceGame(s, { type: 'choose', id: action, eventId: s.pendingEvent!.id, choiceId: id });
}
describe('detailed abilities', () => {
  it('creates 30 reproducible varied skills, with every one used by an activity', () => {
    const a = createCareerGame('a', 42), b = createCareerGame('b', 42), c = createCareerGame('a', 43);
    expect(ABILITIES).toHaveLength(30); expect(a.abilities).toEqual(b.abilities);
    expect(a.abilities!.values).not.toEqual(c.abilities!.values);
    expect(new Set(Object.values(a.abilities!.values)).size).toBeGreaterThan(20);
    expect(new Set(Object.values(FOCUS_ABILITIES).flat()).size).toBe(30);
    expect(validState(a)).toBe(true);
  });
  it('separates acquired skill from health, happiness, knowledge, relationship and fatigue effects', () => {
    const good = createCareerGame('condition', 1); setSkills(good, 50);
    good.stats = { health: 90, happiness: 90, knowledge: 90, relationships: 90 };
    const tired = structuredClone(good); tired.dynamics!.fatigue = 24;
    tired.stats = { health: 10, happiness: 10, knowledge: 10, relationships: 10 };
    expect(abilityPerformance(good, 'procedures').current).toBeGreaterThan(abilityPerformance(tired, 'procedures').current);
    expect(good.abilities!.values).toEqual(tired.abilities!.values);
    for (const k of ['health', 'happiness', 'knowledge', 'relationships'] as const) {
      const lower = structuredClone(good); lower.stats[k] = 0;
      practiceAbilities(good, ['analysis'], 2, '연구'); practiceAbilities(lower, ['analysis'], 2, '연구');
      expect(good.abilities!.values.analysis).toBeGreaterThan(lower.abilities!.values.analysis);
    }
  });
  it('grows practiced skills, decays unused skills, caps student procedures and processes each month once', () => {
    const s = createCareerGame('growth', 5); setSkills(s, 40); s.progress!.focus = 'study';
    for (let m = 1; m <= 24; m++) { s.life!.elapsedMs = m * 1000; advanceAbilities(s); }
    expect(s.abilities!.values.memory).toBeGreaterThan(40);
    expect(s.abilities!.values.business).toBeLessThan(40);
    expect(s.abilities!.changes.business!.reason).toMatch(/쓰지 않은/);
    const snapshot = structuredClone(s); advanceAbilities(s); expect(s).toEqual(snapshot);
    practiceAbilities(s, ['procedures'], 100, '실습'); expect(s.abilities!.values.procedures).toBe(45);
    expect(validAbilities(s.abilities, 24)).toBe(true);
  });
  it('keeps old pending choices intact and upgrades from the current month without replaying history', () => {
    const s = createCareerGame('old', 42); delete s.abilities; s.life!.elapsedMs = 12000;
    s.pendingEvent = careerEvent(s, 'campus-team');
    const old = structuredClone(s.pendingEvent);
    expect(validState(s)).toBe(true);
    const preview = initialAbilities(s); expect(preview.since).toBe(12); expect(s.abilities).toBeUndefined();
    const next = choose(s, s.pendingEvent!.choices[0].id);
    expect(s.pendingEvent).toEqual(old); expect(next.abilities!.since).toBe(12);
    expect(validState(next)).toBe(true);
  });
  it('uses skills in outcomes and event weights without consuming RNG on inspection', () => {
    const low = createCareerGame('weights', 8), high = structuredClone(low); setSkills(low, 0); setSkills(high, 90);
    const snapshot = structuredClone(high);
    abilityPerformance(high, 'sociability'); abilityEventWeight(high, 'friend'); abilityEvent(high, 'ability-team');
    expect(high).toEqual(snapshot);
    expect(abilityEventWeight(high, 'friend')).toBeGreaterThan(abilityEventWeight(low, 'friend'));
    let a = 0, b = 0;
    for (let seed = 0; seed < 100; seed++) {
      low.dynamics!.seed = high.dynamics!.seed = seed * 99991;
      low.dynamics!.momentum.people = high.dynamics!.momentum.people = 0;
      a += rollEffort(low, 'people'); b += rollEffort(high, 'people');
    }
    expect(b).toBeGreaterThan(a);
    expect(weightedAbilityPick(['a', 'b'], 0.4, x => x === 'a' ? 1 : 9)).toBe('b');
  });
  it.each(ABILITY_SITUATIONS)('$key exposes advanced choices only with the needed skill and resolves once after restore', (situation: (typeof ABILITY_SITUATIONS)[number]) => {
    const low = createCareerGame('scenario', 42); setSkills(low, 0);
    low.progress!.focus = situation.focus;
    if (situation.key === 'ability-practice') low.life!.elapsedMs = 36000;
    const high = structuredClone(low); setSkills(high, 90);
    expect(abilityEvent(low, situation.key)!.choices.map(c => c.id)).not.toContain('advanced');
    high.pendingEvent = careerEvent(high, situation.key);
    expect(high.pendingEvent!.choices.map(c => c.id)).toContain('advanced');
    expect(high.pendingEvent!.body).toContain(situation.clue);
    expect(validState(high)).toBe(true);
    const a = choose(high, 'advanced'), b = choose(JSON.parse(JSON.stringify(high)), 'advanced');
    expect(a).toEqual(b); expect(validState(a)).toBe(true);
    expect(reduceGame(a, { type: 'choose', id: 'answer', eventId: high.pendingEvent!.id, choiceId: 'advanced' })).toBe(a);
    expect(a.journal.some(e => e.id === 'answer:abilities')).toBe(true);
    low.pendingEvent = careerEvent(low, situation.key);
    expect(choose(low, 'advanced')).toBe(low);
    expect(choose(low, 'supported')).not.toBe(low);
  });
  it('weights specialty preparation while keeping knowledge, qualifications and individual records separate', () => {
    const low = createCareerGame('specialty', 42), high = structuredClone(low); setSkills(low, 0); setSkills(high, 90);
    for (const x of SPECIALTIES) {
      const a = specialtyAbilityBonus(low, x.id), b = specialtyAbilityBonus(high, x.id);
      expect(b).toBeGreaterThan(a);
      const result = applySpecialty(high.career!, x.id, 'snuh', 50, 0.5, b);
      expect(result.state.lastApplication!.knowledge).toBe(50);
      expect(result.state.lastApplication!.abilityBonus).toBe(b);
    }
    const first = reduceGame(low, { type: 'explore', id: 'visit', specialtyId: 'internal' });
    const again = reduceGame(first, { type: 'explore', id: 'visit-again', specialtyId: 'internal' });
    expect(again.abilities!.specialties).toEqual(first.abilities!.specialties);
  });
  it('reproduces generated opportunities and enforces eligibility and cooldown', () => {
    const a = createCareerGame('events', 42), b = structuredClone(a); const seen: string[] = [];
    for (let m = 6; m < 66; m += 6) {
      for (const s of [a, b]) { s.life!.elapsedMs = m * 1000; advanceAbilities(s); }
      const key = nextAbilityEvent(a); expect(nextAbilityEvent(b)).toBe(key);
      if (key) { seen.push(key); expect(ABILITY_SITUATIONS.find(x => x.key === key)!.eligible(a)).toBe(true); }
    }
    expect(seen.length).toBeGreaterThan(0); expect(a.abilities).toEqual(b.abilities);
  });
  it('persists exact values, random state and pending event, rejecting corrupt skill saves', async () => {
    const s = createCareerGame('db', 999); s.pendingEvent = careerEvent(s, 'ability-team');
    const db = await openGameDatabase('abilities-' + crypto.randomUUID());
    try { await persistGame(db, s, null); expect((await loadGame(db))!.state).toEqual(s); }
    finally { db.close(); }
    for (const bad of [null, [], { ...s.abilities!, values: {} }, { ...s.abilities!, seed: -1 }, { ...s.abilities!, specialties: { fake: 80 } }, { ...s.abilities!, values: { ...s.abilities!.values, memory: NaN } }, { ...s.abilities!, changes: { memory: { month: 1, delta: 1, reason: '미래' } } }]) expect(validAbilities(bad, 0)).toBe(false);
    expect(validAbilities(undefined, 0)).toBe(true);
  });
  it('renders actual acquired and effective values with plain Korean labels', () => {
    const s = createCareerGame('view', 2); setSkills(s, 50); s.stats.health = 0; s.dynamics!.fatigue = 24;
    practiceAbilities(s, ['stamina'], 1, '운동');
    const html = renderToStaticMarkup(<AbilityContent game={s}/>);
    expect(html).toContain('쌓은 실력'); expect(html).toContain('현재 수행력'); expect(html).toContain('운동');
    expect(html).toContain(abilityPerformance(s, 'stamina').current.toFixed(1));
    expect(html).not.toContain('provisional');
  });
});
