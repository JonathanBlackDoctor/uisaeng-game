import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from './contracts';
import { ABILITIES, ABILITY_GROUPS, abilityPerformance, abilityState } from './abilities';
import { SPECIALTIES } from './career';
import './ability-panel.css';
import AbilitySummary, { relevantAbilities } from './AbilitySummary';

const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
export function AbilityContent({ game }: { game: GameState }) {
  const [group, setGroup] = useState<keyof typeof ABILITY_GROUPS | 'specialties' | 'current'>('current');
  const abilities = abilityState(game), current = { ...game, abilities };
  const m = Math.floor((game.life?.elapsedMs ?? 0) / 1000);
  const specialties = SPECIALTIES.filter(s => (abilities.specialties[s.id] ?? 0) > 0 || game.career?.explored.includes(s.id));
  return <>
    <AbilitySummary game={game}/>
    <details className="ability-browse"><summary>다른 능력 보기</summary><div className="ability-groups" role="group" aria-label="능력 분야">
      <button type="button" aria-pressed={group === 'current'} onClick={() => setGroup('current')}>지금 쓰는 능력</button>
      {Object.entries(ABILITY_GROUPS).map(([key, label]) => <button type="button" key={key} aria-pressed={group === key} onClick={() => setGroup(key as keyof typeof ABILITY_GROUPS)}>{label}</button>)}
      <button type="button" aria-pressed={group === 'specialties'} onClick={() => setGroup('specialties')}>전공 숙련</button>
    </div></details>
    <h3 className="ability-group-title">{group === 'current' ? '지금 쓰는 능력' : group === 'specialties' ? '전공 숙련' : ABILITY_GROUPS[group]}</h3>
    {group === 'specialties' ? <div className="ability-specialties">
      <p>견학·실습·수련에서 경험한 분야입니다. 자격과 면허는 별도로 쌓습니다.</p>
      {specialties.length ? specialties.map(s => <div className="ability-specialty" key={s.id}><span>{s.name}</span><strong>{(abilities.specialties[s.id] ?? 0).toFixed(1)}<small>/100</small></strong><progress aria-label={`${s.name} 숙련`} max="100" value={abilities.specialties[s.id] ?? 0}/></div>) : <p>아직 전공 경험이 없습니다.</p>}
    </div> : <div className="ability-list">
      {ABILITIES.filter(a => group === 'current' ? relevantAbilities(game).includes(a.id) : a.group === group).map(a => {
        const p = abilityPerformance(current, a.id), change = abilities.changes[a.id];
        return <details className="ability-row" key={a.id}>
          <summary><span className="ability-name">{a.label}<small>{change ? `${m === change.month ? '이번 달' : `${m - change.month}개월 전`} ${signed(change.delta)}` : '시작 능력'}</small></span>
            <strong aria-label={`현재 수행력 ${p.current.toFixed(1)}`}>{p.current.toFixed(1)}</strong></summary>
          <div className="ability-detail"><p>{a.use}</p><progress max="100" value={p.current} aria-label={`${a.label} 현재 수행력`}/>
            <p>쌓은 실력 {p.base.toFixed(1)} · 컨디션 {signed(p.condition)}</p>
            {change && <p>최근 변화: {change.reason} ({signed(change.delta)})</p>}
          </div>
        </details>;
      })}
    </div>}
    <p className="ability-footnote">현재 컨디션을 반영한 실력입니다. 항목을 누르면 변화 이유를 볼 수 있습니다.</p>
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
