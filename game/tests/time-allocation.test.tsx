import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TimeAllocation, { allocationSummary, TimeAllocationContent } from '../src/TimeAllocation';
import PlayOverview from '../src/PlayOverview';
import CareerPanel from '../src/CareerPanel';
import { careerEvent, createCareerGame } from '../src/career-runtime';
import { createGame, reduceGame } from '../src/engine';
import { loadGame, openGameDatabase, persistGame } from '../src/storage';

const noop = () => {};
describe('visible time allocation', () => {
  it('exposes the empty plan and entry button in the sticky overview, before finances', () => {
    const game = createCareerGame('visible-plan', 42), before = structuredClone(game);
    const html = renderToStaticMarkup(<PlayOverview game={game} busy={false} onAbilities={noop} allocation={<TimeAllocation game={game} busy={false} onOpen={noop}/>}>시간 조작</PlayOverview>);
    expect(html).toContain('주로 하는 일 · 공부');
    expect(html).toContain('생활 활동 없음 · 여유 14시간/주');
    expect(html).toContain('시간·생활 바꾸기');
    expect(html).toContain('건너뛰기');
    expect(html.indexOf('지금의 시간 배분')).toBeLessThan(html.indexOf('생애 기록과 재정'));
    expect(html.slice(html.indexOf('지금의 시간 배분'), html.indexOf('생애 기록과 재정'))).not.toContain('<details');
    expect(game).toEqual(before);
  });
  it('shows actual active hours and suspended activities after the time budget shrinks', () => {
    const game = createCareerGame('shrinking-plan', 42);
    game.lifestyle!.enabled.exercise = true;
    game.lifestyle!.enabled.family = true;
    expect(allocationSummary(game)).toMatchObject({ activities: '운동 3시간 · 가족과 시간 보내기 6시간', remaining: 5, budget: 14, suspended: [] });
    game.stageIndex = 1;
    expect(allocationSummary(game)).toMatchObject({ activities: '운동 3시간', remaining: 3, budget: 6, suspended: ['가족과 시간 보내기'] });
    const html = renderToStaticMarkup(<TimeAllocation game={game} busy={false} onOpen={noop}/>);
    expect(html).toContain('가족과 시간 보내기 중단 중');
    expect(game.lifestyle!.enabled.family).toBe(true);
  });
  it('keeps focus, lifestyle and diet in the editor and finance in the career section', () => {
    const game = createCareerGame('plan-editor', 42);
    const html = renderToStaticMarkup(<TimeAllocationContent game={game} busy={false} act={noop}/>);
    for (const label of ['주로 하는 일', '운동', '가족과 시간 보내기', '식생활', '여유 14시간/주']) expect(html).toContain(label);
    expect(html).not.toContain('<details><summary>생활 설정');
    expect(html).not.toContain('저축·투자·상환');
    const career = renderToStaticMarkup(<CareerPanel game={game} busy={false} act={noop}/>);
    expect(career).toContain('저축·투자·상환');
    expect(career).not.toContain('생활 설정');
    expect(career).not.toContain('주로 하는 일');
  });
  it('keeps an important pending choice authoritative and hides controls after completion', () => {
    const game = createCareerGame('blocked-plan', 42);
    game.pendingEvent = careerEvent(game, 'club-required');
    expect(renderToStaticMarkup(<TimeAllocation game={game} busy={false} onOpen={noop}/>)).toContain('disabled=""');
    const html = renderToStaticMarkup(<TimeAllocationContent game={game} busy={false} act={noop}/>);
    expect(html.match(/<select[^>]*disabled=""/g)).toHaveLength(2);
    game.status = 'completed';
    expect(renderToStaticMarkup(<TimeAllocation game={game} busy={false} onOpen={noop}/>)).toBe('');
  });
  it('shows service suspension without displaying normal weekly activity as active', () => {
    const game = createCareerGame('serving-plan', 42);
    game.identity!.service.status = 'serving';
    game.identity!.service.route = 'army';
    game.lifestyle!.enabled.exercise = true;
    const html = renderToStaticMarkup(<TimeAllocation game={game} busy={false} onOpen={noop}/>);
    expect(html).toContain('복무 중');
    expect(html).toContain('생활 활동은 잠시 쉬어요');
    expect(html).not.toContain('운동 3시간');
    expect(html).not.toContain('여유');
    expect(html).toContain('disabled=""');
  });
  it('preserves the activity controls for old turn-based saves without a life clock', () => {
    const game = createGame('legacy-plan', 42);
    delete game.life;
    delete game.career;
    delete game.progress;
    const html = renderToStaticMarkup(<TimeAllocationContent game={game} busy={false} act={noop}/>);
    expect(html).toContain('보조활동');
    expect(html).toContain('이렇게 하루 보내기');
  });
  it('applies the existing actions and restores focus, activities and diet from storage', async () => {
    let game = createCareerGame('saved-plan', 42);
    const db = await openGameDatabase('visible-plan-test');
    try {
      game = reduceGame(game, { type: 'career-focus', id: 'plan-focus', focus: 'research' });
      game = reduceGame(game, { type: 'lifestyle', id: 'plan-exercise', key: 'exercise', enabled: true });
      game = reduceGame(game, { type: 'diet', id: 'plan-diet', diet: 'frugal' });
      await persistGame(db, game, null);
      const saved = (await loadGame(db))!.state;
      expect(saved.progress!.focus).toBe('research');
      expect(saved.lifestyle!.diet).toBe('frugal');
      expect(allocationSummary(saved)).toMatchObject({ focus: '연구', activities: '운동 3시간', remaining: 11 });
      expect(saved.life!.elapsedMs).toBe(0);
    } finally { db.close(); }
  });
});
