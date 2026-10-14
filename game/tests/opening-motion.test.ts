import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginOpeningTransition } from '../src/opening-motion';

function environment(reduced = false) {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  const listeners = new Set<() => void>();
  const media = {
    matches: reduced,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  return { media: media as unknown as MediaQueryList, listeners, reduce() { media.matches = true; for (const listener of listeners) listener(); } };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('opening transition', () => {
  it('holds entry until the campus animation finishes, then releases it once', async () => {
    const { media, listeners } = environment();
    const transition = beginOpeningTransition(media);
    const entered = vi.fn(); transition.finished.then(entered);
    await vi.advanceTimersByTimeAsync(2199);
    expect(entered).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(entered).toHaveBeenCalledTimes(1);
    transition.skip();
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('skip releases the saved game immediately and cancels the pending timer', async () => {
    const { media, listeners } = environment();
    const transition = beginOpeningTransition(media);
    await vi.advanceTimersByTimeAsync(100);
    transition.skip(); transition.skip();
    await transition.finished;
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('reduced motion does not add a waiting period', async () => {
    const { media, listeners } = environment(true);
    await beginOpeningTransition(media).finished;
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners.size).toBe(0);
  });
  it('turning reduced motion on mid-flight finishes and cleans up', async () => {
    const env = environment();
    const transition = beginOpeningTransition(env.media);
    await vi.advanceTimersByTimeAsync(400);
    env.reduce();
    await transition.finished;
    expect(vi.getTimerCount()).toBe(0);
    expect(env.listeners.size).toBe(0);
  });
});
