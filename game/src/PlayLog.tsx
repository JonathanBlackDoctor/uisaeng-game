import { useLayoutEffect, useRef, useState } from 'react';
import { STAT_LABELS, type JournalEntry } from './contracts';
import { STAGES } from './fixtures/content';

export function logEmphasis(entry: JournalEntry): 'milestone' | 'routine' | 'event' {
  if (entry.id === 'background' || /^auto:(stage|application|qualification|career):/.test(entry.id)) return 'milestone';
  if (/^auto:(dynamics|money):/.test(entry.id)) return 'routine';
  return 'event';
}

// Only adjacent updates of the same kind are grouped; choices remain visible.
export function groupPlayLog(entries: JournalEntry[]) {
  const groups: JournalEntry[][] = [];
  for (const entry of [...entries].reverse()) {
    const previous = groups.at(-1);
    if (logEmphasis(entry) === 'routine' && previous && logEmphasis(previous[0]) === 'routine'
      && entry.id.split(':')[1] === previous[0].id.split(':')[1]
      && previous[0].title === entry.title && previous[0].stage === entry.stage) previous.push(entry);
    else groups.push([entry]);
  }
  return groups;
}

function LogEntry({ entry, expanded = false, history = false }: { entry: JournalEntry; expanded?: boolean; history?: boolean }) {
  const effects = Object.entries(entry.effects).filter(([, value]) => value !== 0);
  const age = entry.detail.match(/^\d+세(?:\s*\d+개월)?/)?.[0];
  return <article className={`play-log-entry log-${logEmphasis(entry)}`}>
    {(age || history) && <small className="play-log-age">{[age, history ? STAGES.find(stage => stage.id === entry.stage)?.label : null].filter(Boolean).join(' · ')}</small>}
    <details open={expanded || undefined}><summary>{entry.title}</summary><p>{entry.detail.replace(/^\d+세(?:\s*\d+개월)?\s*·\s*/, '').replaceAll('이 미리보기에서는', '게임에서는')}</p></details>
    {effects.length > 0 && <div className="play-log-effects">{effects.map(([key, value]) => <span key={key}>{STAT_LABELS[key as keyof typeof STAT_LABELS]} {value! > 0 ? '+' : ''}{value}</span>)}</div>}
  </article>;
}

export function JournalHistory({ entries }: { entries: JournalEntry[] }) {
  return <div className="journal-history play-log"><ol>{groupPlayLog(entries).map(group => <li key={group.at(-1)!.id}>{group.length === 1
    ? <LogEntry entry={group[0]} history expanded={logEmphasis(group[0]) !== 'routine'}/>
    : <details className="play-log-group"><summary>{group[0].title} <span>· {group.length}개 기록</span></summary>{group.map(entry => <LogEntry key={entry.id} entry={entry} history/>)}</details>}
  </li>)}</ol></div>;
}

export default function PlayLog({ entries, onOpenJournal }: { entries: JournalEntry[]; onOpenJournal: () => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const previousCount = useRef(entries.length);
  const previousHeight = useRef(0);
  const [unread, setUnread] = useState(0);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const rememberHeight = () => { previousHeight.current = node.scrollHeight; };
    node.addEventListener('toggle', rememberHeight, true);
    return () => node.removeEventListener('toggle', rememberHeight, true);
  }, []);
  // Keep all entries mounted so expanding a group never shifts the reader by trimming the start.
  const groups = groupPlayLog(entries);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const added = Math.max(0, entries.length - previousCount.current);
    if (following.current) node.scrollTop = 0;
    else if (added) {
      node.scrollTop += node.scrollHeight - previousHeight.current;
      setUnread(count => count + added);
    }
    previousHeight.current = node.scrollHeight;
    previousCount.current = entries.length;
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
        ? <LogEntry entry={group[0]}/>
        : <details className="play-log-group"><summary>{group[0].title} <span>· {group.length}개 기록</span></summary>{group.map(entry => <LogEntry key={entry.id} entry={entry}/>)}</details>}
      </li>)}</ol> : <p className="play-log-empty">아직 기록이 없습니다.</p>}
    </div>
    <div className="play-log-notice" aria-live="polite">{unread > 0 && <button className="subtle-button" onClick={toLatest}>새 기록 {unread}개 ↑</button>}</div>
  </section>;
}
