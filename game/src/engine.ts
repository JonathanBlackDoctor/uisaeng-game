import { STAT_LABELS, type GameAction, type GameState, type Stats } from './contracts';
import { ACTIVITIES, FIXTURE_EVENTS, FIXTURE_INITIAL_STATS, STAGES } from './fixtures/content';
import { familyEvent, familySummary, firstFamilyScene, initialFamily, settleFamily } from './family';
import { createRandomGame, reduceRandomGame } from './random-life';

export function createGame(runId: string, seed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0], version: GameState['rulesVersion'] = 'random-preview-v1'): GameState {
  if (version === 'random-preview-v1') return createRandomGame(runId, seed);
  return { runId, revision: 0, seed: seed >>> 0, stageIndex: 0, stats: { ...FIXTURE_INITIAL_STATS }, pendingEvent: null, journal: [], processedActionIds: [], status: 'active', rulesVersion: version, contentVersion: version, ...(version === 'family-preview-v1' ? { family: initialFamily() } : {}) };
}
const nextSeed = (seed: number) => (Math.imul(seed, 1664525) + 1013904223) >>> 0;
function adjust(stats: Stats, effects: Partial<Stats>): Stats {
  return Object.fromEntries(Object.keys(STAT_LABELS).map(key => [key, Math.max(0, Math.min(100, stats[key as keyof Stats] + (effects[key as keyof Stats] ?? 0)))])) as Stats;
}
export function reduceGame(state: GameState, action: GameAction): GameState {
  if (state.rulesVersion === 'random-preview-v1') return reduceRandomGame(state, action);
  if (action.type === 'tick' || action.type === 'control') return state;
  if (state.status === 'completed' || state.processedActionIds.includes(action.id)) return state;
  const stage = STAGES[state.stageIndex];
  if (!stage) return state;
  if (action.type === 'activity') {
    if (state.pendingEvent || action.main === action.supporting || !ACTIVITIES[action.main] || !ACTIVITIES[action.supporting]) return state;
    const main = ACTIVITIES[action.main];
    const supporting = ACTIVITIES[action.supporting];
    const effects = { ...main.effects };
    for (const [key, value] of Object.entries(supporting.effects)) effects[key as keyof Stats] = (effects[key as keyof Stats] ?? 0) + Math.round(value / 2);
    const seed = nextSeed(state.seed);
    const event = structuredClone(FIXTURE_EVENTS[state.stageIndex]);
    return { ...state, revision: state.revision + 1, seed, stats: adjust(state.stats, effects), pendingEvent: { ...event, id: `${state.runId}:${event.id}:${seed}` }, journal: [...state.journal, { id: action.id, stage: stage.id, title: main.label, detail: `보조 활동: ${supporting.label}`, effects }], processedActionIds: [...state.processedActionIds, action.id] };
  }
  if (!state.pendingEvent || state.pendingEvent.id !== action.eventId) return state;
  const choice = state.pendingEvent.choices.find(item => item.id === action.choiceId);
  if (!choice) return state;
  let family = state.family;
  let nextEvent: GameState['pendingEvent'] = null;
  let detail = choice.label;
  if (state.rulesVersion === 'family-preview-v1') {
    if (!family) return state;
    if (state.pendingEvent.familyScene) {
      const result = settleFamily(state.pendingEvent.familyScene, family, stage.id, choice.id);
      if (!result) return state;
      family = result.family;
      if (result.next) nextEvent = familyEvent(result.next, family, stage.id);
      detail += ` — ${familySummary(family)}`;
    } else {
      nextEvent = familyEvent(firstFamilyScene(stage.id, family), family, stage.id);
    }
    if (nextEvent) nextEvent = { ...nextEvent, id: `${state.runId}:${nextEvent.id}:${state.revision + 1}` };
  }
  const complete = state.stageIndex === STAGES.length - 1;
  return { ...state, ...(family ? { family } : {}), revision: state.revision + 1, stats: adjust(state.stats, choice.effects), stageIndex: nextEvent || complete ? state.stageIndex : state.stageIndex + 1, status: !nextEvent && complete ? 'completed' : 'active', pendingEvent: nextEvent, processedActionIds: [...state.processedActionIds, action.id], journal: [...state.journal, { id: action.id, stage: stage.id, title: state.pendingEvent.title, detail, effects: choice.effects }] };
}
