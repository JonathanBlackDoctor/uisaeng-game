import { useState } from 'react';
import { SPECIALTIES } from './career';
import { CREDENTIALS, specialtyFields } from './credential-catalog';
import { credentialKey, fieldKey, firstAchievement, specialtyKey, type CareerRecord } from './career-records';
import './career-collection.css';
import ClinicRoom, { clinicRoom } from './ClinicRoom';
import ClinicRoomDetail from './ClinicRoomDetail';

export default function CareerCollection({ records }: { records: CareerRecord[] }) {
  const [tab, setTab] = useState<'specialties' | 'credentials' | 'fields'>('specialties');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const has = (key: string) => !!firstAchievement(records, key);
  const trained = SPECIALTIES.filter(s => has(specialtyKey(s.id))).length;
  const qualified = SPECIALTIES.filter(s => has(specialtyKey(s.id, true))).length;
  const credentials = CREDENTIALS.filter(c => has(credentialKey(c.id))).length;
  const internal = CREDENTIALS.filter(c => c.id.startsWith('internal-'));
  const internalCount = internal.filter(c => has(credentialKey(c.id))).length;
  const note = (key: string) => { const first = firstAchievement(records, key); return first ? `첫 달성 · ${first.run}번째 플레이` : '아직 기록 없음'; };
  const visible = (name: string, achieved: boolean) => name.includes(query.trim()) && (filter === 'all' || (filter === 'achieved') === achieved);
  const rows = tab === 'specialties' ? SPECIALTIES.map(s => {
    const trainedKey = specialtyKey(s.id), qualifiedKey = specialtyKey(s.id, true);
    return { id: s.id, name: s.name, achieved: has(trainedKey), status: has(qualifiedKey) ? '전문의 취득' : has(trainedKey) ? '수련 경험' : '미경험', detail: note(has(qualifiedKey) ? qualifiedKey : trainedKey), source: undefined as string | undefined };
  }) : tab === 'credentials' ? CREDENTIALS.map(c => ({
    id: c.id, name: `${c.name} ${c.kind}`, achieved: has(credentialKey(c.id)), status: has(credentialKey(c.id)) ? '취득' : '미취득',
    detail: `${c.routes.map(r => SPECIALTIES.find(s => s.id === r.specialty)!.name).join(' · ')} → ${c.name} · ${note(credentialKey(c.id))}`, source: c.source,
  })) : SPECIALTIES.flatMap(s => specialtyFields(s.id).map(f => ({
    id: `${s.id}:${f.id}`, name: f.name, achieved: has(fieldKey(s.id, f.id)),
    status: has(fieldKey(s.id, f.id, true)) ? '수련 완료' : has(fieldKey(s.id, f.id)) ? '수련 경험' : '미경험',
    detail: `${s.name} · ${note(fieldKey(s.id, f.id))}`, source: undefined as string | undefined,
  })));
  const shown = rows.filter(row => visible(row.name, row.achieved));
  return <section className="panel career-collection" aria-label="진료실 도감">
    <div className="collection-room-count"><span>열어 본 진료실</span><strong>{trained} / {SPECIALTIES.length}</strong></div>
    <p className="collection-intro">새 게임을 시작해도 이 기기에 남습니다. {records.length}번의 플레이 · {records.filter(r => r.completed).length}번의 회고</p>
    <details className="collection-challenges"><summary>도전과제 · 전문의 {qualified} / {SPECIALTIES.length} · 자격 {credentials} / {CREDENTIALS.length}</summary><div className="collection-goals">
      {[['모든 전공 경험하기', trained, SPECIALTIES.length], ['모든 전공 전문의 되기', qualified, SPECIALTIES.length], ['내과 분과 모으기', internalCount, internal.length], ['분과·세부 자격 모으기', credentials, CREDENTIALS.length]].map(([label, value, total]) => <div key={label}>
        <span>{label}</span><strong>{value === total ? '달성' : `${value} / ${total}`}</strong><progress aria-label={String(label)} value={Number(value)} max={Number(total)}/>
      </div>)}
    </div></details>
    <div className="collection-tabs" aria-label="기록 종류">{([['specialties', '진료실'], ['credentials', '분과·세부 자격'], ['fields', '전문 분야']] as const).map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setQuery(''); }}>{label}</button>)}</div>
    {tab === 'credentials' && <p>확인된 {CREDENTIALS.length}개 자격 경로를 모읍니다. 수련을 마친 뒤 자격 심사까지 마쳐야 기록됩니다.</p>}
    {tab === 'fields' && <p>분야별 수련 경험입니다. 자격 취득 기록은 따로 모읍니다.</p>}
    <div className="collection-filters"><label>검색<input value={query} onChange={e => setQuery(e.target.value)} placeholder="과 또는 분야 이름"/></label><label>표시<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">전체</option><option value="achieved">기록 있음</option><option value="missing">기록 없음</option></select></label></div>
    {tab === 'specialties' ? <ul className="clinic-room-grid">{shown.map(row => {
      const room = clinicRoom(records, row.id);
      return <li key={row.id}><button onClick={() => setSelected(row.id)} aria-label={`${row.name} · ${row.status} · 자세히 보기`}>
        <ClinicRoom specialty={row.id} records={records}/><span className="room-name">{row.name}</span><span className="room-status">{row.status}{room.credentials.length > 0 && ` · 자격 ${room.credentials.length}`}</span>
      </button></li>;
    })}</ul> : <ul className="collection-list">{shown.map(row => <li key={row.id} className={row.achieved ? 'collected' : ''}><div><strong>{row.name}</strong><span>{row.status}</span></div><p>{row.detail}</p>{row.source && <a href={row.source} target="_blank" rel="noreferrer">자격 제도 확인</a>}</li>)}</ul>}
    {selected && <ClinicRoomDetail specialty={selected} records={records} onClose={() => setSelected(null)}/>}
    {!shown.length && <p className="empty">조건에 맞는 기록이 없습니다.</p>}
    <details className="collection-help"><summary>기록 기준</summary><p>지원과 견학은 수련 경험에 포함하지 않습니다. 전공 수련 이후 단계에 도달하면 전문의 취득으로 기록합니다. 자격시험은 게임 안에서 간소화했습니다.</p><p>이전 저장의 수련 경험은 반영하지만, 별도 자격 심사 기록이 없으면 분과·세부 자격 취득으로 소급하지 않습니다. 이 목록은 국내 모든 인증 자격의 목록이 아닙니다.</p><p>저장되지 않았거나 이미 지운 플레이는 복구할 수 없습니다. 브라우저 데이터를 지우기 전에는 원본을 백업해 주세요.</p></details>
  </section>;
}
