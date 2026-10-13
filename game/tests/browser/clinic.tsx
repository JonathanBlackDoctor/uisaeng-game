import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { clinicScenario } from '../helpers/clinic-scenario';
import { reduceGame } from '../../src/engine';
import { validState } from '../../src/storage';
import type { GameAction, GameState } from '../../src/contracts';
import CareerPanel from '../../src/CareerPanel';
import DecisionSheet from '../../src/DecisionSheet';
import FinanceSummary from '../../src/FinanceSummary';
import '../../src/style.css';
import '../../src/play-layout.css';
const storage = 'clinic-isolated-qa';
function Preview() {
  const [game, setGame] = useState<GameState>(() => {
    const saved = localStorage.getItem(storage); return saved ? JSON.parse(saved) : clinicScenario(12, 20_000_000);
  });
  function act(a: GameAction) { const next = reduceGame(game, a); if (!validState(next)) throw new Error('Invalid clinic save'); localStorage.setItem(storage, JSON.stringify(next)); setGame(next); }
  return <main style={{ maxWidth: 1024, margin: 'auto', padding: 16 }}>
    <h1>병원 확장 검수</h1><p>현금 {game.economy!.cash.toLocaleString()}원 · 부채 {game.economy!.debt.toLocaleString()}원</p>
    <button onClick={() => { const s = clinicScenario(12, 20_000_000); localStorage.setItem(storage, JSON.stringify(s)); setGame(s); }}>검수 다시 시작</button>
    <button onClick={() => { const s = structuredClone(game); if (s.clinic) s.clinic.shockUntil = Math.floor(s.life!.elapsedMs / 1000) + 6; localStorage.setItem(storage, JSON.stringify(s)); setGame(s); }}>검수용 불황</button>
    <button onClick={() => act({ type: 'tick', id: crypto.randomUUID(), elapsedMs: 325 })}>한 달 진행</button>
    <FinanceSummary game={game}/><CareerPanel game={game} busy={false} act={act}/>
    {game.pendingEvent && <DecisionSheet event={game.pendingEvent} busy={false} onChoose={choiceId => act({ type: 'choose', id: crypto.randomUUID(), eventId: game.pendingEvent!.id, choiceId })}/>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
