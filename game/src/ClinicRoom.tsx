import ProfessionEquipment from './ProfessionEquipment';
import { Anatomy, ClinicalEquipment, SPECIALTY_VISUALS } from './SceneScenery';
import { CREDENTIALS } from './credential-catalog';
import { credentialKey, fieldKey, specialtyKey, type CareerRecord } from './career-records';
import { NURSING_CERTIFICATES } from './professions';

export function clinicRoom(records: CareerRecord[], id: string) {
  const has = (key: string) => records.some(r => r.milestones[key] !== undefined);
  return {
    status: has(specialtyKey(id, true)) ? 'qualified' : has(specialtyKey(id)) ? 'training' : 'locked',
    // A shared certificate decorates only the specialty in which it was earned.
    credentials: id.startsWith('nursing:')
      ? NURSING_CERTIFICATES.filter(name => records.some(r => r.milestones[specialtyKey(id)] !== undefined && r.milestones[credentialKey(`nursing:${name}`)] !== undefined))
        .map(name => ({ id: `nursing:${name}`, name, kind: '전문간호사' }))
      : CREDENTIALS.filter(c => c.routes.some(route => route.specialty === id && records.some(r =>
        r.milestones[credentialKey(c.id)] !== undefined && r.milestones[fieldKey(id, route.field, true)] !== undefined))),
  } as const;
}
export default function ClinicRoom({ specialty, records }: { specialty: string; records: CareerRecord[] }) {
  const { status, credentials } = clinicRoom(records, specialty);
  const design = SPECIALTY_VISUALS[specialty];
  const opened = status !== 'locked', complete = status === 'qualified';
  return <svg className="clinic-room-art" viewBox="0 0 800 460" aria-hidden="true" data-room-state={status}>
    <rect x="18" y="12" width="764" height="423" rx="10" fill="#e9e8df"/>
    <path d="M40 36h720v303H40Z" fill={complete ? '#f7f3e7' : '#e0e4dd'}/>
    <path d="M40 339h720l22 72H18Z" fill={complete ? '#dfcfb7' : '#cbcfc5'}/>
    <path d="M40 36v303h720V36" fill="none" stroke={design.color} strokeWidth="8"/>
    <path d="M310 35h180l-28 16H337Z" fill={complete ? '#f2d68b' : '#b6c0b7'}/>
    {complete && <path d="m338 51-79 273h278L462 51Z" fill="#fff8d9" opacity=".32"/>}
    {opened ? <g opacity={complete ? 1 : .66}>
      <rect x="131" y="93" width="116" height="115" rx="3" fill="#faf9ef" stroke={design.color} strokeWidth="5"/>
      <g transform="translate(189 151)"><Anatomy motif={design.motif}/></g>
      <g transform="translate(-17 -7)">{specialty.includes(':') ? <ProfessionEquipment specialty={specialty}/> : <ClinicalEquipment equipment={design.equipment}/>}</g>
      {specialty === 'pediatrics' ? <g><rect x="175" y="279" width="222" height="42" rx="12" fill="#b8c8b0"/><rect x="181" y="268" width="60" height="20" rx="6" fill="#fbf8e8"/><path d="M185 321v49m200-49v49" stroke="#9f9987" strokeWidth="9"/></g>
        : <g><path d="M160 279h243v19H160Z" fill="#c2a88a"/><path d="M177 298v72m209-72v72" stroke="#a28f78" strokeWidth="9"/><rect x="215" y="223" width="90" height="54" rx="4" fill="#8ba6a1"/><rect x="222" y="230" width="76" height="37" rx="2" fill="#e3ece2"/><path d="M246 278h40" stroke="#627f7b" strokeWidth="6"/></g>}
      {complete && <g><rect x="307" y="101" width="57" height="72" rx="2" fill="#fbf4dd" stroke="#bca46b" strokeWidth="5"/><path d="M319 120h32m-32 10h32m-32 10h24" stroke="#b6ab91" strokeWidth="3"/><circle cx="337" cy="157" r="7" fill="#ac9360"/></g>}
      {credentials.slice(0, 10).map((c, i) => <g key={c.id} transform={`translate(${383 + i % 5 * 33} ${104 + Math.floor(i / 5) * 45})`}><rect width="24" height="31" rx="2" fill="#f8edc9" stroke="#b2955f" strokeWidth="3"/><circle cx="12" cy="13" r="5" fill={design.color}/><path d="M7 24h10" stroke="#b2955f" strokeWidth="2"/></g>)}
    </g> : null}
    {!complete && <g>
      <path d={opened ? 'M43 40 154 70v299L43 337Z' : 'M282 72h236v267H282Z'} fill={opened ? design.color : '#b7c0b5'} stroke="#8f9e92" strokeWidth="5"/>
      {opened ? <path d="M129 203v27" stroke="#ece9da" strokeWidth="7"/> : <><rect x="323" y="113" width="154" height="60" rx="4" fill="#e8ece3"/><path d="M384 130v27m-14-14h28" stroke={design.color} strokeWidth="7"/><path d="M485 223v27" stroke="#f4f0dc" strokeWidth="7"/></>}
    </g>}
    <path d="M18 413h764v22H18Z" fill={design.color}/>
  </svg>;
}
