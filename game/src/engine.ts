import { STAT_LABELS, type GameAction, type GameState, type Stats } from './contracts';
import { ACTIVITIES, FIXTURE_EVENTS, FIXTURE_INITIAL_STATS, STAGES } from './fixtures/content';
import { familyEvent, familySummary, firstFamilyScene, initialFamily, settleFamily } from './family';
import { createRandomGame, reduceRandomGame } from './random-life';
import { createCareerGame, reduceCareerGame } from './career-runtime';
import { captureHighs } from './stat-highs';
import { describeChoice } from './choice-journal';

export function createGame(runId: string, seed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0], version: GameState['rulesVersion'] = 'random-preview-v1'): GameState {
  if (version === 'career-preview-v1') return createCareerGame(runId, seed);
  if (version === 'random-preview-v1') return createRandomGame(runId, seed);
  return { runId, revision: 0, seed: seed >>> 0, stageIndex: 0, stats: { ...FIXTURE_INITIAL_STATS }, pendingEvent: null, journal: [], processedActionIds: [], status: 'active', rulesVersion: version, contentVersion: version, ...(version === 'family-preview-v1' ? { family: initialFamily() } : {}) };
}
const nextSeed = (seed: number) => (Math.imul(seed, 1664525) + 1013904223) >>> 0;
function adjust(stats: Stats, effects: Partial<Stats>): Stats {
  return Object.fromEntries(Object.keys(STAT_LABELS).map(key => [key, Math.max(0, Math.min(100, stats[key as keyof Stats] + (effects[key as keyof Stats] ?? 0)))])) as Stats;
}
export function reduceGame(state: GameState, action: GameAction): GameState {
  const next = reduceAction(state, action);
  if (next !== state) { captureHighs(next, state); describeChoice(state, next, action); }
  return next;
}
function reduceAction(state: GameState, action: GameAction): GameState {
  if (state.rulesVersion !== 'career-preview-v1' && ['lifestyle','diet','money-plan','investment-risk','savings-buffer','money-transfer'].includes(action.type)) return state;
  if (action.type === 'next-choice') return advanceToNextChoice(state, action);
  if (state.rulesVersion === 'career-preview-v1') return reduceCareerGame(state, action);
  if (action.type === 'career-focus' || action.type === 'explore' || action.type === 'finance' || action.type === 'school-funding' || action.type === 'workload') return state;
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
  if (action.type !== 'choose' || !state.pendingEvent || state.pendingEvent.id !== action.eventId) return state;
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

function advanceToNextChoice(state: GameState, action: GameAction): GameState {
  if (!state.life || state.pendingEvent || state.status !== 'active' || state.processedActionIds.includes(action.id)) return state;
  // Reuse ordinary monthly progression, including finances and seeded draws.
  // One click is one saved action; skipped time is not active player time.
  let next = structuredClone(state);
  next.life!.paused = false;
  next.life!.speed = 16;
  for (let i = 0; i < 4096; i++) {
    const previous = next;
    next = reduceGame(next, { type: 'tick', id: `${action.id}:advance:${i}`, elapsedMs: 1000 });
    if (next === previous) return state;
    if (!next.pendingEvent && next.status !== 'completed') continue;
    next.life!.speed = state.life.speed;
    next.life!.paused = true;
    if (next.progress && state.progress) next.progress.activeMs = [...state.progress.activeMs];
    next.revision = state.revision + 1;
    next.processedActionIds = [...state.processedActionIds, action.id];
    return next;
  }
  return state;
}
