import type { GameEvent } from './contracts';
import { evidenceForEvent } from './evidence';

export function EventEvidencePanel({ event }: { event: GameEvent }) {
  const evidence = evidenceForEvent(event)[0];
  if (event.sourceNote) return <p className="event-evidence"><a href={event.sourceNote.url} target="_blank" rel="noopener noreferrer">{event.sourceNote.text}</a></p>;
  if (!evidence) return null;

  return <p className="event-evidence">
    <a href={evidence.source.url} target="_blank" rel="noopener noreferrer">{evidence.summary}</a>
  </p>;
}
