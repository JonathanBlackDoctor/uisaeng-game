import { useRef, useState } from 'react';
import type { GameState } from './contracts';
import { copyResult, resultShareData, resultShareText, shareResult, type ShareOutcome } from './result-share';
import './result-share.css';

export default function ResultShare({ game }: { game: GameState }) {
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const lock = useRef(false);
  if (game.status !== 'completed') return null;
  const data = resultShareData(game);
  async function run(copy = false) {
    if (lock.current) return;
    lock.current = true;
    setPending(true); setOutcome(null);
    try { setOutcome(await (copy ? copyResult(data, navigator) : shareResult(data, navigator))); }
    finally { lock.current = false; setPending(false); }
  }
  return <div className="result-share">
    <div className="result-share-actions">
      <button className="primary" disabled={pending} onClick={() => void run()}>{pending ? '공유 준비 중…' : '결과 공유하기'}</button>
      {outcome === 'failed' && <button className="subtle-button" onClick={() => void run(true)} disabled={pending}>결과 복사하기</button>}
    </div>
    <p role="status" aria-live="polite">{outcome === 'copied' ? '결과를 복사했습니다. 원하는 곳에 붙여넣으세요.' : outcome === 'failed' ? '공유창을 열지 못했습니다. 결과를 복사해 주세요.' : outcome === 'manual' ? '아래 내용을 선택해 복사해 주세요.' : ''}</p>
    {outcome === 'manual' && <textarea aria-label="공유할 결과" readOnly rows={8} value={resultShareText(data)} onFocus={event => event.currentTarget.select()}/>}
  </div>;
}
