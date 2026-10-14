import { formatMoneyText } from './money-format';
import { useLayoutEffect, useRef, useState } from 'react';
import { STAT_LABELS, type JournalEntry } from './contracts';
import { STAGES } from './fixtures/content';
import { roundedValue, signedValue } from './display-values';
import { readableText } from './event-copy';
import { INCIDENT_BALANCE } from './incident-balance';

export function logEmphasis(entry: JournalEntry): 'major' | 'consequence' | 'milestone' | 'routine' | 'event' {
  const changes = Object.values(entry.choice?.effects ?? entry.effects).map(value => Math.abs(value ?? 0));
  if (entry.importance === 'major' || entry.id.startsWith('incident:') || entry.choice?.resultId?.startsWith('incident:')
    || entry.id.startsWith('impact:') && entry.id.endsWith(':end')
    || changes.some(value => value >= INCIDENT_BALANCE.majorStatChange)
    || changes.reduce((sum, value) => sum + value, 0) >= INCIDENT_BALANCE.majorCombinedChange) return 'major';
  if (entry.id.startsWith('impact:')) return 'consequence';
  if (entry.choice) return 'event';
  if (entry.id === 'background' || /^auto:(stage|application|qualification|career):/.test(entry.id)) return 'milestone';
  if (/^(auto:(dynamics|money):|auto:campus:ambient:|publication:|identity:month:)/.test(entry.id)) return 'routine';
  return 'event';
}

export function recentPlayLog(entries: JournalEntry[]) {
  return groupPlayLog(entries).filter(group => logEmphasis(group[0]) !== 'routine').slice(0, 8);
}

// Only adjacent updates of the same kind are grouped; choices remain visible.
export function groupPlayLog(entries: JournalEntry[]) {
  const groups: JournalEntry[][] = [];
  // The chosen action already shows this result; retain its raw record in the save.
  const combinedResults = new Set(entries.flatMap(entry => entry.choice?.resultId ? [entry.choice.resultId] : []));
  // New performance explanations are already included in the selected action.
  for (const entry of entries) if (entry.choice) combinedResults.add(`${entry.id}:impact`);
  for (const entry of [...entries].reverse()) {
    if (combinedResults.has(entry.id)) continue;
    const previous = groups.at(-1);
    if (['routine', 'consequence'].includes(logEmphasis(entry)) && previous && logEmphasis(previous[0]) === logEmphasis(entry)
      && entry.id.split(':')[1] === previous[0].id.split(':')[1]
      && previous[0].title === entry.title && previous[0].stage === entry.stage) previous.push(entry);
    else groups.push([entry]);
  }
  return groups;
}

function LogEntry({ entry, expanded = false, history = false }: { entry: JournalEntry; expanded?: boolean; history?: boolean }) {
  const effects = Object.entries(entry.choice?.effects ?? entry.effects).filter(([, value]) => roundedValue(value!) !== 0);
  const age = entry.detail.match(/^\d+세(?:\s*\d+개월)?/)?.[0];
  return <article className={`play-log-entry log-${logEmphasis(entry)}`}>
    {logEmphasis(entry) === 'major' && <small className="play-log-major-label">{entry.id.startsWith('incident:') || entry.choice?.resultId?.startsWith('incident:') ? '큰 사건' : '큰 변화'}</small>}
    {(age || history) && <small className="play-log-age">{[age, history ? STAGES.find(stage => stage.id === entry.stage)?.label : null].filter(Boolean).join(' · ')}</small>}
    {entry.choice ? <div className="play-log-choice">
      <strong>{formatMoneyText(readableText(entry.title))}</strong>
      {entry.choice.context && <p>{formatMoneyText(entry.choice.context)}</p>}
      <p className="play-log-action">{formatMoneyText(entry.choice.label)}</p>
      {entry.choice.detail && <p>{formatMoneyText(entry.choice.detail)}</p>}
    </div> : <details open={expanded || undefined}><summary>{formatMoneyText(readableText(entry.title))}</summary><p>{formatMoneyText(readableText(entry.detail.replace(/^\d+세(?:\s*\d+개월)?\s*·\s*/, '')))}</p></details>}
    {effects.length > 0 && <div className="play-log-effects">{effects.map(([key, value]) => <span key={key}>{STAT_LABELS[key as keyof typeof STAT_LABELS]} {signedValue(value!)}</span>)}</div>}
  </article>;
}

