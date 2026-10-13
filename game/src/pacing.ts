import type { GameState } from './contracts';

// Game tuning, not a model of real-world event frequencies. Missing version keeps old saves intact.
export const PACING_RULES = { version: 1, monthMs: [3900, 325, 325, 325], abilityLimit: 1, randomChance: 0.035 } as const;
export const compactPacing = (s: GameState) => s.progress?.pacingVersion === 1;
export const careerMonthMs = (s: GameState) => compactPacing(s) ? PACING_RULES.monthMs[s.stageIndex] : [6000, 500, 500, 500][s.stageIndex];

function pick(s: GameState, salt: number, count: number) {
  let value = (s.life!.initialSeed ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) % count;
}
export const pacingArc = (s: GameState) => pick(s, 0x6c696665, 2) === 0 ? 'notebook' : 'peer';
export const pacingExtraStage = (s: GameState) => pick(s, 0x65787472, 4);
export const pacingStoryLimit = (s: GameState) => 1 + Number(s.stageIndex === 2) + Number(s.stageIndex === pacingExtraStage(s));
