import { describe, expect, it } from 'vitest';
import { createGame, reduceGame } from '../src/engine';
import type { GameState } from '../src/contracts';
import manifest from '../src/content-manifest.json';

function turn(state: GameState) {
  const pending = reduceGame(state, { type: 'activity', id: `activity-${state.stageIndex}`, main: 'study', supporting: 'rest' });
  return reduceGame(pending, { type: 'choose', id: `choice-${state.stageIndex}`, eventId: pending.pendingEvent!.id, choiceId: pending.pendingEvent!.choices[0].id });
}
describe('integration fixture reducer', () => {
  it('is deterministic, immutable and does not advance on elapsed wall time', () => {
    const initial = createGame('run', 103, 'fixture-v1');
    const before = structuredClone(initial);
    const action = { type: 'activity', id: 'a', main: 'study', supporting: 'rest' } as const;
    expect(reduceGame(initial, action)).toEqual(reduceGame(initial, action));
    expect(initial).toEqual(before);
    expect(initial.stageIndex).toBe(0);
  });
  it('requires distinct activities and settles a pending event only once even with different action IDs', () => {
    const initial = createGame('run', 42, 'fixture-v1');
    expect(reduceGame(initial, { type: 'activity', id: 'same', main: 'study', supporting: 'study' })).toBe(initial);
    const pending = reduceGame(initial, { type: 'activity', id: 'a', main: 'study', supporting: 'rest' });
    expect(reduceGame(pending, { type: 'activity', id: 'b', main: 'connect', supporting: 'rest' })).toBe(pending);
    const choice = { type: 'choose', id: 'c', eventId: pending.pendingEvent!.id, choiceId: pending.pendingEvent!.choices[0].id } as const;
    const settled = reduceGame(pending, choice);
    expect(reduceGame(settled, choice)).toBe(settled);
    expect(reduceGame(settled, { ...choice, id: 'another-click' })).toBe(settled);
    expect(settled.stageIndex).toBe(1);
    expect(settled.journal).toHaveLength(2);
  });
  it('rejects an obsolete event and unknown choices', () => {
    const pending = reduceGame(createGame('run', 42, 'fixture-v1'), { type: 'activity', id: 'a', main: 'connect', supporting: 'rest' });
    expect(reduceGame(pending, { type: 'choose', id: 'c', eventId: 'old', choiceId: 'walk' })).toBe(pending);
    expect(reduceGame(pending, { type: 'choose', id: 'c', eventId: pending.pendingEvent!.id, choiceId: 'missing' })).toBe(pending);
  });
  it('reaches retirement and creates eight records without claiming production completion', () => {
    let state = createGame('run', 42, 'fixture-v1');
    for (let i = 0; i < 4; i++) state = turn(state);
    expect(state.status).toBe('completed');
    expect(state.journal).toHaveLength(8);
    expect(state.pendingEvent).toBeNull();
    expect(reduceGame(state, { type: 'activity', id: 'after-end', main: 'study', supporting: 'rest' })).toBe(state);
    expect(manifest.status).toBe('awaiting_design');
    expect(manifest.specialtyTarget).toBe(26);
    expect(manifest.deliveredProductionEvents).toBe(0);
    expect(manifest.approvedEventCount).toBeNull();
  });
  it('bounds fixture stats under repeated extreme input', () => {
    const state = createGame('run', 42, 'fixture-v1');
    state.stats = { health: 100, knowledge: 100, happiness: 100, relationships: 100 };
    const result = reduceGame(state, { type: 'activity', id: 'a', main: 'rest', supporting: 'connect' });
    expect(Object.values(result.stats).every(value => value <= 100 && value >= 0)).toBe(true);
  });
});
