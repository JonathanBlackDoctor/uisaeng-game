// Isolated visual QA: no database, clock, or saved-game mutations.
import { createRoot } from 'react-dom/client';
import { createCareerGame } from '../../src/career-runtime';
import PlayOverview from '../../src/PlayOverview';
import CareerPanel from '../../src/CareerPanel';
import PlayLog from '../../src/PlayLog';
import Opening from '../../src/Opening';
import DecisionSheet from '../../src/DecisionSheet';
import AbilityPanel from '../../src/AbilityPanel';
import '../../src/style.css';
import '../../src/brand.css';
import '../../src/refinement.css';
import '../../src/scene-layout.css';
import '../../src/play-layout.css';

const screen = new URLSearchParams(location.search).get('screen') ?? 'play';
const game = createCareerGame('layout-audit', 42);
const noop = () => {};
const opening = screen === 'opening';
const params = new URLSearchParams(location.search);
if (params.get('text') === 'large') document.documentElement.style.fontSize = '24px';

createRoot(document.getElementById('root')!).render(<div className={`app-shell ${opening ? 'opening-shell' : 'play-shell'}`}>
  <header className="site-header">
    <a className="brand" href="#" aria-label="의생게임 홈"><span className="brand-logo" aria-hidden="true"/></a>
    <nav aria-label="주 메뉴">
      <button className="nav active">지금의 삶</button><button className="nav">생애 기록 <span className="count">999</span></button><button className="nav">회고 보관함</button><button className="nav">진료실 도감</button>
    </nav><span className="save-status">이 기기에 저장됨</span>
  </header>
  <main className="content">
    {opening ? <Opening draft={game} busy={false} disabled={false} entering={false} onPrepare={noop} onEnter={noop} onBack={noop}/> : <>
      <div className="page-heading"><div><h1>대학 생활</h1></div><button className="subtle-button">새 게임</button></div>
      <PlayOverview game={game} busy={false} onAbilities={noop}>
        <section className="time-ribbon" aria-label="나이와 시간 조작"><div className="age-display"><strong>20<span>세</span></strong><span>0개월 · 대학 생활</span></div><div className="year-clock"><div><span className="time-state">일시정지</span></div></div><div className="time-controls"><button className="time-toggle">▶ 계속하기</button><select aria-label="시간 진행 속도"><option>16배속</option></select><button className="subtle-button next-choice">다음 선택</button></div></section>
      </PlayOverview>
      <div className="life-layout"><div className="life-primary"><CareerPanel game={game} busy={false} act={noop}/></div><aside className="life-companions"><PlayLog entries={game.journal} onOpenJournal={noop}/></aside></div>
    </>}
  </main>
  {screen === 'reset' && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><span className="eyebrow">새 게임</span><h2 id="reset-title">새 게임을 시작할까요?</h2><p>진행 중인 생애 기록은 새 게임으로 바뀝니다. 진로 기록과 완료된 회고는 남습니다. 필요한 기록은 먼저 백업해 주세요.</p><div><button className="subtle-button">계속하기</button><button className="primary">입학 배경 보기</button></div></section></div>}
  {screen === 'decision' && <DecisionSheet event={{id:'layout-audit',title:'함께 제출할 관찰 기록',body:'같은 조 동기가 실습 마지막 시간에 빠졌습니다. 내일 함께 내야 할 관찰 기록이 남았습니다.',choices:Array.from({length:12},(_,i)=>({id:String(i),label:`${i+1}번째 관찰 내용을 정리하고 담당자와 상의하기`,description:'오늘 관찰한 내용을 먼저 정리하고, 남은 기록은 내일 함께 마칩니다.'}))}} busy={false} onChoose={noop}/>}
  {screen === 'abilities' && <AbilityPanel game={game} onClose={noop}/>}
</div>);
