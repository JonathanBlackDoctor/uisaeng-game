import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { ABILITIES, ABILITY_SITUATIONS, abilityPerformance } from '../src/abilities';
import { abilityRoute, performanceGrade, performancePreview } from '../src/ability-impact';
import { rollEffort } from '../src/life-dynamics';
import { reduceGame } from '../src/engine';
import { validState, openGameDatabase, persistGame, loadGame } from '../src/storage';
import { startingAbilityReason, startingStatReason } from '../src/ability-origin';
import { backgroundAbilityBonuses, backgroundStatEffects, EXPERIENCES, LEARNING, CLIMATES, CHILDHOOD_HEALTH } from '../src/background';
import { SPECIALTIES } from '../src/career';
import { choiceResult } from '../src/choice-feedback';
import { groupPlayLog } from '../src/PlayLog';
import Opening from '../src/Opening';
import { AbilityContent } from '../src/AbilityPanel';
import type { CareerProgress, GameState } from '../src/contracts';

function game(n = 50) {
  const s = createCareerGame('impact', 42);
  s.stats = { health: 50, happiness: 50, knowledge: 50, relationships: 50 };
  for (const a of ABILITIES) s.abilities!.values[a.id] = n;
  s.dynamics!.fatigue = 0;
  return s;
}
function choose(s: GameState, id: string) {
  return reduceGame(s, { type: 'choose', id: 'answer', eventId: s.pendingEvent!.id, choiceId: id });
}
describe('ability-led play', () => {
  it('makes ability the dominant factor in every routine across stages, with bounded luck', () => {
    const comparisons = [];
    for (const stage of [0, 1, 2, 3]) for (const focus of ['study', 'clinical', 'research', 'people', 'work', 'rest'] as CareerProgress['focus'][]) {
      const low = game(25), high = game(75); low.stageIndex = high.stageIndex = stage;
      let lowTotal = 0, highTotal = 0, highFailures = 0;
      for (let i = 0; i < 200; i++) {
        low.dynamics!.seed = high.dynamics!.seed = i * 99991;
        low.dynamics!.momentum[focus] = high.dynamics!.momentum[focus] = 0;
        const a = rollEffort(low, focus), b = rollEffort(high, focus);
        expect(b).toBeGreaterThanOrEqual(a); lowTotal += a; highTotal += b;
        highFailures += Number(b < 0);
        expect(low.dynamics!.seed).toBe(high.dynamics!.seed);
      }
      expect((highTotal - lowTotal) / 200).toBeGreaterThan(1.5);
      expect(highFailures).toBe(0);
      comparisons.push({ stage, focus, low: lowTotal / 200, high: highTotal / 200 });
    }
    console.log('ability comparison:', JSON.stringify(comparisons));
  });
  it('keeps skilled routine work reliable without guaranteeing difficult work', () => {
    const s = game(50), ordinary = performancePreview(s, 'study');
    expect(performanceGrade(ordinary, 0)).toBeGreaterThanOrEqual(0);
    const difficult = performancePreview(s, 'study', { base: 'study', skill: 'judgment', focus: 'study', advanced: true });
    expect(performanceGrade(difficult, 0)).toBeLessThan(performanceGrade(difficult, 1));
    s.dynamics!.fatigue = 24; s.stats.health = 10;
    expect(performancePreview(s, 'study').score).toBeLessThan(ordinary.score);
  });
  it('opens a real management route and makes the applied skill visible in feedback', () => {
    const s = game(20); s.abilities!.values.management = 70;
    s.pendingEvent = careerEvent(s, 'campus-team');
    expect(s.pendingEvent!.choices.some(c => c.id === 'skill-management')).toBe(true);
    const before = structuredClone(s), after = choose(s, 'skill-management');
    expect(after).not.toBe(s); expect(validState(after)).toBe(true); expect(s).toEqual(before);
    expect(after.abilities!.values.management).toBeGreaterThan(s.abilities!.values.management);
    expect(after.career!.experience.people).toBeGreaterThan(s.career!.experience.people);
    expect(after.journal.find(e => e.id === 'answer')!.choice!.detail).toContain('운영력 중심 수행력');
    expect(choiceResult(s, after, 'answer')!.detail).toContain('운영력');
    expect(groupPlayLog(after.journal).flat().some(e => e.id === 'answer:impact')).toBe(false);
    expect(reduceGame(after, { type: 'choose', id: 'answer', eventId: s.pendingEvent!.id, choiceId: 'skill-management' })).toBe(after);
    const low = game(20); low.pendingEvent = careerEvent(low, 'campus-team');
    expect(choose(low, 'skill-management')).toBe(low);
  });
  it('offers different useful routes to research and communication specialists', () => {
    const research = game(20), communication = game(20);
    research.abilities!.values.research = 80; communication.abilities!.values.communication = 80;
    for (const s of [research, communication]) s.pendingEvent = careerEvent(s, 'campus-team');
    const researchRoute = abilityRoute(research, research.pendingEvent!, 'research')!;
    const peopleRoute = abilityRoute(research, research.pendingEvent!, 'people')!;
    expect(performancePreview(research, peopleRoute.focus, peopleRoute).tier).toBe('도움받아 진행');
    expect(performancePreview(research, researchRoute.focus, researchRoute).margin).toBeGreaterThan(performancePreview(research, peopleRoute.focus, peopleRoute).margin);
    expect(performancePreview(communication, peopleRoute.focus, peopleRoute).margin).toBeGreaterThan(performancePreview(communication, researchRoute.focus, researchRoute).margin);
  });
  it.each(ABILITY_SITUATIONS)('settles $key with real costs, learning, and save restoration', async situation => {
    const s = game(65); s.progress!.focus = situation.focus;
    if (['ability-technique', 'ability-practice'].includes(situation.key)) s.life!.elapsedMs = 36000;
    s.pendingEvent = careerEvent(s, situation.key);
    expect(s.pendingEvent).not.toBeNull(); expect(validState(s)).toBe(true);
    const db = await openGameDatabase(`impact-${situation.key}`);
    try {
      await persistGame(db, s, null);
      const restored = (await loadGame(db))!.state;
      const after = choose(s, 'attempt');
      expect(choose(restored, 'attempt')).toEqual(after); expect(validState(after)).toBe(true);
      expect(after.journal.some(e => e.detail.includes('중심 수행력'))).toBe(true);
    } finally { db.close(); }
  });
  it('retains exact old pending choices and rejects edited new choices and versions', () => {
    for (const legacyChoices of [false, true]) {
      const s = game(65); s.pendingEvent = careerEvent(s, 'ability-team', false, false, legacyChoices, true);
      expect(s.pendingEvent!.abilityImpactVersion).toBeUndefined(); expect(validState(s)).toBe(true);
      const after = choose(s, 'attempt');
      expect(after.journal.some(e => e.id === 'answer:abilities' && !e.detail.includes('중심 수행력'))).toBe(true);
      expect(validState(after)).toBe(true);
    }
    const s = game(); s.pendingEvent = careerEvent(s, 'campus-team');
    const tampered = structuredClone(s); tampered.pendingEvent!.choices[0].description += '수정'; expect(validState(tampered)).toBe(false);
    s.pendingEvent!.abilityImpactVersion = 2 as never; expect(validState(s)).toBe(false);
  });
  it('covers training and work choices for all specialties without changing authored costs', () => {
    for (const specialty of SPECIALTIES) for (const key of ['depth-training', 'depth-work']) {
      const s = game(70); s.career!.specialty = specialty.id; s.career!.application = 'accepted'; s.stageIndex = key === 'depth-training' ? 1 : 2;
      const e = careerEvent(s, key), old = careerEvent(s, key, false, false, false, true);
      expect(e!.abilityImpactVersion).toBe(1);
      for (const c of e!.choices) {
        expect(abilityRoute(s, e!, c.id)).toBeDefined();
        expect(c.effects).toEqual(old!.choices.find(o => o.id === abilityRoute(s, e!, c.id)!.base)!.effects);
        expect(c.description).toContain('피로');
      }
    }
  });
});

