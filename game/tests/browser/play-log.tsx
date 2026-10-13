import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PlayLog from '../../src/PlayLog';
import type { JournalEntry } from '../../src/contracts';
import '../../src/style.css';
import '../../src/refinement.css';
import '../../src/play-layout.css';
const entry = (n: number): JournalEntry => ({ id: `fixture:${n}`, stage: 'university', title: `검수 기록 ${n}`, detail: '20세 · 로그 스크롤 검수용 기록', effects: { knowledge: 1 } });
function Fixture() {
  const [entries, setEntries] = useState(Array.from({ length: 35 }, (_, i) => entry(i + 1)));
  return <div style={{ maxWidth: 440, margin: '20px auto' }}><button onClick={() => setEntries(previous => [...previous, entry(previous.length + 1)])}>검수 기록 추가</button><PlayLog entries={entries} onOpenJournal={() => {}}/></div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
