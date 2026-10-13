import { encounterLabel, netAssets } from './life-goals';
import { familyTimeLabel } from './legacy-goals';
import { publicationLabel } from './publications';
import { compactWon } from './finance-view';
import Opening from './Opening';
import IdentityPanel from './IdentityPanel';
import { configureIdentity, calendarMonths, serviceMonths, isServing, serviceSummary, SERVICE_RULES } from './identity';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TIME_SPEEDS, type Activity, type ArchivedRun, type GameAction, type GameState, type TimeSpeed } from './contracts';
import { createGame, reduceGame } from './engine';
import { EventEvidencePanel } from './EventEvidence';
import { evidenceForEvent } from './evidence';
import { familySummary, MEETINGS } from './family';
import { lifeStartAge, RANDOM_RULES } from './random-life';
import BackgroundDetails from './BackgroundDetails';
import LifeScene from './LifeScene';
import { sceneActivity, sceneAppearance, sceneStory } from './scene-state';
import { LifeMap, PeoplePanel } from './LifePanels';
import PlayOverview from './PlayOverview';
import PlayLog, { JournalHistory } from './PlayLog';
import PlayDetails from './PlayDetails';
import DecisionSheet from './DecisionSheet';
import CareerPanel from './CareerPanel';
import AbilityPanel from './AbilityPanel';
import AbilitySummary from './AbilitySummary';
import ResultShare from './ResultShare';
import UpdateToast, { useGameUpdate } from './UpdateToast';
import ChoiceFeedback from './ChoiceFeedback';
import { choiceResult, type ChoiceResult } from './choice-feedback';
import { peerOccupation, peerRelationship, PEER_IDS } from './relationships';
import { APP_DISPLAY_VERSION, saveAndApplyUpdate } from './game-update';
import { CAREER_TIME, careerStageEnds } from './career-runtime';
import { ACTIVITIES, STAGES } from './fixtures/content';
import { archives, exportRawSave, loadGame, openGameDatabase, persistGame } from './storage';
import './style.css';
import './brand.css';
import './refinement.css';
import './scene-layout.css';
import './play-layout.css';

