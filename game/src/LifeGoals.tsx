import type { GameState } from './contracts';
import { professionDefinition, professionOf } from './professions';
import { compactWon, exactWon } from './finance-view';
import { encounterLabel, monthlyEncounters, netAssets, nextGoal } from './life-goals';
import { familyTimeLabel } from './legacy-goals';
import { publicationLabel, publicationSummary } from './publications';
import PublicationRecord from './PublicationRecord';
import './life-goals.css';

export default function LifeGoals({ game }: { game: GameState }) {
  if (!game.career) return null;
  const total = game.encounters?.total ?? 0, assets = netAssets(game), active = game.status !== 'completed';
  return <div className="life-goals" aria-label="생애 성과">
    <div><span>{professionOf(game) === 'nursing' ? '누적 돌봄' : '누적 진료'}</span><strong>{encounterLabel(game)}</strong>
      {active && <small>{monthlyEncounters(game) > 0 ? `월 ${monthlyEncounters(game).toLocaleString('ko-KR')}건 · ` : ''}다음 목표 {nextGoal(total, 1000).toLocaleString('ko-KR')}건</small>}
      {active && game.stageIndex === 0 && <small>{professionDefinition(game).job}로 일하기 시작하면 쌓입니다.</small>}
    </div>
    <div><span>순자산</span><strong title={assets === null ? undefined : exactWon(assets)}>{assets === null ? '기록 없음' : compactWon(assets)}</strong>
      {active && assets !== null && <small>{assets < 0 ? '다음 목표 순자산 0원' : `다음 목표 ${compactWon(nextGoal(assets, 100_000_000))}`}</small>}
    </div>
    <div><span>가족과 보낸 시간</span><strong>{familyTimeLabel(game)}</strong>
      {active && !game.lifestyle?.enabled.family && <small>생활 설정에서 가족 시간을 마련하세요.</small>}
    </div>
    <div><span>발표한 논문</span><strong>{publicationLabel(game)}</strong>
      {active && !game.publications?.current && <small>{publicationSummary(game)}</small>}
      <PublicationRecord game={game}/>
    </div>
  </div>;
}
