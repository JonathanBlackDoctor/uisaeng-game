import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STAT_LABELS, type Activity, type ArchivedRun, type GameAction, type GameState } from './contracts';
import { createGame, reduceGame } from './engine';
import { EventEvidencePanel } from './EventEvidence';
import { evidenceForEvent } from './evidence';
import { familySummary, MEETINGS } from './family';
import { backgroundSummary, RANDOM_RULES } from './random-life';
import LifeScene from './LifeScene';
import { LifeMap, PeoplePanel, RecentLifeFeed } from './LifePanels';
import DecisionSheet from './DecisionSheet';
import { ACTIVITIES, STAGES } from './fixtures/content';
import { archives, exportRawSave, loadGame, openGameDatabase, persistGame } from './storage';
import './style.css';
import './brand.css';

function App() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [history, setHistory] = useState<ArchivedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveTime, setSaveTime] = useState('');
  const [main, setMain] = useState<Activity>('study');
  const [supporting, setSupporting] = useState<Activity>('rest');
  const [view, setView] = useState<'play' | 'journal' | 'archive'>('play');
  const [confirmReset, setConfirmReset] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState<ArchivedRun | null>(null);
  const lock = useRef(false);
  const latestGame = useRef(game);
  latestGame.current = game;
  const latestAct = useRef<(action: GameAction) => Promise<void>>(async () => {});
  const resetCancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let disposed = false; let connection: IDBDatabase | undefined;
    openGameDatabase().then(async database => {
      connection = database;
      if (disposed) { database.close(); return; }
      setDb(database);
      const [saved, records] = await Promise.all([loadGame(database), archives(database)]);
      if (!disposed) { setGame(saved?.state ?? null); setHistory(records); setSaveTime(saved?.updatedAt ?? ''); }
    }).catch(reason => { if (!disposed) setError(String(reason.message ?? reason)); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; connection?.close(); };
  }, []);
  useEffect(() => { if (confirmReset) resetCancel.current?.focus(); }, [confirmReset]);
  async function start() {
    if (!db || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const next = createGame(crypto.randomUUID());
      const saved = await persistGame(db, next, game ? { runId: game.runId, revision: game.revision } : null);
      latestGame.current = next; setGame(next); setSaveTime(saved.updatedAt); setView('play'); setConfirmReset(false);
    } catch (reason) { setError((reason as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function act(action: GameAction) {
    const current = latestGame.current;
    if (!current || !db || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const next = reduceGame(current, action);
      if (next === current) return;
      const saved = await persistGame(db, next, { runId: current.runId, revision: current.revision });
      latestGame.current = next; setGame(next); setSaveTime(saved.updatedAt);
      if (next.status === 'completed') setHistory(await archives(db));
    } catch (reason) { setError((reason as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function resume() {
    if (!db || lock.current) return;
    lock.current = true; setBusy(true);
    try { const saved = await loadGame(db); latestGame.current = saved?.state ?? null; setGame(saved?.state ?? null); setSaveTime(saved?.updatedAt ?? ''); setHistory(await archives(db)); setError(''); setView('play'); }
    catch (reason) { setError((reason as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function download() {
    if (!db) return;
    try {
      const url = URL.createObjectURL(new Blob([await exportRawSave(db)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'uisaeng-preview-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError((reason as Error).message); }
  }
  latestAct.current = act;
  useEffect(() => {
    if (game?.life) { setMain(game.life.focus.main); setSupporting(game.life.focus.supporting); }
  }, [game?.runId, game?.life?.focus.main, game?.life?.focus.supporting]);
  useEffect(() => {
    if (!db || view !== 'play' || busy || error || confirmReset || game?.status !== 'active' || !game.life || game.life.paused || game.pendingEvent) return;
    let previous = performance.now();
    const resetClock = () => { previous = performance.now(); };
    document.addEventListener('visibilitychange', resetClock);
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsedMs = Math.min(1000, Math.floor(now - previous));
      previous = now;
      if (document.visibilityState !== 'visible' || lock.current || elapsedMs <= 0) return;
      void latestAct.current({ type: 'tick', id: crypto.randomUUID(), elapsedMs });
    }, 500);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', resetClock); };
  }, [db, view, busy, error, confirmReset, game?.runId, game?.status, game?.life?.paused, game?.pendingEvent?.id]);
  const stage = STAGES[game?.stageIndex ?? 0];
  const completed = game?.status === 'completed';
  const life = game?.life;
  const months = Math.floor((life?.elapsedMs ?? 0) / RANDOM_RULES.monthMs);
  const age = RANDOM_RULES.startAge + Math.floor(months / 12);
  const month = months % 12;
  const running = !!life && !life.paused && !game?.pendingEvent && !completed && view === 'play' && !confirmReset && !error;
  const timeStatus = completed ? '이야기 마침' : game?.pendingEvent ? '선택을 기다리는 중' : life?.paused ? '일시정지' : '진행 중';
  const partnerName = game?.family?.partner?.name ?? (game?.family?.meeting ? MEETINGS[game.family.meeting].name : undefined);
  const shownJournal = selectedArchive?.state.journal ?? game?.journal ?? [];
  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="#" aria-label="의생게임 홈" onClick={e => { e.preventDefault(); setView('play'); setSelectedArchive(null); }}><span className="brand-logo" aria-hidden="true" /></a>
      <nav aria-label="주 메뉴">
        <button className={view === 'play' ? 'nav active' : 'nav'} aria-current={view === 'play' ? 'page' : undefined} onClick={() => { setView('play'); setSelectedArchive(null); }}>지금의 삶</button>
        <button className={view === 'journal' ? 'nav active' : 'nav'} aria-current={view === 'journal' ? 'page' : undefined} onClick={() => { setView('journal'); setSelectedArchive(null); }}>생애 기록 <span className="count">{game?.journal.length ?? 0}</span></button>
        <button className={view === 'archive' ? 'nav active' : 'nav'} aria-current={view === 'archive' ? 'page' : undefined} onClick={() => { setView('archive'); setSelectedArchive(null); }}>회고 보관함</button>
      </nav>
      <span className="save-status">{busy ? '기록 저장 중…' : saveTime ? '이 기기에 저장됨' : '개발 중인 게임'}</span>
    </header>
    <main className="content">
      {error && <div className="error" role="alert"><strong>기록을 확인해 주세요</strong><p>{error}</p><button onClick={resume} disabled={!db || busy}>저장 기록 다시 읽기</button><button onClick={download} disabled={!db}>원본 백업</button></div>}
      <div className="page-heading"><div><h1>{view === 'play' ? completed ? '회고' : game ? stage.label : '의생게임' : view === 'journal' ? '생애 기록' : '회고 보관함'}</h1></div>{game && <button className="subtle-button" onClick={() => setConfirmReset(true)} disabled={busy}>새 게임</button>}</div>
      {loading ? <section className="panel empty">기록을 불러오는 중입니다…</section> : <>
        {view === 'play' && <>
          {game && life && <section className="time-ribbon" aria-label="나이와 시간 조작">
            <div className="age-display"><strong>{age}<span>세</span></strong><span>{month}개월 · {stage.label}</span></div>
            <div className="year-clock"><div><span className={running ? 'time-state running' : 'time-state'}><i/>{timeStatus}</span><span>올해 {month + 1}/12</span></div><div className="year-progress" role="progressbar" aria-label="올해의 시간" aria-valuemin={0} aria-valuemax={12} aria-valuenow={month}><span style={{ width: `${((life.elapsedMs / RANDOM_RULES.monthMs) % 12) / 12 * 100}%` }}/></div></div>
            {!completed && <div className="time-controls"><button className="time-toggle" disabled={busy || !!error || !!game.pendingEvent} onClick={() => act({ type: 'control', id: crypto.randomUUID(), paused: !life.paused })}>{life.paused ? '▶ 시간 시작' : 'Ⅱ 일시 정지'}</button><label><span className="sr-only">시간 진행 속도</span><select aria-label="시간 진행 속도" value={life.speed} disabled={busy || !!error || !!game.pendingEvent} onChange={e => act({ type: 'control', id: crypto.randomUUID(), speed: Number(e.target.value) as 1 | 2 | 4 | 8 })}>{([1, 2, 4, 8] as const).map(speed => <option key={speed} value={speed}>{speed}배속</option>)}</select></label></div>}
          </section>}
          <div className={game ? 'life-layout' : 'life-layout welcome-layout'}>
            <div className="life-primary">
              <section className="scene-card" aria-label="지금의 생활 장면">
                <div className="scene-heading"><div><span className="eyebrow">{game ? stage.label : '새 게임'}</span><h2>{completed ? '은퇴와 회고' : game ? stage.chapter : '의대 생활을 시작합니다.'}</h2></div><span className="scene-status">{game ? life ? `${age}세의 일상` : '생애 미리보기' : '의대 입학부터 은퇴까지'}</span></div>
                {(!game || life) && <LifeScene stage={stage.id} age={life ? age : 19} month={month} running={running} focus={life?.focus.main ?? main} seed={life?.initialSeed ?? 2026} relationship={game?.family?.status ?? 'single'} partnerName={partnerName} children={game?.family?.children ?? 'none'} eventTitle={game?.pendingEvent?.title}/>}
                {(!game || completed) && <div className="scene-caption"><p>{completed ? '지금까지의 기록을 확인할 수 있습니다.' : game ? stage.subtitle : '무작위 배경으로 입학합니다. 시간이 흐르다가 선택이 필요하면 멈춥니다.'}</p>{!game && <button className="primary" disabled={!db || busy || !!error} onClick={start}>시작하기 <span>→</span></button>}{completed && <button className="primary" onClick={() => setView('journal')}>생애 기록 펼치기 →</button>}</div>}
              </section>
              {game && life && <details className="background-card"><summary><span>시작 배경</span><strong>{life.background.region} · {life.background.environment}</strong><span>배경 펼치기 ＋</span></summary><p>{backgroundSummary(life.background)}</p><p className="life-time-hint">미리보기 속도: 1배에서 {RANDOM_RULES.monthMs / 1000}초에 한 달. 중요한 선택·기록 열람·다른 탭·저장 중에는 시간이 멈춥니다. 자리를 비운 시간은 따라잡지 않습니다.</p></details>}
              {game && !completed && <section className="panel activity-panel">
                <div className="section-heading"><div><span className="eyebrow">생활</span><h3>{life ? '주로 무엇을 할까요?' : '시간을 어디에 쓸까요?'}</h3></div><span className="focus-caption">{game.pendingEvent ? '선택을 기다리며 쉬는 중' : '주활동 + 보조활동'}</span></div>
                <div className="activity-options" role="group" aria-label="주활동">{(Object.entries(ACTIVITIES) as [Activity, typeof ACTIVITIES[Activity]][]).map(([id, activity]) => <button key={id} className={main === id ? 'activity selected' : 'activity'} aria-pressed={main === id} onClick={() => { setMain(id); if (supporting === id) setSupporting(main); }} disabled={busy || !!game.pendingEvent}><span className="activity-icon">{activity.icon}</span><strong>{activity.label}</strong><small>{activity.description}</small><span className="activity-check">{main === id ? '✓' : '＋'}</span></button>)}</div>
                <div className="focus-actions"><label className="support">보조활동<select value={supporting} disabled={busy || !!game.pendingEvent} onChange={e => setSupporting(e.target.value as Activity)}>{Object.entries(ACTIVITIES).filter(([id]) => id !== main).map(([id, activity]) => <option key={id} value={id}>{activity.label}</option>)}</select></label><button className="primary" disabled={busy || !!error || !!game.pendingEvent || !!(life && life.focus.main === main && life.focus.supporting === supporting)} onClick={() => act({ type: 'activity', id: crypto.randomUUID(), main, supporting })}>{life ? '활동 변경' : '이렇게 하루 보내기'} →</button></div>
                <p className="save-hint">{life ? '활동에 따라 능력치와 사건이 달라집니다.' : '활동과 선택은 완료될 때마다 자동으로 저장됩니다.'}</p>
              </section>}
              {game && life && <LifeMap age={age} entries={game.journal}/>}
              {completed && <section className="panel completion"><span>✓ 회고가 보관함에 저장되었습니다</span><h3>{game?.journal.length}개의 기록, 하나의 이야기</h3><p>완료된 회고는 다음 이야기를 시작해도 보관됩니다.</p></section>}
            </div>
            {game && <aside className="life-companions" aria-label="나와 곁의 사람들">
              <section className="panel stats-panel"><div className="section-heading"><h3>능력치</h3></div><div className="stats" aria-label="현재 능력치">{Object.entries(STAT_LABELS).map(([key, label], index) => <div className={`stat stat-${key}`} key={key}><div className="stat-top"><span className="stat-icon">{['♡', '☀', '▤', '♧'][index]}</span><span>{label}</span><strong>{game.stats[key as keyof typeof STAT_LABELS]}<small>/100</small></strong></div><div className="meter"><span style={{ width: `${game.stats[key as keyof typeof STAT_LABELS]}%` }}/></div></div>)}</div></section>
              {game.family && <PeoplePanel status={game.family.status} partnerName={partnerName} partnerTemperament={game.family.partner?.temperament} meeting={game.family.meeting ? MEETINGS[game.family.meeting].label : null} children={game.family.children} contacts={life?.contacts ?? Number.NaN}/>}
              <RecentLifeFeed entries={game.journal} limit={4} onOpenJournal={() => { setView('journal'); setSelectedArchive(null); }}/>
            </aside>}
            {!game && <aside className="welcome-note"><span className="eyebrow">생활 시뮬레이션</span><h2>공부하고, 친구를 만나고,<br/>진로를 정합니다.</h2><p>처음의 환경도, 찾아오는 인연도 매번 달라집니다.</p><ol><li><b>01</b><span>저마다 다른 출발<small>배경과 능력치가 다른 나를 만나요.</small></span></li><li><b>02</b><span>흐르는 시간<small>계절과 일상이 천천히 바뀝니다.</small></span></li><li><b>03</b><span>내가 남긴 선택<small>멈춰 선 순간, 다음 장을 정해요.</small></span></li></ol></aside>}
          </div>
          {game && game.rulesVersion !== 'random-preview-v1' && <p className="legacy-note">이전 버전의 기록은 기존 방식으로 이어갑니다. 무작위 배경과 연속 시간은 새 이야기에서 시작됩니다.</p>}
          {game?.pendingEvent && <DecisionSheet key={game.pendingEvent.id} event={game.pendingEvent} busy={busy || !!error || confirmReset} onChoose={choiceId => act({ type: 'choose', id: crypto.randomUUID(), eventId: game.pendingEvent!.id, choiceId })} evidence={evidenceForEvent(game.pendingEvent).length ? <EventEvidencePanel event={game.pendingEvent}/> : undefined}/>}
        </>}
        {(view === 'journal' || (view === 'archive' && selectedArchive)) && <section className="panel journal"><div className="section-heading"><div><h3>{selectedArchive ? '보관된 회고' : '나의 생애 기록'}</h3><p>기록을 읽는 동안 게임 시간은 흐르지 않습니다.</p></div></div>{(selectedArchive ? selectedArchive.state.family : game?.family) && <p className="family-card">{familySummary((selectedArchive ? selectedArchive.state.family : game?.family)!)}</p>}{shownJournal.length === 0 ? <p className="empty">아직 남긴 기록이 없습니다. 첫 번째 선택을 해 보세요.</p> : shownJournal.map((entry, i) => <article key={entry.id}><span className="journal-index">{String(i + 1).padStart(2, '0')}</span><div><small>{STAGES.find(s => s.id === entry.stage)?.label}</small><h4>{entry.title}</h4><p>{entry.detail}</p><div className="effect-list">{Object.entries(entry.effects).map(([key, value]) => <span key={key}>{STAT_LABELS[key as keyof typeof STAT_LABELS]} {value > 0 ? '+' : ''}{value}</span>)}</div></div></article>)}</section>}
        {view === 'archive' && !selectedArchive && <section className="panel journal"><h3>회고 보관함</h3>{history.length === 0 ? <p className="empty">이야기를 끝내면 이곳에 회고가 남습니다.</p> : history.map((record, i) => <button className="archive-card" key={record.runId} onClick={() => setSelectedArchive(record)}><span><strong>나의 {i + 1}번째 이야기</strong><small>{new Date(record.archivedAt).toLocaleDateString('ko-KR')} · {record.state.journal.length}개 기록</small></span><span>기록 펼치기 →</span></button>)}</section>}
      </>}
      <footer className="disclosure"><div><span>의생게임 · 생애 미리보기</span><button className="text-button" onClick={download} disabled={!db}>저장 기록 백업 ↓</button></div><p><a href="https://1in8b.life/ko/" target="_blank" rel="noreferrer">80억 분의 1</a>의 시간 흐름과 선택 경험을 오마주합니다. 배경 분포·사건 가중치·수치·시간 간격은 창작 조정값입니다. 정식 26개 전공과 전체 사건은 개발 중입니다.</p></footer>
    </main>
    {confirmReset && <div className="modal-backdrop" onKeyDown={e => { if (e.key === 'Escape') setConfirmReset(false); if (e.key === 'Tab') { const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'); if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons[buttons.length - 1]?.focus(); } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) { e.preventDefault(); buttons[0]?.focus(); } } }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><span className="eyebrow">새 게임</span><h2 id="reset-title">새 게임을 시작할까요?</h2><p>현재 진행 중인 미리보기는 새 기록으로 바뀝니다. 완료된 회고는 보관함에 남습니다. 필요한 기록은 먼저 백업해 주세요.</p><div><button ref={resetCancel} className="subtle-button" onClick={() => setConfirmReset(false)} disabled={busy}>계속하기</button><button className="primary" onClick={start} disabled={busy}>새로 시작</button></div></section></div>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
