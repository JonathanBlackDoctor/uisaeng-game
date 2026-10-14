import { createCareerGame } from '../../src/career-runtime';
import { reduceGame } from '../../src/engine';
import { configureIdentity, type Gender } from '../../src/identity';
import { PROFESSION_SPECIALTIES, type AddedProfession } from '../../src/professions';
import { validProfessionalLife } from '../../src/profession-runtime';
import { elapsedMonths } from '../../src/random-life';
import { validState } from '../../src/storage';
import type { GameState } from '../../src/contracts';

export interface JourneyOptions {
  seed?: number;
  field?: string;
  route?: 'specialist' | 'general' | 'nurse' | 'research';
  work?: 'employed' | 'untrained' | 'clinic' | 'research';
  gender?: Gender;
  picks?: Record<string, string>;
  stop?: (state: GameState) => boolean;
  visit?: (state: GameState) => void;
}
export function chooseProfessionEvent(s: GameState, options: JourneyOptions = {}): GameState {
  const e = s.pendingEvent!;
  const defaults: Record<string, string> = {
    funding: 'education-plan', 'marriage-required': 'single',
    'service:plan': 'army', 'service:volunteer': 'civilian',
    'service:timing': 'after-training',
    'profession:route': options.route ?? (s.profession === 'nursing' ? 'nurse' : 'specialist'),
    'profession:field': options.field ?? PROFESSION_SPECIALTIES.find(x => x.profession === s.profession)!.id,
    'profession:result': 'retry', 'profession:license': 'exam',
    'profession:qualification': 'exam', 'profession:work': options.work ?? (options.route === 'research' ? 'research' : 'employed'),
    'profession:shift': 'day', 'profession:certificate': 'skip',
    'profession:certificate-review': 'exam', 'profession:transition': 'stay',
    'clinic-funding': 'loan',
  };
  const desired = options.picks?.[e.randomKey!] ?? defaults[e.randomKey!];
  const picked = e.choices.find(c => c.id === desired)
    ?? e.choices.find(c => c.id === 'untrained')
    ?? e.choices.find(c => c.id === 'team')
    ?? e.choices.find(c => c.id === 'pay-due')
    ?? e.choices[0];
  return reduceGame(s, { type: 'choose', id: `qa:choice:${s.revision}`, eventId: e.id, choiceId: picked.id });
}
export function continueProfession(initial: GameState, options: JourneyOptions = {}) {
  let s = initial;
  const events: string[] = [];
  for (let i = 0; i < 1200 && s.status !== 'completed' && !options.stop?.(s); i++) {
    options.visit?.(s);
    const key = s.pendingEvent?.randomKey;
    if (key) events.push(key);
    const before = s;
    s = s.pendingEvent ? chooseProfessionEvent(s, options) : reduceGame(s, { type: 'next-choice', id: `qa:next:${s.revision}` });
    if (s === before) throw Error(`no progress after ${key ?? 'advance'} at ${elapsedMonths(s)}`);
    if (!Boolean(validState(s))) throw Error(`invalid ${s.profession} at ${elapsedMonths(s)} after ${key} pending ${s.pendingEvent?.randomKey}; professionValid=${validProfessionalLife(s)}; ${JSON.stringify({ professional: s.professional, career: s.career, progress: s.progress, stage: s.stageIndex })}`);
  }
  if (!(options.stop ? options.stop(s) : s.status === 'completed')) throw Error(`stuck ${s.profession} ${elapsedMonths(s)} ${s.pendingEvent?.randomKey}`);
  options.visit?.(s);
  return { s, events };
}
export function professionJourney(profession: AddedProfession, options: JourneyOptions = {}) {
  const seed = options.seed ?? 3;
  let s = createCareerGame(`qa-${profession}-${seed}-${options.field ?? options.route ?? 'default'}`, seed, profession);
  if (options.gender) s = configureIdentity(s, options.gender);
  return continueProfession(s, options);
}
