import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, reduceGame } from '../src/engine';
import { observedHighs, STAT_KEYS } from '../src/stat-highs';
import { careerRecords, exportRawSave, loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import { credentialKey, fieldKey, mergeCareerRecords, recordCareer, specialtyKey } from '../src/career-records';
import LifetimeRecords from '../src/LifetimeRecords';
import ClinicRoom, { clinicRoom } from '../src/ClinicRoom';
import { SPECIALTIES } from '../src/career';

const at = '2026-10-14T00:00:00Z';
describe('lifetime peaks and clinic collection', () => {
  it('retains action peaks after a decline without mutating the input', () => {
    const initial = createGame('a', 42, 'fixture-v1');
    initial.stats.health = 98;
    const before = structuredClone(initial);
    const next = reduceGame(initial, { type: 'activity', id: 'study', main: 'study', supporting: 'connect' });
    expect(next.stats.health).toBeLessThan(98);
    expect(next.statHighs!.values.health).toBe(98);
    expect(next.statHighs!.fromStart).toBe(true);
    expect(initial).toEqual(before);
    expect(reduceGame(next, { type: 'activity', id: 'study', main: 'study', supporting: 'connect' })).toBe(next);
  });
  it.each(['career-preview-v1', 'random-preview-v1'] as const)('keeps peaks while skipping time in %s', version => {
    let s = createGame('skip', 42, version);
    s.stats.health = 99;
    s = reduceGame(s, { type: 'control', id: 'run', speed: 16, paused: false });
    const fast = reduceGame(s, { type: 'next-choice', id: 'skip' });
    let stepped = structuredClone(s);
    for (let i = 0; i < 4096 && !stepped.pendingEvent && stepped.status === 'active'; i++) {
      stepped = reduceGame(stepped, { type: 'tick', id: `step-${i}`, elapsedMs: 1000 });
    }
    expect(fast.statHighs).toEqual(stepped.statHighs);
    expect(fast.statHighs!.values.health).toBeGreaterThanOrEqual(99);
    expect(validState(fast)).toBe(true);
  });
  it('preserves saved peaks across lower values, reset, reopen and export', async () => {
    let db = await openGameDatabase(crypto.randomUUID());
    try {
      const a = createGame('first', 42, 'fixture-v1'); a.stats.health = 96;
      await persistGame(db, a, null);
      const b = reduceGame(a, { type: 'activity', id: 'study', main: 'study', supporting: 'connect' });
      await persistGame(db, b, a);
      expect((await loadGame(db))!.state.statHighs!.values.health).toBe(96);
      const c = createGame('second', 42, 'fixture-v1'); c.stats.health = 34;
      await persistGame(db, c, b);
      const name = db.name; db.close(); db = await openGameDatabase(name);
      const rows = await careerRecords(db);
      expect(rows.find(r => r.runId === 'first')!.statHighs!.values.health).toBe(96);
      expect(rows.find(r => r.runId === 'second')!.statHighs!.values.health).toBe(34);
      expect(JSON.parse(await exportRawSave(db)).careerRecords[0].statHighs).toBeDefined();
      const stale = structuredClone(b); stale.statHighs!.values.health = 100;
      await expect(persistGame(db, stale, b)).rejects.toThrow();
      expect((await careerRecords(db)).find(r => r.runId === 'first')!.statHighs!.values.health).toBe(96);
    } finally { db.close(); }
  });
  it('uses only observed values from legacy saves and rejects malformed peaks', () => {
    const old = createGame('old', 42, 'fixture-v1'); old.revision = 5;
    const highs = observedHighs(old);
    expect(highs.values).toEqual(old.stats); expect(highs.fromStart).toBe(false);
    expect(validState(old)).toBe(true);
    old.statHighs = { ...highs, values: { ...highs.values, health: NaN } };
    expect(validState(old)).toBe(false);
    old.statHighs.values.health = 101;
    expect(validState(old)).toBe(false);
  });
  it('keeps the selected life separate from the all-play record, including a legacy row', () => {
    const a = createGame('archive', 42, 'fixture-v1'); a.stats.health = 31;
    const b = createGame('current', 42, 'fixture-v1'); b.stats.health = 97;
    const rows = mergeCareerRecords([recordCareer(a, at), recordCareer(b, '2026-10-15T00:00:00Z')]);
    const html = renderToStaticMarkup(<LifetimeRecords game={a} records={rows}/>);
    expect(html).toContain('<td>31</td><td><strong>97</strong>');
    expect(html).toContain('2번째 플레이');
    const legacy = { ...rows[0], statHighs: undefined };
    expect(renderToStaticMarkup(<LifetimeRecords records={[legacy]}/>)).toContain('—');
    expect(STAT_KEYS.every(k => observedHighs(a).values[k] === a.stats[k])).toBe(true);
  });
  it('unlocks only trained rooms and places a shared credential in its actual route', () => {
    const a = recordCareer(createGame('orthopedics', 42, 'fixture-v1'), at);
    a.milestones = { [specialtyKey('orthopedics')]: 72, [specialtyKey('orthopedics', true)]: 144, [fieldKey('orthopedics', 'field-3', true)]: 174, [credentialKey('hand-surgery')]: 180 };
    const b = { ...a, runId: 'plastic', milestones: { [specialtyKey('plastic')]: 72 } };
    expect(clinicRoom([a, b], 'orthopedics').credentials).toHaveLength(1);
    expect(clinicRoom([a, b], 'plastic')).toMatchObject({ status: 'training', credentials: [] });
    expect(clinicRoom([a, b], 'internal').status).toBe('locked');
    for (const specialty of SPECIALTIES) expect(renderToStaticMarkup(<ClinicRoom specialty={specialty.id} records={[a, b]}/>)).toContain('data-room-state');
  });
});
