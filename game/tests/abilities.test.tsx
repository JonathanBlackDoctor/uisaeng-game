import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ABILITIES, ABILITY_SITUATIONS, FOCUS_ABILITIES, abilityPerformance, advanceAbilities, abilityEvent, abilityEventWeight, initialAbilities, nextAbilityEvent, practiceAbilities, specialtyAbilityBonus, validAbilities, weightedAbilityPick } from '../src/abilities';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { applySpecialty, SPECIALTIES } from '../src/career';
import { reduceGame } from '../src/engine';
import { rollEffort } from '../src/life-dynamics';
import { AbilityContent } from '../src/AbilityPanel';
import AbilitySummary, { relevantAbilities } from '../src/AbilitySummary';
import { LEGACY_ABILITY_MEMBERS, legacyGame } from '../src/ability-schema';
import { abilityState, migrateAbilities, upgradeAbilities } from '../src/abilities';
import { initialAbilities as legacyInitial, ABILITY_SITUATIONS as legacySituations, settleAbilityEvent as legacySettle } from '../src/abilities-legacy';
import { initialPeer } from '../src/relationships';
import { initialStories } from '../src/life-stories';
import { openGameDatabase, persistGame, loadGame, validState } from '../src/storage';
import type { GameState } from '../src/contracts';

