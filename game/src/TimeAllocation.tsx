import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Activity, GameAction, GameState } from './contracts';
import { CAREER_FOCUS } from './career-runtime';
import { ACTIVITIES } from './fixtures/content';
import { isServing } from './identity';
import { LIFESTYLE_OPTIONS, lifestyleSchedule } from './lifestyle';
import { LifestyleSettings } from './LifestylePanel';
import AbilitySummary from './AbilitySummary';
import './time-allocation.css';

export function allocationSummary(game: GameState) {
  const focus = game.progress ? CAREER_FOCUS[game.progress.focus].label : game.life ? ACTIVITIES[game.life.focus.main].label : '활동 선택';
  if (isServing(game)) return { focus, activities: '생활 활동은 잠시 쉬어요', remaining: null, suspended: [], budget: null };
  if (!game.career) return { focus, activities: game.life ? `보조활동 · ${ACTIVITIES[game.life.focus.supporting].label}` : '', remaining: null, suspended: [], budget: null };
  const schedule = lifestyleSchedule(game);
  return {
    focus,
    activities: schedule.active.map(key => `${LIFESTYLE_OPTIONS[key].label} ${LIFESTYLE_OPTIONS[key].hours}시간`).join(' · ') || '생활 활동 없음',
    remaining: schedule.remaining,
    suspended: schedule.suspended.map(key => LIFESTYLE_OPTIONS[key].label),
    budget: schedule.remaining + schedule.active.reduce((sum, key) => sum + LIFESTYLE_OPTIONS[key].hours, 0),
  };
}

export default function TimeAllocation({ game, busy, onOpen }: { game: GameState; busy: boolean; onOpen: () => void }) {
  const plan = allocationSummary(game), serving = isServing(game);
  const key = `uisaeng-time-plan-seen:${game.runId}`;
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const [changed, setChanged] = useState(false);
  const previous = useRef({ budget: plan.budget, serving });
  useEffect(() => {
    if (previous.current.budget !== plan.budget || previous.current.serving !== serving) setChanged(true);
    previous.current = { budget: plan.budget, serving };
  }, [plan.budget, serving]);
  const dismiss = () => { setSeen(true); setChanged(false); try { localStorage.setItem(key, '1'); } catch { /* This hint is optional. */ } };
  if (game.status === 'completed') return null;
  return <section className="time-allocation" aria-label="지금의 시간 배분">
    <div className="time-allocation-summary">
      <div><strong>{serving ? '복무 중' : `주로 하는 일 · ${plan.focus}`}</strong>
        <p>{plan.activities}{plan.remaining !== null && <> · 여유 {plan.remaining}시간/주</>}</p>
      </div>
      <button type="button" className="time-allocation-button" disabled={busy || !!game.pendingEvent || serving} onClick={() => { dismiss(); onOpen(); }}>시간·생활 바꾸기</button>
    </div>
    {plan.suspended.length > 0 && <p className="time-allocation-warning" role="status">{plan.suspended.join(' · ')} 중단 중 · 지금 가능한 시간과 조건을 확인하세요.</p>}
    {!serving && (!seen || changed) && <div className="time-allocation-hint">
      <p>{changed ? '생활 시간이 바뀌었어요. 시간 배분을 확인하세요.' : '남는 시간에 할 활동을 골라보세요.'}</p>
      <button type="button" className="subtle-button" onClick={dismiss}>{changed ? '확인' : '건너뛰기'}</button>
    </div>}
  </section>;
}

export function TimeAllocationContent({ game, busy, act }: { game: GameState; busy: boolean; act: (action: GameAction) => unknown }) {
  const [main, setMain] = useState<Activity>(game.life?.focus.main ?? 'study');
  const [supporting, setSupporting] = useState<Activity>(game.life?.focus.supporting ?? 'rest');
  const disabled = busy || !!game.pendingEvent || game.status === 'completed' || isServing(game);
  return <div className="time-allocation-content">
    <section aria-label="주활동 설정">
      {game.progress ? <>
        <label className="career-field"><span>주로 하는 일</span><select aria-label="주로 하는 일" value={game.progress.focus} disabled={disabled} onChange={event => act({ type: 'career-focus', id: crypto.randomUUID(), focus: event.target.value as NonNullable<GameState['progress']>['focus'] })}>
          {Object.entries(CAREER_FOCUS).map(([id, focus]) => <option key={id} value={id}>{focus.label}</option>)}
        </select><small>{CAREER_FOCUS[game.progress.focus].detail}</small></label>
        <AbilitySummary game={game}/>
      </> : <>
        <label className="career-field"><span>주활동</span><select value={main} disabled={disabled} onChange={event => { const next = event.target.value as Activity; setMain(next); if (next === supporting) setSupporting(main); }}>{Object.entries(ACTIVITIES).map(([id, activity]) => <option key={id} value={id}>{activity.label}</option>)}</select></label>
        <label className="career-field"><span>보조활동</span><select value={supporting} disabled={disabled} onChange={event => setSupporting(event.target.value as Activity)}>{Object.entries(ACTIVITIES).filter(([id]) => id !== main).map(([id, activity]) => <option key={id} value={id}>{activity.label}</option>)}</select></label>
        <button type="button" disabled={disabled || (!!game.life && main === game.life.focus.main && supporting === game.life.focus.supporting)} onClick={() => act({ type: 'activity', id: crypto.randomUUID(), main, supporting })}>{game.life ? '활동 변경' : '이렇게 하루 보내기'}</button>
      </>}
    </section>
    {game.career && game.economy && <section aria-label="생활 활동과 식생활"><h3>생활 활동 · 여유 {lifestyleSchedule(game).remaining}시간/주</h3><LifestyleSettings game={game} busy={disabled} act={act}/></section>}
  </div>;
}

export function TimeAllocationDialog({ game, busy, act, onClose, error }: { game: GameState; busy: boolean; act: (action: GameAction) => unknown; onClose: () => void; error?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null), closeRef = useRef<HTMLButtonElement>(null), title = useId();
  useLayoutEffect(() => {
    const previous = document.activeElement, dialog = dialogRef.current!, overflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden'; closeRef.current?.focus();
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={dialogRef} className="time-allocation-dialog" aria-labelledby={title} aria-modal="true" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2 id={title}>시간·생활 바꾸기</h2><button type="button" ref={closeRef} onClick={onClose}>닫기</button></header>
    <p className="lifestyle-hint">설정하는 동안 시간은 멈춥니다. 변경은 바로 저장됩니다.</p>
    {error && <p role="alert">저장하지 못했어요. 닫고 저장 상태를 확인하세요.</p>}
    <TimeAllocationContent game={game} busy={busy} act={act}/>
  </dialog>, document.body);
}
