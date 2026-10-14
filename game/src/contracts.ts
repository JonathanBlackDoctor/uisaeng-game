import type { CareerState } from './career';
import type { SpecialtyJourney } from './specialty-journey';
import type { EconomyState } from './economy';
import type { CampusState } from './campus';
import type { CareerDepth } from './career-depth';
import type { LifeDynamics } from './life-dynamics';
import type { AbilityState } from './abilities';
import type { LifestyleState, LifestyleKey, Diet } from './lifestyle';
import type { PortfolioState, InvestmentRisk } from './portfolio';
import type { LifeStories } from './life-stories';
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
export interface LifeBackground { region: string; environment: string; finances: 'tight' | 'steady' | 'comfortable'; support: 'limited' | 'steady' | 'close'; experience: string; profile?: import('./background').BackgroundProfile }
export interface RandomLife {
  initialSeed: number; background: LifeBackground; elapsedMs: number;
  focus: { main: Activity; supporting: Activity }; paused: boolean; speed: TimeSpeed;
  startAge?: 19 | 20;
  seen: Record<string, number>; flags: string[]; contacts: number;
  childBornMonth?: number;
}
export type FamilyScene = 'meeting' | 'gwating' | 'blind-date' | 'campus' | 'confession' | 'cc-life' | 'distance' | 'marriage' | 'parenthood' | 'care' | 'growth' | 'couple-life' | 'single-life' | 'family-recap';
export interface GameEvent { id: string; stage: LifeStage; title: string; body: string; choices: EventChoice[]; provenance: 'integration-fixture' | 'family-preview' | 'random-preview' | 'career-preview'; choiceVersion?: 1; abilityImpactVersion?: 1; opportunityVersion?: 1; familyScene?: FamilyScene; randomKey?: string; person?: Person; sourceNote?: { text: string; url: string; sha256: string } }
export interface JournalEntry { id: string; stage: LifeStage; title: string; detail: string; effects: Partial<Stats>; importance?: 'major'; choice?: { label: string; detail: string; context?: string; effects: Partial<Stats>; resultId?: string } }
export interface GameState {
  statHighs?: import('./stat-highs').StatHighs;
  clinic?: import('./clinic').ClinicState;
  identity?: import('./identity').IdentityState;
  runId: string; revision: number; seed: number; stageIndex: number; stats: Stats;
  pendingEvent: GameEvent | null; journal: JournalEntry[]; processedActionIds: string[];
  status: 'active' | 'completed'; rulesVersion: 'fixture-v1' | 'family-preview-v1' | 'random-preview-v1' | 'career-preview-v1'; contentVersion: 'fixture-v1' | 'family-preview-v1' | 'random-preview-v1' | 'career-preview-v1';
  family?: FamilyState;
  life?: RandomLife;
  career?: CareerState;
  economy?: EconomyState;
  encounters?: import('./life-goals').EncounterRecord;
  legacy?: import('./legacy-goals').LegacyRecord;
  publications?: import('./publications').PublicationRecord;
  progress?: CareerProgress;
  campus?: CampusState;
  depth?: CareerDepth;
  journey?: SpecialtyJourney;
  dynamics?: LifeDynamics;
  abilities?: AbilityState;
  lifestyle?: LifestyleState;
  portfolio?: PortfolioState;
  stories?: LifeStories;
  incidents?: import('./major-events').MajorIncidents;
}
export interface CareerProgress {
  version: 1;
  clockVersion?: 2;
  pacingVersion?: 1;
  runLength?: 'standard' | 'short';
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
  | { type: 'clinic'; id: string; kind: 'expand' | 'manage' }
  | { type: 'lifestyle'; id: string; key: LifestyleKey; enabled: boolean }
  | { type: 'diet'; id: string; diet: Diet }
  | { type: 'money-plan'; id: string; field: 'autoSave' | 'autoInvest' | 'autoRepay'; amount: number }
  | { type: 'investment-risk'; id: string; risk: InvestmentRisk }
  | { type: 'savings-buffer'; id: string; enabled: boolean }
  | { type: 'money-transfer'; id: string; kind: 'save' | 'withdraw' | 'invest' | 'sell'; amount: number }
  | { type: 'next-choice'; id: string }
  | { type: 'finance'; id: string; kind: 'repay' }
  | { type: 'school-funding'; id: string; automatic: boolean }
  | { type: 'workload'; id: string; workload: CareerDepth['workload'] }
  | { type: 'career-focus'; id: string; focus: CareerProgress['focus'] }
  | { type: 'explore'; id: string; specialtyId: string }
  | { type: 'activity'; id: string; main: Activity; supporting: Activity }
  | { type: 'choose'; id: string; eventId: string; choiceId: string }
  | { type: 'tick'; id: string; elapsedMs: number }
  | { type: 'control'; id: string; paused?: boolean; speed?: TimeSpeed };
export interface SaveEnvelope { schemaVersion: 1; updatedAt: string; state: GameState }
export interface ArchivedRun { runId: string; archivedAt: string; state: GameState }
