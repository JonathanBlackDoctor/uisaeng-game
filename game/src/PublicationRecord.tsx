import type { GameState } from './contracts';
import { publicationSummary } from './publications';

export default function PublicationRecord({ game }: { game: GameState }) {
  const r = game.publications;
  if (!r || (!r.current && !r.papers.length)) return null;
  return <details className="mentoring-record"><summary>연구 기록</summary>
    {r.current && <p>{publicationSummary(game)}</p>}
    {!!r.papers.length && <ul>{r.papers.map(p => <li key={p.id}>{p.title} · {p.kind === 'collaboration' ? '공동연구' : '연구 논문'}</li>)}</ul>}
  </details>;
}
