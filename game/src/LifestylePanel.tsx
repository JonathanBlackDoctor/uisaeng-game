import { useState } from 'react';
import type { GameAction, GameState } from './contracts';
import { LIFESTYLE_OPTIONS, lifestyleKeys, lifestyleSchedule, lifestyleAvailable, initialLifestyle, type Diet } from './lifestyle';
import { LEGACY_RULES, currentStudent, mentoringSummary } from './legacy-goals';
import MentoringRecord from './MentoringRecord';
import { FINANCE_RULES, initialPortfolio, PLAN_AMOUNTS, type InvestmentRisk } from './portfolio';
import { compactWon, exactWon } from './finance-view';

export default function LifestylePanel({ game, busy, act }: { game: GameState; busy: boolean; act: (a: GameAction) => unknown }) {
  const [amount, setAmount] = useState(100_000);
  const l = game.lifestyle ?? initialLifestyle(), p = game.portfolio ?? initialPortfolio(game.seed), e = game.economy!;
  const schedule = lifestyleSchedule(game), disabled = busy || !!game.pendingEvent || game.status === 'completed';
  const transferDisabled = busy || game.status === 'completed' || (!!game.pendingEvent && game.pendingEvent.randomKey !== 'funding');
  const transfer = (kind: 'save' | 'withdraw' | 'invest' | 'sell', value: number) => act({ type: 'money-transfer', id: crypto.randomUUID(), kind, amount: value });
  return <div className="lifestyle-panel">
    <details><summary>생활 설정 <small>주 {schedule.remaining}시간 여유</small></summary>
      <p className="lifestyle-hint">수업·근무와 주활동을 뺀 시간입니다. 여러 활동을 함께 이어갈 수 있습니다.</p>
      {lifestyleKeys.map(key => { const o = LIFESTYLE_OPTIONS[key]; const eligible = lifestyleAvailable(game, key), unavailable = !l.enabled[key] && (o.hours > schedule.remaining || !eligible);
        return <label className="lifestyle-option" key={key}><input type="checkbox" role="switch" checked={!!l.enabled[key]} disabled={disabled || unavailable} onChange={event => act({ type: 'lifestyle', id: crypto.randomUUID(), key, enabled: event.target.checked })}/><span>{o.label}<small>주 {o.hours}시간 · {o.income ? `월 수입 ${compactWon(o.income)}` : o.cost ? `월 ${compactWon(Math.round(o.cost * p.priceIndex / 1_000_000))}` : '비용 없음'}{!eligible && key === 'mentoring' ? ' · 직업 생활부터 가능' : schedule.suspended.includes(key) ? ' · 시간 부족으로 중단 중' : ''}</small>{key === 'family' && <small>가족과 함께 보낸 시간이 쌓입니다.</small>}{key === 'mentoring' && eligible && <small>{currentStudent(game) ? mentoringSummary(game) : `누적 ${LEGACY_RULES.mentoringMonths}개월 지도하면 1명`}</small>}</span></label>;
      })}
      <MentoringRecord game={game}/>
      <label className="career-field"><span>식생활</span><select value={l.diet} disabled={disabled} onChange={event => act({ type: 'diet', id: crypto.randomUUID(), diet: event.target.value as Diet })}><option value="frugal">절약해서 먹기</option><option value="balanced">보통으로 먹기</option><option value="comfortable">여유 있게 챙겨 먹기</option></select></label>
    </details>
    <details><summary>저축·투자·상환</summary>
      <dl className="portfolio-balances"><div><dt>예금</dt><dd title={exactWon(p.savings)}>{compactWon(p.savings)}</dd></div><div><dt>투자 평가액</dt><dd title={exactWon(p.investments)}>{compactWon(p.investments)}</dd></div><div><dt>이번 달 예금 이자</dt><dd>{exactWon(p.lastInterest)}</dd></div><div><dt>이번 달 대출 이자</dt><dd>{exactWon(p.lastDebtInterest)}</dd></div><div><dt>이번 달 투자 손익</dt><dd>{exactWon(p.lastInvestmentReturn)}</dd></div></dl>
      <p className="lifestyle-hint">예금 연 {FINANCE_RULES.depositBps / 100}%, 대출 연 {FINANCE_RULES.debtBps / 100}%. 매월 이자가 붙습니다. 갚지 않은 대출 이자는 부채에 더해집니다.</p>
      {(['autoSave','autoInvest','autoRepay'] as const).map(field => <label className="career-field" key={field}><span>{{ autoSave: '매달 저축', autoInvest: '매달 투자', autoRepay: '매달 상환' }[field]}</span><select value={p[field]} disabled={disabled} onChange={event => act({ type: 'money-plan', id: crypto.randomUUID(), field, amount: Number(event.target.value) })}>{PLAN_AMOUNTS.map(n => <option key={n} value={n}>{n ? compactWon(n) : '하지 않기'}</option>)}</select></label>)}
      <p className="lifestyle-hint">생활비를 남긴 뒤 상환·저축·투자 순서로 처리합니다. 잔액이 부족하면 가능한 금액만 옮깁니다.</p>
      <label className="career-field"><span>투자 방식</span><select disabled={disabled} value={p.risk} onChange={event => act({ type: 'investment-risk', id: crypto.randomUUID(), risk: event.target.value as InvestmentRisk })}><option value="bonds">채권 중심 · 작은 변동</option><option value="balanced">혼합 · 중간 변동</option><option value="stocks">주식 중심 · 큰 변동</option></select></label>
      <p className="lifestyle-hint">투자는 손실이 날 수 있습니다. 수입과 지출은 물가와 연봉 갱신에 따라 달라집니다.</p>
      <label className="lifestyle-option"><input type="checkbox" checked={p.useSavings} disabled={disabled} onChange={event => act({ type: 'savings-buffer', id: crypto.randomUUID(), enabled: event.target.checked })}/><span>부족한 생활비는 예금에서 쓰기</span></label>
      <label className="career-field"><span>지금 옮길 금액</span><select value={amount} disabled={transferDisabled} onChange={event => setAmount(Number(event.target.value))}>{[100_000, 500_000, 1_000_000, 5_000_000].map(n => <option key={n} value={n}>{compactWon(n)}</option>)}</select></label>
      <div className="portfolio-actions"><button disabled={disabled || e.cash < amount || e.due > 0} onClick={() => transfer('save', amount)}>예금하기</button><button disabled={disabled || e.cash < amount || e.due > 0} onClick={() => transfer('invest', amount)}>투자하기</button><button disabled={transferDisabled || !p.savings} onClick={() => transfer('withdraw', p.savings)}>예금 전액 인출</button><button disabled={transferDisabled || !p.investments} onClick={() => transfer('sell', p.investments)}>투자 전액 매도</button></div>
    </details>
  </div>;
}
