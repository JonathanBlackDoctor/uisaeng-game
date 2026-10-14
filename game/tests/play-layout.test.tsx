import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { groupPlayLog, JournalHistory, logEmphasis, recentPlayLog } from '../src/PlayLog';
import PlayOverview from '../src/PlayOverview';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { describeChoice } from '../src/choice-journal';
import type { JournalEntry } from '../src/contracts';

const entry = (id: string, title = '공부하며 보낸 석 달', stage: JournalEntry['stage'] = 'university'): JournalEntry =>
  ({ id, title, stage, detail: '20세 · 기록', effects: { knowledge: 1 } });

describe('compact play layout data', () => {
  it('highlights actual large wealth changes while leaving transfers and loan receipts unmarked', () => {
    for (const kind of ['loss', 'gain', 'transfer', 'loan'] as const) {
      const before = createCareerGame('wealth-log', 42); before.pendingEvent = careerEvent(before, 'club-required');
      before.economy!.assets = before.economy!.cash = 100_000_000;
      const after = structuredClone(before), id = `wealth:${kind}`;
      after.journal.push({ id, title: '재정 변화', stage: 'university', detail: '', effects: {} });
      if (kind === 'loss') after.economy!.assets -= 40_000_000;
      if (kind === 'gain') after.economy!.assets += 40_000_000;
      if (kind === 'transfer') { after.economy!.cash -= 40_000_000; after.portfolio!.savings += 40_000_000; }
      if (kind === 'loan') { after.economy!.assets += 40_000_000; after.economy!.debt += 40_000_000; }
      describeChoice(before, after, { type: 'choose', id, eventId: before.pendingEvent!.id, choiceId: before.pendingEvent!.choices[0].id });
      expect(after.journal.at(-1)!.importance, kind).toBe(kind === 'loss' || kind === 'gain' ? 'major' : undefined);
    }
  });
  it('highlights large gains and losses even in otherwise routine records, and keeps smaller updates quiet', () => {
    const loss = { ...entry('auto:dynamics:3'), effects: { health: -15 } };
    const gain = { ...entry('other:gain'), effects: { knowledge: 12 } };
    const combined = { ...entry('other:loss'), effects: { health: -10, happiness: -10, relationships: -5 } };
    const small = entry('auto:dynamics:6');
    for (const e of [loss, gain, combined]) expect(logEmphasis(e)).toBe('major');
    expect(logEmphasis(small)).toBe('routine');
    expect(recentPlayLog([loss, small]).flat().map(e => e.id)).toEqual([loss.id]);
    const html = renderToStaticMarkup(<JournalHistory entries={[loss, gain, combined, small]}/>);
    expect(html.match(/class="play-log-entry log-major"/g)).toHaveLength(3);
    expect(html).toContain('큰 변화');
  });
  it('groups only adjacent periodic updates without swallowing a choice or stage change', () => {
    const entries = [entry('auto:dynamics:3'), entry('auto:dynamics:6'), entry('choice:1'), entry('auto:dynamics:9'), entry('auto:dynamics:12', undefined, 'training')];
    const before = structuredClone(entries);
    expect(groupPlayLog(entries).map(group => group.map(e => e.id))).toEqual([
      ['auto:dynamics:12'], ['auto:dynamics:9'], ['choice:1'], ['auto:dynamics:6', 'auto:dynamics:3'],
    ]);
    expect(entries).toEqual(before);
  });
  it('shows arrears and negative net assets and preserves totals after completion', () => {
    const game = createCareerGame('layout-test', 42);
    game.economy!.assets = 100_000;
    game.economy!.debt = 200_000;
    game.economy!.due = 300_000;
    const render = () => renderToStaticMarkup(<PlayOverview game={game} busy={false} onAbilities={() => {}}>시간</PlayOverview>);
    expect(render()).toContain('−40만 원');
    expect(render()).toContain('미납');
    game.status = 'completed';
    expect(render()).toContain('누적 진료');
    expect(render()).toContain('−40만 원');
    expect(render()).not.toContain('월 잔여');
  });
  it('folds repeated finance records without hiding the admission or intervening choice', () => {
    const entries = [entry('background', '의대 입학'), entry('auto:money:6', '이번 달 수입과 지출'), entry('auto:money:12', '이번 달 수입과 지출'), entry('choice:2', '지원할 병원'), entry('auto:money:18', '이번 달 수입과 지출')];
    expect(groupPlayLog(entries).map(group => group.length)).toEqual([1, 1, 2, 1]);
    const html = renderToStaticMarkup(<JournalHistory entries={entries}/>);
    expect(html).toContain('log-milestone');
    expect(html).toContain('지원할 병원');
    expect(html).toContain('일상 기록');
    expect(html).toContain('3개 기록');
    for (const title of ['의대 입학', '지원할 병원', '이번 달 수입과 지출']) expect(html).toContain(title);
  });
  it('keeps monthly finances in details and shows a deficit only when expenses exceed income', () => {
    const game = createCareerGame('finance-layout', 7);
    game.stageIndex = 2;
    game.career!.practice = 'employed';
    game.economy!.cash = 8_000_000;
    const render = () => renderToStaticMarkup(<PlayOverview game={game} busy={false} onAbilities={() => {}}>시간</PlayOverview>);
    const html = render();
    const overview = html.split('<details class="overview-finance-details"')[0];
    expect(overview).toContain('보유금');
    expect(overview).toContain('800만 원');
    for (const label of ['월수입', '월지출', '매달 남는 돈', '현재 연봉', '순자산', '적자']) expect(overview).not.toContain(label);
    for (const label of ['월수입', '월지출', '매달 남는 돈']) expect(html).toContain(label);
    game.stageIndex = 0;
    game.progress!.focus = 'study';
    expect(render().split('<details class="overview-finance-details"')[0]).toContain('적자');
  });
});
