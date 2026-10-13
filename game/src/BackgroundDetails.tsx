import type { LifeBackground } from './contracts';
import { STAT_LABELS } from './contracts';
import { ABILITIES } from './abilities';
import { backgroundSummary } from './random-life';
import { CLIMATES, FAMILY_STYLES, LEARNING, CHILDHOOD_HEALTH, familyFunding, backgroundStatEffects, backgroundAbilityBonuses, familyFatigueModifier } from './background';
import { compactWon, exactWon } from './finance-view';
import './background.css';

export default function BackgroundDetails({ background: b, hasEconomy }: { background: LifeBackground; hasEconomy: boolean }) {
  const p = b.profile;
  if (!p) return <p>{backgroundSummary(b)}</p>;
  const funding = familyFunding(b), stats = backgroundStatEffects(b), skills = backgroundAbilityBonuses(b);
  const sign = (n: number) => n > 0 ? `+${n}` : `${n}`;
  const fatigue = familyFatigueModifier(b);
  return <div className="background-details">
    <dl>
      <div><dt>성장환경</dt><dd>{b.region} · {b.environment}</dd></div>
      <div><dt>가정 형편</dt><dd>상위 {p.wealthTopPercent}%</dd></div>
      <div><dt>경제적 지원</dt><dd>{FAMILY_STYLES[p.familyStyle]}</dd></div>
      <div><dt>가족 분위기</dt><dd>{CLIMATES[p.climate]}</dd></div>
      <div><dt>학습환경</dt><dd>{LEARNING[p.learning]}</dd></div>
      <div><dt>성장기 건강</dt><dd>{CHILDHOOD_HEALTH[p.childhoodHealth]}</dd></div>
      <div><dt>입학 전 경험</dt><dd>{b.experience}</dd></div>
    </dl>
    {hasEconomy && <dl className="background-funding">
      <div><dt>입학 때 받은 돈</dt><dd title={exactWon(funding.initialCash!)}>{compactWon(funding.initialCash!)}</dd></div>
      <div><dt>월 생활비 지원</dt><dd title={exactWon(funding.monthly)}>{compactWon(funding.monthly)}</dd></div>
      <div><dt>학기별 학비 지원</dt><dd title={exactWon(funding.semester)}>{compactWon(funding.semester)}</dd></div>
    </dl>}
    {hasEconomy && <p className="background-note">가족 지원은 대학 재학 중에 받습니다. 학비 지원은 입학 6개월 뒤부터 6개월마다 들어옵니다.</p>}
    <details className="background-effects"><summary>배경이 주는 영향</summary>
      <p>시작 스탯: {Object.entries(stats).filter(([, n]) => n !== 0).map(([k, n]) => `${STAT_LABELS[k as keyof typeof STAT_LABELS]} ${sign(n)}`).join(' · ')}</p>
      <p>시작 능력: {ABILITIES.filter(a => skills[a.id]).map(a => `${a.label} ${sign(skills[a.id])}`).join(' · ')}</p>
      {hasEconomy && <p>대학 재학 중 3개월마다 피로 {sign(fatigue)}</p>}
    </details>
  </div>;
}
