import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame } from '../src/career-runtime';
import { careerMonthMs, DEFAULT_RUN_LENGTH, setStartingLength, pacingArc } from '../src/pacing';
import { reduceGame } from '../src/engine';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import { measureRun } from './helpers/pacing';
import Opening from '../src/Opening';
import PlayLog, { JournalHistory, recentPlayLog } from '../src/PlayLog';
import type { JournalEntry } from '../src/contracts';

describe('session length and readable recent history', () => {
  it('changes only the draft setting and locks the length after starting', () => {
    const base = createCareerGame('length', 42), snapshot = structuredClone(base);
    const short = setStartingLength(base, DEFAULT_RUN_LENGTH);
    expect(short.life).toEqual(base.life); expect(short.identity).toEqual(base.identity);
    expect(base).toEqual(snapshot); expect(careerMonthMs(short)).toBe(3900);
    expect(careerMonthMs(setStartingLength(short, 'standard'))).toBe(7800);
    const begun = reduceGame(short, { type: 'control', id: 'start', paused: false });
    expect(setStartingLength(begun, 'standard')).toBe(begun);
    const html = renderToStaticMarkup(<Opening draft={short} onLengthChange={() => {}} busy={false} disabled={false} entering={false} onPrepare={() => {}} onEnter={() => {}} onBack={() => {}}/>);
    expect(html).toContain('한 판 분량'); expect(html).toContain('길게');
    expect(html).toMatch(/<input(?=[^>]*value="short")(?=[^>]*checked="")[^>]*\/>기본/);
    expect(html.indexOf('value="short"')).toBeLessThan(html.indexOf('value="standard"'));
    const long = setStartingLength(short, 'standard');
    const longHtml = renderToStaticMarkup(<Opening draft={long} onLengthChange={() => {}} busy={false} disabled={false} entering={false} onPrepare={() => {}} onEnter={() => {}} onBack={() => {}}/>);
    expect(longHtml).toMatch(/<input(?=[^>]*value="standard")(?=[^>]*checked="")[^>]*\/>길게/);
    expect(careerMonthMs(long)).toBe(7800);
  });
  it('restores the chosen length and preserves both generations of old pacing', async () => {
    let short = setStartingLength(createCareerGame('restore-length', 42), 'short');
    short = reduceGame(short, { type: 'control', id: 'start', paused: false });
    short = reduceGame(short, { type: 'tick', id: 'partial', elapsedMs: 17 });
    const db = await openGameDatabase(`length-${crypto.randomUUID()}`);
    try { await persistGame(db, short, null); expect((await loadGame(db))!.state).toEqual(short); } finally { db.close(); }
    const old = createCareerGame('old-length', 42); delete old.progress!.runLength;
    expect(careerMonthMs(old)).toBe(7800); expect(validState(old)).toBe(true);
    delete old.progress!.pacingVersion; expect(careerMonthMs(old)).toBe(6000); expect(validState(old)).toBe(true);
    old.progress!.runLength = 'short'; expect(validState(old)).toBe(false);
    old.progress!.pacingVersion = 1; old.progress!.runLength = 'unknown' as never; expect(validState(old)).toBe(false);
  });
  it('finishes a shorter life with all required choices and its connected ending', () => {
    const standard = measureRun(3, 'untrained'), short = measureRun(3, 'untrained', true, 16, 'short');
    expect(short.state.status).toBe('completed'); expect(short.keys.length).toBeLessThan(standard.keys.length);
    expect(short.activeSeconds / standard.activeSeconds).toBeLessThan(.55);
    for (const key of ['club-required', 'specialty-required', 'marriage-required', 'practice-required']) expect(short.keys).toContain(key);
    const arc = pacingArc(short.state) === 'peer' ? ['peer-seat', 'peer-distance', 'peer-offer', 'peer-retirement'] : ['shared-notebook', 'notebook-return', 'notebook-handover', 'notebook-ending'];
    expect(short.keys).toEqual(expect.arrayContaining(arc.map(id => `story:${id}`)));
    expect(Object.values(short.state.stories!.decisions).every(d => d.followed)).toBe(true);
  }, 30000);
  it('keeps short-mode outcomes identical at 1x and 16x', () => {
    const slow = measureRun(2, 'untrained', true, 1, 'short'), fast = measureRun(2, 'untrained', true, 16, 'short');
    expect(slow.keys).toEqual(fast.keys); expect(slow.state.stats).toEqual(fast.state.stats);
    expect(slow.state.seed).toBe(fast.state.seed); expect(slow.state.stories).toEqual(fast.state.stories);
  }, 30000);
  it('keeps recent history quiet and readable, with routine details in the full archive', () => {
    const entry = (id: string, detail = '20세 · 친구와 산책했습니다.'): JournalEntry => ({ id, stage: 'university', title: '하루의 기록', detail, effects: {} });
    const entries = [entry('background'), ...Array.from({ length: 90 }, (_, i) => entry(`auto:campus:ambient:${i}`)), entry('auto:money:6'), entry('publication:paper1'),
      ...Array.from({ length: 12 }, (_, i) => ({ ...entry(`choice:${i}`), choice: { label: '동료와 나눠 맡기', context: '발표 일주일 전, 팀원이 빠졌습니다.', detail: '남은 팀원들과 역할을 다시 나눴습니다.', effects: {} } }))];
    const groups = recentPlayLog(entries);
    expect(groups).toHaveLength(8); expect(groups.flat().every(e => !!e.choice)).toBe(true);
    const html = renderToStaticMarkup(<PlayLog entries={entries} onOpenJournal={() => {}}/>);
    expect(html).toContain('팀원이 빠졌습니다.'); expect(html).toContain('역할을 다시 나눴습니다.'); expect(html).not.toContain('친구와 산책했습니다.');
    const full = renderToStaticMarkup(<JournalHistory entries={entries}/>);
    expect(full).toContain('일상 기록'); expect(full).toContain('친구와 산책했습니다.');
    expect(entries).toHaveLength(105);
  });
});
