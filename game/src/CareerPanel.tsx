import { useState } from 'react';
import type { GameAction, GameState } from './contracts';
import { CAREER_FOCUS } from './career-runtime';
import { INSTITUTIONS, SPECIALTIES } from './career';
import { netWorth } from './economy';
import { campusClub } from './campus';
import './career-panel.css';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
export default function CareerPanel({ game, busy, act }: { game: GameState; busy: boolean; act: (a: GameAction) => unknown }) {
  const [selection, setSelection] = useState(game.career?.interest ?? SPECIALTIES[0].id);
  if (!game.career || !game.economy || !game.progress) return null;
  const c = game.career, e = game.economy, chosen = SPECIALTIES.find(s => s.id === selection)!;
  const current = SPECIALTIES.find(s => s.id === c.specialty);
  const disabled = busy || !!game.pendingEvent || game.status === 'completed';
  const school = game.stageIndex === 0;
  const club = campusClub(game);
  const practice = { undecided: '수련 준비', employed: '봉직의', clinic: '개원', research: '연구', untrained: '미수련·일반진료' }[c.practice];
  return <section className="panel career-panel" aria-label="진로와 돈">
    <div className="career-summary"><h3>{school ? '어떤 의사가 될까요?' : current ? `${current.name} · ${practice}` : practice}</h3>{c.institution && <p>{INSTITUTIONS.find(i => i.id === c.institution)?.name}</p>}</div>
    {club && <div className="campus-summary"><strong>{club.name}</strong><p>{club.mentor}</p><small>{game.campus!.project === 'accepted' ? `${club.project} 준비 중` : game.campus!.project === 'finished' ? `함께 마친 활동: ${club.project}` : '모임에서 함께한 일이 쌓입니다.'}</small></div>}
    {game.status !== 'completed' && <label className="career-field"><span>주로 하는 일</span><select aria-label="주로 하는 일" value={game.progress.focus} disabled={disabled} onChange={ev => act({ type: 'career-focus', id: crypto.randomUUID(), focus: ev.target.value as typeof game.progress.focus })}>{Object.entries(CAREER_FOCUS).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}</select><small>{CAREER_FOCUS[game.progress.focus].detail}</small></label>}
    {school && <div className="specialty-explorer"><label className="career-field"><span>관심 있는 과</span><select aria-label="관심 있는 과" value={selection} disabled={disabled} onChange={ev => setSelection(ev.target.value)}>{SPECIALTIES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><p>{chosen.summary}</p><button className="subtle-button" disabled={disabled || c.interest === selection} onClick={() => act({ type: 'explore', id: crypto.randomUUID(), specialtyId: selection })}>{c.explored.includes(selection) ? '관심 전공으로 정하기' : '알아보기'}</button><small>탐색한 과 {c.explored.length}개 · 학업·연구·임상·모임 경험이 지원 준비에 반영됩니다.</small></div>}
    <div className="money-summary"><div><span>현금</span><strong>{won(e.cash)}</strong></div><div><span>부채</span><strong>{won(e.debt)}</strong></div></div>
    <details className="money-details"><summary>수입·지출 보기</summary>{school && <div className="education-plan"><p>{game.campus?.automaticFunding ? "졸업까지 학비·생활비 부족액만 대출로 충당합니다. 대출한 금액만큼 부채가 늘어납니다." : "돈이 부족하면 직접 마련합니다."}</p><button className="subtle-button" disabled={disabled} onClick={() => act({ type: "school-funding", id: crypto.randomUUID(), automatic: !game.campus?.automaticFunding })}>{game.campus?.automaticFunding ? "자동 대출 중단하기" : "졸업까지 부족액 자동 대출하기"}</button></div>}<dl><div><dt>이번 달 수입</dt><dd>{won(e.income)}</dd></div><div><dt>이번 달 지출</dt><dd>{won(e.expenses)}</dd></div><div><dt>총자산</dt><dd>{won(e.assets)}</dd></div><div><dt>순자산</dt><dd>{won(netWorth(e))}</dd></div>{e.due > 0 && <div><dt>미납액</dt><dd>{won(e.due)}</dd></div>}</dl>{e.debt > 0 && e.cash > 0 && <button className="subtle-button" disabled={disabled} onClick={() => act({ type: 'finance', id: crypto.randomUUID(), kind: 'repay' })}>{won(Math.min(e.cash, e.debt))} 상환하기</button>}<ol>{e.ledger.slice(-5).reverse().map(t => <li key={t.id}><span>{t.label}</span><span>{t.cashDelta >= 0 ? '+' : ''}{won(t.cashDelta)}</span></li>)}</ol></details>
  </section>;
}
