import { STAT_LABELS, type GameState, type Stat } from './contracts';

export default function CampusNews({ game }: { game: GameState }) {
  const notes = game.journal.filter(j => j.id.startsWith('auto:campus:') || j.id.startsWith('auto:dynamics:')).slice(-1);
  if (!notes.length) return null;
  return <section className="campus-news" aria-label="생활 소식" aria-live="polite" aria-atomic="false">
    {notes.map((n, i) => <article key={n.id} className={i === 0 ? 'latest-news' : ''}>
      <strong>{n.title}</strong><p>{n.detail}</p>
      {Object.entries(n.effects).some(([, value]) => value !== 0) && <small>{Object.entries(n.effects).filter(([, value]) => value !== 0).map(([key, value]) => `${STAT_LABELS[key as Stat]} ${value > 0 ? '+' : ''}${value}`).join(' · ')}</small>}
    </article>)}
  </section>;
}
