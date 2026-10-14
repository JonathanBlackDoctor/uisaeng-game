import type { JournalEntry } from './contracts';
import { INCIDENT_BALANCE } from './incident-balance';

/** Periodic snapshots are replaceable; decisions and exceptional changes are not.
 * The underlying finance ledger, publications and simulation state stay intact. */
function snapshotKey(entry: JournalEntry): string | null {
  const changes = Object.values(entry.choice?.effects ?? entry.effects).map(value => Math.abs(value ?? 0));
  if (entry.choice || entry.importance === 'major'
    || changes.some(value => value >= INCIDENT_BALANCE.majorStatChange)
    || changes.reduce((sum, value) => sum + value, 0) >= INCIDENT_BALANCE.majorCombinedChange) return null;
  const routine = entry.id.match(/^(auto:(?:dynamics|money|lifestyle):|auto:campus:ambient:|publication:|identity:month:|depth-load:)/);
  if (routine) {
    // A missed paid activity is distinct from an ordinary lifestyle update.
    const warning = entry.id.startsWith('auto:lifestyle:') && entry.detail.includes('비용이 부족')
      ? entry.detail.replace(/^\d+세(?:\s*\d+개월)?\s*·\s*/, '') : '';
    return `${entry.stage}:${routine[0]}:${warning}`;
  }
  // Keep one current burden per case. Its opening, decision, result and end remain.
  if (/^impact:.+:\d+:\d+:health$/.test(entry.id)) return entry.id.split(':').slice(0, -2).join(':');
  return null;
}

export function compactJournal(entries: JournalEntry[]): JournalEntry[] {
  const seen = new Set<string>();
  const kept: JournalEntry[] = [];
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index], key = snapshotKey(entry);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    kept.push(entry);
  }
  return kept.reverse();
}
