import type { CareerState } from './career';
import type { EconomyState } from './economy';
export const STAT_LABELS = { health: '건강', happiness: '행복', knowledge: '지식', relationships: '관계' } as const;
export type Stat = keyof typeof STAT_LABELS;
export type Stats = Record<Stat, number>;
export type LifeStage = 'university' | 'training' | 'career' | 'retirement';
export type Activity = 'study' | 'connect' | 'rest';
export const TIME_SPEEDS = [1, 2, 4, 8, 16] as const;
export type TimeSpeed = typeof TIME_SPEEDS[number];
export interface EventChoice { id: string; label: string; description: string; effects: Partial<Stats> }
export type MeetingRoute = 'gwating' | 'blind-date' | 'campus';
export interface FamilyState {
  status: 'single' | 'dating' | 'married';
  meeting: MeetingRoute | null;
  children: 'none' | 'young' | 'school' | 'adult';
  care: 'none' | 'shared' | 'support';
  partner?: Person;
}
export interface Person { id: string; name: string; temperament: string; occupation: string }
export interface LifeBackground { region: string; environment: string; finances: 'tight' | 'steady' | 'comfortable'; support: 'limited' | 'steady' | 'close'; experience: string }
export interface RandomLife {
  initialSeed: number; background: LifeBackground; elapsedMs: number;
  focus: { main: Activity; supporting: Activity }; paused: boolean; speed: TimeSpeed;
  startAge?: 19 | 20;
  seen: Record<string, number>; flags: string[]; contacts: number;
  childBornMonth?: number;
}
export type FamilyScene = 'meeting' | 'gwating' | 'blind-date' | 'campus' | 'confession' | 'cc-life' | 'distance' | 'marriage' | 'parenthood' | 'care' | 'growth' | 'couple-life' | 'single-life' | 'family-recap';
export interface GameEvent { id: string; stage: LifeStage; title: string; body: string; choices: EventChoice[]; provenance: 'integration-fixture' | 'family-preview' | 'random-preview' | 'career-preview'; familyScene?: FamilyScene; randomKey?: string; person?: Person }
export interface JournalEntry { id: string; stage: LifeStage; title: string; detail: string; effects: Partial<Stats> }
export interface GameState {
  runId: string; revision: number; seed: number; stageIndex: number; stats: Stats;
  pendingEvent: GameEvent | null; journal: JournalEntry[]; processedActionIds: string[];
  status: 'active' | 'completed'; rulesVersion: 'fixture-v1' | 'family-preview-v1' | 'random-preview-v1' | 'career-preview-v1'; contentVersion: 'fixture-v1' | 'family-preview-v1' | 'random-preview-v1' | 'career-preview-v1';
  family?: FamilyState;
  life?: RandomLife;
  career?: CareerState;
  economy?: EconomyState;
  progress?: CareerProgress;
}
export interface CareerProgress {
  version: 1;
  focus: 'study' | 'research' | 'clinical' | 'people' | 'rest' | 'work';
  club: 'pending' | 'joined' | 'declined';
  marriage: 'pending' | 'later' | 'settled';
  resolved: string[];
  counts: Record<string, number>;
  activeMs: number[];
  remainder: number;
  retryMonth: number;
  marriageRetryMonth?: number;
  trainingStartMonth?: number;
  result: string;
  selectedSpecialty?: string;
}
export type GameAction =
  | { type: 'next-choice'; id: string }
  | { type: 'finance'; id: string; kind: 'repay' }
  | { type: 'career-focus'; id: string; focus: CareerProgress['focus'] }
  | { type: 'explore'; id: string; specialtyId: string }
  | { type: 'activity'; id: string; main: Activity; supporting: Activity }
  | { type: 'choose'; id: string; eventId: string; choiceId: string }
  | { type: 'tick'; id: string; elapsedMs: number }
  | { type: 'control'; id: string; paused?: boolean; speed?: TimeSpeed };
export interface SaveEnvelope { schemaVersion: 1; updatedAt: string; state: GameState }
export interface ArchivedRun { runId: string; archivedAt: string; state: GameState }
