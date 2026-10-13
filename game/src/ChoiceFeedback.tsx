import { formatMoneyText } from './money-format';
import type { ChoiceResult } from './choice-feedback';
import './choice-feedback.css';
export default function ChoiceFeedback({ result, onClose }: { result: ChoiceResult; onClose: () => void }) {
  return <aside className="choice-result" role="status" aria-live="polite" aria-atomic="true">
    <div><strong>{formatMoneyText(result.title)}</strong><p>{formatMoneyText(result.detail)}</p>{result.changes.length > 0 && <p className="choice-result-changes">{formatMoneyText(result.changes.join(' · '))}</p>}</div>
    <button type="button" onClick={onClose} aria-label="선택 결과 닫기">×</button>
  </aside>;
}
