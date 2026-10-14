import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { measureRun } from './helpers/pacing';
import * as retention from '../src/journal-retention';
import { journalCopy } from '../src/journal-copy';
import PlayLog, { JournalHistory } from '../src/PlayLog';
import { choiceResult } from '../src/choice-feedback';
import { reduceGame } from '../src/engine';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import type { JournalEntry } from '../src/contracts';

const entry = (id: string, detail = '20세 · 동료와 기록을 확인했습니다.'): JournalEntry => ({ id, stage: 'university', title: '활동 기록', detail, effects: {} });

describe('journal density', () => {
  it.each(['untrained', 'academic'] as const)('reduces the %s route without changing any simulation outcomes', mode => {
    const spy = vi.spyOn(retention, 'compactJournal').mockImplementation(entries => entries);
    let baseline: ReturnType<typeof measureRun>;
    try { baseline = measureRun(2, mode, true, 16, 'short'); } finally { spy.mockRestore(); }
    const { state } = measureRun(2, mode, true, 16, 'short');
    expect({ ...state, journal: [] }).toEqual({ ...baseline!.state, journal: [] });
    expect(state.journal.filter(e => e.choice)).toEqual(baseline!.state.journal.filter(e => e.choice));
    expect(state.journal.length).toBeLessThan(baseline!.state.journal.length / 4);
    console.log(JSON.stringify({ mode, before: baseline!.state.journal.length, after: state.journal.length, choices: state.journal.filter(e => e.choice).length }));
  }, 30000);

  it('replaces snapshots but keeps major changes, decisions, story endings and distinct warnings', () => {
    const entries = [entry('background'), entry('auto:dynamics:3'), entry('auto:money:6'), entry('auto:campus:ambient:7'),
      entry('impact:diagnosis:20:23:health'), entry('auto:dynamics:9'), entry('auto:money:12'), entry('auto:campus:ambient:13'),
      entry('impact:diagnosis:20:26:health'), entry('impact:diagnosis:20:end'), entry('auto:story:friend:follow'),
      { ...entry('auto:dynamics:15'), effects: { health: -20 } }, { ...entry('auto:money:18'), importance: 'major' as const },
      { ...entry('auto:dynamics:21'), choice: { label: '휴식', detail: '쉬었습니다.', effects: {} } },
      entry('auto:lifestyle:10', '20세 · 유료 교육은 비용이 부족해 쉬었습니다.'), entry('auto:lifestyle:11', '20세 · 운동은 비용이 부족해 쉬었습니다.')];
    const before = structuredClone(entries), result = retention.compactJournal(entries);
    expect(result.map(e => e.id)).toEqual(entries.filter((_, index) => ![1, 2, 3, 4].includes(index)).map(e => e.id));
    expect(entries).toEqual(before); expect(retention.compactJournal(result)).toEqual(result);
  });

  it('keeps action feedback and restores a compacted old save without losing a pending choice', async () => {
    const s = createCareerGame('old-dense-log', 42);
    s.pendingEvent = careerEvent(s, 'club-required');
    s.journal.push(...Array.from({ length: 80 }, (_, i) => entry(`auto:money:${i}`)));
    const original = structuredClone(s);
    const next = reduceGame(s, { type: 'choose', id: 'pick', eventId: s.pendingEvent!.id, choiceId: 'pass' });
    expect(next.journal.length).toBeLessThan(s.journal.length);
    expect(choiceResult(s, next, 'pick')?.detail).toContain('가입하지');
    expect(s).toEqual(original); expect(validState(next)).toBe(true);
    const db = await openGameDatabase(`compact-log-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      expect((await loadGame(db))!.state).toEqual(original);
      await persistGame(db, next, { runId: s.runId, revision: s.revision });
      expect((await loadGame(db))!.state).toEqual(next);
    } finally { db.close(); }
  });

  it('shows one continuous paragraph, keeps money and timing visible, and folds only supporting context', () => {
    const e = { ...entry('pick'), choice: { label: '동료와 역할 나누기', detail: '발표를 마쳤습니다. 준비 방법을 동료와 돌아봤습니다. 비용 120000원과 부채 300000원이 남았습니다. 3개월 뒤 다시 확인합니다.', context: '발표 하루 전, 동료가 아팠습니다.', effects: { knowledge: 1 } } };
    const copy = journalCopy(e);
    expect(copy.text).toContain('동료와 역할 나누기 · 발표를 마쳤습니다.');
    expect(copy.text).toContain('120000원'); expect(copy.text).toContain('3개월');
    expect(copy.text).not.toContain('준비 방법'); expect(copy.more).toContain('준비 방법');
    const html = renderToStaticMarkup(<PlayLog entries={[e]} onOpenJournal={() => {}}/>);
    expect(html).not.toContain('<strong>활동 기록'); expect(html).not.toContain('<details open');
    const line = html.split('class="play-log-line"')[1].split('</p>')[0];
    expect(line).toContain('동료와 역할 나누기'); expect(line).toContain('12만 원');
    expect(line).not.toContain('발표 하루 전'); expect(html).toContain('발표 하루 전');
    const old = [entry('auto:money:1', '이전 정산'), entry('auto:money:2', '최신 정산')];
    const snapshot = structuredClone(old);
    const history = renderToStaticMarkup(<JournalHistory entries={old}/>);
    expect(history).not.toContain('이전 정산'); expect(history).toContain('최신 정산'); expect(old).toEqual(snapshot);
    const background = journalCopy(entry('background', '20세 · 서울 · 대도시에서 성장 · 가정 형편 상위 15% · 가족과 가까운 유대'));
    expect(background.summary).toBe('서울 · 대도시에서 성장');
    expect(background.more).toContain('가정 형편 상위 15%');
  });
});
