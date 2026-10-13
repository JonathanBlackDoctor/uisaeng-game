import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LifeScene, { type LifeSceneProps } from '../src/LifeScene';
import { SPECIALTIES } from '../src/career';
import { SPECIALTY_VISUALS } from '../src/SceneScenery';
import { sceneAppearance, sceneRoom } from '../src/scene-state';
import { createCareerGame } from '../src/career-runtime';
import { initialLifestyle } from '../src/lifestyle';

const base: LifeSceneProps = { stage: 'career', age: 38, month: 3, running: false, focus: 'study', seed: 42, relationship: 'single' };
const render = (props: Partial<LifeSceneProps> = {}) => renderToStaticMarkup(<LifeScene {...base} {...props}/>);

describe('state-driven scene variety', () => {
  it('covers the actual specialty catalog with valid renderable art', () => {
    expect(Object.keys(SPECIALTY_VISUALS).sort()).toEqual(SPECIALTIES.map(s => s.id).sort());
    for (const { id } of SPECIALTIES) {
      const html = render({ specialty: id });
      expect(html).toContain(`data-specialty-art="${id}"`);
      expect(html).toContain(`data-equipment="${SPECIALTY_VISUALS[id].equipment}"`);
      expect(html).not.toMatch(/NaN|undefined|\[object Object\]/);
    }
    expect(render({ specialty: 'unknown-future-specialty' })).not.toContain('data-specialty-art');
  });
  it('does not turn rejected applications, student interests, or disabled activities into visual achievements', () => {
    const game = createCareerGame('visual-source', 42);
    game.career!.specialty = 'surgery';
    game.career!.application = 'rejected';
    game.stageIndex = 1;
    expect(sceneAppearance(game).specialty).toBeUndefined();
    game.career!.application = 'accepted';
    expect(sceneAppearance(game).specialty).toBe('surgery');
    game.stageIndex = 0;
    expect(sceneAppearance(game).specialty).toBeUndefined();
    game.lifestyle = initialLifestyle();
    expect(sceneAppearance(game).exercise).toBe(false);
    game.lifestyle.enabled.exercise = true;
    const saved = JSON.stringify(game);
    expect(sceneAppearance(game).exercise).toBe(true);
    expect(sceneAppearance(JSON.parse(saved))).toEqual(sceneAppearance(game));
    expect(JSON.stringify(game)).toBe(saved);
  });
  it('keeps specialty equipment out of rest, research, retirement, and service scenes', () => {
    for (const props of [{ focus: 'rest' as const }, { workContext: 'research' as const }, { stage: 'retirement' as const }, { serviceRoute: 'army' as const }, { serviceRoute: 'doctor' as const }, { serviceRoute: 'public-health' as const }]) {
      expect(render({ specialty: 'surgery', ...props })).not.toContain('data-specialty-art');
      expect(render({ specialty: 'surgery', ...props })).not.toContain('data-outfit="scrubs"');
    }
    expect(render({ specialty: 'surgery' })).toContain('data-outfit="scrubs"');
    expect(render({ workContext: 'research' })).toContain('data-outfit="lab-coat"');
    expect(render({ stage: 'university' })).toContain('data-outfit="hoodie"');
    expect(render({ focus: 'rest', month: 11 })).toContain('data-outfit="cardigan"');
  });
  it('uses campus and park only for appropriate life stages and preserves story priority', () => {
    expect(sceneRoom('university', 'connect')).toBe('campus');
    expect(sceneRoom('retirement', 'connect')).toBe('park');
    expect(sceneRoom('university', 'connect', undefined, 'offered')).toBe('library');
    expect(sceneRoom('training', 'connect')).toBe('lounge');
    expect(sceneRoom('retirement', 'rest')).toBe('home');
  });
  it('shows seasonal art and child/activity props only in matching contexts', () => {
    for (const [month, season] of [[2, 0], [5, 1], [8, 2], [11, 3]]) {
      expect(render({ month })).toContain(`data-season-art="${season}"`);
    }
    const young = render({ focus: 'rest', children: 'young' });
    expect(young).toContain('data-prop="child-toys"');
    expect(young).not.toContain('data-prop="school-bag"');
    const school = render({ focus: 'rest', children: 'school' });
    expect(school).toContain('data-prop="school-bag"');
    expect(school).not.toContain('data-prop="child-toys"');
    expect(render({ focus: 'rest', children: 'none' })).not.toContain('data-prop="child-toys"');
    expect(render({ focus: 'rest', exercise: true })).toContain('data-prop="exercise-kit"');
    expect(render({ exercise: true })).not.toContain('data-prop="exercise-kit"');
    expect(render({ focus: 'rest', extraStudy: true })).toContain('data-prop="study-books"');
  });
});
