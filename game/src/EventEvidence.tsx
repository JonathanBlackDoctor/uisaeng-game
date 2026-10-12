import type { GameEvent } from './contracts';
import { evidenceForEvent } from './evidence';

export function EventEvidencePanel({ event }: { event: GameEvent }) {
  const evidence = evidenceForEvent(event)[0];
  if (!evidence) return null;

  return <p className="event-evidence">
    <a href={evidence.source.url} target="_blank" rel="noopener noreferrer">{evidence.summary}</a>
  </p>;
}
