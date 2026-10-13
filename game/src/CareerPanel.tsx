import { useState } from 'react';
import type { GameAction, GameState } from './contracts';
import { CAREER_FOCUS } from './career-runtime';
import { INSTITUTIONS, SPECIALTIES } from './career';
import { campusClub } from './campus';
import { DEPTH_RUNTIME } from './career-depth';
import './career-panel.css';
import FinanceSummary from './FinanceSummary';
import LifestylePanel from './LifestylePanel';
import { compactWon } from './finance-view';
import { explorationOptions } from './opportunities';

const won = compactWon;
export default function CareerPanel({ game, busy, act }: { game: GameState; busy: boolean; act: (a: GameAction) => unknown }) {
  const [selection, setSelection] = useState(game.career?.interest ?? SPECIALTIES[0].id);
  if (!game.career || !game.economy || !game.progress) return null;
  const c = game.career, e = game.economy, available = explorationOptions(game);
  const chosen = available.find(s => s.id === selection) ?? available[0];
  const current = SPECIALTIES.find(s => s.id === c.specialty);
  const disabled = busy || !!game.pendingEvent || game.status === 'completed';
  const school = game.stageIndex === 0;
  const club = campusClub(game);
  const practice = { undecided: '수련 준비', employed: '봉직의', clinic: '개원', research: '연구', untrained: '미수련·일반진료' }[c.practice];
  return <section className="panel career-panel" aria-label="진로와 돈">
    <div className="career-summary"><h3>{school ? '어떤 의사가 될까요?' : current ? `${current.name} · ${practice}` : practice}</h3>{c.institution && <p>{INSTITUTIONS.find(i => i.id === c.institution)?.name}</p>}</div>
    <FinanceSummary game={game}/>
    {club && <div className="campus-summary"><strong>{club.name}</strong><p>{club.mentor}</p><small>{game.campus!.project === 'accepted' ? `${club.project} 준비 중` : game.campus!.project === 'finished' ? `함께 마친 활동: ${club.project}` : '모임에서 함께한 일이 쌓입니다.'}</small></div>}
    {!school && game.depth && <details className="money-details"><summary>수련·업무 기록</summary><p>숙련 경험 {game.depth.skill} · 안전관리 경험 {game.depth.safety}</p>{game.depth.institutionPath && <p>수련 일정과 몇 달 뒤 결과는 생애 기록에 남습니다.</p>}{game.stageIndex === 2 && c.practice !== 'undecided' && game.status !== 'completed' && <label className="career-field"><span>업무 일정</span><select aria-label="업무 일정" value={game.depth.workload} disabled={disabled} onChange={ev => act({ type: 'workload', id: crypto.randomUUID(), workload: ev.target.value as 'balanced' | 'extended' | 'learning' })}><option value="balanced">기본 일정</option>{c.practice !== 'research' && <option value="extended">추가 업무</option>}<option value="learning">교육·동료 검토</option></select><small>{game.depth.workload === 'extended' ? `월 추가 ${won(c.practice === 'clinic' ? DEPTH_RUNTIME.extendedRevenue : DEPTH_RUNTIME.extendedSalary)}${c.practice === 'clinic' ? ` · 운영비 ${won(DEPTH_RUNTIME.extendedCost)}` : ''} · 석 달마다 건강 -2` : game.depth.workload === 'learning' ? `월 교육비 ${won(DEPTH_RUNTIME.learningCost)} · 잔액 부족 시 중단` : '기본 수입과 생활 시간을 유지합니다.'}</small></label>}<p className="career-assumption">업무·비용·사건 수치는 가상 게임 설정입니다. 실제 병원의 급여나 사고 확률을 뜻하지 않습니다.</p></details>}
    {game.status !== 'completed' && <label className="career-field"><span>주로 하는 일</span><select aria-label="주로 하는 일" value={game.progress.focus} disabled={disabled} onChange={ev => act({ type: 'career-focus', id: crypto.randomUUID(), focus: ev.target.value as typeof game.progress.focus })}>{Object.entries(CAREER_FOCUS).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}</select><small>{CAREER_FOCUS[game.progress.focus].detail}</small></label>}
    {school && <div className="specialty-explorer"><label className="career-field"><span>이번 학기에 알아볼 과</span><select aria-label="이번 학기에 알아볼 과" value={chosen.id} disabled={disabled} onChange={ev => setSelection(ev.target.value)}>{available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><p>{chosen.summary}</p><button className="subtle-button" disabled={disabled || c.interest === chosen.id} onClick={() => act({ type: 'explore', id: crypto.randomUUID(), specialtyId: chosen.id })}>{c.explored.includes(chosen.id) ? '관심 전공으로 정하기' : '알아보기'}</button><small>{c.interest ? `관심 전공: ${SPECIALTIES.find(s => s.id === c.interest)?.name} · ` : ''}6개월마다 견학할 과가 바뀝니다.</small></div>}
    <LifestylePanel game={game} busy={busy} act={act}/>
    <details className="money-details"><summary>수입·지출 보기</summary>{school && <div className="education-plan"><p>{game.campus?.automaticFunding ? "졸업까지 학비·생활비 부족액만 대출로 충당합니다. 대출한 금액만큼 부채가 늘어납니다." : "돈이 부족하면 직접 마련합니다."}</p><button className="subtle-button" disabled={disabled} onClick={() => act({ type: "school-funding", id: crypto.randomUUID(), automatic: !game.campus?.automaticFunding })}>{game.campus?.automaticFunding ? "자동 대출 중단하기" : "졸업까지 부족액 자동 대출하기"}</button></div>}<dl><div><dt>이번 달 수입</dt><dd>{won(e.income)}</dd></div><div><dt>이번 달 지출</dt><dd>{won(e.expenses)}</dd></div><div><dt>총자산</dt><dd>{won(e.assets)}</dd></div><div><dt>순자산</dt><dd>{won(e.assets - e.debt - e.due)}</dd></div>{e.due > 0 && <div><dt>미납액</dt><dd>{won(e.due)}</dd></div>}</dl>{e.debt > 0 && e.cash > 0 && <button className="subtle-button" disabled={disabled} onClick={() => act({ type: 'finance', id: crypto.randomUUID(), kind: 'repay' })}>{won(Math.min(e.cash, e.debt))} 상환하기</button>}<ol>{e.ledger.slice(-5).reverse().map(t => <li key={t.id}><span>{t.label}</span><span>{t.cashDelta >= 0 ? '+' : ''}{won(t.cashDelta)}</span></li>)}</ol></details>
  </section>;
}
