import type { GameState } from './contracts';
import { academicCredits, journeySummary, JOURNEY_RULES } from './specialty-journey';
export default function SpecialtyJourneyPanel({ game }: { game: GameState }) {
  const summary = journeySummary(game);
  if (!summary.theme && !summary.route) return null;
  const rank = summary.rank;
  const points = summary.pursuingAcademic && rank < 3 ? academicCredits(game, rank) : null;
  return <details className="money-details"><summary>전공과 다음 진로{summary.title ? ` · ${summary.title}` : ''}</summary>
    {summary.theme && <p>{summary.theme}</p>}
    {summary.field && <p><strong>{summary.field}</strong> · {summary.qualification}</p>}
    {summary.route && <p>{summary.route}</p>}
    <p>전문의 → 전임의 → 분과·세부 수련 → 임상강사 → 조교수 → 부교수 → 정교수</p>
    <p>기초·연구 교실 → 연구교원 → 조교수 → 부교수 → 정교수</p>
    {points && <p>다음 심사: {['조교수 임용', '부교수 승진', '정교수 승진'][rank]} · 최소 {JOURNEY_RULES.promotionMonths[rank]}개월<br/>연구 {points.research}/2 · 교육 {points.teaching}/2 · 팀 기여 {points.clinical}/2</p>}
    {summary.completedScenes > 0 && <p>이어 온 전공 이야기 {summary.completedScenes}장</p>}
  </details>;
}
