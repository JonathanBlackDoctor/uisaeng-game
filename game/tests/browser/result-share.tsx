// Isolated browser fixture: no storage, real clipboard writes, or external sends.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ResultShare from '../../src/ResultShare';
import { createCareerGame } from '../../src/career-runtime';
import '../../src/style.css';

const game = createCareerGame('share-ui-fixture', 42);
game.status = 'completed';
game.life!.elapsedMs = 684000;
game.career!.specialty = 'orthopedics';
game.career!.practice = 'employed';
const archive = structuredClone(game); archive.runId = 'archive'; archive.stats.health = 12;
function Preview() {
  const [mode, setMode] = useState('manual');
  const [old, setOld] = useState(false);
  const [captured, setCaptured] = useState('');
  Object.defineProperty(navigator, 'share', { configurable: true, value: ['native', 'cancel', 'failure'].includes(mode) ? async (data: ShareData) => {
    if (mode === 'cancel') throw new DOMException('cancel', 'AbortError');
    if (mode === 'failure') throw new DOMException('denied', 'NotAllowedError');
    setCaptured(JSON.stringify(data));
  } : undefined });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => {
    if (mode !== 'copy') throw new DOMException('denied', 'NotAllowedError');
    setCaptured(text);
  } } });
  return <main style={{ maxWidth: 760, margin: '24px auto', padding: 16 }}>
    <label>검수 모드 <select value={mode} onChange={e => { setMode(e.target.value); setCaptured(''); }}>
      <option value="manual">수동 복사</option><option value="copy">자동 복사</option><option value="native">네이티브 호출 모의</option><option value="cancel">공유 취소</option><option value="failure">공유 실패</option>
    </select></label>
    <label><input type="checkbox" checked={old} onChange={e => { setOld(e.target.checked); setCaptured(''); }}/>보관된 회고</label>
    <section className="panel completion" style={{ marginTop: 24 }}><span>✓ 회고가 보관함에 저장되었습니다</span><h3>은퇴와 회고</h3><p>완료된 회고는 다음 이야기를 시작해도 보관됩니다.</p><ResultShare key={`${mode}:${old}`} game={old ? archive : game}/></section>
    {captured && <pre aria-label="검수용 공유 내용" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{captured}</pre>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
