// Isolated UI fixture using real event generation and settlement, without player storage.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createCareerGame } from '../../src/career-runtime';
import { advanceJourney, initialJourney, journeyEvent, requiredJourney, settleJourney } from '../../src/specialty-journey';
import { SPECIALTIES } from '../../src/career';
import DecisionSheet from '../../src/DecisionSheet';
import SpecialtyJourneyPanel from '../../src/SpecialtyJourneyPanel';
import type { GameState } from '../../src/contracts';
import '../../src/style.css';
import '../../src/career-panel.css';

function fixture(specialty: string, target: string) {
  const s = createCareerGame('journey-ui', 42);
  Object.assign(s.career!, { specialty, institution: 'snuh', application: 'accepted', attempts: 1, practice: 'undecided' });
  s.progress!.trainingStartMonth = 72; s.journey = initialJourney(72);
  for (let m = 73; m < 550; m++) {
    s.life!.elapsedMs = m * 1000; s.stageIndex = m < 144 ? 1 : 2;
    if (m === 144) s.career!.practice = 'employed';
    advanceJourney(s);
    const key = requiredJourney(s); if (!key) continue;
    const event = journeyEvent(s, key)!;
    if (key === `journey:${target}`) return s;
    settleJourney(s, key, event.choices[0].id);
  }
  return s;
}
function Preview() {
  const [specialty, setSpecialty] = useState('internal'), [target, setTarget] = useState('scene:1');
  const [game, setGame] = useState<GameState | null>(null), [result, setResult] = useState('');
  const key = game ? requiredJourney(game) : null, event = game && key ? journeyEvent(game, key) : null;
  return <main style={{ maxWidth: 640, padding: 16, margin: 'auto' }}><h1>전공 진로 화면 검수</h1>
    <label>전공 <select value={specialty} onChange={e => setSpecialty(e.target.value)}>{SPECIALTIES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label> 장면 <select value={target} onChange={e => setTarget(e.target.value)}>{['scene:0', 'scene:1', 'field', 'fellow-case', 'academic:0:research', 'review:1:0', 'legacy'].map(k => <option key={k}>{k}</option>)}</select></label>
    <button onClick={() => { setGame(fixture(specialty, target)); setResult(''); }}>장면 열기</button>
    {game && <SpecialtyJourneyPanel game={game}/>}{result && <p role="status">{result}</p>}
    {event && game && key && <DecisionSheet event={{ ...event, id: key }} busy={false} onChoose={id => { const next = structuredClone(game); const choice = event.choices.find(c => c.id === id)!; if (settleJourney(next, key, id)) { setGame(next); setResult(choice.description); } }}/>}</main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
