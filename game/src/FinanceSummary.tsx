import type { GameState } from './contracts';
import { compactWon, exactWon, financeView } from './finance-view';

export default function FinanceSummary({ game }: { game: GameState }) {
  const f = financeView(game), e = game.economy!;
  return <div className="money-summary">
    <div><span>순자산</span><strong title={exactWon(f.netAssets)}>{compactWon(f.netAssets)}</strong>
      <details><summary>재산 내역</summary><p>현금 {exactWon(e.cash)}</p><p>예금 {exactWon(game.portfolio?.savings ?? 0)}</p><p>투자 {exactWon(game.portfolio?.investments ?? 0)}</p><p>총자산 {exactWon(e.assets)}</p><p>부채 {exactWon(e.debt)}</p>{e.due > 0 && <p>미납 {exactWon(e.due)}</p>}<p>순자산 {exactWon(f.netAssets)}</p></details>
    </div>
    <div><span>{f.label}</span><strong title={exactWon(f.annual)}>{compactWon(f.annual)}</strong>
      <small title={exactWon(f.expenses)}>월 지출 {compactWon(f.expenses)}</small>
      <small title={exactWon(f.disposable)}>월 잔여 {f.disposable > 0 ? '+' : ''}{compactWon(f.disposable)}</small>
      <details><summary>월 예산</summary><p>예상 수입 {exactWon(f.income)}</p>{f.familyMonthly > 0 && <p>가족 생활비 지원 {exactWon(f.familyMonthly)}</p>}{f.familySemester > 0 && <p>가족 학비 지원 {exactWon(f.familySemester)} / 학기</p>}<p>예상 지출 {exactWon(f.expenses)}</p><p>예상 잔여 {exactWon(f.disposable)}</p><p>상환 계획 {exactWon(f.repayment)}</p><p>저축·투자·상환 후 {exactWon(f.afterPlans)}</p><p>{game.stageIndex === 0 ? '등록금과 가족 학비 지원은 월평균으로 포함했습니다. 실제 납부와 학비 지원은 학기마다 이루어집니다.' : '현재 일정 기준입니다. 일회성 거래와 예금 이자·투자 손익은 별도입니다.'}</p></details>
    </div>
  </div>;
}
