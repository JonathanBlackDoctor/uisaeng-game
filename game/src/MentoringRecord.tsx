import type { GameState } from './contracts';
import { currentStudent, mentoringSummary, studentAchievement, trainedStudents } from './legacy-goals';

export default function MentoringRecord({ game }: { game: GameState }) {
  const graduates = trainedStudents(game), current = currentStudent(game);
  if (!current && !graduates.length) return null;
  return <details className="mentoring-record"><summary>지도 기록</summary>
    {current && <p>{mentoringSummary(game)}{game.status === 'completed' ? ' · 지도 미완료' : ''}</p>}
    {graduates.length > 0 && <ul>{graduates.map(p => <li key={p.id}><strong>{p.name}</strong> · {studentAchievement(p)}</li>)}</ul>}
  </details>;
}
