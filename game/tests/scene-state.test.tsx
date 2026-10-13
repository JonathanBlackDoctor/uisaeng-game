import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { initialStories } from '../src/life-stories';
import { sceneActivity, sceneRoom, sceneStory, seasonIndex } from '../src/scene-state';
import LifeScene from '../src/LifeScene';

function fixture() {
  const s = createCareerGame('scene-test', 42);
  s.stories = initialStories();
  s.pendingEvent = careerEvent(s, 'story:shared-notebook');
  return s;
}
describe('life stage presentation', () => {
  it('switches army scenery and clothing together and restores civilian scenes', () => {
    const base = { stage: 'university' as const, age: 23, month: 4, running: false, focus: 'rest' as const, seed: 42, relationship: 'married' as const, children: 'young' as const };
    const army = renderToStaticMarkup(<LifeScene {...base} serviceRoute="army"/>);
    expect(army).toContain('data-room="barracks"');
    expect(army).toContain('class="ls-barracks-furniture"');
    expect(army).toContain('data-outfit="military-tracksuit"');
    expect(army).not.toContain('<strong>배우자</strong>');
    expect(army).not.toContain('<strong>자녀</strong>');
    const restored = renderToStaticMarkup(<LifeScene {...base}/>);
    expect(restored).toContain('data-room="home"');
    expect(restored).not.toContain('ls-barracks-furniture');
    expect(restored).not.toContain('military-tracksuit');
    for (const serviceRoute of ['doctor', 'public-health'] as const) {
      const medical = renderToStaticMarkup(<LifeScene {...base} serviceRoute={serviceRoute}/>);
      expect(medical).toContain('data-outfit="medical"');
      expect(medical).not.toContain('ls-barracks-furniture');
    }
  });
  it('uses the active career activity rather than the legacy life focus', () => {
    const s = fixture(); s.life!.focus.main = 'study';
    s.progress!.focus = 'rest'; expect(sceneActivity(s)).toBe('rest');
    s.progress!.focus = 'people'; expect(sceneActivity(s)).toBe('connect');
    s.progress!.focus = 'research'; expect(sceneActivity(s)).toBe('study');
    expect(sceneActivity(null)).toBe('study');
  });
  it.each(['lead', 'share', 'decline'])('reflects the actual %s notebook choice without mutating the game', (choiceId: string) => {
    const s = fixture();
    const snapshot = JSON.stringify(s);
    expect(sceneStory(s)).toEqual({ notebook: 'offered', guestName: '같은 조였던 동기' });
    expect(JSON.stringify(s)).toBe(snapshot);
    const next = reduceGame(s, { type: 'choose', id: `scene-${choiceId}`, eventId: s.pendingEvent!.id, choiceId });
    expect(next.stories!.decisions['shared-notebook'].choice).toBe(choiceId);
    expect(sceneStory(next).notebook).toBe(choiceId === 'decline' ? 'returned' : 'kept');
    expect(sceneStory(next).guestName).toBeUndefined();
    expect(sceneStory(JSON.parse(JSON.stringify(next)))).toEqual(sceneStory(next));
  });
  it('does not invent a notebook or a visitor for legacy/other events', () => {
    const s = fixture(); s.pendingEvent = null; s.stories = undefined;
    expect(sceneStory(s)).toEqual({ notebook: 'none', guestName: undefined });
    expect(sceneStory(null)).toEqual({ notebook: 'none', guestName: undefined });
  });
  it('matches rooms to activity and actual work context', () => {
    expect(sceneRoom('career', 'study', 'research')).toBe('research');
    expect(sceneRoom('career', 'study', 'preparation')).toBe('preparation');
    expect(sceneRoom('training', 'study')).toBe('ward');
    expect(sceneRoom('career', 'study')).toBe('clinic');
    expect(sceneRoom('training', 'rest')).toBe('home');
    expect(sceneRoom('university', 'rest', undefined, 'offered')).toBe('library');
    expect(sceneRoom('retirement', 'study', 'research')).toBe('home');
  });
  it('renders truthful people and retained notes without exposing hidden actors', () => {
    const base = { stage: 'university' as const, age: 23, month: 4, running: true, focus: 'study' as const, seed: 42, relationship: 'single' as const };
    const alone = renderToStaticMarkup(<LifeScene {...base}/>);
    expect(alone).not.toContain('<strong>배우자</strong>');
    expect(alone).not.toContain('<strong>자녀</strong>');
    const story = renderToStaticMarkup(<LifeScene {...base} notebook="kept"/>);
    expect(story).toContain('함께 확인한 노트가 책상에 놓여 있습니다.');
    const home = renderToStaticMarkup(<LifeScene {...base} focus="rest" relationship="married" partnerName="하람" children="young"/>);
    expect(home).toContain('<strong>하람</strong>');
    expect(home).toContain('어린 자녀');
    expect([0, 2, 5, 8, 11].map(seasonIndex)).toEqual([3, 0, 1, 2, 3]);
  });
});
