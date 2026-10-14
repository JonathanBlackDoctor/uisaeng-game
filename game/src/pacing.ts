import type { GameState } from './contracts';

// Game tuning, not a model of real-world event frequencies. Missing version keeps old saves intact.
export const PACING_RULES = { version: 1, monthMs: [3900, 325, 325, 325], abilityLimit: 1, randomChance: 0.035 } as const;
export const compactPacing = (s: GameState) => s.progress?.pacingVersion === 1;
// Adjustable short-session tuning; the simulated calendar and monthly effects stay intact.
export const SHORT_PACING = { monthMs: [1950, 163, 163, 163], randomChance: 0.0175, serviceRate: 2 } as const;
export const shortPacing = (s: GameState) => compactPacing(s) && s.progress?.runLength === 'short';
export const careerMonthMs = (s: GameState) => shortPacing(s) ? SHORT_PACING.monthMs[s.stageIndex] : compactPacing(s) ? PACING_RULES.monthMs[s.stageIndex] : [6000, 500, 500, 500][s.stageIndex];
export const careerRandomChance = (s: GameState) => shortPacing(s) ? SHORT_PACING.randomChance : PACING_RULES.randomChance;
export const servicePacingRate = (s: GameState) => shortPacing(s) ? SHORT_PACING.serviceRate : 1;
export function setStartingLength(s: GameState, length: 'standard' | 'short'): GameState {
  if (!s.progress || !compactPacing(s) || s.revision !== 0 || s.life?.elapsedMs !== 0 || s.pendingEvent || !s.life.paused || !['standard', 'short'].includes(length)) return s;
  return { ...s, progress: { ...s.progress, runLength: length } };
}

function pick(s: GameState, salt: number, count: number) {
  let value = (s.life!.initialSeed ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) % count;
}
export const pacingArc = (s: GameState) => pick(s, 0x6c696665, 2) === 0 ? 'notebook' : 'peer';
export const pacingExtraStage = (s: GameState) => pick(s, 0x65787472, 4);
export const pacingStoryLimit = (s: GameState) => 1 + Number(s.stageIndex === 2) + Number(!shortPacing(s) && s.stageIndex === pacingExtraStage(s));
