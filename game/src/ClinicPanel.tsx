import type { GameAction, GameState } from './contracts';
import { CLINIC_RULES, canExpandClinic, clinicDebtBps, clinicLevel, clinicOpen, clinicRevenue, clinicService, clinicTier, nextClinicTier } from './clinic';
import { compactWon as won } from './finance-view';
import { elapsedMonths } from './random-life';

export default function ClinicPanel({ game, disabled, act }: { game: GameState; disabled: boolean; act: (a: GameAction) => unknown }) {
  if (!clinicOpen(game)) return null;
  const tier = clinicTier(game), next = nextClinicTier(game);
  const price = (game.portfolio?.priceIndex ?? 1e6) / 1e6, wage = (game.portfolio?.wageIndex ?? 1e6) / 1e6;
  const wait = Math.max(0, (game.clinic?.changedAt ?? -12) + CLINIC_RULES.cooldown - elapsedMonths(game));
  return <details className="money-details"><summary>병원 운영 · {tier.name}</summary>
    <dl><div><dt>기본 월 매출 예상</dt><dd>{won(Math.round(clinicRevenue(game) * wage))}</dd></div>
      <div><dt>월 운영비</dt><dd>{won(Math.round(tier.cost * price))}</dd></div>
      {clinicLevel(game) > 0 && <><div><dt>전체 대출 금리</dt><dd>연 {clinicDebtBps(game) / 100}%</dd></div>
        <div><dt>월 원리금 상환 예상</dt><dd>{won(clinicService(game))}</dd></div></>}</dl>
    {game.clinic && elapsedMonths(game) < game.clinic.shockUntil && <p>예약 감소 · {game.clinic.shockUntil - elapsedMonths(game)}개월 남음</p>}
    {next && <><p>{next.name} · 내 돈 {won(next.equity)} + 대출 {won(next.loan)}</p>
      <button className="subtle-button" disabled={disabled || !canExpandClinic(game)} onClick={() => act({ type: 'clinic', id: crypto.randomUUID(), kind: 'expand' })}>확장 조건 보기</button>
      {wait > 0 ? <p>{wait}개월 뒤 다시 확장할 수 있습니다.</p> : game.economy!.due > 0 ? <p>미납액부터 납부해야 합니다.</p> : game.economy!.cash < next.equity ? <p>내 돈 {won(next.equity)}이 필요합니다.</p> : null}</>}
    {clinicLevel(game) > 0 && <button className="subtle-button" disabled={disabled} onClick={() => act({ type: 'clinic', id: crypto.randomUUID(), kind: 'manage' })}>축소·폐업 검토하기</button>}
  </details>;
}
