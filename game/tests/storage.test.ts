import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame, reduceGame } from '../src/engine';
import { archives, exportRawSave, loadGame, openGameDatabase, persistGame, SaveConflictError } from '../src/storage';
import type { GameState } from '../src/contracts';

const connections: IDBDatabase[] = [];
async function database() { const db = await openGameDatabase(`test-${crypto.randomUUID()}`); connections.push(db); return db; }
afterEach(() => { connections.splice(0).forEach(db => db.close()); vi.restoreAllMocks(); });
async function rawPut(db: IDBDatabase, value: unknown) { await new Promise<void>((resolve, reject) => { const tx = db.transaction('current', 'readwrite'); tx.objectStore('current').put(value, 'active'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
function completed(): GameState {
  let state = createGame('completed', 42, 'fixture-v1');
  for (let i = 0; i < 4; i++) {
    state = reduceGame(state, { type: 'activity', id: `a${i}`, main: 'study', supporting: 'rest' });
    state = reduceGame(state, { type: 'choose', id: `c${i}`, eventId: state.pendingEvent!.id, choiceId: state.pendingEvent!.choices[0].id });
  }
  return state;
}
describe('transactional IndexedDB persistence', () => {
  it('returns no record for a fresh database', async () => { expect(await loadGame(await database())).toBeNull(); });
  it('resumes pending events and exact state after database reopen', async () => {
    const db = await database();
    const state = reduceGame(createGame('run', 42, 'fixture-v1'), { type: 'activity', id: 'a', main: 'study', supporting: 'rest' });
    await persistGame(db, state, null);
    const name = db.name; db.close();
    const reopened = await openGameDatabase(name); connections.push(reopened);
    expect((await loadGame(reopened))!.state).toEqual(state);
  });
  it('prevents stale or simultaneous tabs from overwriting newer choices', async () => {
    const db = await database(); const initial = createGame('run', 42, 'fixture-v1');
    await persistGame(db, initial, null);
    const next = reduceGame(initial, { type: 'activity', id: 'a', main: 'study', supporting: 'rest' });
    const outcomes = await Promise.allSettled([persistGame(db, next, initial), persistGame(db, { ...next, seed: 77 }, initial)]);
    expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(x => x.status === 'rejected')).toHaveLength(1);
    await expect(persistGame(db, initial, null)).rejects.toBeInstanceOf(SaveConflictError);
    expect((await loadGame(db))!.state.revision).toBe(1);
  });
  it('stores final state and archive together and deduplicates recap by run ID', async () => {
    const db = await database(); const state = completed();
    await persistGame(db, state, null);
    await persistGame(db, state, state);
    expect(await archives(db)).toHaveLength(1);
    expect((await archives(db))[0].state).toEqual((await loadGame(db))!.state);
    await persistGame(db, createGame('next', 42, 'fixture-v1'), state);
    expect(await archives(db)).toHaveLength(1);
  });
  it('rolls current state back when the archive write fails', async () => {
    const db = await database(); const initial = createGame('initial', 42, 'fixture-v1');
    await persistGame(db, initial, null);
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'archives') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    });
    await expect(persistGame(db, completed(), initial)).rejects.toThrow('Full');
    expect((await loadGame(db))!.state).toEqual(initial);
    expect(await archives(db)).toHaveLength(0);
  });
  it.each([{ schemaVersion: 9, state: createGame('run', 42, 'fixture-v1') }, { schemaVersion: 1, state: { malformed: true }, updatedAt: 'today' }])('preserves unknown or corrupt records for export', async (raw: unknown) => {
    const db = await database(); await rawPut(db, raw);
    await expect(loadGame(db)).rejects.toThrow();
    await expect(persistGame(db, createGame('replacement', 42, 'fixture-v1'), null)).rejects.toThrow();
    expect(JSON.parse(await exportRawSave(db)).current).toEqual(raw);
  });
  it('rejects malformed pending events and invalid stats before writing', async () => {
    const db = await database(); const state = createGame('run', 42, 'fixture-v1');
    await persistGame(db, state, null);
    await expect(persistGame(db, { ...state, stats: { ...state.stats, health: NaN } }, state)).rejects.toThrow();
    await expect(persistGame(db, { ...state, pendingEvent: {} } as GameState, state)).rejects.toThrow();
    expect((await loadGame(db))!.state).toEqual(state);
  });
  it('does not accept corrupted event effects or journal entries', async () => {
    const db = await database();
    const pending = reduceGame(createGame('run', 42, 'fixture-v1'), { type: 'activity', id: 'a', main: 'study', supporting: 'rest' });
    pending.pendingEvent!.choices[0].effects = { health: Infinity };
    await expect(persistGame(db, pending, null)).rejects.toThrow();
    const state = createGame('run', 42, 'fixture-v1');
    state.journal = [null as never];
    await expect(persistGame(db, state, null)).rejects.toThrow();
    expect(await loadGame(db)).toBeNull();
  });
});
