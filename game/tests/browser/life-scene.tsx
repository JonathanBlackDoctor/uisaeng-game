// Isolated presentation fixture. Real story choices; no user saves or network writes.
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LifeScene, { type LifeSceneProps } from '../../src/LifeScene';
import DecisionSheet from '../../src/DecisionSheet';
import { sceneStory } from '../../src/scene-state';
import { createCareerGame, careerEvent } from '../../src/career-runtime';
import { initialStories } from '../../src/life-stories';
import { reduceGame } from '../../src/engine';
import '../../src/style.css';
import '../../src/refinement.css';
import '../../src/scene-layout.css';

const initial = () => { const s = createCareerGame('scene-browser', 42); s.stories = initialStories(); s.pendingEvent = null; return s; };
function Preview() {
  const [game, setGame] = useState(initial);
  const [focus, setFocus] = useState<LifeSceneProps['focus']>('study');
  const [stage, setStage] = useState<LifeSceneProps['stage']>('university');
  const [work, setWork] = useState<LifeSceneProps['workContext']>();
  const [paused, setPaused] = useState(false);
  const [month, setMonth] = useState(3);
  const [fast, setFast] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [family, setFamily] = useState(false);
  const [service, setService] = useState<LifeSceneProps['serviceRoute']>();
  const [report, setReport] = useState('검사 전');
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!fast || paused || game.pendingEvent) return; const timer = setInterval(() => setMonth(m => (m + 1) % 12), 60); return () => clearInterval(timer); }, [fast, paused, game.pendingEvent]);
  async function checkMotion() {
    const root = wrapper.current!;
    const actor = root.querySelector('[data-actor="protagonist"]');
    const front = root.querySelector('[data-actor="protagonist"] .ls-arm-front')!;
    const start = getComputedStyle(front).transform;
    setFocus('rest');
    await new Promise(r => setTimeout(r, 240));
    const middle = getComputedStyle(front).transform;
    setFocus('study');
    await new Promise(r => setTimeout(r, 1000));
    const end = getComputedStyle(front).transform;
    const animations = root.getAnimations({ subtree: true }).filter(a => a instanceof CSSAnimation);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReport(JSON.stringify({ actorRetained: root.querySelector('[data-actor="protagonist"]') === actor, interpolated: reduce ? 'reduced-motion' : start !== middle && middle !== end, finalPose: actor?.getAttribute('data-pose'), continuousAnimations: animations.length, reducedMotion: reduce, overflow: root.scrollWidth > root.clientWidth }));
  }
  async function checkPause() {
    setPaused(true);
    await new Promise(r => setTimeout(r, 1000));
    const root = wrapper.current!;
    const loops = root.getAnimations({ subtree: true }).filter(a => a instanceof CSSAnimation && a.effect?.getTiming().iterations === Infinity);
    const before = loops.map(a => a.currentTime);
    await new Promise(r => setTimeout(r, 350));
    setReport(JSON.stringify({ check: 'pause', cycles: loops.length, allPaused: loops.every(a => a.playState === 'paused'), timeFrozen: loops.every((a, i) => a.currentTime === before[i]), reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches }));
  }
  return <main style={{ maxWidth: 1100, margin: '30px auto', padding: 16 }}>
    <h1 style={{ fontSize: 21 }}>장면 미리보기</h1>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '18px 0' }}>
      <button onClick={() => { setFocus('study'); setStage('university'); setWork(undefined); }}>열람실</button>
      <button onClick={() => { setFocus('study'); setStage('training'); setWork(undefined); }}>병동</button>
      <button onClick={() => { setFocus('study'); setStage('career'); setWork(undefined); }}>진료실</button>
      <button onClick={() => { setFocus('study'); setStage('career'); setWork('research'); }}>연구실</button>
      <button onClick={() => setFocus('rest')}>휴식</button>
      <button onClick={() => setFocus('connect')}>대화</button>
      <button onClick={() => setService('army')}>부대 생활관</button>
      <button onClick={() => setService(undefined)}>전역</button>
      <button onClick={() => setPaused(p => !p)}>{paused ? '재생' : '일시정지'}</button>
      <button onClick={() => setMonth(m => (m + 3) % 12)}>계절 변경</button>
      <button onClick={() => setFast(f => !f)}>{fast ? '빠른 시간 끄기' : '빠른 시간 켜기'}</button>
      <button onClick={() => setMobile(m => !m)}>{mobile ? 'PC 폭' : '390px 폭'}</button>
      <button onClick={() => { setFamily(f => !f); setFocus('rest'); }}>가족 표시 전환</button>
      <button onClick={() => { const next = initial(); next.pendingEvent = careerEvent(next, 'story:shared-notebook'); setGame(next); setStage('university'); setWork(undefined); setFocus('study'); }}>노트 사건</button>
      <button onClick={() => setGame(JSON.parse(JSON.stringify(game)))}>상태 복원</button>
      <button onClick={checkMotion}>연속 전환 검사</button>
      <button onClick={checkPause}>모션 정지 검사</button>
    </div>
    <output style={{ display: 'block', overflowWrap: 'anywhere', fontSize: 12, marginBottom: 12 }}>{report}</output>
    <div ref={wrapper} style={{ width: mobile ? 390 : 800, maxWidth: '100%' }} className="scene-card">
      <LifeScene {...sceneStory(game)} serviceRoute={service} stage={stage} age={stage === 'university' ? 23 : 36} month={month} running={!paused && !game.pendingEvent} focus={focus} seed={42} relationship={family ? 'married' : 'single'} partnerName={family ? '하람' : undefined} children={family ? 'young' : 'none'} workContext={work} awaitingChoice={!!game.pendingEvent} eventTitle={game.pendingEvent?.title}/>
    </div>
    {game.pendingEvent && <DecisionSheet event={game.pendingEvent} busy={false} onChoose={choiceId => setGame(s => reduceGame(s, { type: 'choose', id: `scene:${s.revision}`, eventId: s.pendingEvent!.id, choiceId }))}/>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Preview/></StrictMode>);