describe('starting ability explanations', () => {
  it('uses only actual background factors and leaves generation unchanged', () => {
    const s = game(), b = s.life!.background;
    for (const experience of EXPERIENCES) {
      b.experience = experience;
      const old = structuredClone(b), stats = backgroundStatEffects(b), skills = backgroundAbilityBonuses(b);
      for (const a of ABILITIES) {
        const reason = startingAbilityReason(b, a.id);
        expect(reason.length).toBeLessThan(100);
        expect(reason).not.toMatch(/부유|가난|재능|천재/);
      }
      for (const stat of ['health', 'happiness', 'knowledge', 'relationships'] as const) {
        const sources = [experience, LEARNING[b.profile!.learning], CLIMATES[b.profile!.climate], CHILDHOOD_HEALTH[b.profile!.childhoodHealth], '입학 당시의 개인차'];
        expect(sources).toContain(startingStatReason(b, stat));
      }
      expect(backgroundStatEffects(b)).toEqual(stats); expect(backgroundAbilityBonuses(b)).toEqual(skills); expect(b).toEqual(old);
    }
    b.experience = EXPERIENCES[6]; b.profile!.learning = 'library';
    expect(startingAbilityReason(b, 'research')).toContain('과학 동아리');
    const reasons = ABILITIES.map(a => startingAbilityReason(b, a.id));
    b.profile!.wealthTopPercent = 99; b.region = '제주';
    expect(ABILITIES.map(a => startingAbilityReason(b, a.id))).toEqual(reasons);
  });
  it('renders concise origins in the opening and skill details without mutating saves', () => {
    const s = game(), before = structuredClone(s);
    const opening = renderToStaticMarkup(<Opening draft={s} busy={false} disabled={false} entering={false} onPrepare={() => {}} onEnter={() => {}} onBack={() => {}}/>);
    expect(opening).toContain('시작 실력과 배경'); expect(opening).toContain('개인차');
    expect(opening).toContain(startingStatReason(s.life!.background, 'health'));
    const panel = renderToStaticMarkup(<AbilityContent game={s}/>);
    expect(panel).toContain('시작 배경:'); expect(s).toEqual(before);
    expect(abilityPerformance(s, 'judgment').base).toBe(50);
  });
});
