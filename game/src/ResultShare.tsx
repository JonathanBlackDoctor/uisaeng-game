import { useRef, useState } from 'react';
import type { GameState } from './contracts';
import { copyResult, resultShareData, resultShareText, shareResult, type ShareOutcome } from './result-share';
import './result-share.css';
import LifeGoals from './LifeGoals';

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
    <LifeGoals game={game}/>
    <div className="result-share-actions">
      <button className="primary" disabled={pending} onClick={() => void run()}>{pending ? '공유 중…' : '기록 공유하기'}</button>
      {outcome === 'failed' && <button className="subtle-button" onClick={() => void run(true)} disabled={pending}>기록 복사하기</button>}
    </div>
    <p role="status" aria-live="polite">{outcome === 'copied' ? '기록을 복사했습니다.' : outcome === 'failed' ? '공유창을 열지 못했습니다. 기록을 복사해 주세요.' : outcome === 'manual' ? '아래 기록을 선택해 복사해 주세요.' : ''}</p>
    {outcome === 'manual' && <textarea aria-label="공유할 기록" readOnly rows={8} value={resultShareText(data)} onFocus={event => event.currentTarget.select()}/>}
  </div>;
}
