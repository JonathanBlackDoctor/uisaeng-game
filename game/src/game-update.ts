/// <reference types="vite/client" />
import type { GameState } from './contracts';
import { persistGame } from './storage';

declare const __APP_VERSION__: string;
declare const __APP_DISPLAY_VERSION__: string;
declare const __APP_UPDATES_ENABLED__: boolean;
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
export const APP_DISPLAY_VERSION = typeof __APP_DISPLAY_VERSION__ === 'string' ? __APP_DISPLAY_VERSION__ : '';
export const UPDATES_ENABLED = typeof __APP_UPDATES_ENABLED__ === 'boolean' && __APP_UPDATES_ENABLED__;
export const UPDATE_INTERVAL = 60_000;
export const UPDATE_SNOOZE = 5 * 60_000;
export const validVersion = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export async function checkGameUpdate(current: string, url: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  if (!validVersion(current)) return null;
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetcher(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const version = data && typeof data === 'object' && 'version' in data ? data.version : undefined;
    return validVersion(version) && version !== current ? version : null;
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

export function monitorGameUpdates(options: { current: string; base: string; onUpdate: (version: string) => void; fetcher?: typeof fetch; page?: Document; clock?: () => number }) {
  const page = options.page ?? document, now = options.clock ?? Date.now;
  let disposed = false, checking = false, lastCheck = -Infinity;
  const check = async () => {
    if (disposed || checking || page.visibilityState !== 'visible' || now() - lastCheck < 15_000) return;
    checking = true; lastCheck = now();
    try {
      const url = new URL('version.json', new URL(options.base, page.baseURI));
      url.searchParams.set('check', String(Math.floor(now() / UPDATE_INTERVAL)));
      const version = await checkGameUpdate(options.current, url.href, options.fetcher);
      if (!disposed && version) options.onUpdate(version);
    } finally { checking = false; }
  };
  const visible = () => { void check(); };
  const timer = setInterval(visible, UPDATE_INTERVAL);
  page.addEventListener('visibilitychange', visible);
  void check();
  return () => { disposed = true; clearInterval(timer); page.removeEventListener('visibilitychange', visible); };
}

export async function saveAndApplyUpdate(db: IDBDatabase, state: GameState | null, version: string, href: string, navigate: (url: string) => void) {
  if (!validVersion(version)) throw new Error('업데이트 정보를 다시 확인해 주세요.');
  if (state) await persistGame(db, state, { runId: state.runId, revision: state.revision });
  const url = new URL(href); url.searchParams.set('update', version);
  navigate(url.href);
}
