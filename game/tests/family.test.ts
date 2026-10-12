import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createGame, reduceGame } from '../src/engine';
import { archives, loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import { familySummary } from '../src/family';
import type { GameState, MeetingRoute } from '../src/contracts';

function choose(s: GameState, choiceId: string): GameState {
  expect(s.pendingEvent!.choices.some(c => c.id === choiceId)).toBe(true);
  const result = reduceGame(s, { type: 'choose', id: `choice-${s.revision}`, eventId: s.pendingEvent!.id, choiceId });
  expect(result).not.toBe(s);
  expect(validState(result)).toBe(true);
  return result;
}
function activity(s: GameState) {
  return reduceGame(s, { type: 'activity', id: `activity-${s.revision}`, main: 'study', supporting: 'rest' });
}
function storyChoice(s: GameState, route: MeetingRoute, child = true) {
  const scene = s.pendingEvent?.familyScene;
  const choices: Record<string, string> = { meeting: route, gwating: 'again', 'blind-date': 'again', campus: 'again', confession: 'date', 'cc-life': 'private', distance: 'schedule', marriage: 'marry', parenthood: child ? 'child' : 'childfree', care: 'share', growth: 'listen', 'couple-life': 'move', 'family-recap': 'people' };
  return scene ? choices[scene] : s.pendingEvent!.choices[0].id;
}
describe('romance and family playthroughs', () => {
  it.each(['gwating', 'blind-date', 'campus'] as const)('persists and resumes %s through marriage, parenting and an archived recap', async (route: MeetingRoute) => {
    let db = await openGameDatabase(`family-${route}-${crypto.randomUUID()}`);
    try {
      let state = createGame(route, 42, 'family-preview-v1');
      await persistGame(db, state, null);
      const scenes: string[] = [];
      for (let guard = 0; state.status !== 'completed' && guard < 40; guard++) {
        const before = structuredClone(state);
        if (state.pendingEvent?.familyScene) scenes.push(state.pendingEvent.familyScene);
        const next = state.pendingEvent ? choose(state, storyChoice(state, route)) : activity(state);
        expect(state).toEqual(before);
        await persistGame(db, next, state);
        const name = db.name; db.close(); db = await openGameDatabase(name);
        state = (await loadGame(db))!.state;
        expect(state).toEqual(next);
      }
      expect(state.status).toBe('completed');
      expect(state.family).toEqual({ status: 'married', meeting: route, children: 'adult', care: 'shared' });
      expect(scenes).toEqual(expect.arrayContaining([route, 'confession', 'distance', 'marriage', 'parenthood', 'care', 'growth', 'family-recap']));
      expect(scenes.includes('cc-life')).toBe(route === 'campus');
      expect(familySummary(state.family!)).toContain('배우자');
      expect((await archives(db))[0].state).toEqual(state);
    } finally { db.close(); }
  });
  it('allows every offered branch to finish with valid state and no forced relationship or child', () => {
    const queue = [createGame('all-paths', 42, 'family-preview-v1')];
    const seen = new Set<string>();
    const endings = new Set<string>();
    const scenes = new Set<string>();
    while (queue.length) {
      const state = queue.pop()!;
      expect(validState(state)).toBe(true);
      expect(state.revision).toBeLessThan(40);
      const key = JSON.stringify([state.stageIndex, state.family, state.pendingEvent?.familyScene ?? state.pendingEvent?.title, state.status]);
      if (seen.has(key)) continue;
      seen.add(key);
      if (state.status === 'completed') { endings.add(JSON.stringify(state.family)); continue; }
      if (!state.pendingEvent) { queue.push(activity(state)); continue; }
      if (state.pendingEvent.familyScene) scenes.add(state.pendingEvent.familyScene);
      for (const choice of state.pendingEvent.choices) queue.push(choose(state, choice.id));
    }
    expect([...scenes].sort()).toEqual(['meeting', 'gwating', 'blind-date', 'campus', 'confession', 'cc-life', 'distance', 'marriage', 'parenthood', 'care', 'growth', 'couple-life', 'single-life', 'family-recap'].sort());
    const finals = [...endings].map(s => JSON.parse(s));
    expect(finals.some(f => f.status === 'single' && f.children === 'none')).toBe(true);
    expect(finals.some(f => f.status === 'dating' && f.children === 'none')).toBe(true);
    expect(finals.some(f => f.status === 'married' && f.children === 'none')).toBe(true);
    expect(finals.some(f => f.status === 'dating' && f.children === 'adult')).toBe(true);
    expect(finals.some(f => f.care === 'support')).toBe(true);
  });
  it('does not settle duplicate or stale romance choices or skip directly to marriage', () => {
    let s = activity(createGame('guard', 42, 'family-preview-v1'));
    s = choose(s, s.pendingEvent!.choices[0].id);
    const action = { type: 'choose', id: 'route', eventId: s.pendingEvent!.id, choiceId: 'campus' } as const;
    const next = reduceGame(s, action);
    expect(reduceGame(next, action)).toBe(next);
    expect(reduceGame(next, { ...action, id: 'repeat' })).toBe(next);
    expect(reduceGame(next, { ...action, id: 'skip', eventId: next.pendingEvent!.id, choiceId: 'marry' })).toBe(next);
    expect(next.family?.status).toBe('single');
  });
  it('rejects inconsistent family data, unknown scenes and tampered effects without overwriting saves', async () => {
    const db = await openGameDatabase(`corrupt-family-${crypto.randomUUID()}`);
    try {
      let s = activity(createGame('guard', 42, 'family-preview-v1'));
      s = choose(s, s.pendingEvent!.choices[0].id);
      await persistGame(db, s, null);
      const malformed = [
        { ...s, family: undefined },
        { ...s, family: { ...s.family!, status: 'married' } },
        { ...s, family: { ...s.family!, children: 'adult' } },
        { ...s, pendingEvent: { ...s.pendingEvent!, familyScene: 'unknown' } },
        { ...s, pendingEvent: { ...s.pendingEvent!, choices: [{ ...s.pendingEvent!.choices[0], effects: { happiness: 100 } }] } },
      ];
      for (const bad of malformed) {
        expect(validState(bad)).toBe(false);
        await expect(persistGame(db, bad as GameState, s)).rejects.toThrow();
      }
      expect((await loadGame(db))!.state).toEqual(s);
    } finally { db.close(); }
  });
});
