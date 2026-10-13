import { useEffect, useId, useRef, useState } from 'react';
import './life-panels.css';

type LifeEntry = { id: string; title: string; detail: string; stage: string };
type LifeMapProps = { age: number; startAge?: number; endAge?: number; entries: LifeEntry[] };
type PeoplePanelProps = {
  status: 'single' | 'dating' | 'married';
  partnerName?: string;
  partnerTemperament?: string;
  meeting?: string | null;
  children: 'none' | 'young' | 'school' | 'adult';
  contacts: number;
};
type RecentLifeFeedProps = { entries: LifeEntry[]; limit?: number; onOpenJournal?: () => void };

// Only an explicit age prefix provides a date; stage is not a substitute for age.
function recordedAge(detail: string): number | null {
  const match = /^\s*(\d+)세(?:\s+\d+개월)?\s*·/.exec(detail);
  return match ? Number(match[1]) : null;
}

function RecordList({ entries }: { entries: LifeEntry[] }) {
  return <ul className="lp-records">{entries.map(entry => <li key={entry.id}>
    <strong>{entry.title}</strong><p>{entry.detail}</p>
  </li>)}</ul>;
}

export function LifeMap({ age, startAge = 20, endAge = 77, entries }: LifeMapProps) {
  const headingId = useId();
  const detailId = useId();
  const start = Number.isFinite(startAge) ? Math.trunc(startAge) : 20;
  const end = Math.max(start, Number.isFinite(endAge) ? Math.trunc(endAge) : 77);
  const current = Number.isFinite(age) ? Math.trunc(age) : null;
  const [chosenYear, setChosenYear] = useState<number | null>(null);
  const selected = chosenYear !== null && chosenYear >= start && chosenYear <= end
    ? chosenYear : current !== null && current >= start && current <= end ? current : start;
  const byYear = new Map<number, LifeEntry[]>();
  const undated: LifeEntry[] = [];
  const outside: LifeEntry[] = [];
  for (const entry of entries) {
    const year = recordedAge(entry.detail);
    if (year === null) undated.push(entry);
    else if (year < start || year > end) outside.push(entry);
    else byYear.set(year, [...(byYear.get(year) ?? []), entry]);
  }
  const selectedEntries = byYear.get(selected) ?? [];
  return <section className="lp-panel lp-map" aria-labelledby={headingId}>
    <header className="lp-heading"><div>
      <h2 id={headingId}>생애 지도</h2></div><span className="lp-badge">{current === null ? '나이 미정' : `현재 ${current}세`}</span></header>
    <p className="lp-help">나이를 누르면 기록을 볼 수 있습니다.</p>
    <ul className="lp-legend" aria-label="지도 표시 안내">
      <li><span className="lp-swatch lp-past" />지나온 해</li>
      <li><span className="lp-swatch lp-current" />현재 해</li>
      <li><span className="lp-swatch lp-future" />앞으로의 해</li>
      <li><span className="lp-event-dot" />기록 있음</li>
    </ul>
    <ol className="lp-years" aria-label={`${start}세부터 ${end}세까지의 생애`}>
      {Array.from({ length: end - start + 1 }, (_, index) => {
        const year = start + index;
        const count = byYear.get(year)?.length ?? 0;
        const phase = current === null ? 'unknown' : year < current ? 'past' : year === current ? 'current' : 'future';
        const phaseLabel = phase === 'past' ? '지나온 해' : phase === 'current' ? '현재 해' : phase === 'future' ? '앞으로의 해' : '현재 나이 미정';
        return <li key={year}><button type="button" className={`lp-year lp-${phase}`}
          aria-label={`${year}세, ${phaseLabel}, 기록 ${count}개`}
          aria-current={year === current ? 'date' : undefined}
          aria-pressed={year === selected} aria-controls={detailId} onClick={() => setChosenYear(year)}>
          <span>{year}</span><span className={`lp-year-mark${count ? ' lp-has-record' : ''}`} aria-hidden="true" />
        </button></li>;
      })}
    </ol>
    <div className="lp-year-detail" id={detailId} role="region" aria-label={`${selected}세의 기록`} aria-live="polite" aria-atomic="true">
      <div className="lp-detail-heading"><h3>{selected}세 기록</h3><span>{selectedEntries.length}개 기록</span></div>
      {selectedEntries.length ? <RecordList entries={selectedEntries} /> : <p className="lp-empty">이 해의 기록이 없습니다.</p>}
    </div>
    {undated.length > 0 && <details className="lp-extra-records"><summary>시점이 표시되지 않은 기록 · {undated.length}개</summary>
      <p className="lp-help">나이가 표시되지 않은 기록입니다.</p><RecordList entries={undated} /></details>}
    {outside.length > 0 && <details className="lp-extra-records"><summary>지도 범위 밖의 기록 · {outside.length}개</summary>
      <RecordList entries={outside} /></details>}
  </section>;
}

