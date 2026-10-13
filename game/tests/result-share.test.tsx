import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame } from '../src/career-runtime';
import { copyResult, GAME_SHARE_URL, resultShareData, resultShareText, shareResult } from '../src/result-share';
import ResultShare from '../src/ResultShare';

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
    expect(shared.text).toContain('생애 기록 1개');
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
    expect(resultShareData(game).text).not.toMatch(/undefined|NaN|세/);
  });
  it('only renders a share button for completed games', () => {
    const game = createCareerGame('render', 2);
    expect(renderToStaticMarkup(<ResultShare game={game}/>)).toBe('');
    game.status = 'completed';
    expect(renderToStaticMarkup(<ResultShare game={game}/>)).toContain('결과 공유하기');
  });
});
