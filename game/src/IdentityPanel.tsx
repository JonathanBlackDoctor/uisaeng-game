import type { GameState } from './contracts';
import { GENDER_LABELS, SERVICE_RULES, isServing, serviceSummary, serviceMonths, serviceDuration } from './identity';
import { compactWon } from './finance-view';

export default function IdentityPanel({ game }: { game: GameState }) {
  if (!game.identity) return null;
  const route = game.identity.service.route, active = isServing(game);
  return <section className="identity-summary" aria-label="성별과 병역">
    <p>{GENDER_LABELS[game.identity.gender]} · {serviceSummary(game)}</p>
    {active && route && <>
      <progress aria-label="복무 진행" max={serviceDuration(route)} value={serviceMonths(game)}/>
      <p>월 급여 {compactWon(SERVICE_RULES[route].income)} · 생활비 {compactWon(SERVICE_RULES[route].expenses)}</p>
      <p>복무를 마치면 학업·진로를 이어갑니다. 생활 활동과 자동 저축·투자는 복귀 뒤 다시 시작합니다.</p>
    </>}
  </section>;
}
