import { STAT_LABELS, type GameState } from './contracts';
import { mergeCareerRecords, type CareerRecord } from './career-records';
import { observedHighs, STAT_KEYS } from './stat-highs';
import './lifetime-records.css';

export default function LifetimeRecords({ game, records }: { game?: GameState; records: CareerRecord[] }) {
  const current = game ? observedHighs(game) : undefined;
  const rows = mergeCareerRecords(records);
  const own = rows.find(r => r.runId === game?.runId)?.statHighs;
  return <section className="lifetime-records" aria-label="최고 기록">
    <h3>최고 기록</h3>
    <table><thead><tr><th scope="col">능력</th>{game && <th scope="col">이 생애</th>}<th scope="col">모든 플레이</th></tr></thead><tbody>
      {STAT_KEYS.map(key => {
        const peak = Math.max(current?.values[key] ?? -1, own?.values[key] ?? -1, ...rows.map(r => r.statHighs?.values[key] ?? -1));
        const first = rows.findIndex(r => r.statHighs?.values[key] === peak);
        return <tr key={key}><th scope="row">{STAT_LABELS[key]}</th>{current && <td>{Number(Math.max(current.values[key], own?.values[key] ?? 0).toFixed(1))}</td>}<td>{peak < 0 ? '—' : <><strong>{Number(peak.toFixed(1))}</strong>{first >= 0 && <small>{first + 1}번째 플레이</small>}</>}</td></tr>;
      })}
    </tbody></table>
    <p>저장된 기록을 기준으로 합니다. 이전 저장에 없는 과거 최고값은 포함하지 않습니다.</p>
  </section>;
}
