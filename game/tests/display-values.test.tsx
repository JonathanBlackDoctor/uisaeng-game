import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { ABILITIES, abilityPerformance } from '../src/abilities';
import { roundedValue, signedValue, synergyLabel } from '../src/display-values';
import { choiceResult } from '../src/choice-feedback';
import { resultShareData } from '../src/result-share';
import Opening from '../src/Opening';
import PlayOverview from '../src/PlayOverview';
import { AbilityContent } from '../src/AbilityPanel';
import AbilitySummary from '../src/AbilitySummary';
import LifetimeRecords from '../src/LifetimeRecords';
import { JournalHistory } from '../src/PlayLog';

const visible = (html: string) => html.replace(/<[^>]*>/g, '');
describe('rounded presentation with precise saved values', () => {
  it('rounds signed fractions consistently without displaying negative zero or rounding multipliers away', () => {
    expect([49.49, 49.5, -1.5, -.2, 99.999999].map(roundedValue)).toEqual([49, 50, -2, 0, 100]);
    expect([1.5, -1.5, -.2, .2].map(signedValue)).toEqual(['+2', '-2', '0', '0']);
    expect(synergyLabel(1.5)).toBe('+50%');
  });
  it('uses whole-number stats throughout opening, overview, records and sharing without mutating the game', () => {
    const game = createCareerGame('fractional-display', 42);
    game.stats = { health: 79.5999999, happiness: 52.4, knowledge: 61.5, relationships: 47.49 };
    game.statHighs = { values: { ...game.stats }, fromStart: true };
    const before = structuredClone(game);
    const opening = renderToStaticMarkup(<Opening draft={game} busy={false} disabled={false} entering={false} onPrepare={() => {}} onEnter={() => {}} onBack={() => {}}/>);
    const overview = renderToStaticMarkup(<PlayOverview game={game} busy={false} onAbilities={() => {}}>시간</PlayOverview>);
    const records = renderToStaticMarkup(<LifetimeRecords game={game} records={[]}/>);
    for (const html of [opening, overview, records]) {
      expect(visible(html)).not.toMatch(/\d+\.\d+/);
      expect(visible(html)).toContain('80');
    }
    expect(overview).toContain('aria-valuenow="80"');
    expect(resultShareData(game).text).toContain('건강 80 · 행복 52 · 지식 62 · 관계 47');
    expect(opening).not.toContain('disabled=""');
    expect(game).toEqual(before);
  });
  it('rounds acquired skills, effective skills and specialization without rewriting their precision', () => {
    const game = createCareerGame('fractional-skills', 42);
    for (const { id } of ABILITIES) game.abilities!.values[id] = 63.65;
    game.abilities!.specialties.internal = 23.5;
    game.abilities!.changes.judgment = { month: 0, delta: 1.65, reason: '공부' };
    const before = structuredClone(game);
    const html = renderToStaticMarkup(<AbilityContent game={game}/>);
    expect(visible(html)).not.toMatch(/\d+\.\d+/);
    expect(html).toContain('쌓은 실력 64');
    expect(html).toContain('24<small>/100');
    expect(html).toContain('공부 (+2)');
    expect(game).toEqual(before);
  });
  it('does not unlock a choice when a rounded score reaches its threshold', () => {
    const game = createCareerGame('rounded-gate', 42);
    game.abilities!.values.management = 50;
    game.abilities!.values.management += 54.6 - abilityPerformance(game, 'management').current;
    game.pendingEvent = careerEvent(game, 'ability-schedule');
    expect(game.pendingEvent!.choices.some(c => c.id === 'advanced')).toBe(false);
    const before = structuredClone(game);
    const html = visible(renderToStaticMarkup(<AbilitySummary game={game} decision/>));
    expect(html).toContain('55');
    expect(html).toContain('실력을 더 쌓으면');
    expect(game).toEqual(before);
  });
  it('rounds positive and negative feedback and hides zero-rounded noise while preserving journal data', () => {
    const before = createCareerGame('fractional-result', 42);
    before.pendingEvent = careerEvent(before, 'ability-schedule');
    const after = structuredClone(before);
    after.stats.health -= 1.6; after.stats.knowledge += 2.6; after.stats.happiness += .1;
    after.journal.push({ id: 'pick:result', stage: 'university', title: '선택 결과', detail: '20세 · 기록', effects: { health: -1.6, knowledge: 2.6, happiness: .1 } });
    const original = structuredClone(after);
    const feedback = choiceResult(before, after, 'pick')!;
    expect(feedback.changes).toEqual(['건강 -2', '지식 +3']);
    const html = visible(renderToStaticMarkup(<JournalHistory entries={[after.journal.at(-1)!]}/>));
    expect(html).toContain('건강 -2'); expect(html).toContain('지식 +3');
    expect(html).not.toContain('행복'); expect(html).not.toMatch(/\d+\.\d+/);
    expect(after).toEqual(original);
  });
});