function setSkills(s: GameState, n: number) { for (const { id } of ABILITIES) s.abilities!.values[id] = n; }
function choose(s: GameState, id: string, action = 'answer') {
  return reduceGame(s, { type: 'choose', id: action, eventId: s.pendingEvent!.id, choiceId: id });
}
describe('detailed abilities', () => {
  it('creates six reproducible varied skills, with every one used by an activity', () => {
    const a = createCareerGame('a', 42), b = createCareerGame('b', 42), c = createCareerGame('a', 43);
    expect(ABILITIES).toHaveLength(6); expect(a.abilities).toEqual(b.abilities);
    expect(a.abilities!.values).not.toEqual(c.abilities!.values);
    expect(new Set(Object.values(a.abilities!.values)).size).toBeGreaterThan(4);
    expect(new Set(Object.values(FOCUS_ABILITIES).flat()).size).toBe(6);
    expect(validState(a)).toBe(true);
  });
  it('separates acquired skill from health, happiness, knowledge, relationship and fatigue effects', () => {
    const good = createCareerGame('condition', 1); setSkills(good, 50);
    good.stats = { health: 90, happiness: 90, knowledge: 90, relationships: 90 };
    const tired = structuredClone(good); tired.dynamics!.fatigue = 24;
    tired.stats = { health: 10, happiness: 10, knowledge: 10, relationships: 10 };
    expect(abilityPerformance(good, 'technique').current).toBeGreaterThan(abilityPerformance(tired, 'technique').current);
    expect(good.abilities!.values).toEqual(tired.abilities!.values);
    for (const k of ['health', 'happiness', 'knowledge', 'relationships'] as const) {
      const lower = structuredClone(good); lower.stats[k] = 0;
      practiceAbilities(good, ['research'], 2, '연구'); practiceAbilities(lower, ['research'], 2, '연구');
      expect(good.abilities!.values.research).toBeGreaterThan(lower.abilities!.values.research);
    }
  });
  it('grows practiced skills, decays unused skills, caps student technique and processes each month once', () => {
    const s = createCareerGame('growth', 5); setSkills(s, 40); s.progress!.focus = 'study';
    for (let m = 1; m <= 24; m++) { s.life!.elapsedMs = m * 1000; advanceAbilities(s); }
    expect(s.abilities!.values.judgment).toBeGreaterThan(40);
    expect(s.abilities!.values.management).toBeLessThan(40);
    expect(s.abilities!.changes.management!.reason).toMatch(/쓰지 않은/);
    const snapshot = structuredClone(s); advanceAbilities(s); expect(s).toEqual(snapshot);
    practiceAbilities(s, ['technique'], 100, '실습'); expect(s.abilities!.values.technique).toBe(45);
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
    abilityPerformance(high, 'communication'); abilityEventWeight(high, 'friend'); abilityEvent(high, 'ability-team');
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
    if (situation.key === 'ability-technique') low.life!.elapsedMs = 36000;
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
    for (const bad of [null, [], { ...s.abilities!, values: {} }, { ...s.abilities!, seed: -1 }, { ...s.abilities!, specialties: { fake: 80 } }, { ...s.abilities!, values: { ...s.abilities!.values, judgment: NaN } }, { ...s.abilities!, changes: { judgment: { month: 1, delta: 1, reason: '미래' } } }]) expect(validAbilities(bad, 0)).toBe(false);
    expect(validAbilities(undefined, 0)).toBe(true);
  });
  it('keeps skill growth, opportunity draws and specialty state identical at different time speeds', () => {
    function play(speed: 1 | 8) {
      let s = createCareerGame('speed', 42); s.life!.paused = false; s.life!.speed = speed;
      for (let step = 0; step < 4000; step++) {
        if (s.pendingEvent?.randomKey === 'campus-summer') return s;
        s = s.pendingEvent ? choose(s, s.pendingEvent.choices[0].id, `choice:${s.revision}`)
          : reduceGame(s, { type: 'tick', id: `tick:${s.revision}`, elapsedMs: 1000 });
        expect(validState(s)).toBe(true);
      }
      throw new Error('대학 2학년 사건에 도달하지 못했습니다.');
    }
    const a = play(1), b = play(8);
    expect(a.abilities).toEqual(b.abilities); expect(a.stats).toEqual(b.stats); expect(a.seed).toBe(b.seed);
  });
  it('renders actual acquired and effective values with plain Korean labels', () => {
    const s = createCareerGame('view', 2); setSkills(s, 50); s.stats.health = 0; s.dynamics!.fatigue = 24;
    s.progress!.focus = 'rest';
    practiceAbilities(s, ['selfManagement'], 1, '운동');
    const html = renderToStaticMarkup(<AbilityContent game={s}/>);
    expect(html).toContain('쌓은 실력'); expect(html).toContain('현재 수행력'); expect(html).toContain('운동');
    expect(html).toContain(`현재 수행력 ${Math.round(abilityPerformance(s, 'selfManagement').current)}`);
    expect(html).not.toContain('provisional');
    expect(html.match(/class="ability-row(?: ability-relevant)?"/g)).toHaveLength(6);
    expect(html).toContain('상세 능력 6가지');
  });
  it('shows actual event gates without changing saved choices or RNG', () => {
    const s = createCareerGame('impact', 42); setSkills(s, 0);
    s.pendingEvent = careerEvent(s, 'ability-schedule');
    const snapshot = structuredClone(s);
    expect(relevantAbilities(s)).toEqual(['management', 'judgment', 'selfManagement']);
    const html = renderToStaticMarkup(<AbilitySummary game={s} decision/>);
    expect(html).toContain('55부터');
    expect(s).toEqual(snapshot);
    setSkills(s, 90); s.pendingEvent = careerEvent(s, 'ability-schedule');
    const high = renderToStaticMarkup(<AbilitySummary game={s} decision/>);
    expect(high).toContain('선택 가능'); expect(high).not.toContain('55부터');
    s.pendingEvent = careerEvent(s, 'campus-team');
    expect(renderToStaticMarkup(<AbilitySummary game={s} decision/>)).toBe('');
  });
  it('only labels current-month growth as this month and hides effects for legacy saves', () => {
    const s = createCareerGame('growth-summary', 42); s.progress!.focus = 'study';
    practiceAbilities(s, ['judgment'], 2, '공부');
    const snapshot = structuredClone(s);
    expect(renderToStaticMarkup(<AbilitySummary game={s}/>)).toContain('판단력 +');
    expect(s).toEqual(snapshot);
    s.life!.elapsedMs += 1000;
    expect(renderToStaticMarkup(<AbilitySummary game={s}/>)).not.toContain('이번 달');
    delete s.abilities;
    expect(renderToStaticMarkup(<AbilitySummary game={s}/>)).toBe('');
  });
  it('maps all 30 old skills once, retaining averages, recent changes, usage, specialty and RNG without mutating input', () => {
    const s = createCareerGame('migration', 42), old = legacyInitial(legacyGame(s));
    old.lastMonth = 12;
    old.changes.memory = { month: 12, delta: 1.6, reason: '공부' };
    old.changes.reasoning = { month: 11, delta: 1, reason: '지난 공부' };
    old.used.memory = 12; old.specialties.internal = 10; old.seen['ability-team'] = 6;
    const snapshot = structuredClone(old), converted = migrateAbilities(old);
    const members = Object.values(LEGACY_ABILITY_MEMBERS).flat();
    expect(members).toHaveLength(30); expect(new Set(members).size).toBe(30);
    expect(converted.version).toBe(2); expect(Object.keys(converted.values)).toHaveLength(6);
    expect(converted.seed).toBe(old.seed); expect(converted.specialties).toEqual(old.specialties);
    expect(converted.seen).toEqual(old.seen); expect(converted.used.judgment).toBe(12);
    expect(converted.changes.judgment).toEqual({ month: 12, delta: 0.2, reason: '공부' });
    expect(converted.values.judgment).toBe(Math.round(LEGACY_ABILITY_MEMBERS.judgment.reduce((n, id) => n + old.values[id], 0) / 8 * 10) / 10);
    expect(validAbilities(converted, 12)).toBe(true); expect(old).toEqual(snapshot);
    legacyGame(s).abilities = old; s.life!.elapsedMs = 12000;
    expect(abilityState(s)).toEqual(converted); expect(legacyGame(s).abilities).toEqual(old);
    upgradeAbilities(s); const first = structuredClone(s); upgradeAbilities(s); expect(s).toEqual(first);
  });
  it.each(legacySituations)('restores and settles old $key choices under their original rules, then migrates once', (situation: (typeof legacySituations)[number]) => {
    const s = createCareerGame('old-pending', 42); s.progress!.focus = situation.focus;
    if (situation.key === 'ability-practice') s.life!.elapsedMs = 36000;
    legacyGame(s).abilities = legacyInitial(legacyGame(s));
    for (const id of Object.keys(legacyGame(s).abilities!.values)) (legacyGame(s).abilities!.values as Record<string, number>)[id] = 90;
    s.pendingEvent = careerEvent(s, situation.key, false, false, true);
    const old = structuredClone(s), expected = structuredClone(s);
    expect(validState(s)).toBe(true);
    expect(s.pendingEvent!.choices.some(c => c.id === 'advanced')).toBe(true);
    expect(legacySettle(legacyGame(expected), situation.key, 'advanced', 'old-answer')).toBe(true);
    const result = choose(s, 'advanced', 'old-answer');
    expect(result.abilities).toEqual(migrateAbilities(legacyGame(expected).abilities!));
    expect(result.stats).toEqual(expected.stats); expect(validState(result)).toBe(true);
    expect(choose(JSON.parse(JSON.stringify(s)), 'advanced', 'old-answer')).toEqual(result);
    expect(s).toEqual(old);
    const tampered = structuredClone(s); tampered.pendingEvent!.body += '임의 수정';
    expect(validState(tampered)).toBe(false);
  });
  it('keeps all four stats meaningful for performance and makes every new ability relevant to choices', () => {
    const s = createCareerGame('influences', 42); setSkills(s, 50);
    s.stats = { health: 50, happiness: 50, knowledge: 50, relationships: 50 };
    for (const def of ABILITIES) for (const stat of Object.keys(s.stats) as (keyof typeof s.stats)[]) {
      const higher = structuredClone(s); higher.stats[stat] = 70;
      expect(abilityPerformance(higher, def.id).current).toBeGreaterThan(abilityPerformance(s, def.id).current);
    }
    expect(new Set(ABILITY_SITUATIONS.map(e => e.gate))).toEqual(new Set(ABILITIES.map(a => a.id)));
  });
  it('restores an old ability save and its original peer name without accepting another person', () => {
    const s = createCareerGame('old-peer', 4091869858);
    s.stories = initialStories();
    legacyGame(s).abilities = legacyInitial(legacyGame(s));
    s.stories!.peer = { ...initialPeer(s), person: { ...initialPeer(s).person, name: '민재' } };
    s.pendingEvent = careerEvent(s, 'club-required', false, false, true);
    expect(validState(s)).toBe(true);
    const restored = choose(s, s.pendingEvent!.choices[0].id);
    expect(restored.abilities!.version).toBe(2); expect(validState(restored)).toBe(true);
    expect(restored.stories!.peer!.person.name).toBe('민재');
    const altered = structuredClone(s); altered.stories!.peer!.person.name = '윤서';
    expect(validState(altered)).toBe(false);
  });
});
