import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame } from '../src/career-runtime';
import { copyResult, GAME_SHARE_URL, resultShareData, resultShareText, shareResult } from '../src/result-share';
import ResultShare from '../src/ResultShare';
import { settleStory, advanceStories } from '../src/life-stories';

describe('result sharing', () => {
  const data = { title: '결과', text: '건강 70', url: GAME_SHARE_URL };
  it('shares only a bounded summary, including the selected run and public URL', () => {
    const game = createCareerGame('private-run-id', 42);
    game.status = 'completed';
    game.life!.elapsedMs = 684000;
    game.career!.specialty = 'orthopedics';
    game.career!.practice = 'employed';
    game.stats = { health: 70, happiness: 60, knowledge: 90, relationships: 80 };
    game.journal = [{ id: 'private-entry', stage: 'career', title: '개인 기록', detail: 'private-detail', effects: {} }];
    const snapshot = structuredClone(game);
    const shared = resultShareData(game);
    expect(shared.text).toContain('정형외과 · 봉직의');
    expect(shared.text).toContain('건강 70 · 행복 60 · 지식 90 · 관계 80');
    expect(shared.text!.split('\n').length).toBeLessThanOrEqual(8);
    expect(shared.text).toContain('의생게임 · 이번 생의 기록');
    expect(shared.text).toContain('가족과 보낸 시간 0시간 · 발표한 논문 0편');
    expect(shared.text).toContain('정형외과 · 봉직의 · 77세');
    expect(shared.text).not.toMatch(/생애 기록 \d+개|병역|남자|여자|주력 능력|인생 최고점|🎬/);
    expect(shared.url).toBe(GAME_SHARE_URL);
    expect(JSON.stringify(shared)).not.toMatch(/private-|localhost|127\.0\.0\.1/);
    expect(game).toEqual(snapshot);
    const archive = structuredClone(game); archive.stats.health = 12;
    expect(resultShareData(archive).text).toContain('건강 12');
  });
  it('calls native share immediately, with its navigator receiver intact', async () => {
    const browser = { share: vi.fn(function(this: unknown) { expect(this).toBe(browser); return Promise.resolve(); }) };
    const result = shareResult(data, browser);
    expect(browser.share).toHaveBeenCalledWith(data);
    expect(await result).toBe('handed-off');
  });
  it('does not copy when native sharing is cancelled', async () => {
    const writeText = vi.fn();
    expect(await shareResult(data, { share: () => Promise.reject({ name: 'AbortError' }), clipboard: { writeText } })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });
  it('offers an explicit fallback on share failure without claiming delivery', async () => {
    const writeText = vi.fn();
    expect(await shareResult(data, { share: () => Promise.reject({ name: 'NotAllowedError' }), clipboard: { writeText } })).toBe('failed');
    expect(writeText).not.toHaveBeenCalled();
  });
  it('copies the summary and URL when native share is absent', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareResult(data, { clipboard: { writeText } })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(resultShareText(data));
  });
  it('falls back when the browser rejects the payload capability', async () => {
    const share = vi.fn();
    expect(await shareResult(data, { share, canShare: () => false })).toBe('manual');
    expect(share).not.toHaveBeenCalled();
  });
  it('keeps text available when clipboard is denied or absent', async () => {
    expect(await copyResult(data, {})).toBe('manual');
    expect(await copyResult(data, { clipboard: { writeText: () => Promise.reject(new Error('denied')) } })).toBe('manual');
  });
  it('supports old saves without life or career fields', () => {
    const game = createCareerGame('old', 1); delete game.life; delete game.career;
    delete game.abilities; delete game.statHighs; delete game.publications;
    expect(resultShareData(game).text).not.toMatch(/undefined|NaN|세/);
    expect(resultShareData(game).text).not.toMatch(/주력 능력|인생 최고점|남긴 논문/);
  });
  it.each(['medicine', 'dentistry', 'korean-medicine', 'nursing'] as const)('restores family and papers and removes ability/peak rows for %s', profession => {
    const game = createCareerGame('highlights', 3, profession);
    game.statHighs = { fromStart: true, values: { health: 98.6, happiness: 70, knowledge: 90, relationships: 80 } };
    game.legacy!.familyTimeUnits = 2_480_000;
    game.publications!.papers = Array.from({ length: 34 }, (_, i) => ({ id: `paper:${i}`, title: 'private-paper-title', kind: 'study', startedMonth: 0, publishedMonth: 1 }));
    const before = structuredClone(game);
    const shared = resultShareData(game);
    expect(shared.text).toContain('🩺 의생게임 · 논문 쓰는 가족파');
    expect(shared.text).toContain('가족과 보낸 시간 2,480시간 · 발표한 논문 34편');
    expect(shared.text).not.toMatch(/주력 능력|인생 최고점|private-paper-title/);
    expect(game).toEqual(before);
    expect(resultShareData(structuredClone(game))).toEqual(shared);
    game.legacy!.familyTimeUnits = 0;
    expect(resultShareData(game).text).toContain('마감과 평생 동행');
  });
  it('selects one actual scene, omits unresolved choices, and keeps a stable summary after restoration', () => {
    const game = createCareerGame('scene', 42);
    expect(resultShareData(game).text).not.toContain('🎬');
    expect(settleStory(game, 'story:poster-print', 'simplify')).toBe(true);
    expect(resultShareData(game).text).toContain('🎬 발표 전날 사라진 그림, 표 하나로 정리했다.');
    game.campus!.club = 'test-club';
    expect(settleStory(game, 'story:club-reservation', 'outside')).toBe(true);
    const before = structuredClone(game), shared = resultShareData(game);
    expect(shared.text).toContain('🎬 동아리 모임, 장소보다 예약자가 많았다.');
    expect(shared.text!.match(/🎬/g)).toHaveLength(1);
    expect(shared.text!.match(/🩺|🎬/g)).toHaveLength(2);
    expect(shared.text!.split('\n').length).toBeLessThanOrEqual(8);
    expect(resultShareData(structuredClone(game))).toEqual(shared);
    expect(game).toEqual(before);
  });
  it('requires the recorded follow-up before describing its result', () => {
    const game = createCareerGame('follow-up', 42);
    game.stageIndex = 3;
    expect(settleStory(game, 'story:walking-route', 'new')).toBe(true);
    expect(resultShareData(game).text).not.toContain('단골 벤치');
    game.life!.elapsedMs += 3000;
    advanceStories(game);
    expect(resultShareData(game).text).toContain('새 산책로에서 단골 벤치를 찾았다.');
  });
  it('counts actual expansion contracts rather than monthly bills or declined requests', () => {
    const game = createCareerGame('expansions', 42);
    game.economy!.ledger = [1, 2].map(n => ({ id: `clinic:${n}:0:settled`, month: n, label: '병원 월 결산', cashDelta: 0, debtDelta: 0, kind: 'monthly' }));
    expect(resultShareData(game).text).not.toContain('또 확장');
    game.economy!.ledger.push(...[1, 2].map(n => ({ id: `clinic:${n}:1:expand`, month: n, label: '병원 확장 계약', cashDelta: -1, debtDelta: 1, kind: 'monthly' as const })));
    expect(resultShareData(game).text).toContain('원장님, 또 확장이요?');
  });
  it('keeps partial or missing record labels instead of manufacturing a lifetime total', () => {
    const game = createCareerGame('partial', 42);
    game.legacy!.sinceMs = 500; game.publications!.sinceMs = 500;
    expect(resultShareData(game).text).toContain('가족과 보낸 시간 0시간 (집계 시작 이후) · 발표한 논문 0편 (집계 시작 이후)');
    delete game.legacy; delete game.publications;
    expect(resultShareData(game).text).toContain('가족과 보낸 시간 집계 전 · 발표한 논문 집계 전');
    expect(resultShareData(game).text).toContain('이번 생의 기록');
  });
  it('only renders a share button for completed games', () => {
    const game = createCareerGame('render', 2);
    expect(renderToStaticMarkup(<ResultShare game={game}/>)).toBe('');
    game.status = 'completed';
    expect(renderToStaticMarkup(<ResultShare game={game}/>)).toContain('기록 공유하기');
  });
});