export function JournalHistory({ entries }: { entries: JournalEntry[] }) {
  const important = entries.filter(entry => logEmphasis(entry) !== 'routine');
  const routine = entries.filter(entry => logEmphasis(entry) === 'routine');
  return <div className="journal-history play-log"><ol>{groupPlayLog(important).map(group => <li key={group.at(-1)!.id}>{group.length === 1
    ? <LogEntry entry={group[0]} history expanded={logEmphasis(group[0]) !== 'routine'}/>
    : <details className="play-log-group"><summary>{group[0].title} <span>· {group.length}개 기록</span></summary>{group.map(entry => <LogEntry key={entry.id} entry={entry} history/>)}</details>}
  </li>)}</ol>{routine.length > 0 && <details className="play-log-group"><summary>일상 기록 · {routine.length}개</summary><ol>{groupPlayLog(routine).map(group => <li key={group.at(-1)!.id}>{group.length === 1
    ? <LogEntry entry={group[0]} history/>
    : <details className="play-log-group"><summary>{group[0].title} <span>· {group.length}개 기록</span></summary>{group.map(entry => <LogEntry key={entry.id} entry={entry} history/>)}</details>}
  </li>)}</ol></details>}</div>;
}

export default function PlayLog({ entries, onOpenJournal }: { entries: JournalEntry[]; onOpenJournal: () => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const previousIds = useRef(new Set(entries.map(entry => entry.id)));
  const previousHeight = useRef(0);
  const [unread, setUnread] = useState(0);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const rememberHeight = () => { previousHeight.current = node.scrollHeight; };
    node.addEventListener('toggle', rememberHeight, true);
    return () => node.removeEventListener('toggle', rememberHeight, true);
  }, []);
  const groups = recentPlayLog(entries);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const added = groups.flat().filter(entry => !previousIds.current.has(entry.id)).length;
    if (following.current) node.scrollTop = 0;
    else if (added) {
      node.scrollTop += node.scrollHeight - previousHeight.current;
      setUnread(count => count + added);
    }
    previousHeight.current = node.scrollHeight;
    previousIds.current = new Set(entries.map(entry => entry.id));
  }, [entries]);
  const toLatest = () => {
    const node = viewport.current;
    if (node) node.scrollTop = 0;
    following.current = true;
    setUnread(0);
  };
  return <section className="play-log" aria-label="최근 기록">
    <header><h2>최근 기록</h2><button className="text-button" onClick={onOpenJournal}>전체 기록</button></header>
    <div className="play-log-scroll" ref={viewport} tabIndex={0} role="region" aria-label="최신순 생애 기록" onScroll={event => {
      const node = event.currentTarget;
      following.current = node.scrollTop < 32;
      previousHeight.current = node.scrollHeight;
      if (following.current) setUnread(0);
    }}>
      {groups.length ? <ol>{groups.map(group => <li key={group.at(-1)!.id}>{group.length === 1
        ? <LogEntry entry={group[0]} expanded/>
        : <details className="play-log-group"><summary>{group[0].title} <span>· {group.length}개 기록</span></summary>{group.map(entry => <LogEntry key={entry.id} entry={entry}/>)}</details>}
      </li>)}</ol> : <p className="play-log-empty">아직 기록이 없습니다.</p>}
    </div>
    <div className="play-log-notice" aria-live="polite">{unread > 0 && <button className="subtle-button" onClick={toLatest}>새 기록 {unread}개 ↑</button>}</div>
  </section>;
}
