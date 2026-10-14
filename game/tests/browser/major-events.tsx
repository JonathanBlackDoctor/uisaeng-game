import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createCareerGame, careerEvent } from '../../src/career-runtime';
import { openIncident, requiredIncident, settleIncident, advanceIncidents } from '../../src/major-events';
import DecisionSheet from '../../src/DecisionSheet';
import PlayOverview from '../../src/PlayOverview';
import PlayLog, { JournalHistory } from '../../src/PlayLog';
import '../../src/style.css';
import '../../src/play-layout.css';
import '../../src/decision-sheet.css';
import '../../src/refinement.css';
function fixture(medical: boolean) {
  const s = createCareerGame('isolated-incidents-ui', 42);
  s.stageIndex = 2; s.life!.elapsedMs = 180_000;
  Object.assign(s.career!, { specialty: 'obgyn', application: 'accepted', institution: 'snuh', attempts: 1, practice: 'clinic' });
  s.economy!.ledger.push({ id: 'fixture-open', month: 144, label: '개원', cashDelta: 0, debtDelta: 0, kind: 'open-clinic' });
  s.economy!.income = 12_000_000;
  openIncident(s, medical ? 'birth' : 'fire'); return s;
}
function Preview() {
  const [game, setGame] = useState(() => fixture(true)), [narrow, setNarrow] = useState(false);
  const key = requiredIncident(game), event = key ? careerEvent(game, key) : null;
  return <main style={{ maxWidth: narrow ? 390 : 960, margin: 'auto', padding: 12, boxSizing: 'border-box' }}>
    <h1>돌발 사건 검수</h1><button onClick={() => setNarrow(!narrow)}>화면 폭 변경</button><button onClick={() => setGame(fixture(false))}>화재 장면</button><button onClick={() => setGame(fixture(true))}>의료 분쟁 장면</button>
    <button onClick={() => { const s = structuredClone(game); s.life!.elapsedMs += 3000; advanceIncidents(s); setGame(s); }}>3개월 진행</button>
    <PlayOverview game={game} busy={false} onAbilities={() => {}}><span>현재 생활</span></PlayOverview>
    {event && key && <DecisionSheet event={event} busy={false} onChoose={id => { const s = structuredClone(game); settleIncident(s, key, id); setGame(s); }}/>}<p>보유금 {game.economy!.cash.toLocaleString()}원 · 부채 {game.economy!.debt.toLocaleString()}원</p>
    <PlayLog entries={game.journal} onOpenJournal={() => {}}/>
    <section className="panel journal"><JournalHistory entries={game.journal}/></section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
