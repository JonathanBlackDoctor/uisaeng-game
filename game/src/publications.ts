import type { GameState, LifeStage } from './contracts';
import { abilityState } from './abilities';
import { SPECIALTIES } from './career';
import { academicRank } from './specialty-journey';

// Fictional tuning: work units represent research progress, not real publication rates.
export const PUBLICATION_RULES = { version: 'publications-provisional-v1', provisional: true,
  workPerPaper: 12_000_000, focusRate: 1000, groupRate: 500, jobRate: 500, rankRate: 250, maxRate: 4500 } as const;
export interface PaperProject { title: string; kind: 'study' | 'collaboration'; startedMonth: number }
export interface PublishedPaper extends PaperProject { id: string; publishedMonth: number }
export interface PublicationRecord {
  version: 1; sinceMs: number; lastMs: number; effortUnits: number;
  papers: PublishedPaper[]; current: PaperProject | null;
}
export const initialPublications = (ms = 0): PublicationRecord => ({ version: 1, sinceMs: ms, lastMs: ms, effortUnits: 0, papers: [], current: null });
export const publicationLabel = (s: GameState) => s.publications
  ? `${s.publications.papers.length.toLocaleString('ko-KR')}편${s.publications.sinceMs > 0 ? ' (집계 시작 이후)' : ''}` : '집계 전';
export function activeAcademicRank(s: GameState): number {
  if (s.stageIndex !== 2 || Object.entries(s.journey?.decisions ?? {}).some(([k, d]) => !k.startsWith('scene:') && ['exit', 'leave'].includes(d.choice))) return -1;
  return academicRank(s);
}
export function publicationRate(s: GameState, active: readonly string[]): number {
  if (!s.career || !s.progress) return 0;
  const r = PUBLICATION_RULES;
  let rate = (s.progress.focus === 'research' ? r.focusRate : 0) + (active.includes('research') ? r.groupRate : 0)
    + (s.stageIndex === 2 && s.career.practice === 'research' ? r.jobRate : 0);
  if (!rate) return 0;
  rate += Math.max(0, activeAcademicRank(s) + 1) * r.rankRate;
  const skill = s.abilities ? abilityState(s).values.research : 50;
  return Math.min(r.maxRate, Math.round(rate * (0.5 + skill / 100)));
}
export function publicationSummary(s: GameState): string {
  const r = s.publications;
  if (!r?.current) return s.status === 'completed' ? '' : '연구 활동을 이어가면 논문을 완성합니다.';
  const percent = Math.floor((r.effortUnits % PUBLICATION_RULES.workPerPaper) * 100 / PUBLICATION_RULES.workPerPaper);
  return `${r.current.title} · ${percent}%${s.status === 'completed' ? ' · 미완성' : ''}`;
}
export function accruePublications(s: GameState, simulatedMs: number, active: readonly string[]) {
  if (!s.life || !s.career || s.status === 'completed' || s.life.paused || s.pendingEvent || simulatedMs <= 0) return;
  const start = s.life.elapsedMs, end = start + simulatedMs;
  const r = s.publications ??= initialPublications(start);
  const delta = Math.max(0, end - Math.max(start, r.lastMs));
  if (!delta) return;
  r.lastMs = end;
  const rate = publicationRate(s, active);
  let remaining = delta * rate;
  while (remaining > 0) {
    if (!r.current) {
      const specialty = SPECIALTIES.find(x => x.id === s.career!.specialty)?.name ?? '의학';
      const collaboration = activeAcademicRank(s) >= 1;
      const topics = collaboration ? ['다기관 자료 분석', '공동 추적 연구', '기관 간 결과 비교'] : ['문헌 검토', '자료 분석', '관찰 연구'];
      r.current = { title: `${specialty} ${topics[r.papers.length % topics.length]}`, kind: collaboration ? 'collaboration' : 'study', startedMonth: Math.floor((end * rate - remaining) / (rate * 1000)) };
    }
    const needed = PUBLICATION_RULES.workPerPaper - r.effortUnits % PUBLICATION_RULES.workPerPaper;
    const used = Math.min(remaining, needed); r.effortUnits += used; remaining -= used;
    if (r.effortUnits % PUBLICATION_RULES.workPerPaper === 0) {
      const paper = { ...r.current, id: `paper:${r.papers.length + 1}`, publishedMonth: Math.floor((end * rate - remaining) / (rate * 1000)) };
      r.papers.push(paper); r.current = null;
      s.journal.push({ id: `publication:${paper.id}`, stage: (['university', 'training', 'career', 'retirement'] as LifeStage[])[s.stageIndex],
        title: '논문 발표', detail: `${paper.title}를 논문으로 발표했습니다. 누적 ${r.papers.length}편.`, effects: {} });
    }
  }
}
export function validPublications(s: GameState): boolean {
  const r = s.publications;
  if (r === undefined) return true;
  const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
  if (!r || r.version !== 1 || !s.life || !integer(r.sinceMs) || !integer(r.lastMs) || r.sinceMs > r.lastMs || r.lastMs > s.life.elapsedMs
    || !integer(r.effortUnits) || r.effortUnits > (r.lastMs - r.sinceMs) * PUBLICATION_RULES.maxRate
    || !Array.isArray(r.papers) || r.papers.length !== Math.floor(r.effortUnits / PUBLICATION_RULES.workPerPaper)) return false;
  const project = (p: PaperProject) => p && typeof p.title === 'string' && p.title.trim().length > 0 && p.title.length <= 100
    && ['study', 'collaboration'].includes(p.kind) && integer(p.startedMonth) && p.startedMonth >= Math.floor(r.sinceMs / 1000) && p.startedMonth <= Math.floor(r.lastMs / 1000);
  let previous = Math.floor(r.sinceMs / 1000);
  for (let i = 0; i < r.papers.length; i++) {
    const p = r.papers[i];
    if (!project(p) || p.id !== `paper:${i + 1}` || !integer(p.publishedMonth) || p.startedMonth < previous
      || p.publishedMonth < p.startedMonth || p.publishedMonth > Math.floor(r.lastMs / 1000)) return false;
    previous = p.publishedMonth;
  }
  const pending = r.effortUnits % PUBLICATION_RULES.workPerPaper > 0;
  return pending ? !!r.current && project(r.current) && r.current.startedMonth >= previous : r.current === null;
}
