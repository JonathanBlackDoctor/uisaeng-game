import type { GameState, LifeStage } from './contracts';

// Adjustable game settings, not real training requirements or calendar conversions.
export const LEGACY_RULES = { version: 'family-mentoring-provisional-v1', provisional: true,
  familyHours: 6, mentoringHours: 4, weeksPerMonth: 4, mentoringMonths: 24 } as const;
export interface StudentRecord {
  id: string; name: string; kind: 'clinical' | 'research'; startedMonth: number;
  mentoredMs: number; completedMonth?: number;
}
export interface LegacyRecord {
  version: 1; sinceMs: number; lastMs: number; familyTimeUnits: number; students: StudentRecord[];
}
const NAMES = ['유진', '도윤', '서연', '지호', '수빈', '민재', '다은', '시우', '채원', '현우', '지안', '준서'];
const duration = LEGACY_RULES.mentoringMonths * 1000;
export const initialLegacy = (ms = 0): LegacyRecord => ({ version: 1, sinceMs: ms, lastMs: ms, familyTimeUnits: 0, students: [] });
export function canMentor(s: GameState): boolean {
  return !!s.career && s.stageIndex >= 2 && s.career.practice !== 'undecided'
    && (s.career.practice !== 'clinic' || !!s.economy?.ledger.some(t => t.kind === 'open-clinic'));
}
export const trainedStudents = (s: GameState) => s.legacy?.students.filter(p => p.completedMonth !== undefined) ?? [];
export const currentStudent = (s: GameState) => s.legacy?.students.find(p => p.completedMonth === undefined);
const partial = (s: GameState) => s.legacy && s.legacy.sinceMs > 0 ? ' (집계 시작 이후)' : '';
export const familyTimeLabel = (s: GameState) => s.legacy ? `${Math.floor(s.legacy.familyTimeUnits / 1000).toLocaleString('ko-KR')}시간${partial(s)}` : '집계 전';
export const studentsLabel = (s: GameState) => s.legacy ? `${trainedStudents(s).length.toLocaleString('ko-KR')}명${partial(s)}` : '집계 전';
export const studentAchievement = (p: StudentRecord) => p.kind === 'research' ? '독립 연구 과제 마침' : '진료 계획과 인계 과정 마침';
export function mentoringSummary(s: GameState): string {
  const p = currentStudent(s);
  if (p) return `${p.name} 지도 중 · ${Math.floor(p.mentoredMs / 1000)}/${LEGACY_RULES.mentoringMonths}개월`;
  return canMentor(s) ? '생활 설정에서 후배 지도를 시작하세요.' : '직업 생활을 시작하면 후배를 지도할 수 있습니다.';
}
function note(s: GameState, id: string, title: string, detail: string) {
  s.journal.push({ id, stage: (['university', 'training', 'career', 'retirement'] as LifeStage[])[s.stageIndex], title, detail, effects: {} });
}
// Called before the life clock advances. The cursor prevents duplicate and retroactive accrual.
export function accrueLegacy(s: GameState, simulatedMs: number, active: readonly string[]) {
  if (!s.life || s.status === 'completed' || s.life.paused || s.pendingEvent || simulatedMs <= 0) return;
  const start = s.life.elapsedMs, end = start + simulatedMs;
  const r = s.legacy ??= initialLegacy(start);
  const delta = Math.max(0, end - Math.max(start, r.lastMs));
  if (!delta) return;
  r.lastMs = end;
  if (active.includes('family')) r.familyTimeUnits += delta * LEGACY_RULES.familyHours * LEGACY_RULES.weeksPerMonth;
  if (!active.includes('mentoring') || !canMentor(s)) return;
  let remaining = delta;
  while (remaining > 0) {
    let p = currentStudent(s);
    if (!p) {
      const index = r.students.length;
      p = { id: `student:${index + 1}`, name: NAMES[((s.life.initialSeed >>> 0) + index) % NAMES.length],
        kind: s.career!.practice === 'research' ? 'research' : 'clinical', startedMonth: Math.floor((end - remaining) / 1000), mentoredMs: 0 };
      r.students.push(p);
      note(s, `legacy:${p.id}:start`, `${p.name}의 지도를 맡다`, p.kind === 'research'
        ? '후배와 연구 질문을 정하고, 정기적으로 진행 상황을 살피기로 했습니다.'
        : '후배와 진료 기록을 함께 검토하고, 판단과 인계를 꾸준히 연습하기로 했습니다.');
    }
    const used = Math.min(remaining, duration - p.mentoredMs), before = p.mentoredMs;
    p.mentoredMs += used; remaining -= used;
    if (before < duration / 2 && p.mentoredMs >= duration / 2) note(s, `legacy:${p.id}:mid`, `${p.name}의 중간 점검`,
      p.kind === 'research' ? '후배가 직접 분석 계획을 세웠습니다. 함께 검토하고 다음 과제를 정했습니다.' : '후배가 먼저 진료 계획을 설명했습니다. 놓친 부분을 짚고 다음 사례를 함께 살폈습니다.');
    if (p.mentoredMs === duration) {
      p.completedMonth = Math.floor((end - remaining) / 1000);
      note(s, `legacy:${p.id}:complete`, `${p.name}의 지도를 마치다`, `${studentAchievement(p)}. ${p.kind === 'research' ? '스스로 연구를 이어갈' : '스스로 진료 계획을 세우고 필요한 도움을 구할'} 수 있게 됐습니다.`);
    }
  }
}
export function validLegacy(s: GameState): boolean {
  const r = s.legacy;
  if (r === undefined) return true;
  const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
  if (!r || r.version !== 1 || !s.life || !integer(r.sinceMs) || !integer(r.lastMs)
    || r.sinceMs > r.lastMs || r.lastMs > s.life.elapsedMs || !integer(r.familyTimeUnits)
    || r.familyTimeUnits > (r.lastMs - r.sinceMs) * LEGACY_RULES.familyHours * LEGACY_RULES.weeksPerMonth
    || !Array.isArray(r.students) || r.students.length > Math.ceil((r.lastMs - r.sinceMs) / duration)) return false;
  let total = 0, previousEnd = Math.floor(r.sinceMs / 1000);
  for (let i = 0; i < r.students.length; i++) {
    const p = r.students[i];
    if (!p || p.id !== `student:${i + 1}` || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 30
      || !['clinical', 'research'].includes(p.kind) || !integer(p.startedMonth) || p.startedMonth < previousEnd
      || p.startedMonth > Math.floor(r.lastMs / 1000) || !integer(p.mentoredMs) || p.mentoredMs === 0 || p.mentoredMs > duration) return false;
    total += p.mentoredMs;
    if (p.completedMonth === undefined) {
      if (i !== r.students.length - 1 || p.mentoredMs >= duration || p.mentoredMs > r.lastMs - Math.max(r.sinceMs, p.startedMonth * 1000)) return false;
    } else {
      if (!integer(p.completedMonth) || p.completedMonth < p.startedMonth + LEGACY_RULES.mentoringMonths
        || p.completedMonth > Math.floor(r.lastMs / 1000) || p.mentoredMs !== duration) return false;
      previousEnd = p.completedMonth;
    }
  }
  return total <= r.lastMs - r.sinceMs;
}
