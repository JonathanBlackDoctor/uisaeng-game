import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { eventParagraphs, readableEvent, readableText } from '../src/event-copy';
import { careerEvent, createCareerGame, reduceCareerGame } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { ABILITY_SITUATIONS } from '../src/abilities';
import { openGameDatabase, persistGame, loadGame, validState } from '../src/storage';
import PlayLog, { groupPlayLog } from '../src/PlayLog';
import type { GameState } from '../src/contracts';

const choose = (s: GameState, choiceId: string) => ({ type: 'choose' as const, id: `choice:${s.revision}`, eventId: s.pendingEvent!.id, choiceId });
const at = (key: string, month = 1) => {
  const s = createCareerGame('copy', 42); s.life!.elapsedMs = month * 1000;
  s.pendingEvent = careerEvent(s, key); return s;
};

describe('readable events and choice records', () => {
  it('shows concise copy while keeping saved IDs, rules, source notes and original text intact', () => {
    const s = at('club-required'), original = structuredClone(s);
    const shown = readableEvent(s.pendingEvent!);
    expect(shown.body.length).toBeLessThan(s.pendingEvent!.body.length);
    expect(shown.choices.find(c => c.id === 'pass')!.label).toBe('가입하지 않기');
    expect(shown.choices.map(c => [c.id, c.effects])).toEqual(s.pendingEvent!.choices.map(c => [c.id, c.effects]));
    expect(shown.id).toBe(s.pendingEvent!.id);
    expect(s).toEqual(original); expect(validState(s)).toBe(true);
    const forged = structuredClone(s); forged.pendingEvent!.choices[0].effects.health = 99;
    expect(validState(forged)).toBe(false);
  });
  it('retains costs, durations, uncertainty and unknown authored text in full', () => {
    const text = '대응 비용 120000원. 약 12개월 뒤 결과를 받습니다. 기각되거나 큰 배상 부담이 남을 수 있습니다.';
    const shown = readableText(text);
    for (const part of ['120000원', '12개월', '기각', '배상', '수도']) expect(shown).toContain(part);
    const unknown = '조건 55.5 이상이며, 현금이 부족하면 이 선택은 할 수 없습니다. '.repeat(8);
    expect(readableText(unknown)).toBe(unknown);
    const body = '수료 심사에는 성과 3건이 필요합니다. 앞서 ‘첫 사례’에서 동료와 나눠 맡았다.';
    const parts = eventParagraphs(body);
    expect(parts.situation).toContain('3건');
    expect(`${parts.situation} ${parts.memory}`).toBe(body);
  });
  it('records a chosen action and its outcome without changing simulation state', () => {
    const s = at('club-required'), original = structuredClone(s), action = choose(s, 'pass');
    const next = reduceGame(s, action), reference = reduceCareerGame(s, action);
    for (const key of ['stats', 'seed', 'career', 'economy', 'progress', 'stories'] as const) expect(next[key]).toEqual(reference[key]);
    const entry = next.journal.find(e => e.id === action.id)!;
    expect(entry.choice?.label).toBe('가입하지 않기');
    expect(entry.choice?.detail).toContain('가입하지 않고');
    expect(s).toEqual(original); expect(validState(next)).toBe(true);
    expect(reduceGame(next, action)).toBe(next);
  });
  it('uses actual ability outcomes for both success and setback', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed < 50; seed++) {
      const s = at('ability-schedule');
      for (const id of Object.keys(s.abilities!.values) as (keyof NonNullable<GameState['abilities']>['values'])[]) s.abilities!.values[id] = seed % 2 ? 0 : 90;
      s.dynamics!.seed = Math.imul(seed, 0x9e3779b9) >>> 0;
      s.pendingEvent = careerEvent(s, 'ability-schedule');
      const action = choose(s, 'attempt'), next = reduceGame(s, action);
      const recorded = next.journal.find(e => e.id === `${action.id}:abilities`)!;
      const summary = next.journal.find(e => e.id === action.id)!.choice!.detail;
      expect(summary).toBe(readableText(recorded.detail));
      const visible = groupPlayLog(next.journal).flat();
      expect(visible.some(e => e.id === recorded.id)).toBe(false);
      const combined = visible.find(e => e.id === action.id)!;
      for (const key of ['health', 'happiness', 'knowledge', 'relationships'] as const)
        expect(combined.choice!.effects[key] ?? 0).toBe(next.stats[key] - s.stats[key]);
      if (summary.includes('심화 내용까지 정리했습니다.')) outcomes.add('success');
      if (summary.includes('기초 내용을 다시 살폈습니다.')) outcomes.add('setback');
    }
    expect([...outcomes].sort()).toEqual(['setback', 'success']);
  });
  it('records actual paid arrears and loan changes', () => {
    let s = createCareerGame('money-copy', 42); s.life!.paused = false;
    s.economy!.cash = s.economy!.assets = 0; s.economy!.due = 3_000_000;
    s = reduceGame(s, { type: 'tick', id: 'open', elapsedMs: 1 });
    const action = choose(s, 'education-plan'), next = reduceGame(s, action);
    const detail = next.journal.find(e => e.id === action.id)!.choice!.detail;
    expect(detail).toContain('부채 +'); expect(detail).toContain('미납액 납부 완료');
    expect(next.economy!.due).toBe(0); expect(detail).toContain('자동 대출을 켰습니다');
  });
  it('keeps open old choices and new choice metadata through save and reload', async () => {
    const s = at('club-required'); s.pendingEvent = careerEvent(s, 'club-required', false, false, true);
    const db = await openGameDatabase(`copy-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      const old = (await loadGame(db))!.state;
      readableEvent(old.pendingEvent!); expect(old).toEqual(s);
      const next = reduceGame(old, choose(old, 'pass'));
      await persistGame(db, next, { runId: old.runId, revision: old.revision });
      expect((await loadGame(db))!.state).toEqual(next);
      const broken = structuredClone(next); broken.journal.at(-1)!.choice = { label: 7, detail: null } as never;
      expect(validState(broken)).toBe(false);
    } finally { db.close(); }
  });
  it('shows the selected action and context directly in the left log', () => {
    const s = at('club-required'), next = reduceGame(s, choose(s, 'pass'));
    const html = renderToStaticMarkup(<PlayLog entries={next.journal} onOpenJournal={() => {}}/>);
    expect(html).toContain('play-log-action'); expect(html).toContain('가입하지 않기');
    expect(html).toContain('공부와 휴식 시간을 남겼습니다.');
    const choice = html.split('class="play-log-choice"')[1].split('</article>')[0];
    expect(choice).not.toContain('<details');
  });
});