function App() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [openingDraft, setOpeningDraft] = useState<GameState | null>(null);
  const [openingEntering, setOpeningEntering] = useState(false);
  const [history, setHistory] = useState<ArchivedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveTime, setSaveTime] = useState('');
  const [main, setMain] = useState<Activity>('study');
  const [supporting, setSupporting] = useState<Activity>('rest');
  const [view, setView] = useState<'play' | 'journal' | 'archive'>('play');
  const [confirmReset, setConfirmReset] = useState(false);
  const [showAbilities, setShowAbilities] = useState(false);
  const [feedback, setFeedback] = useState<ChoiceResult | null>(null);
  const [selectedArchive, setSelectedArchive] = useState<ArchivedRun | null>(null);
  const lock = useRef(false);
  const queuedControl = useRef<{ runId: string; action: Extract<GameAction, { type: 'control' }> } | null>(null);
  const latestGame = useRef(game);
  latestGame.current = game;
  const latestAct = useRef<(action: GameAction) => Promise<void>>(async () => {});
  const resetCancel = useRef<HTMLButtonElement>(null);
  const playHeading = useRef<HTMLHeadingElement>(null);
  const update = useGameUpdate();
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
  useEffect(() => { setFeedback(null); }, [game?.runId, openingDraft?.runId]);
  useEffect(() => {
    if (!feedback || game?.pendingEvent || view !== 'play' || showAbilities || confirmReset || openingDraft) return;
    const timer = window.setTimeout(() => setFeedback(null), 8000);
    return () => window.clearTimeout(timer);
  }, [feedback, game?.pendingEvent?.id, view, showAbilities, confirmReset, openingDraft]);
  function prepareStart() {
    if (!db || lock.current || error) return;
    setOpeningDraft(createGame(crypto.randomUUID(), undefined, 'career-preview-v1'));
    setView('play'); setConfirmReset(false);
    window.scrollTo({ top: 0 });
  }
  async function start() {
    if (!db || lock.current || !openingDraft) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const next = reduceGame(openingDraft, { type: 'control', id: crypto.randomUUID(), paused: false });
      const saved = await persistGame(db, next, game ? { runId: game.runId, revision: game.revision } : null);
      setOpeningEntering(true);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await new Promise<void>(resolve => window.setTimeout(resolve, 550));
      }
      latestGame.current = next; setGame(next); setSaveTime(saved.updatedAt); setView('play'); setConfirmReset(false); setOpeningDraft(null);
      setOpeningEntering(false);
    } catch (reason) { setError((reason as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function act(action: GameAction) {
    const current = latestGame.current;
    if (!current || !db) return;
    if (lock.current) {
      if (action.type === 'control') {
        const previous = queuedControl.current;
        queuedControl.current = { runId: current.runId, action: { ...(previous?.runId === current.runId ? previous.action : {}), ...action } };
      }
      return;
    }
    // A clock save must not disable an open native speed menu.
    const foreground = action.type !== 'tick';
    let failed = false;
    lock.current = true; if (foreground) setBusy(true); setError('');
    try {
      const next = reduceGame(current, action);
      if (next === current) return;
      const saved = await persistGame(db, next, { runId: current.runId, revision: current.revision });
      latestGame.current = next; setGame(next); setSaveTime(saved.updatedAt);
      if (action.type === 'choose') setFeedback(choiceResult(current, next, action.id));
      if (action.type === 'career-focus' || action.type === 'activity') setFeedback(null);
      if (action.type === 'next-choice') setFeedback(null);
      if (next.status === 'completed') setHistory(await archives(db));
    } catch (reason) { failed = true; setError((reason as Error).message); }
    finally {
      lock.current = false;
      if (foreground) setBusy(false);
      const queued = queuedControl.current;
      queuedControl.current = null;
      if (!failed && queued && queued.runId === latestGame.current?.runId && !latestGame.current.pendingEvent && latestGame.current.status === 'active') {
        void latestAct.current(queued.action);
      }
    }
  }
  async function resume() {
    if (!db || lock.current) return;
    lock.current = true; setBusy(true);
    try { const saved = await loadGame(db); latestGame.current = saved?.state ?? null; setGame(saved?.state ?? null); setSaveTime(saved?.updatedAt ?? ''); setHistory(await archives(db)); setError(''); setView('play'); setOpeningDraft(null); }
    catch (reason) { setError((reason as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function download() {
    if (!db) return;
    try {
      const url = URL.createObjectURL(new Blob([await exportRawSave(db)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'uisaeng-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError((reason as Error).message); }
  }
  async function applyUpdate() {
    if (!db || lock.current) throw new Error('저장 중입니다. 잠시 후 다시 눌러 주세요.');
    if (error || !update.version) throw new Error('저장 기록을 먼저 확인해 주세요.');
    lock.current = true; setBusy(true);
    try { await saveAndApplyUpdate(db, latestGame.current, update.version, window.location.href, url => window.location.replace(url)); }
    finally { lock.current = false; setBusy(false); }
  }
  latestAct.current = act;
  useEffect(() => {
    if (game?.life) { setMain(game.life.focus.main); setSupporting(game.life.focus.supporting); }
  }, [game?.runId, game?.life?.focus.main, game?.life?.focus.supporting]);
  useEffect(() => {
    if (game && !openingDraft) playHeading.current?.focus({ preventScroll: true });
  }, [game?.runId, openingDraft]);
  useEffect(() => {
    if (!db || view !== 'play' || busy || error || openingDraft || confirmReset || showAbilities || game?.status !== 'active' || !game.life || game.life.paused || game.pendingEvent) return;
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
  }, [db, view, busy, error, openingDraft, confirmReset, showAbilities, game?.runId, game?.status, game?.life?.paused, game?.pendingEvent?.id]);
  const baseStage = STAGES[game?.stageIndex ?? 0];
  const stage = game?.stageIndex === 1 && game.career && game.career.application !== 'accepted' ? { ...baseStage, id: 'career' as const, label: '진로와 일', chapter: game.career.practice === 'research' ? '연구 생활' : game.career.practice === 'untrained' ? '일반진료와 생활' : '다음 지원 준비' } : baseStage;
  const workContext = game?.stageIndex !== 0 && game?.career?.practice === 'research' ? 'research' as const : game?.stageIndex === 1 && game.career?.application !== 'accepted' && game.career?.practice === 'undecided' ? 'preparation' as const : undefined;
  const completed = game?.status === 'completed';
  const life = game?.life;
  const months = game ? calendarMonths(game) : 0;
  const serving = !!game && isServing(game);
  const stageLabel = serving ? serviceSummary(game!) : stage.label;
  const startAge = game ? lifeStartAge(game) : RANDOM_RULES.startAge;
  const age = startAge + Math.floor(months / 12);
  const month = months % 12;
  const running = !!life && !life.paused && !game?.pendingEvent && !completed && view === 'play' && !confirmReset && !showAbilities && !error;
  const timeStatus = completed ? '이야기 마침' : error ? '저장 확인 필요' : game?.pendingEvent ? '선택 대기' : showAbilities ? '능력 확인 중' : confirmReset || life?.paused ? '일시정지' : '진행 중';
  const partnerName = game?.family?.partner?.name ?? (game?.family?.meeting ? MEETINGS[game.family.meeting].name : undefined);
  const shownJournal = selectedArchive?.state.journal ?? game?.journal ?? [];
  const knownPeer = game?.stories?.peer && PEER_IDS.some(id => game.stories?.decisions[id]) ? game.stories.peer : undefined;
  const feedbackNotice = feedback ? <ChoiceFeedback result={feedback} onClose={() => setFeedback(null)}/> : null;
  const visualStory = sceneStory(game);
  const visualFocus = sceneActivity(game);
  const visualWork = game?.progress?.focus === 'research' ? 'research' as const : workContext;
  const updateNotice = update.version && !showAbilities && !confirmReset && !openingDraft ? <UpdateToast key={update.version} onApply={applyUpdate} onLater={update.later} disabled={busy || loading || !db || !!error}/> : null;
  const opening = view === 'play' && (!game || !!openingDraft);
  return <div className={opening ? 'app-shell opening-shell' : view === 'play' ? 'app-shell play-shell' : 'app-shell'}>
    <header className="site-header">
      <a className="brand" href="#" aria-label="의생게임 홈" onClick={e => { e.preventDefault(); setView('play'); setSelectedArchive(null); }}><span className="brand-logo" aria-hidden="true" /></a>
      {!opening && <nav aria-label="주 메뉴">
        <button className={view === 'play' ? 'nav active' : 'nav'} aria-current={view === 'play' ? 'page' : undefined} onClick={() => { setView('play'); setSelectedArchive(null); }}>지금의 삶</button>
        <button className={view === 'journal' ? 'nav active' : 'nav'} aria-current={view === 'journal' ? 'page' : undefined} onClick={() => { setView('journal'); setSelectedArchive(null); }}>생애 기록 <span className="count">{game?.journal.length ?? 0}</span></button>
        <button className={view === 'archive' ? 'nav active' : 'nav'} aria-current={view === 'archive' ? 'page' : undefined} onClick={() => { setView('archive'); setSelectedArchive(null); }}>회고 보관함</button>
      </nav>}
      <span className="save-status">{busy ? '저장 중…' : saveTime ? '이 기기에 저장됨' : ''}</span>
    </header>
    <main className="content">
      {error && <div className="error" role="alert"><strong>기록을 확인해 주세요</strong><p>{error}</p><button onClick={resume} disabled={!db || busy}>저장 기록 다시 읽기</button><button onClick={download} disabled={!db}>원본 백업</button></div>}
      {!opening && <div className="page-heading"><div><h1 ref={playHeading} tabIndex={-1}>{view === 'play' ? completed ? '회고' : game ? stageLabel : '의생게임' : view === 'journal' ? '생애 기록' : '회고 보관함'}</h1></div>{game && <button className="subtle-button" onClick={() => setConfirmReset(true)} disabled={busy}>새 게임</button>}</div>}
      {loading ? <section className="panel empty">기록을 불러오는 중입니다…</section> : <>
        {opening && <Opening draft={openingDraft} busy={busy} disabled={!db || busy || !!error} entering={openingEntering} onPrepare={prepareStart} onIdentity={(gender, status) => setOpeningDraft(draft => draft ? configureIdentity(draft, gender, status) : draft)} onEnter={start} onBack={() => setOpeningDraft(null)}/>}
        {view === 'play' && !opening && <>
          {game && <PlayOverview key={game.runId} game={game} feedback={feedback} busy={busy} onAbilities={() => setShowAbilities(true)}>{life && <section className="time-ribbon" aria-label="나이와 시간 조작">
            <div className="age-display"><strong>{age}<span>세</span></strong><span>{month}개월 · {stageLabel}</span></div>
            <div className="year-clock"><div><span role="status" className={running ? 'time-state running' : 'time-state'}><i/>{timeStatus}</span><span>올해 {month + 1}/12</span></div><div className="year-progress" role="progressbar" aria-label="올해의 시간" aria-valuemin={0} aria-valuemax={12} aria-valuenow={month}><span style={{ width: `${((months + (serving ? (game.identity!.service.elapsedMs % SERVICE_RULES.monthMs) / SERVICE_RULES.monthMs : (life.elapsedMs % RANDOM_RULES.monthMs) / RANDOM_RULES.monthMs)) % 12) / 12 * 100}%` }}/></div></div>
            {!completed && <div className="time-controls"><button className="time-toggle" disabled={busy || !!error || !!game.pendingEvent} onClick={() => act({ type: 'control', id: crypto.randomUUID(), paused: !life.paused })}>{life.paused ? '▶ 재생' : 'Ⅱ 일시정지'}</button><label><span className="sr-only">시간 진행 속도</span><select aria-label="시간 진행 속도" value={life.speed} disabled={busy || !!error || !!game.pendingEvent} onChange={e => act({ type: 'control', id: crypto.randomUUID(), speed: Number(e.target.value) as TimeSpeed })}>{TIME_SPEEDS.map(speed => <option key={speed} value={speed}>{speed}배속</option>)}</select></label><button className="time-toggle next-choice" disabled={busy || !!error || !!game.pendingEvent} onClick={() => act({ type: 'next-choice', id: crypto.randomUUID() })}>다음 선택</button></div>}
          </section>}</PlayOverview>}
          <div className="life-layout">
            <div className="life-primary">
              <section className="scene-card" aria-label="지금의 생활 장면">
                <div className="scene-heading"><div><span className="eyebrow">{game ? stageLabel : '새 게임'}</span><h2>{completed ? '은퇴와 회고' : serving ? '복무 중의 일상' : game ? stage.chapter : '의대 생활을 시작합니다.'}</h2></div><span className="scene-status">{game ? life ? `${age}세의 일상` : '생애 기록' : '의대 입학부터 은퇴까지'}</span></div>
                {(!game || life) && <LifeScene {...visualStory} {...sceneAppearance(game)} serviceRoute={serving ? game?.identity?.service.route : undefined} key={game?.runId} awaitingChoice={!!game?.pendingEvent} stage={serving ? 'training' : stage.id} age={life ? age : RANDOM_RULES.startAge} month={month} running={running} focus={visualFocus} seed={life?.initialSeed ?? 2026} relationship={game?.family?.status ?? 'single'} partnerName={partnerName} children={game?.family?.children ?? 'none'} eventTitle={game?.pendingEvent?.title ?? feedback?.title} workContext={visualWork} reaction={feedback?.reaction} companionName={knownPeer && (feedback?.title.includes(knownPeer.person.name) || visualFocus === 'connect') ? knownPeer.person.name : undefined}/>}
                {!game?.pendingEvent && feedbackNotice}
                {(!game || completed) && <div className="scene-caption"><p>{completed ? '지금까지의 기록을 확인할 수 있습니다.' : game ? stage.subtitle : '진행 상황은 이 기기에 자동 저장됩니다.'}</p>{!game && <button className="primary" disabled={!db || busy || !!error} onClick={start}>시작하기 <span>→</span></button>}{completed && <button className="primary" onClick={() => setView('journal')}>기록 보기</button>}</div>}
              </section>
              <PlayDetails key={game?.runId}>
                <>
              {game && <IdentityPanel game={game}/>}
              {game?.career && !serving && <CareerPanel game={game} busy={busy || !!error} act={act}/>}
              {game && !completed && !game.career && <section className="panel activity-panel">
                <div className="section-heading"><div><span className="eyebrow">생활</span><h3>{life ? '주로 무엇을 할까요?' : '시간을 어디에 쓸까요?'}</h3></div><span className="focus-caption">{game.pendingEvent ? '선택을 기다리며 쉬는 중' : '주활동 + 보조활동'}</span></div>
                <div className="activity-options" role="group" aria-label="주활동">{(Object.entries(ACTIVITIES) as [Activity, typeof ACTIVITIES[Activity]][]).map(([id, activity]) => <button key={id} className={main === id ? 'activity selected' : 'activity'} aria-pressed={main === id} onClick={() => { setMain(id); if (supporting === id) setSupporting(main); }} disabled={busy || !!game.pendingEvent}><span className="activity-icon">{activity.icon}</span><strong>{activity.label}</strong><small>{activity.description}</small><span className="activity-check">{main === id ? '✓' : '＋'}</span></button>)}</div>
                <div className="focus-actions"><label className="support">보조활동<select value={supporting} disabled={busy || !!game.pendingEvent} onChange={e => setSupporting(e.target.value as Activity)}>{Object.entries(ACTIVITIES).filter(([id]) => id !== main).map(([id, activity]) => <option key={id} value={id}>{activity.label}</option>)}</select></label><button className="primary" disabled={busy || !!error || !!game.pendingEvent || !!(life && life.focus.main === main && life.focus.supporting === supporting)} onClick={() => act({ type: 'activity', id: crypto.randomUUID(), main, supporting })}>{life ? '활동 변경' : '이렇게 하루 보내기'} →</button></div>
                <p className="save-hint">{life ? '활동에 따라 능력치와 사건이 달라집니다.' : '활동과 선택은 완료될 때마다 자동으로 저장됩니다.'}</p>
              </section>}
                </>
                <>
              {game && life && <details className="background-card"><summary><span>시작 배경</span><strong>{life.background.region} · {life.background.profile ? `가정 형편 상위 ${life.background.profile.wealthTopPercent}%` : life.background.environment}</strong><span>배경 펼치기 ＋</span></summary><BackgroundDetails background={life.background} hasEconomy={!!game.economy} /><p className="life-time-hint">진행 속도: 1배에서 {game.rulesVersion === 'career-preview-v1' ? CAREER_TIME.monthMs[game.stageIndex] / 1000 : RANDOM_RULES.monthMs / 1000}초에 한 달. 중요한 선택·기록 열람·다른 탭·저장 중에는 시간이 멈춥니다. 자리를 비운 시간은 따라잡지 않습니다.</p></details>}
              {game?.family && <details className="play-people"><summary>곁의 사람들 · {familySummary(game.family)}</summary><PeoplePanel status={game.family.status} partnerName={partnerName} partnerTemperament={game.family.partner?.temperament} meeting={game.family.meeting ? MEETINGS[game.family.meeting].label : null} children={game.family.children} contacts={life?.contacts ?? Number.NaN} peer={knownPeer ? { name: knownPeer.person.name, occupation: peerOccupation(game), relationship: peerRelationship(game) } : undefined}/></details>}
              {game && life && <details className="life-map-disclosure"><summary>생애 지도</summary><LifeMap age={age} startAge={startAge} endAge={startAge + Math.ceil(((game.career ? careerStageEnds(game)[3] : RANDOM_RULES.stageEnds[3]) + serviceMonths(game)) / 12)} entries={game.journal}/></details>}
                </>
              </PlayDetails>
              {completed && game && <section className="panel completion"><h3>{game.journal.length}개의 기록</h3><p>회고를 보관함에 저장했습니다. 새 게임을 시작해도 남아 있습니다.</p><ResultShare key={game.runId} game={game}/></section>}
            </div>
            {game && <aside className="life-companions" aria-label="생활 소식과 기록">
              <PlayLog key={game.runId} entries={game.journal} onOpenJournal={() => { setView('journal'); setSelectedArchive(null); }}/>
            </aside>}
          </div>
          {game && !['random-preview-v1', 'career-preview-v1'].includes(game.rulesVersion) && <p className="legacy-note">이전 버전의 기록은 기존 방식으로 이어갑니다. 무작위 배경과 연속 시간은 새 이야기에서 시작됩니다.</p>}
          {game?.pendingEvent && !error && <DecisionSheet key={game.pendingEvent.id} event={game.pendingEvent} busy={busy || confirmReset} onChoose={choiceId => act({ type: 'choose', id: crypto.randomUUID(), eventId: game.pendingEvent!.id, choiceId })} onAbilities={game.career ? () => setShowAbilities(true) : undefined} updateNotice={updateNotice} abilityImpact={<AbilitySummary game={game} decision/>} feedback={feedbackNotice} evidence={game.pendingEvent.sourceNote || evidenceForEvent(game.pendingEvent).length ? <EventEvidencePanel event={game.pendingEvent}/> : undefined}/>}
        </>}
        {(view === 'journal' || (view === 'archive' && selectedArchive)) && <section className="panel journal"><div className="section-heading"><div><h3>{selectedArchive ? '보관된 회고' : '나의 생애 기록'}</h3><p>기록을 읽는 동안 게임 시간은 흐르지 않습니다.</p></div></div>{(selectedArchive?.state ?? game)?.status === 'completed' && <ResultShare key={(selectedArchive?.state ?? game)!.runId} game={(selectedArchive?.state ?? game)!}/>} {(selectedArchive ? selectedArchive.state.family : game?.family) && <p className="family-card">{familySummary((selectedArchive ? selectedArchive.state.family : game?.family)!)}</p>}{shownJournal.length === 0 ? <p className="empty">아직 남긴 기록이 없습니다. 첫 번째 선택을 해 보세요.</p> : <JournalHistory key={selectedArchive?.runId ?? game?.runId} entries={shownJournal}/>}</section>}

        {view === 'archive' && !selectedArchive && <section className="panel journal"><h3>회고 보관함</h3>{history.length === 0 ? <p className="empty">이야기를 끝내면 이곳에 회고가 남습니다.</p> : history.map((record, i) => <button className="archive-card" key={record.runId} onClick={() => setSelectedArchive(record)}><span><strong>나의 {i + 1}번째 이야기</strong><small>{new Date(record.archivedAt).toLocaleDateString('ko-KR')} · {record.state.journal.length}개 기록</small>{record.state.career && <small>누적 진료 {encounterLabel(record.state)} · 순자산 {netAssets(record.state) === null ? '기록 없음' : compactWon(netAssets(record.state)!)}</small>}{record.state.career && <small>가족과 보낸 시간 {familyTimeLabel(record.state)} · 발표한 논문 {publicationLabel(record.state)}</small>}</span><span>기록 펼치기 →</span></button>)}</section>}
      </>}
      <footer className="disclosure"><div><span><a href="https://1in8b.life/ko/" target="_blank" rel="noreferrer">80억 분의 1</a>을 오마주한 게임</span><button className="text-button" onClick={download} disabled={!db}>저장 기록 백업</button></div><details><summary>게임 안내</summary><p>인물과 사건, 능력치와 금액은 게임을 위한 창작 설정입니다. 실제 의료 제도나 개인의 삶을 예측하지 않습니다.</p></details>{APP_DISPLAY_VERSION && <small className="app-version">버전 {APP_DISPLAY_VERSION}</small>}</footer>
    </main>
    {showAbilities && game && <AbilityPanel game={game} onClose={() => setShowAbilities(false)}/>}
    {(!game?.pendingEvent || !!error) && updateNotice}
    {confirmReset && <div className="modal-backdrop" onKeyDown={e => { if (e.key === 'Escape') setConfirmReset(false); if (e.key === 'Tab') { const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'); if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons[buttons.length - 1]?.focus(); } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) { e.preventDefault(); buttons[0]?.focus(); } } }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><span className="eyebrow">새 게임</span><h2 id="reset-title">새 게임을 시작할까요?</h2><p>현재 게임은 새 기록으로 바뀝니다. 완료된 회고는 보관함에 남습니다. 필요한 기록은 먼저 백업해 주세요.</p><div><button ref={resetCancel} className="subtle-button" onClick={() => setConfirmReset(false)} disabled={busy}>계속하기</button><button className="primary" onClick={prepareStart} disabled={busy || !!error}>입학 배경 보기</button></div></section></div>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
