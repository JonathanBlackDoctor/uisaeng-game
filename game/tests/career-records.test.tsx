import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { createGame, reduceGame } from '../src/engine';
import { CREDENTIALS, credentialFor, specialtyFields } from '../src/credential-catalog';
import { credentialEarned, fellowshipComplete, initialJourney, journeyEvent, requiredJourney, settleJourney, validJourney } from '../src/specialty-journey';
import { careerRecords, exportRawSave, loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import { credentialKey, fieldKey, firstAchievement, mergeCareerRecords, recordCareer, specialtyKey } from '../src/career-records';
import type { GameState } from '../src/contracts';
import CareerCollection from '../src/CareerCollection';

const stamp = '2026-10-14T00:00:00.000Z';
const connections: IDBDatabase[] = [];
afterEach(() => { connections.splice(0).forEach(db => db.close()); vi.restoreAllMocks(); });
async function database(name: string = crypto.randomUUID()) { const db = await openGameDatabase(name); connections.push(db); return db; }
function trainee(specialty = 'internal', version: 1 | 2 = 2) {
  const s = createCareerGame(crypto.randomUUID(), 42);
  s.stageIndex = 1;
  Object.assign(s.career!, { specialty, institution: 'snuh', application: 'accepted', attempts: 1, practice: 'undecided' });
  Object.assign(s.progress!, { trainingStartMonth: 72, club: 'declined', marriage: 'settled' });
  Object.assign(s.life!, { elapsedMs: 72_000, paused: false });
  s.journey = initialJourney(72, version);
  return s;
}
function advance(s: GameState, field = 'field-0', stop = '', choice?: (key: string) => string | undefined) {
  for (let m = Math.floor(s.life!.elapsedMs / 1000) + 1; m < 450; m++) {
    s.life!.elapsedMs = m * 1000; s.stageIndex = m < 144 ? 1 : 2;
    if (m >= 144 && s.career!.practice === 'undecided') s.career!.practice = 'employed';
    const key = requiredJourney(s); if (!key) continue;
    if (key === `journey:${stop}`) return s;
    const e = journeyEvent(s, key)!;
    expect(settleJourney(s, key, choice?.(key) ?? (key === 'journey:field' ? field : e.choices[0].id))).toBe(true);
    expect(validJourney(s), key).toBe(true);
  }
  return s;
}
describe('career collection and credential gates', () => {
  it('does not turn an application, rejection, exploration or untrained practice into experience', () => {
    for (const application of ['none', 'rejected', 'untrained'] as const) {
      const s = trainee(); s.career!.application = application;
      expect(recordCareer(s, stamp).milestones).toEqual({});
    }
    const s = trainee(); s.stageIndex = 0;
    expect(recordCareer(s, stamp).milestones).toEqual({});
  });
  it('separates residency experience, specialist completion, fellowship and credential', () => {
    const s = trainee();
    expect(recordCareer(s, stamp).milestones).toEqual({ [specialtyKey('internal')]: 72 });
    advance(s, 'field-0', 'credential-preparation');
    const before = recordCareer(s, stamp);
    expect(before.milestones[specialtyKey('internal', true)]).toBe(144);
    expect(before.milestones[fieldKey('internal', 'field-0', true)]).toBeGreaterThan(144);
    expect(before.milestones[credentialKey('internal-0')]).toBeUndefined();
    expect(fellowshipComplete(s)).toBe(true); expect(credentialEarned(s)).toBe(false);
    expect(settleJourney(s, 'journey:credential-preparation', 'prepare')).toBe(true);
    advance(s, 'field-0', 'credential-exam');
    s.pendingEvent = careerEvent(s, 'journey:credential-exam');
    expect(validState(s)).toBe(true);
    const action = { type: 'choose' as const, id: 'exam', eventId: s.pendingEvent!.id, choiceId: 'pass' };
    const after = reduceGame(s, action);
    expect(credentialEarned(after)).toBe(true); expect(validState(after)).toBe(true);
    expect(reduceGame(after, action)).toBe(after);
  });
  it('rejects skipped preparation and early exams; permits declining certification', () => {
    const s = advance(trainee(), 'field-0', 'credential-exam');
    expect(settleJourney(s, 'journey:credential-exam', 'pass')).toBe(true);
    const forged = structuredClone(s); delete forged.journey!.decisions['credential-preparation'];
    expect(validJourney(forged)).toBe(false);
    const early = structuredClone(s); early.journey!.decisions['credential-exam'].month -= 3;
    expect(validJourney(early)).toBe(false);
    const skipped = advance(trainee(), 'field-0', '', key => key === 'journey:credential-preparation' ? 'skip' : undefined);
    expect(fellowshipComplete(skipped)).toBe(true); expect(credentialEarned(skipped)).toBe(false);
    expect(skipped.journey!.decisions['academic-entry']).toBeDefined();
  });
  it('keeps legacy field IDs and validates old completed routes without retroactive credentials', () => {
    const s = advance(trainee('internal', 1));
    expect(validState(s)).toBe(true); expect(fellowshipComplete(s)).toBe(true);
    expect(credentialEarned(s)).toBe(false);
    expect(Object.keys(recordCareer(s, stamp).milestones).some(k => k.startsWith('credential:'))).toBe(false);
    expect(specialtyFields('internal', false).some(f => f.id === 'credential-endoscopy')).toBe(false);
  });
  it('has playable, uniquely mapped paths for every catalog credential', () => {
    expect(new Set(CREDENTIALS.map(c => c.id)).size).toBe(CREDENTIALS.length);
    for (const credential of CREDENTIALS) for (const route of credential.routes) {
      expect(specialtyFields(route.specialty).some(f => f.id === route.field)).toBe(true);
      const s = advance(trainee(route.specialty), route.field);
      expect(credentialEarned(s), `${route.specialty}/${route.field}`).toBe(true);
      expect(recordCareer(s, stamp).milestones[credentialKey(credential.id)]).toBeDefined();
    }
    expect(credentialFor('neurology', 'field-0')).toBeUndefined();
    expect(credentialFor('surgery', 'field-3')).toBeUndefined();
  });
  it('deduplicates shared qualifications and retains first achievement across plays', () => {
    const a = recordCareer(advance(trainee('orthopedics'), 'field-3'), stamp);
    const b = recordCareer(advance(trainee('plastic'), 'field-0'), '2026-10-15T00:00:00Z');
    const rows = mergeCareerRecords([b, a, a]);
    expect(rows).toHaveLength(2);
    expect(firstAchievement(rows, credentialKey('hand-surgery'))?.run).toBe(1);
    expect(firstAchievement(rows, specialtyKey('plastic'))?.run).toBe(2);
    expect(renderToStaticMarkup(<CareerCollection records={rows}/>)).toContain('2 / 26');
  });
  it('persists unfinished experience through reset and reopen, and exports it', async () => {
    const db = await database(); const s = trainee(); expect(validState(s)).toBe(true);
    await persistGame(db, s, null);
    const next = createCareerGame('next', 9); await persistGame(db, next, s);
    const name = db.name; db.close(); const reopened = await database(name);
    const rows = await careerRecords(reopened);
    expect(rows).toHaveLength(2);
    expect(firstAchievement(rows, specialtyKey('internal'))).not.toBeNull();
    expect(JSON.parse(await exportRawSave(reopened)).careerRecords).toHaveLength(2);
  });
  it('upgrades a v1 database without modifying its current or archive state', async () => {
    const name = crypto.randomUUID(), old = trainee('pediatrics', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(name, 1); r.onupgradeneeded = () => { r.result.createObjectStore('current'); r.result.createObjectStore('archives', { keyPath: 'runId' }); };
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(['current', 'archives'], 'readwrite'); tx.objectStore('current').put({ schemaVersion: 1, updatedAt: stamp, state: old }, 'active'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close(); const upgraded = await database(name);
    expect((await loadGame(upgraded))!.state).toEqual(old);
    expect(firstAchievement(await careerRecords(upgraded), specialtyKey('pediatrics'))).not.toBeNull();
    await persistGame(upgraded, createCareerGame('new', 3), old);
    expect(firstAchievement(await careerRecords(upgraded), specialtyKey('pediatrics'))).not.toBeNull();
  });
  it('rolls back current state and new awards if the collection write fails', async () => {
    const db = await database(), initial = createGame('initial', 3, 'fixture-v1');
    await persistGame(db, initial, null);
    const before = await careerRecords(db); const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'careerRecords') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    });
    await expect(persistGame(db, trainee(), initial)).rejects.toThrow('Full');
    expect((await loadGame(db))!.state).toEqual(initial); expect(await careerRecords(db)).toEqual(before);
  });
  it('does not grant a second tab awards after a stale write', async () => {
    const db = await database(), s = trainee(); await persistGame(db, s, null);
    const next = createCareerGame('next', 5); await persistGame(db, next, s);
    await expect(persistGame(db, advance(structuredClone(s)), s)).rejects.toThrow();
    expect(firstAchievement(await careerRecords(db), credentialKey('internal-0'))).toBeNull();
  });
  it('plays a new credential route to retirement through the real reducer and reloads the open exam', async () => {
    let s = trainee(); s.life!.speed = 16;
    const db = await database(); let reloaded = false;
    for (let i = 0; i < 4000 && s.status !== 'completed'; i++) {
      const e = s.pendingEvent;
      if (e) {
        if (e.randomKey === 'journey:credential-exam') {
          await persistGame(db, s, null); s = (await loadGame(db))!.state; reloaded = true;
        }
        const id = e.randomKey === 'funding' ? e.choices.some(c => c.id === 'pay-due') ? 'pay-due' : 'loan'
          : e.randomKey === 'marriage-required' ? 'single' : e.randomKey?.startsWith('offer-') ? 'decline' : e.choices[0].id;
        s = reduceGame(s, { type: 'choose', id: `c:${s.revision}`, eventId: e.id, choiceId: id });
      } else s = reduceGame(s, { type: 'tick', id: `t:${s.revision}`, elapsedMs: 500 });
      expect(validState(s), `${s.life!.elapsedMs} ${s.pendingEvent?.randomKey}`).toBe(true);
    }
    expect(s.status).toBe('completed'); expect(reloaded).toBe(true); expect(credentialEarned(s)).toBe(true);
    const old = (await loadGame(db))!.state;
    await persistGame(db, s, old);
    expect((await careerRecords(db)).filter(r => r.runId === s.runId)).toHaveLength(1);
    expect(firstAchievement(await careerRecords(db), credentialKey('internal-0'))).not.toBeNull();
  });
});
