import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import UpdateToast from '../src/UpdateToast';
import { checkGameUpdate, monitorGameUpdates, saveAndApplyUpdate, UPDATE_INTERVAL, validVersion } from '../src/game-update';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { loadGame, openGameDatabase, persistGame } from '../src/storage';

const oldVersion = 'a'.repeat(64), newVersion = 'b'.repeat(64);
const response = (data: unknown) => Promise.resolve(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
afterEach(() => vi.useRealTimers());
describe('small opt-in game updates', () => {
  it('only announces a distinct valid version and asks the browser for uncached data', async () => {
    const fetcher = vi.fn<typeof fetch>(() => response({ version: newVersion }));
    expect(await checkGameUpdate(oldVersion, 'https://example.test/game/version.json', fetcher)).toBe(newVersion);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
    expect(await checkGameUpdate(oldVersion, '', () => response({ version: oldVersion }))).toBeNull();
    expect(validVersion('changed')).toBe(false);
  });
  it.each([null, {}, { version: 123 }, { version: '<html>' }])('ignores malformed version data %j', async (data: unknown) => {
    expect(await checkGameUpdate(oldVersion, '', () => response(data))).toBeNull();
  });
  it('keeps playing through offline, HTTP errors and invalid JSON', async () => {
    expect(await checkGameUpdate(oldVersion, '', async () => { throw new Error('offline'); })).toBeNull();
    expect(await checkGameUpdate(oldVersion, '', async () => new Response('', { status: 404 }))).toBeNull();
    expect(await checkGameUpdate(oldVersion, '', async () => new Response('<html>'))).toBeNull();
  });
  it('checks visible pages on schedule, respects the base path and stops when disposed', async () => {
    vi.useFakeTimers(); const page = new EventTarget() as Document;
    Object.defineProperties(page, { visibilityState: { value: 'visible', configurable: true }, baseURI: { value: 'https://example.test/uisaeng-game/?update=old' } });
    const found: string[] = [], fetcher = vi.fn<typeof fetch>(() => response({ version: newVersion }));
    const stop = monitorGameUpdates({ current: oldVersion, base: '/uisaeng-game/', page, fetcher, onUpdate: v => found.push(v) });
    await vi.advanceTimersByTimeAsync(1);
    expect(found).toEqual([newVersion]); expect(fetcher.mock.calls[0][0]).toContain('/uisaeng-game/version.json?check=');
    Object.defineProperty(page, 'visibilityState', { value: 'hidden', configurable: true });
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL); expect(fetcher).toHaveBeenCalledTimes(1);
    Object.defineProperty(page, 'visibilityState', { value: 'visible', configurable: true }); page.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1); expect(fetcher).toHaveBeenCalledTimes(2);
    page.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(1); expect(fetcher).toHaveBeenCalledTimes(2);
    stop(); await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL * 2); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('preserves the exact open choice and commits before navigating to new assets', async () => {
    const db = await openGameDatabase('update-pending'); const s = createCareerGame('update', 42);
    s.pendingEvent = careerEvent(s, 'club-required'); await persistGame(db, s, null);
    try {
      let destination = '';
      await saveAndApplyUpdate(db, s, newVersion, 'https://example.test/game/?x=1#life', url => { destination = url; });
      expect((await loadGame(db))!.state).toEqual(s);
      expect(new URL(destination).searchParams.get('update')).toBe(newVersion);
      expect(new URL(destination).searchParams.get('x')).toBe('1'); expect(new URL(destination).hash).toBe('#life');
    } finally { db.close(); }
  });
  it('never reloads or overwrites a newer game from another tab', async () => {
    const db = await openGameDatabase('update-conflict'); const stale = createCareerGame('stale', 42), fresh = createCareerGame('fresh', 8);
    await persistGame(db, fresh, null); const navigate = vi.fn();
    try {
      await expect(saveAndApplyUpdate(db, stale, newVersion, 'https://example.test/game/', navigate)).rejects.toThrow('다른 탭');
      expect(navigate).not.toHaveBeenCalled(); expect((await loadGame(db))!.state).toEqual(fresh);
    } finally { db.close(); }
  });
  it('rejects an invalid version before saving and supports the empty start screen', async () => {
    const db = await openGameDatabase('update-empty'), navigate = vi.fn();
    try {
      await expect(saveAndApplyUpdate(db, null, 'bad', 'https://example.test/game/', navigate)).rejects.toThrow();
      expect(navigate).not.toHaveBeenCalled();
      await saveAndApplyUpdate(db, null, newVersion, 'https://example.test/game/', navigate); expect(navigate).toHaveBeenCalledOnce();
    } finally { db.close(); }
  });
  it('renders a quiet status and explicit apply/later actions, disabled while saving', () => {
    const html = renderToStaticMarkup(<UpdateToast disabled onApply={async () => {}} onLater={() => {}}/>);
    expect(html).toContain('새 버전이 있습니다.'); expect(html).toContain('aria-live="polite"');
    expect(html).toContain('업데이트'); expect(html).toContain('나중에'); expect(html).toContain('disabled'); expect(html).not.toContain('role="dialog"');
  });
});
