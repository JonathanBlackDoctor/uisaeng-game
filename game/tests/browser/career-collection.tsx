import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createCareerGame } from '../../src/career-runtime';
import { initialJourney, journeyEvent, requiredJourney, settleJourney } from '../../src/specialty-journey';
import { recordCareer, mergeCareerRecords } from '../../src/career-records';
import CareerCollection from '../../src/CareerCollection';
import LifetimeRecords from '../../src/LifetimeRecords';
import '../../src/style.css';
function run(id: string, specialty: string, field: string) {
  const s = createCareerGame(id, 42);
  Object.assign(s.career!, { specialty, institution: 'snuh', application: 'accepted', attempts: 1, practice: 'employed' });
  s.progress!.trainingStartMonth = 72; s.journey = initialJourney(72, 2);
  for (let m = 73; m < 260; m++) {
    s.life!.elapsedMs = m * 1000; s.stageIndex = m < 144 ? 1 : 2;
    const key = requiredJourney(s); if (!key) continue;
    const e = journeyEvent(s, key)!;
    settleJourney(s, key, key === 'journey:field' ? field : e.choices[0].id);
  }
  return s;
}
const rows = mergeCareerRecords([
  recordCareer(run('one', 'internal', 'field-0'), '2026-10-12T00:00:00Z'),
  recordCareer(run('two', 'orthopedics', 'field-3'), '2026-10-13T00:00:00Z'),
  recordCareer(run('three', 'plastic', 'field-0'), '2026-10-14T00:00:00Z'),
]);
const training = run('four', 'pediatrics', 'field-0');
training.life!.elapsedMs = 82_000; training.stageIndex = 1; training.journey = initialJourney(72, 2);
rows.push(recordCareer(training, '2026-10-15T00:00:00Z'));
rows[0].statHighs = { fromStart: true, values: { health: 94, happiness: 88, knowledge: 100, relationships: 81 } };
training.statHighs = { fromStart: true, values: { health: 78, happiness: 92, knowledge: 84, relationships: 75 } };
function Preview() {
  const [empty, setEmpty] = useState(false);
  const [life, setLife] = useState(false);
  return <main className="content"><h1>{life ? '생애 기록' : '진료실 도감'}</h1><button onClick={() => setLife(!life)}>{life ? '진료실 도감 보기' : '생애 기록 보기'}</button><button onClick={() => setEmpty(!empty)}>{empty ? '기록 있는 화면' : '빈 기록 화면'}</button>{life ? <section className="panel"><LifetimeRecords game={empty ? undefined : training} records={empty ? [] : mergeCareerRecords([...rows, recordCareer(training, '2026-10-15T00:00:00Z')])}/></section> : <CareerCollection records={empty ? [] : rows}/>}</main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Preview/></StrictMode>);
