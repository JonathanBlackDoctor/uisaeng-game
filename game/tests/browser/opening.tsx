// Visual fixture only: no database, saved game, or game clock.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Opening from '../../src/Opening';
import { createAdmissionGame } from '../../src/admission';
import { setStartingLength } from '../../src/pacing';
import type { GameState } from '../../src/contracts';
import '../../src/style.css';
import '../../src/brand.css';
import '../../src/refinement.css';
import '../../src/scene-layout.css';
import '../../src/play-layout.css';

function Preview() {
  const [draft, setDraft] = useState<GameState | null>(null);
  const [entering, setEntering] = useState(false);
  const [revision, setRevision] = useState(0);
  return <div className="app-shell opening-shell">
    <header className="site-header"><span className="brand"><span className="brand-logo"/></span></header>
    <main className="content"><Opening key={revision} draft={draft} busy={entering} disabled={entering} entering={entering}
      onPrepare={() => setDraft(createAdmissionGame('opening-visual-qa', 42))}
      onEnter={() => { window.scrollTo({ top: 0 }); setEntering(true); }}
      onBack={() => setDraft(null)} onSkipEnter={() => setEntering(false)}
      onLengthChange={length => setDraft(value => value && setStartingLength(value, length))}/></main>
    <aside aria-label="검수 조작" style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 1300, display: 'flex', gap: 8 }}>
      <button onClick={() => { setEntering(false); setDraft(null); setRevision(value => value + 1); window.scrollTo({ top: 0 }); }}>처음부터 확인</button>
      <button onClick={() => { setDraft(createAdmissionGame('opening-visual-qa', 42)); setEntering(true); window.scrollTo({ top: 0 }); }}>캠퍼스 장면 유지</button>
    </aside>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
