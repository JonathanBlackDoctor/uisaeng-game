import { STAT_LABELS, type ArchivedRun, type GameState, type SaveEnvelope } from './contracts';
import { familyEvent } from './family';
import { validStatHighs } from './stat-highs';
import { validRandomState } from './random-life';
import { validCareerGame } from './career-runtime';
import { mergeCareerRecords, recordCareer, validCareerRecord, type CareerRecord } from './career-records';

export class SaveError extends Error {}
export class SaveConflictError extends SaveError {}
export const DB_NAME = 'uisaeng-preview-v1';
const request = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
const finished = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new SaveError('저장이 취소되었습니다. 이전 기록은 보존됩니다.')); tx.onerror = () => reject(tx.error); });
const stages = ['university', 'training', 'career', 'retirement'];
function validEffects(value: unknown) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([key, amount]) => key in STAT_LABELS && typeof amount === 'number' && Number.isFinite(amount));
}
function validFamily(s: GameState): boolean {
  if (s.rulesVersion === 'career-preview-v1') return validCareerGame(s);
  if (s.rulesVersion === 'random-preview-v1') return validRandomState(s);
  if (s.life !== undefined || s.family?.partner !== undefined) return false;
  if (s.rulesVersion === 'fixture-v1') return s.contentVersion === 'fixture-v1' && s.family === undefined && !s.pendingEvent?.familyScene;
  if (s.rulesVersion !== 'family-preview-v1' || s.contentVersion !== 'family-preview-v1') return false;
  const f = s.family;
  if (!f || !['single', 'dating', 'married'].includes(f.status) || ![null, 'gwating', 'blind-date', 'campus'].includes(f.meeting)
    || !['none', 'young', 'school', 'adult'].includes(f.children) || !['none', 'shared', 'support'].includes(f.care)) return false;
  if (f.status !== 'single' && f.meeting === null) return false;
  if (f.children !== 'none' && f.status === 'single') return false;
  if ((['none', 'young'].includes(f.children)) !== (f.care === 'none')) return false;
  if (s.stageIndex === 0 && (f.status === 'married' || f.children !== 'none')) return false;
  if (s.stageIndex < 2 && ['school', 'adult'].includes(f.children)) return false;
  if (f.children === 'adult' && s.status !== 'completed') return false;
  if (s.status === 'completed' && ['young', 'school'].includes(f.children)) return false;
  const e = s.pendingEvent;
  if (e?.provenance === 'family-preview') {
    if (!e.familyScene) return false;
    const canonical = familyEvent(e.familyScene, f, e.stage);
    return !!canonical && canonical.title === e.title && canonical.body === e.body && JSON.stringify(canonical.choices) === JSON.stringify(e.choices);
  }
  return !e?.familyScene && !(f.status === 'single' && f.meeting !== null);
}
export function validState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as GameState;
  return typeof s.runId === 'string' && s.runId.length > 0 && Number.isInteger(s.revision) && s.revision >= 0 && Number.isInteger(s.seed) && Number.isInteger(s.stageIndex) && s.stageIndex >= 0 && s.stageIndex < 4
    && validFamily(s) && ['active', 'completed'].includes(s.status)
    && (s.statHighs === undefined || validStatHighs(s.statHighs))
    && !!s.stats && Object.keys(STAT_LABELS).every(k => Number.isFinite(s.stats[k as keyof typeof STAT_LABELS]) && s.stats[k as keyof typeof STAT_LABELS] >= 0 && s.stats[k as keyof typeof STAT_LABELS] <= 100)
    && (s.status !== 'completed' || (s.stageIndex === 3 && s.pendingEvent === null))
    && Array.isArray(s.journal) && s.journal.every(e => e && typeof e.id === 'string' && typeof e.title === 'string' && typeof e.detail === 'string' && stages.includes(e.stage) && validEffects(e.effects)
      && (e.importance === undefined || e.importance === 'major')
      && (e.choice === undefined || (!!e.choice && typeof e.choice.label === 'string' && typeof e.choice.detail === 'string' && validEffects(e.choice.effects)
        && (e.choice.context === undefined || typeof e.choice.context === 'string')
        && (e.choice.resultId === undefined || typeof e.choice.resultId === 'string'))))
    && Array.isArray(s.processedActionIds) && s.processedActionIds.every(id => typeof id === 'string')
    && (s.pendingEvent === null || (!!s.pendingEvent && typeof s.pendingEvent.id === 'string' && s.pendingEvent.stage === stages[s.stageIndex] && ['integration-fixture', ...(s.rulesVersion === 'family-preview-v1' ? ['family-preview'] : []), ...(['random-preview-v1','career-preview-v1'].includes(s.rulesVersion) ? ['random-preview'] : []), ...(s.rulesVersion === 'career-preview-v1' ? ['career-preview'] : [])].includes(s.pendingEvent.provenance) && typeof s.pendingEvent.title === 'string' && typeof s.pendingEvent.body === 'string' && Array.isArray(s.pendingEvent.choices) && s.pendingEvent.choices.length > 0 && s.pendingEvent.choices.every(c => c && typeof c.id === 'string' && typeof c.label === 'string' && typeof c.description === 'string' && validEffects(c.effects))));
}
function envelope(value: unknown): SaveEnvelope | null {
  if (value === undefined) return null;
  const e = value as SaveEnvelope;
  if (e?.schemaVersion !== 1) throw new SaveError('지원하지 않는 저장 버전입니다. 원본은 변경하지 않았습니다.');
  if (!validState(e.state) || typeof e.updatedAt !== 'string') throw new SaveError('저장 기록을 읽을 수 없습니다. 원본을 보존했습니다.');
  return e;
}
export async function openGameDatabase(name = DB_NAME): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) throw new SaveError('이 브라우저에서는 로컬 저장을 사용할 수 없습니다.');
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('current')) db.createObjectStore('current');
      if (!db.objectStoreNames.contains('archives')) db.createObjectStore('archives', { keyPath: 'runId' });
      if (!db.objectStoreNames.contains('careerRecords')) db.createObjectStore('careerRecords', { keyPath: 'runId' });
    };
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result); };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new SaveError('다른 탭을 닫고 다시 열어 주세요.'));
  });
}
export async function loadGame(db: IDBDatabase): Promise<SaveEnvelope | null> {
  return envelope(await request(db.transaction('current').objectStore('current').get('active')));
}
export async function archives(db: IDBDatabase): Promise<ArchivedRun[]> {
  const rows = await request(db.transaction('archives').objectStore('archives').getAll());
  return rows.filter((row): row is ArchivedRun => typeof row.runId === 'string' && validState(row.state));
}
export async function careerRecords(db: IDBDatabase): Promise<CareerRecord[]> {
  const tx = db.transaction(['current', 'archives', 'careerRecords']);
  const [saved, history, records] = await Promise.all([
    request(tx.objectStore('current').get('active')), request(tx.objectStore('archives').getAll()), request(tx.objectStore('careerRecords').getAll()),
  ]);
  if (!records.every(validCareerRecord)) throw new SaveError('진로 기록을 읽을 수 없습니다. 원본을 백업해 주세요.');
  const current = envelope(saved);
  const legacy = history.filter((r): r is ArchivedRun => r && typeof r.archivedAt === 'string' && Number.isFinite(Date.parse(r.archivedAt)) && validState(r.state));
  return mergeCareerRecords([...records, ...legacy.map(r => recordCareer(r.state, r.archivedAt)), ...(current ? [recordCareer(current.state, current.updatedAt)] : [])]);
}
// Compare-and-swap prevents two tabs or a double click from settling a choice twice.
// Current state and the final recap share one atomic transaction.
export async function persistGame(db: IDBDatabase, state: GameState, expected: { runId: string; revision: number } | null): Promise<SaveEnvelope> {
  if (!validState(state)) throw new SaveError('유효하지 않은 상태입니다. 이전 기록을 유지합니다.');
  const tx = db.transaction(['current', 'archives', 'careerRecords'], 'readwrite');
  const completion = finished(tx);
  try {
    const store = tx.objectStore('current');
    const old = envelope(await request(store.get('active')));
    const matches = expected === null ? old === null : old?.state.runId === expected.runId && old.state.revision === expected.revision;
    if (!matches) throw new SaveConflictError('다른 탭에서 기록이 바뀌었습니다. 이어하기로 최신 기록을 불러오세요.');
    const saved: SaveEnvelope = { schemaVersion: 1, updatedAt: new Date().toISOString(), state };
    const records = tx.objectStore('careerRecords');
    // Keep the outgoing run too, including runs created before this store existed.
    for (const snapshot of old && old.state.runId !== state.runId ? [old, saved] : [saved]) {
      const previous = await request(records.get(snapshot.state.runId));
      if (previous !== undefined && !validCareerRecord(previous)) throw new SaveError('진로 기록을 읽을 수 없습니다. 원본을 보존했습니다.');
      const row = mergeCareerRecords([...(previous ? [previous] : []), recordCareer(snapshot.state, snapshot.updatedAt)])[0];
      if (JSON.stringify(previous) !== JSON.stringify(row)) records.put(row);
    }
    store.put(saved, 'active');
    if (state.status === 'completed') {
      const previousArchive = await request(tx.objectStore('archives').get(state.runId));
      if (!previousArchive) tx.objectStore('archives').put({ runId: state.runId, archivedAt: saved.updatedAt, state } satisfies ArchivedRun);
    }
    await completion;
    return saved;
  } catch (error) {
    try { tx.abort(); } catch { /* Already finished or aborted. */ }
    await completion.catch(() => undefined);
    throw error;
  }
}
export async function exportRawSave(db: IDBDatabase): Promise<string> {
  const tx = db.transaction(['current', 'archives', 'careerRecords']);
  const [current, history, records] = await Promise.all([request(tx.objectStore('current').get('active')), request(tx.objectStore('archives').getAll()), request(tx.objectStore('careerRecords').getAll())]);
  return JSON.stringify({ exportedAt: new Date().toISOString(), current: current ?? null, archives: history, careerRecords: records }, null, 2);
}