function PersonIcon({ kind = 'person' }: { kind?: 'person' | 'child' | 'contacts' }) {
  return <span className={`lp-avatar lp-avatar-${kind}`} aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" focusable="false">
    {kind === 'contacts' ? <><circle cx="17" cy="18" r="5" /><circle cx="32" cy="20" r="4" />
      <path d="M6 36c0-8 5-12 11-12s11 4 11 12M29 27c7-1 12 3 12 9" /></>
      : <><circle cx="24" cy={kind === 'child' ? 21 : 17} r={kind === 'child' ? 6 : 7} />
        <path d={kind === 'child' ? 'M13 39c0-8 4-12 11-12s11 4 11 12' : 'M10 39c0-10 5-15 14-15s14 5 14 15'} /></>}
  </svg></span>;
}

export function PeoplePanel({ status, partnerName, partnerTemperament, meeting, children, contacts }: PeoplePanelProps) {
  const headingId = useId();
  const linked = status !== 'single';
  const acquaintance = !linked && !!partnerName?.trim();
  const partnerRole = status === 'married' ? '배우자' : '연인';
  const contactCount = Number.isFinite(contacts) ? Math.max(0, Math.trunc(contacts)) : null;
  const childrenLabel = { young: '어린 자녀', school: '학교에 다니는 자녀', adult: '성인 자녀' };
  return <section className="lp-panel lp-people" aria-labelledby={headingId}>
    <header className="lp-heading"><div><h2 id={headingId}>주변 사람</h2></div>
      {linked && <span className="lp-badge">{status === 'dating' ? '연애 중' : '기혼'}</span>}</header>
    <ul className="lp-person-list">
      <li className="lp-person"><PersonIcon /><div>
        <h3>{linked || acquaintance ? partnerName?.trim() || partnerRole : '지금은 싱글'}</h3>
        {(linked || acquaintance) && <p className="lp-person-role">{linked ? partnerRole : '서로 알아가는 중'}</p>}
        {(linked || acquaintance) && partnerTemperament?.trim() && <p>{partnerTemperament}</p>}
        {(linked || acquaintance) && meeting?.trim() && <p className="lp-meeting">{meeting}에서 시작된 인연</p>}
      </div></li>
      {children !== 'none' && <li className="lp-person"><PersonIcon kind="child" /><div>
        <h3>{childrenLabel[children]}</h3><p className="lp-person-role">가족</p>
      </div></li>}
      <li className="lp-person lp-contact-row"><PersonIcon kind="contacts" /><div><h3>연락하는 사람들</h3>
        <p className="lp-person-role">{contactCount === null ? '연락망 기록 없음' : <>연락망 <strong>{contactCount}명</strong></>}</p></div></li>
    </ul>
  </section>;
}

export function RecentLifeFeed({ entries, limit = 5, onOpenJournal }: RecentLifeFeedProps) {
  const headingId = useId();
  const knownIds = useRef(new Set(entries.map(entry => entry.id)));
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const added = new Set(entries.filter(entry => !knownIds.current.has(entry.id)).map(entry => entry.id));
    knownIds.current = new Set(entries.map(entry => entry.id));
    setNewIds(added);
    if (!added.size) return;
    const timer = window.setTimeout(() => setNewIds(new Set()), 700);
    return () => window.clearTimeout(timer);
  }, [entries]);
  const count = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 5;
  // The engine appends journal entries in occurrence order; never mutate that input.
  const recent = entries.slice().reverse().slice(0, count);
  return <section className="lp-panel lp-feed" aria-labelledby={headingId}>
    <header className="lp-heading"><div><h2 id={headingId}>최근 기록</h2></div>
      {onOpenJournal && <button type="button" className="lp-journal-button" onClick={onOpenJournal}>전체 기록 <span aria-hidden="true">↗</span></button>}
    </header>
    
    {!recent.length ? <p className="lp-empty">{entries.length ? '최근 기록이 없습니다.' : '아직 기록이 없습니다.'}</p>
      : <ol className="lp-feed-list">{recent.map(entry => <li key={entry.id} className={newIds.has(entry.id) ? 'lp-feed-item lp-new-record' : 'lp-feed-item'}>
        <span className="lp-feed-dot" aria-hidden="true" /><article>
          <details className="lp-feed-detail"><summary><span className="lp-feed-title">{entry.title}</span></summary>
            <p>{entry.detail}</p></details>
        </article>
      </li>)}</ol>}
  </section>;
}
