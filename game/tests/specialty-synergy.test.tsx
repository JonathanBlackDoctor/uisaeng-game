import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame } from '../src/career-runtime';
import { ABILITIES, SPECIALTY_SYNERGY, advanceAbilities, specialtySynergy } from '../src/abilities';
import { SPECIALTIES } from '../src/career';
import { advanceDynamics, resolveChoiceEffort, variableEarnings, settleVariableEarnings } from '../src/life-dynamics';
import AbilitySummary from '../src/AbilitySummary';
import { AbilityContent } from '../src/AbilityPanel';

function trained(seed = 42) {
  const s = createCareerGame('synergy', seed);
  s.stageIndex = 2; s.career!.application = 'accepted'; s.career!.specialty = 'surgery';
  s.career!.practice = 'research'; s.progress!.focus = 'clinical';
  s.stats = { health: 50, happiness: 50, knowledge: 50, relationships: 50 };
  s.dynamics!.fatigue = 0;
  for (const a of ABILITIES) s.abilities!.values[a.id] = 85;
  s.abilities!.specialties.surgery = 100;
  return s;
}

describe('multiplicative specialty synergy', () => {
  it('covers every specialty, requires complementary skills and respects mastery and condition', () => {
    expect(Object.keys(SPECIALTY_SYNERGY).sort()).toEqual(SPECIALTIES.map(s => s.id).sort());
    const s = trained(), strong = specialtySynergy(s, 'clinical'); expect(strong).toBeGreaterThan(3);
    s.abilities!.specialties.surgery = 0; expect(specialtySynergy(s, 'clinical')).toBeLessThan(strong);
    const novice = specialtySynergy(s, 'clinical');
    s.abilities!.values.judgment = 30; expect(specialtySynergy(s, 'clinical')).toBeLessThan(novice);
    s.career!.specialty = 'psychiatry'; s.abilities!.specialties.psychiatry = 100;
    expect(specialtySynergy(s, 'clinical')).toBe(strong);
    s.dynamics!.fatigue = 24; expect(specialtySynergy(s, 'clinical')).toBeLessThan(strong);
  });
  it('does not activate for students, retirement, unspecialized paths or unrelated activities', () => {
    const s = trained();
    for (const focus of ['study', 'people', 'rest'] as const) expect(specialtySynergy(s, focus)).toBe(1);
    for (const stage of [0, 3]) { s.stageIndex = stage; expect(specialtySynergy(s, 'clinical')).toBe(1); }
    s.stageIndex = 2; s.career!.application = 'untrained'; expect(specialtySynergy(s, 'clinical')).toBe(1);
    delete s.abilities; expect(specialtySynergy(s, 'clinical')).toBe(1);
  });
  it('multiplies actual positive monthly experience and preserves negative results with the same draws', () => {
    const grades = new Set<number>();
    for (let seed = 1; seed <= 120; seed++) {
      const s = trained(seed), base = structuredClone(s); base.career!.application = 'untrained';
      s.life!.elapsedMs = base.life!.elapsedMs = 1000;
      s.career!.experience.clinical = base.career!.experience.clinical = 20;
      advanceDynamics(s); advanceDynamics(base);
      const grade = s.dynamics!.lastGrade; grades.add(grade);
      expect(grade).toBe(base.dynamics!.lastGrade);
      const delta = base.career!.experience.clinical - 20;
      expect(s.career!.experience.clinical - 20).toBe(Math.round(delta * (delta > 0 ? specialtySynergy(s, 'clinical') : 1)));
      expect(s.dynamics!.seed).toBe(base.dynamics!.seed);
    }
    expect(grades.has(2)).toBe(true); expect(grades.has(-2)).toBe(true);
  });
  it('accelerates relevant skill growth, restores deterministically and does not reapply a month', () => {
    const s = trained(); s.abilities!.values.technique = s.abilities!.values.judgment = 60;
    s.abilities!.specialties.surgery = 40; s.life!.elapsedMs = 1000;
    const base = structuredClone(s), restored = JSON.parse(JSON.stringify(s)); base.career!.application = 'untrained';
    advanceAbilities(s); advanceAbilities(base); advanceAbilities(restored);
    expect(s.abilities!.values.technique).toBeGreaterThan(base.abilities!.values.technique);
    expect(s.abilities!.specialties.surgery).toBeGreaterThan(base.abilities!.specialties.surgery);
    expect(s.abilities).toEqual(restored.abilities);
    const once = structuredClone(s.abilities); advanceAbilities(s); expect(s.abilities).toEqual(once);
  });
  it('multiplies additional research earnings, keeps losses unchanged, and settles only once', () => {
    const s = trained(), base = structuredClone(s); base.career!.application = 'untrained';
    s.dynamics!.momentum.research = base.dynamics!.momentum.research = 10;
    expect(variableEarnings(s)).toBeCloseTo(variableEarnings(base) * specialtySynergy(s, 'research'), -1);
    s.economy!.lastMonth = 0; settleVariableEarnings(s);
    const once = structuredClone(s.economy); settleVariableEarnings(s); expect(s.economy).toEqual(once);
    s.dynamics!.momentum.research = base.dynamics!.momentum.research = -10;
    expect(variableEarnings(s)).toBe(variableEarnings(base));
  });
  it('applies to career choices once and displays the actual multiplier without mutating state', () => {
    const s = trained(); s.career!.experience.clinical = 20;
    resolveChoiceEffort(s, 'clinical-case', 'review', 'case-1');
    const once = structuredClone(s); resolveChoiceEffort(s, 'clinical-case', 'review', 'case-1'); expect(s).toEqual(once);
    const shown = specialtySynergy(s, 'clinical').toFixed(1);
    expect(renderToStaticMarkup(<AbilitySummary game={s}/>)).toContain(`전공 시너지 ×${shown}`);
    expect(renderToStaticMarkup(<AbilityContent game={s}/>)).toContain(`외과 시너지 ×${shown}`);
    expect(s).toEqual(once);
  });
  it('keeps career experience and training skill integral at fractional multipliers', () => {
    const s = trained(); s.abilities!.values.technique = s.abilities!.values.judgment = 60;
    s.abilities!.specialties.surgery = 40;
    expect(specialtySynergy(s, 'clinical') % 1).not.toBe(0);
    resolveChoiceEffort(s, 'depth-training-result', 'review', 'fractional-choice');
    expect(Number.isSafeInteger(s.depth!.skill)).toBe(true);
    expect(Number.isSafeInteger(s.career!.experience.clinical)).toBe(true);
    s.life!.elapsedMs = 1000; advanceDynamics(s);
    expect(Number.isSafeInteger(s.career!.experience.clinical)).toBe(true);
  });
  it('grows continuously and increasingly steeply with skill and mastery, beyond the former ceiling', () => {
    const s = trained();
    const value = (skill: number, mastery: number) => {
      for (const a of ABILITIES) s.abilities!.values[a.id] = skill;
      s.abilities!.specialties.surgery = mastery;
      return specialtySynergy(s, 'clinical');
    };
    const curve = [0, 20, 40, 60, 80, 100].map(n => value(n, 75));
    expect(curve[0]).toBe(1);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThan(curve[i - 1]);
      if (i > 1) expect(curve[i] - curve[i - 1]).toBeGreaterThan(curve[i - 1] - curve[i - 2]);
    }
    expect(value(100, 100)).toBe(16);
    expect(value(100, 100)).toBeGreaterThan(value(85, 100));
    const low = value(70, 25), mid = value(70, 50), high = value(70, 75);
    expect(high - mid).toBeGreaterThan(mid - low);
    const before = value(70, 50), after = value(70, 50.001);
    expect(after).toBeGreaterThan(before); expect(after - before).toBeLessThan(0.001);
    for (let skill = 0; skill <= 100; skill++) for (let mastery = 0; mastery <= 100; mastery += 10) {
      expect(Number.isFinite(value(skill, mastery))).toBe(true);
      expect(value(skill, mastery + 0.1)).toBeGreaterThanOrEqual(value(skill, mastery));
    }
  });
});
