import { isAddedProfession, NURSING_CERTIFICATES } from './professions';
import type { GameState } from './contracts';
import { ALL_SPECIALTIES as SPECIALTIES } from './career';
import { CREDENTIALS, specialtyFields } from './credential-catalog';
import { credentialEarned, fellowshipComplete, journeyCredential, journeyField } from './specialty-journey';
import { elapsedMonths } from './random-life';
import { mergeStatHighs, observedHighs, validStatHighs, type StatHighs } from './stat-highs';

export interface CareerRecord {
  version: 1; runId: string; firstSeenAt: string; completed: boolean;
  milestones: Record<string, number>;
  statHighs?: StatHighs;
}
export const specialtyKey = (id: string, qualified = false) => `specialty:${id}:${qualified ? 'qualified' : 'trained'}`;
export const fieldKey = (specialty: string, field: string, completed = false) => `field:${specialty}:${field}:${completed ? 'completed' : 'trained'}`;
export const credentialKey = (id: string) => `credential:${id}`;
const keys = new Set([
  ...SPECIALTIES.flatMap(s => [specialtyKey(s.id), specialtyKey(s.id, true), ...specialtyFields(s.id).flatMap(f => [fieldKey(s.id, f.id), fieldKey(s.id, f.id, true)])]),
  ...CREDENTIALS.map(c => credentialKey(c.id)),
  ...NURSING_CERTIFICATES.map(c => credentialKey('nursing:' + c)),
]);
export function validCareerRecord(value: unknown): value is CareerRecord {
  const r = value as CareerRecord;
  return !!r && r.version === 1 && typeof r.runId === 'string' && r.runId.length > 0
    && (r.statHighs === undefined || validStatHighs(r.statHighs))
    && typeof r.firstSeenAt === 'string' && Number.isFinite(Date.parse(r.firstSeenAt)) && typeof r.completed === 'boolean'
    && !!r.milestones && typeof r.milestones === 'object' && !Array.isArray(r.milestones)
    && Object.keys(r.milestones).length <= keys.size
    && Object.entries(r.milestones).every(([key, month]) => keys.has(key) && Number.isSafeInteger(month) && month >= 0);
}
// Call only with a validated state. Old saves can establish training, never a new credential.
export function recordCareer(s: GameState, at: string): CareerRecord {
  const r: CareerRecord = { version: 1, runId: s.runId, firstSeenAt: at, completed: s.status === 'completed', milestones: {}, statHighs: observedHighs(s) };
  const c = s.career, id = c?.specialty;
  if (!id || c.application !== 'accepted' || !SPECIALTIES.some(x => x.id === id) || s.stageIndex < 1) return r;
  if (isAddedProfession(s)) {
    const p = s.professional!;
    r.milestones[specialtyKey(id)] = s.progress?.trainingStartMonth ?? p.licenseMonth!;
    if (p.qualified) r.milestones[specialtyKey(id, true)] = p.qualifiedMonth!;
    if (p.certificateEarned) r.milestones[credentialKey('nursing:' + p.certificate)] = p.decisions['certificate-review'].month;
    return r;
  }
  const start = s.progress?.trainingStartMonth ?? 72;
  if (elapsedMonths(s) < start) return r;
  r.milestones[specialtyKey(id)] = start;
  // The existing engine treats entry into the post-training stage as specialist completion.
  if (s.stageIndex >= 2 && elapsedMonths(s) >= start + 72) r.milestones[specialtyKey(id, true)] = start + 72;
  const f = journeyField(s), d = s.journey?.decisions;
  if (f && d?.field && r.milestones[specialtyKey(id, true)] !== undefined) {
    r.milestones[fieldKey(id, f.id)] = d.field.month;
    const completion = Object.entries(d).find(([key, value]) => key.startsWith('fellow-review:') && value.choice === 'qualify');
    if (fellowshipComplete(s) && completion) r.milestones[fieldKey(id, f.id, true)] = completion[1].month;
    if (credentialEarned(s)) r.milestones[credentialKey(journeyCredential(s)!.id)] = d['credential-exam'].month;
  }
  return r;
}
export function mergeCareerRecords(rows: CareerRecord[]): CareerRecord[] {
  const byRun = new Map<string, CareerRecord>();
  for (const r of rows) {
    const previous = byRun.get(r.runId);
    if (!previous) { byRun.set(r.runId, { ...r, milestones: { ...r.milestones } }); continue; }
    previous.firstSeenAt = new Date(previous.firstSeenAt) <= new Date(r.firstSeenAt) ? previous.firstSeenAt : r.firstSeenAt;
    previous.completed ||= r.completed;
    if (r.statHighs) previous.statHighs = mergeStatHighs(previous.statHighs, r.statHighs);
    for (const [key, month] of Object.entries(r.milestones)) previous.milestones[key] = Math.min(previous.milestones[key] ?? Infinity, month);
  }
  return [...byRun.values()].sort((a, b) => Date.parse(a.firstSeenAt) - Date.parse(b.firstSeenAt) || a.runId.localeCompare(b.runId));
}
export function firstAchievement(rows: CareerRecord[], key: string) {
  const index = rows.findIndex(r => r.milestones[key] !== undefined);
  return index < 0 ? null : { run: index + 1, month: rows[index].milestones[key], runId: rows[index].runId };
}
