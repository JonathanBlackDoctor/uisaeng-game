import { createCareerGame } from './career-runtime';
import { PROFESSION_IDS } from './professions';
import { lifeAge, nextRandom } from './random-life';
import { initialAging } from './aging';

// Adjustable game weights, not real admission statistics.
export const ADMISSION_RULES = {
  version: 'random-admission-provisional-1', provisional: true,
  ages: [20, 21, 22, 23, 24], weights: [65, 23, 8, 3, 1],
} as const;

export const admissionRoute = (age: number) => age <= 20 ? '현역' : age === 21 ? '재수' : `${age - 19}수`;

export function createAdmissionGame(runId: string, seed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0]) {
  // Separate draws leave existing background and event streams unchanged.
  const college = nextRandom((seed ^ 0xA41D1501) >>> 0);
  const ageDraw = nextRandom(college.seed).value * 100;
  let cumulative = 0;
  const ageIndex = ADMISSION_RULES.weights.findIndex(weight => (cumulative += weight) > ageDraw);
  const s = createCareerGame(runId, seed, PROFESSION_IDS[Math.floor(college.value * PROFESSION_IDS.length)]);
  s.life!.startAge = ADMISSION_RULES.ages[ageIndex];
  s.aging = initialAging(s);
  s.journal[0].detail = `${lifeAge(s)} · ${admissionRoute(s.life!.startAge)} 입학 · ${s.journal[0].detail.replace(/^20세 0개월 · /, '')}`;
  return s;
}
