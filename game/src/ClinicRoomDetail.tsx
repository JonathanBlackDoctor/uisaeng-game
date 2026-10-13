import { useEffect, useRef } from 'react';
import { SPECIALTIES } from './career';
import { specialtyFields } from './credential-catalog';
import { fieldKey, firstAchievement, specialtyKey, type CareerRecord } from './career-records';
import ClinicRoom, { clinicRoom } from './ClinicRoom';

export default function ClinicRoomDetail({ specialty, records, onClose }: { specialty: string; records: CareerRecord[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => { ref.current?.close(); onClose(); };
  useEffect(() => { const dialog = ref.current!; if (!dialog.open) dialog.showModal(); }, []);
  const name = SPECIALTIES.find(s => s.id === specialty)!.name;
  const room = clinicRoom(records, specialty);
  const trained = firstAchievement(records, specialtyKey(specialty));
  const qualified = firstAchievement(records, specialtyKey(specialty, true));
  const fields = specialtyFields(specialty);
  return <dialog ref={ref} className="clinic-room-detail" aria-labelledby="clinic-room-title" onCancel={e => { e.preventDefault(); close(); }} onClose={onClose} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div><header><h2 id="clinic-room-title">{name}</h2><button autoFocus onClick={close}>닫기</button></header>
      <ClinicRoom specialty={specialty} records={records}/>
      <p>{trained ? `첫 수련 · ${trained.run}번째 플레이` : '이 과에서 수련을 시작하면 문이 열립니다.'}{qualified && ` · 전문의 취득 ${qualified.run}번째 플레이`}</p>
      {room.credentials.length > 0 && <><h3>모은 자격</h3><ul>{room.credentials.map(c => <li key={c.id}>{c.name} {c.kind}</li>)}</ul></>}
      <h3>전문 분야</h3><ul className="room-fields">{fields.map(f => { const completed = firstAchievement(records, fieldKey(specialty, f.id, true)); const started = firstAchievement(records, fieldKey(specialty, f.id)); return <li key={f.id}><span>{f.name}</span><small>{completed ? '수련 완료' : started ? '수련 경험' : '미경험'}</small></li>; })}</ul>
    </div>
  </dialog>;
}
