import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LifeScene, { type LifeSceneProps } from '../../src/LifeScene';
import type { DesignVariant } from '../../src/SceneDesign';

const settings: { name: string; props: Partial<LifeSceneProps> }[] = [
  { name: '열람실', props: {} },
  { name: '캠퍼스', props: { focus: 'connect' } },
  { name: '병동', props: { stage: 'training' } },
  { name: '진료실', props: { stage: 'career', specialty: 'internal' } },
  { name: '연구실', props: { workContext: 'research' } },
  { name: '작업 공간', props: { workContext: 'preparation' } },
  { name: '집', props: { focus: 'rest' } },
  { name: '휴게 공간', props: { stage: 'career', focus: 'connect' } },
  { name: '공원', props: { stage: 'retirement', focus: 'connect', age: 68 } },
  { name: '부대 생활관', props: { serviceRoute: 'army' } },
  { name: '군 진료실', props: { serviceRoute: 'doctor' } },
  { name: '보건지소', props: { serviceRoute: 'public-health' } },
];

function Gallery() {
  const [selected, setSelected] = useState(0);
  const [running, setRunning] = useState(false);
  const [month, setMonth] = useState(3);
  const [seed, setSeed] = useState(42);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [family, setFamily] = useState(false);
  const [report, setReport] = useState('');
  const [checking, setChecking] = useState(false);
  const gallery = useRef<HTMLDivElement>(null);
  async function checkMotion() {
    setChecking(true);
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    setRunning(false);
    await delay(1000);
    const root = gallery.current!;
    const cycles = root.getAnimations({ subtree: true }).filter(a => a instanceof CSSAnimation && a.effect?.getTiming().iterations === Infinity);
    const before = cycles.map(a => a.currentTime);
    await delay(220);
    const frozen = cycles.every((a, i) => a.playState === 'paused' && a.currentTime === before[i]);
    setRunning(true);
    await delay(350);
    const visibleCycles = cycles.filter(a => !(a.effect as KeyframeEffect).target?.closest('[data-visible="false"]'));
    setReport(JSON.stringify({ room: settings[selected].name, cycles: cycles.length, frozen, resumed: visibleCycles.every(a => a.playState === 'running'), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, cupPathSupported: CSS.supports('d', 'path("M24-99 38-74 40-48")'), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
    setChecking(false);
  }
  return <main>
    <style>{`
      body { background:#f4f4ee; color:#31453b; font-family:system-ui,sans-serif; }
      main { max-width:1440px; padding:32px 24px; margin:auto; }
      h1 { font-size:25px; letter-spacing:-.05em; margin:0 0 8px; }
      p { font-size:14px; color:#768075; margin:0 0 24px; }
      nav,.controls { display:flex; flex-wrap:wrap; gap:7px; margin:0 0 18px; }
      button { border:1px solid #d5dbce; border-radius:8px; background:#fafbf6; color:#46594b; padding:10px 13px; font:inherit; font-size:13px; cursor:pointer; }
      button[aria-pressed=true] { background:#496859; color:#fff; border-color:#496859; }
      button:focus-visible { outline:3px solid #abbd9d; outline-offset:3px; }
      .designs { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
      article { min-width:0; background:#fafbf7; border:1px solid #dfe3d7; border-radius:16px; overflow:hidden; }
      h2.version { margin:0; padding:16px 20px; font-size:13px; font-weight:500; border-bottom:1px solid #e7e9df; color:#748070; }
      .ls-root .ls-header { padding:14px 18px 0; }
      .ls-root .ls-footer { padding:4px 18px; }
      @media(max-width:850px) { main { padding:22px 14px; } .designs { grid-template-columns:1fr; max-width:560px; margin:auto; } }
    `}</style>
    <h1>같은 일상, 다른 공간</h1><p>장소를 골라 세 가지 그림을 비교해 보세요.</p>
    <nav aria-label="장소">{settings.map((item, i) => <button key={item.name} aria-pressed={selected === i} onClick={() => setSelected(i)}>{item.name}</button>)}</nav>
    <div className="controls">
      <button aria-pressed={running} onClick={() => setRunning(v => !v)}>{running ? '움직임 멈추기' : '움직임 보기'}</button>
      <button onClick={() => setMonth(v => (v + 3) % 12)}>계절 바꾸기</button>
      <button onClick={() => setSeed(v => v + 4)}>머리 모양 바꾸기</button>
      <button onClick={() => setSeed(v => v + 16)}>얼굴 바꾸기</button>
      <button aria-pressed={gender === 'female'} onClick={() => setGender(v => v === 'male' ? 'female' : 'male')}>{gender === 'male' ? '남자' : '여자'}</button>
      <button aria-pressed={family} onClick={() => setFamily(v => !v)}>가족과 함께</button>
      <button disabled={checking} onClick={checkMotion}>{checking ? '검사 중' : '모션 검사'}</button>
    </div>
    {report && <output style={{ display: 'block', fontSize: 12, overflowWrap: 'anywhere', marginBottom: 12 }}>{report}</output>}
    <div className="designs" ref={gallery}>{([0,1,2] as DesignVariant[]).map(variant => <article key={variant}>
      <h2 className="version">{['기본 공간', '따뜻한 나무', '차분한 파랑'][variant]}</h2>
      <LifeScene stage="university" age={23} month={month} running={running} focus="study" seed={seed} gender={gender}
        relationship={family ? 'married' : 'single'} partnerName={family ? '하람' : undefined} children={family ? 'young' : 'none'}
        {...settings[selected].props} designVariant={variant}/>
    </article>)}</div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Gallery/>);
