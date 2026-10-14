import { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from './contracts';
import { ABILITIES, abilityPerformance, abilityState, SPECIALTY_SYNERGY, specialtySynergy } from './abilities';
import { ALL_SPECIALTIES as SPECIALTIES } from './career';
import './ability-panel.css';
import { relevantAbilities } from './AbilitySummary';
import { roundedValue, signedValue, synergyLabel } from './display-values';
import { startingAbilityReason } from './ability-origin';

export function AbilityContent({ game }: { game: GameState }) {
  const abilities = abilityState(game), current = { ...game, abilities };
  const m = Math.floor((game.life?.elapsedMs ?? 0) / 1000);
  const relevant = relevantAbilities(game);
  const specialties = SPECIALTIES.filter(s => (abilities.specialties[s.id] ?? 0) > 0 || game.career?.explored.includes(s.id));
  const synergy = specialtySynergy(game, 'clinical');
  const synergySkills = SPECIALTY_SYNERGY[game.career?.specialty ?? ''] ?? [];
  return <>
    <p className="ability-intro">지금 하는 일에 쓰이는 능력에 밑줄이 표시됩니다.</p>
    {synergy > 1 && <p className="ability-impact">{SPECIALTIES.find(s => s.id === game.career?.specialty)?.name} 시너지 {synergyLabel(synergy)} · {synergySkills.map(id => ABILITIES.find(a => a.id === id)!.label).join('·')}</p>}
    <div className="ability-list" aria-label="상세 능력 6가지">
      {ABILITIES.map(a => {
        const p = abilityPerformance(current, a.id), change = abilities.changes[a.id];
        return <details className={`ability-row${relevant.includes(a.id) ? ' ability-relevant' : ''}`} key={a.id}>
          <summary><span className="ability-name">{a.label}<small>{change ? `${m === change.month ? '이번 달' : `${m - change.month}개월 전`} ${signedValue(change.delta)}` : '시작 능력'}</small></span>
            <strong aria-label={`현재 수행력 ${roundedValue(p.current)}`}>{roundedValue(p.current)}</strong></summary>
          <div className="ability-detail"><p>{a.use}</p><progress max="100" value={roundedValue(p.current)} aria-label={`${a.label} 현재 수행력`}/>
            <p>쌓은 실력 {roundedValue(p.base)} · 컨디션 {signedValue(p.condition)}</p>
            <p>시작 배경: {startingAbilityReason(game.life?.background, a.id)}</p>
            {change && <p>최근 변화: {change.reason} ({signedValue(change.delta)})</p>}
          </div>
        </details>;
      })}
    </div>
    {specialties.length > 0 && <details className="ability-browse"><summary>전공 숙련</summary><div className="ability-specialties">
      {specialties.map(s => <div className="ability-specialty" key={s.id}><span>{s.name}</span><strong>{roundedValue(abilities.specialties[s.id] ?? 0)}<small>/100</small></strong><progress aria-label={`${s.name} 숙련`} max="100" value={roundedValue(abilities.specialties[s.id] ?? 0)}/></div>)}
    </div></details>}
    <p className="ability-footnote">현재 컨디션을 반영한 실력입니다. 항목을 누르면 쓰임과 변화 이유를 볼 수 있습니다.</p>
  </>;
}
export default function AbilityPanel({ game, onClose }: { game: GameState; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), closeRef = useRef<HTMLButtonElement>(null), title = useId();
  useLayoutEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current!;
    const overflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden'; closeRef.current?.focus();
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={ref} className="ability-dialog" aria-labelledby={title} aria-modal="true" onCancel={e => { e.preventDefault(); onClose(); }}>
    <header><h2 id={title}>상세 능력</h2><button ref={closeRef} type="button" onClick={onClose} aria-label="능력 보기 닫기">닫기</button></header>
    <AbilityContent game={game}/>
  </dialog>, document.body);
}
