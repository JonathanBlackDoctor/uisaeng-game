import { useEffect, useState, type ReactNode } from 'react';
import type { ChoiceResult } from './choice-feedback';
import { STAT_LABELS, type GameState } from './contracts';
import { compactWon, exactWon, financeView } from './finance-view';
import { encounterLabel, netAssets } from './life-goals';
import { familyTimeLabel } from './legacy-goals';
import { publicationLabel } from './publications';
import FinanceSummary from './FinanceSummary';
import { incidentSummary } from './major-events';
import { roundedValue, signedValue } from './display-values';

export default function PlayOverview({ game, children, busy, onAbilities, feedback, allocation }: {
  game: GameState; children: ReactNode; busy: boolean; onAbilities: () => void; feedback?: ChoiceResult | null; allocation?: ReactNode;
}) {
  const [expiredFeedback, setExpiredFeedback] = useState<string | null>(null);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setExpiredFeedback(feedback.id), Math.max(0, feedback.statChangesUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [feedback?.id, feedback?.statChangesUntil]);
  const changes = feedback && feedback.id !== expiredFeedback && Date.now() < feedback.statChangesUntil ? feedback.statChanges : {};
  const finance = game.career && game.economy && game.progress && game.life ? financeView(game) : null;
  const assets = netAssets(game);
  const impacts = incidentSummary(game);
  return <><section className="play-overview" aria-label="현재 상태">
    <div className="overview-top">
      {children}
      <div className="overview-stats" aria-label="현재 능력치">
        {Object.entries(STAT_LABELS).map(([key, label]) => {
          const stat = key as keyof typeof STAT_LABELS;
          const value = roundedValue(game.stats[stat]), change = roundedValue(changes[stat] ?? 0);
          return <div className={`overview-stat stat-${key}`} key={key}>
            <div className="overview-stat-value"><span>{label}</span><strong>{value}</strong></div>
            {change !== 0 && <span key={feedback!.id} className={`overview-stat-change ${change > 0 ? 'positive' : 'negative'}`} aria-label={`${label} ${change > 0 ? '증가' : '감소'} ${Math.abs(change)}`}>{signedValue(change)}</span>}
            <div className="overview-stat-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><i style={{ width: `${Math.max(0, Math.min(100, game.stats[stat]))}%` }}/></div>
          </div>;
        })}
        {game.career && <button className="subtle-button" onClick={onAbilities} disabled={busy}>능력 보기</button>}
      </div>
    </div>
      {allocation}
    </section>
    {(game.career || assets !== null) && <div className="overview-finance" aria-label="생애 기록과 재정">
      {game.career && <div className="overview-goal"><span>누적 진료</span><strong>{encounterLabel(game)}</strong></div>}
      {game.career && <div className="overview-goal"><span>가족과 보낸 시간</span><strong>{familyTimeLabel(game)}</strong></div>}
      {game.career && <div className="overview-goal"><span>발표한 논문</span><strong>{publicationLabel(game)}</strong></div>}
      {assets !== null && game.status === 'completed' && <div className="overview-goal"><span>순자산</span><strong title={exactWon(assets)}>{compactWon(assets)}</strong></div>}
      {finance && game.status !== 'completed' && <>
        <div><span>보유금</span><strong title={exactWon(game.economy!.cash)}>{compactWon(game.economy!.cash)}</strong></div>
        {finance.disposable < 0 && <div className="overview-due" title={exactWon(-finance.disposable)}>매달 {compactWon(-finance.disposable)} 적자</div>}
        {game.economy!.due > 0 && <div className="overview-due"><span>미납</span><strong>{compactWon(game.economy!.due)}</strong></div>}
        <details className="overview-finance-details"><summary>재정 내역</summary><div className="overview-finance-popover"><FinanceSummary game={game}/></div></details>
      </>}
    </div>}
    {impacts.length > 0 && <details className="overview-finance-details"><summary>진행 중인 영향 ({impacts.length})</summary><ul>{impacts.map((line, i) => <li key={i}>{line}</li>)}</ul></details>}
  </>;
}
