import { useEffect, useRef, useState } from 'react';
import { APP_VERSION, monitorGameUpdates, UPDATE_SNOOZE, UPDATES_ENABLED } from './game-update';
import './update-toast.css';

export function useGameUpdate() {
  const [version, setVersion] = useState<string | null>(null);
  const snooze = useRef({ version: '', until: 0 });
  useEffect(() => {
    if (!UPDATES_ENABLED) return;
    return monitorGameUpdates({ current: APP_VERSION, base: import.meta.env.BASE_URL, onUpdate: next => {
      if (next !== snooze.current.version || Date.now() >= snooze.current.until) setVersion(next);
    } });
  }, []);
  const later = () => { snooze.current = { version: version ?? '', until: Date.now() + UPDATE_SNOOZE }; setVersion(null); };
  return { version, later };
}

export default function UpdateToast({ onApply, onLater, disabled }: { onApply: () => Promise<void>; onLater: () => void; disabled: boolean }) {
  const [applying, setApplying] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  async function apply() {
    if (disabled || lock.current) return;
    lock.current = true; setApplying(true); setError('');
    try { await onApply(); }
    catch (reason) { setError((reason as Error).message || '저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { lock.current = false; setApplying(false); }
  }
  return <aside className="update-toast" aria-label="게임 업데이트">
    <div><p role="status" aria-live="polite">{applying ? '저장 후 적용 중…' : '새 버전이 있습니다.'}</p>{error && <p className="update-error" role="alert">{error}</p>}</div>
    <button type="button" className="update-apply" disabled={disabled || applying} onClick={() => void apply()}>업데이트</button>
    <button type="button" className="update-later" disabled={applying} onClick={onLater}>나중에</button>
  </aside>;
}
