import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createCareerGame } from '../src/career-runtime';
import type { GameState } from '../src/contracts';
import { archives, careerRecords, exportRawSave, loadGame, openGameDatabase, persistGame, SaveConflictError, validState } from '../src/storage';
import { credentialKey, specialtyKey } from '../src/career-records';
import { chooseProfessionEvent, continueProfession, professionJourney } from './helpers/profession-play';

const connections: IDBDatabase[] = [];
async function database(name = `profession-${crypto.randomUUID()}`) {
  const db = await openGameDatabase(name); connections.push(db); return db;
}
async function rawPut(db: IDBDatabase, state: GameState) {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('current', 'readwrite');
    tx.objectStore('current').put({ schemaVersion: 1, updatedAt: new Date().toISOString(), state }, 'active');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
afterEach(() => connections.splice(0).forEach(db => db.close()));

describe('profession IndexedDB saves', () => {
  it.each(['dentistry', 'korean-medicine', 'nursing'] as const)('%s restores its exact pending choice, settles once, and archives a complete career', async profession => {
    let db = await database();
    const pending = professionJourney(profession, { stop: s => s.pendingEvent?.randomKey === 'profession:field' }).s;
    await persistGame(db, pending, null);
    const name = db.name; db.close(); db = await database(name);
    const restored = (await loadGame(db))!.state;
    expect(restored).toEqual(pending);
    expect(restored.professional!.licensed).toBe(true);
    const one = chooseProfessionEvent(restored);
    const two = chooseProfessionEvent(restored, { field: restored.pendingEvent!.choices[1].id });
    const outcomes = await Promise.allSettled([persistGame(db, one, restored), persistGame(db, two, restored)]);
    expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(x => x.status === 'rejected')).toHaveLength(1);
    expect((outcomes.find(x => x.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(SaveConflictError);
    const settled = (await loadGame(db))!.state;
    expect(settled.revision).toBe(restored.revision + 1);
    expect(settled.professional!.decisions.field).toBeDefined();
    const finished = continueProfession(settled).s;
    await persistGame(db, finished, settled);
    expect((await loadGame(db))!.state).toEqual(finished);
    const history = await archives(db);
    expect(history).toHaveLength(1);
    expect(history[0].state).toEqual(finished);
    const records = await careerRecords(db);
    expect(records).toHaveLength(1);
    expect(records[0].completed).toBe(true);
    expect(records[0].milestones[specialtyKey(finished.career!.specialty!)]).toBe(finished.progress!.trainingStartMonth);
    if (profession === 'nursing') expect(records[0].milestones[specialtyKey(finished.career!.specialty!, true)]).toBeUndefined();
    else expect(records[0].milestones[specialtyKey(finished.career!.specialty!, true)]).toBe(finished.professional!.qualifiedMonth);
    await persistGame(db, finished, finished);
    expect(await archives(db)).toHaveLength(1);
    expect(await careerRecords(db)).toEqual(records);
  }, 120000);

  it('restores a nursing education plan and records only the actually earned certificate', async () => {
    const before = professionJourney('nursing', { field: 'nursing:ward', stop: s => s.pendingEvent?.randomKey === 'profession:certificate' }).s;
    const enrolled = chooseProfessionEvent(before, { picks: { 'profession:certificate': '임상' } });
    let db = await database(); await persistGame(db, enrolled, null);
    const name = db.name; db.close(); db = await database(name);
    const restored = (await loadGame(db))!.state;
    expect(restored).toEqual(enrolled);
    expect(restored.professional!.certificateEarned).toBe(false);
    expect((await careerRecords(db))[0].milestones[credentialKey('nursing:임상')]).toBeUndefined();
    const finished = continueProfession(restored).s;
    expect(finished.professional!.certificateEarned).toBe(true);
    await persistGame(db, finished, restored);
    expect((await careerRecords(db))[0].milestones[credentialKey('nursing:임상')]).toBe(finished.professional!.decisions['certificate-review'].month);
  }, 120000);

  it('rejects unknown professions at creation and before writing or loading raw saves', async () => {
    expect(() => createCareerGame('unknown', 3, 'pharmacy' as never)).toThrow(RangeError);
    const db = await database(), initial = createCareerGame('safe', 3, 'dentistry');
    await persistGame(db, initial, null);
    const bad = structuredClone(initial); bad.profession = 'pharmacy' as never;
    expect(validState(bad)).toBe(false);
    await expect(persistGame(db, bad, initial)).rejects.toThrow();
    expect((await loadGame(db))!.state).toEqual(initial);
    await rawPut(db, bad);
    await expect(loadGame(db)).rejects.toThrow();
    expect(JSON.parse(await exportRawSave(db)).current.state).toEqual(bad);
  });

  it.each(['dentistry', 'korean-medicine', 'nursing'] as const)('%s rejects foreign career fields and forged license or specialist data without overwriting its save', async profession => {
    const db = await database(), initial = createCareerGame(`protected-${profession}`, 3, profession);
    await persistGame(db, initial, null);
    const badStates: GameState[] = [];
    const foreign = structuredClone(initial); foreign.career!.specialty = 'internal'; badStates.push(foreign);
    const mismatched = structuredClone(initial); mismatched.career!.profession = profession === 'nursing' ? 'dentistry' : 'nursing'; badStates.push(mismatched);
    const license = structuredClone(initial); Object.assign(license.professional!, { licensed: true, licenseMonth: 0 }); badStates.push(license);
    const specialist = structuredClone(initial); Object.assign(specialist.professional!, { qualified: true, qualifiedMonth: 0 }); badStates.push(specialist);
    const certificate = structuredClone(initial); Object.assign(certificate.professional!, { certificate: '임상', certificateStart: 0, certificateEarned: true }); badStates.push(certificate);
    for (const bad of badStates) {
      expect(validState(bad)).toBe(false);
      await expect(persistGame(db, bad, initial)).rejects.toThrow();
      expect((await loadGame(db))!.state).toEqual(initial);
    }
    expect(await archives(db)).toHaveLength(0);
  });

  it('rejects a specialist qualification injected into a completed general-practice career', async () => {
    const safe = professionJourney('dentistry', { route: 'general', work: 'untrained' }).s;
    const db = await database(); await persistGame(db, safe, null);
    const bad = structuredClone(safe);
    Object.assign(bad.professional!, { route: 'specialist', qualified: true, qualifiedMonth: bad.professional!.licenseMonth! + 48 });
    expect(validState(bad)).toBe(false);
    await expect(persistGame(db, bad, safe)).rejects.toThrow();
    expect((await loadGame(db))!.state).toEqual(safe);
  }, 120000);

  it('rejects a nursing credential injected after choosing to skip its education', async () => {
    const safe = professionJourney('nursing', { field: 'nursing:ward' }).s;
    const db = await database(); await persistGame(db, safe, null);
    const bad = structuredClone(safe);
    expect(bad.professional!.decisions.certificate.choice).toBe('skip');
    Object.assign(bad.professional!, { certificate: '임상', certificateStart: bad.professional!.decisions.certificate.month, certificateEarned: true });
    expect(validState(bad)).toBe(false);
    await expect(persistGame(db, bad, safe)).rejects.toThrow();
    expect((await loadGame(db))!.state).toEqual(safe);
  }, 120000);

  it('rejects a medical specialty injected into a new nonmedical training plan', () => {
    const bad = createCareerGame('foreign-plan', 3, 'dentistry');
    bad.progress!.selectedSpecialty = 'internal';
    expect(validState(bad)).toBe(false);
  });
});
