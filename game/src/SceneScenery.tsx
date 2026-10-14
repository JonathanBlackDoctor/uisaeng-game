import ProfessionEquipment from './ProfessionEquipment';
import { PROFESSION_SPECIALTIES } from './professions';
import { RoomDesign, ClinicalStorage, OutdoorDesign, type DesignVariant } from './SceneDesign';
import type { SceneRoom } from './scene-state';

export type VisualRoom = SceneRoom | 'barracks' | 'military-clinic' | 'public-health';
type Equipment = 'chart' | 'surgical' | 'toys' | 'ultrasound' | 'counseling' | 'mobility' | 'eye' | 'scope' | 'skin' | 'imaging' | 'monitor' | 'microscope' | 'community' | 'safety';
// Visual motifs, not a clinical simulation. Medical visuals stay keyed by their original IDs.
export const SPECIALTY_VISUALS: Record<string, { equipment: Equipment; motif: 'heart' | 'brain' | 'lung' | 'bone' | 'cells' | 'general'; color: string }> = {
  internal: { equipment: 'chart', motif: 'heart', color: '#789b92' },
  surgery: { equipment: 'surgical', motif: 'general', color: '#5f8c89' },
  pediatrics: { equipment: 'toys', motif: 'general', color: '#c49a61' },
  obgyn: { equipment: 'ultrasound', motif: 'general', color: '#b08d9a' },
  psychiatry: { equipment: 'counseling', motif: 'general', color: '#a6a07c' },
  orthopedics: { equipment: 'mobility', motif: 'bone', color: '#8b9caf' },
  neurosurgery: { equipment: 'surgical', motif: 'brain', color: '#8498a9' },
  thoracic: { equipment: 'surgical', motif: 'heart', color: '#a88078' },
  plastic: { equipment: 'surgical', motif: 'cells', color: '#b29483' },
  ophthalmology: { equipment: 'eye', motif: 'general', color: '#7796a3' },
  ent: { equipment: 'scope', motif: 'general', color: '#8da78c' },
  dermatology: { equipment: 'skin', motif: 'cells', color: '#b5907a' },
  urology: { equipment: 'ultrasound', motif: 'cells', color: '#899bba' },
  radiology: { equipment: 'imaging', motif: 'bone', color: '#798da3' },
  radiation: { equipment: 'imaging', motif: 'cells', color: '#9d88a6' },
  anesthesia: { equipment: 'monitor', motif: 'heart', color: '#76a19d' },
  neurology: { equipment: 'chart', motif: 'brain', color: '#9b8aaa' },
  rehabilitation: { equipment: 'mobility', motif: 'general', color: '#a9a072' },
  tuberculosis: { equipment: 'chart', motif: 'lung', color: '#86a5a1' },
  laboratory: { equipment: 'microscope', motif: 'cells', color: '#8796b0' },
  pathology: { equipment: 'microscope', motif: 'general', color: '#b093a5' },
  preventive: { equipment: 'community', motif: 'general', color: '#8ba082' },
  family: { equipment: 'chart', motif: 'general', color: '#a7a079' },
  occupational: { equipment: 'safety', motif: 'lung', color: '#baa071' },
  nuclear: { equipment: 'imaging', motif: 'heart', color: '#829cab' },
  emergency: { equipment: 'monitor', motif: 'general', color: '#b98679' },
};

function Books({ x, y, count = 6 }: { x: number; y: number; count?: number }) {
  return <g transform={`translate(${x} ${y})`}>
    {Array.from({ length: count }, (_, n) => <g key={n} transform={`translate(${n * 20} 0)`}>
      <rect y={n % 3 * 4} width="15" height={48 - n % 3 * 4} rx="2" fill={['#9d7965', '#879581', '#8a9daa', '#b4a37d'][n % 4]}/>
      <path d="M3 37h9m-9 4h9" stroke="#eee6d1" strokeWidth="2" opacity=".65"/>
    </g>)}
  </g>;
}

for (const s of PROFESSION_SPECIALTIES) SPECIALTY_VISUALS[s.id] = { equipment: s.profession === 'dentistry' ? 'surgical' : s.profession === 'nursing' ? 'monitor' : 'chart', motif: 'general', color: s.profession === 'dentistry' ? '#789f9d' : s.profession === 'nursing' ? '#819faf' : '#a38e71' };

export function Anatomy({ motif }: { motif: string }) {
  if (motif === 'heart') return <path d="M-24-8C-30-31-3-34 0-18 13-41 40-21 24-1L0 25Z" fill="#bb8b83" stroke="#976e69" strokeWidth="2"/>;
  if (motif === 'brain') return <g fill="#b7a1b6" stroke="#8f7f9d" strokeWidth="2"><path d="M0-25C-22-39-37-9-27 3-33 23-9 33 0 21 18 35 36 16 28 1 39-22 13-37 0-25Z"/><path d="M0-23v46M-19-16l11 9-10 15M18-15 8-4l12 13" fill="none"/></g>;
  if (motif === 'lung') return <g fill="#bfa29a" stroke="#917e78" strokeWidth="2"><path d="M-5-22Q-32-25-30 25q19 4 25-13ZM5-22Q32-25 30 25Q11 29 5 12Z"/><path d="M0-34v28m0-3L-18 7M0-9 18 7" fill="none"/></g>;
  if (motif === 'bone') return <path d="M-15-26q-18-11-16 6 0 9 13 9l29 27q-2 19 10 16 14 1 9-13 11-17-7-16L-7-19q1-16-8-7Z" fill="#dfd8bc" stroke="#aaa88e" strokeWidth="2"/>;
  if (motif === 'cells') return <g>{[[-18, -15], [17, -10], [-5, 19]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="15" fill="#d8bdc2" stroke="#b590a5" strokeWidth="2"/><circle cx={x + 3} cy={y} r="5" fill="#9d8caa"/></g>)}</g>;
  return <g fill="none" stroke="#9bac96" strokeWidth="4"><circle cy="-24" r="9"/><path d="M0-14v33m-21-20h42M0 19l-15 19m15-19 15 19"/></g>;
}

export function SeasonalDetails({ season, outdoor = false }: { season: number; outdoor?: boolean }) {
  return <g className="ls-season-details" data-season-art={season}>
    {season === 0 && <g fill="#eac6c5">{[[592, 147], [625, 122], [641, 155], [602, 175], [622, 161]].map(([x, y]) => <g key={x} transform={`translate(${x} ${y})`}><circle r="8"/><circle cx="5" cy="-4" r="5"/><circle cx="-4" cy="-5" r="5"/><circle r="2" fill="#b59b6b"/></g>)}</g>}
    {season === 1 && <g fill="none" stroke="#698c82" strokeWidth="2"><path d="M464 131q6-6 12 0 6-6 12 0m51-43q5-5 10 0 5-5 10 0"/></g>}
    {season === 2 && <g fill="#b78a58">{[0, 1, 2, 3].map(n => <path className="ls-falling-leaf" key={n} d={`M${465 + n * 42} ${166 + n % 2 * 34}q14-12 19 1-13 12-19-1Z`}/>)}</g>}
    {season === 3 && <g fill="#f9faf5"><path d="M418 222q45-15 87 0t81-3 95 5v28H418Z"/>{[0, 1, 2, 3, 4, 5].map(n => <circle className="ls-snow" key={n} cx={452 + n * 37} cy={77 + n % 3 * 46} r="3"/>)}</g>}
    {outdoor && <g fill={season === 3 ? '#f5f6ee' : season === 2 ? '#cfb184' : '#a6b69a'}><path d="M0 312q115-38 216 0t221 0 190-4 173 0v148H0Z"/></g>}
  </g>;
}

export function OutdoorBackdrop({ room, season, variant = 0 }: { room: 'campus' | 'park'; season: number; variant?: DesignVariant }) {
  return <g data-backdrop={room}>
    <rect width="800" height="460" fill="var(--ls-sky)"/>
    <circle cx="610" cy="80" r="29" fill="#fff3cf"/>
    {variant > 0 ? <OutdoorDesign room={room} variant={variant}/> : room === 'campus' ? <g>
      <path d="M98 115h286v192H98Z" fill="#d1bca7"/><path d="M87 115 240 68l155 47Z" fill="#a28c7b"/>
      {[0, 1, 2, 3, 4, 5].map(n => <g key={n}><rect x={119 + n * 43} y="140" width="24" height="39" fill="#eaf0e6"/><rect x={119 + n * 43} y="203" width="24" height="39" fill="#eaf0e6"/></g>)}
      <path d="M207 307v-48h55v48" fill="#8b9e97"/><path d="M88 305h306" stroke="#b4a18e" strokeWidth="10"/>
    </g> : <g><path d="M97 303V172m0 67-27-27m27-12 28-30" stroke="#899075" strokeWidth="9"/><path d="M36 192q-20-68 62-74 78 4 60 81-64 43-122-7Z" fill="var(--ls-leaf)"/><path d="M53 315h188m-167 0v47m143-47v47" stroke="#9f9076" strokeWidth="9"/><path d="M56 273h180v31H56Z" fill="#b7a184"/></g>}
    <path d="M635 319V147m0 82-29-25m29-3 27-25" fill="none" stroke="#83917a" strokeWidth="8"/>
    <path className="ls-outdoor-canopy ls-loop" d="M569 203q-24-68 66-82 94 9 66 93-67 33-132-11Z" fill="var(--ls-leaf)"/>
    <SeasonalDetails season={season} outdoor/>
    <path d="M280 320h190l164 140H126Z" fill="#e4ddc9"/>
    <path d="M257 354h266m-307 39h353" stroke="#cdc5b0" strokeWidth="2"/>
    <g fill={season === 0 ? '#d9a2ac' : '#d4c590'}>{[0, 1, 2, 3, 4].map(n => <circle key={n} cx={650 + n * 18} cy={359 + n % 2 * 7} r="5"/>)}</g>
  </g>;
}

export function ClinicalEquipment({ equipment }: { equipment: Equipment }) {
  return <g data-equipment={equipment} transform="translate(595 230)">
    {['chart', 'monitor', 'ultrasound', 'imaging', 'eye', 'scope', 'skin', 'safety', 'microscope', 'community', 'toys'].includes(equipment) && <g><rect x="-15" y="83" width="133" height="13" rx="4" fill="#b5c8bf"/><path d="M-5 96v43m113-43v43" stroke="#8da49b" strokeWidth="7"/></g>}
    {(equipment === 'monitor' || equipment === 'ultrasound') && <g><rect x="1" y="-3" width="98" height="66" rx="7" fill="#718c8a"/><rect x="8" y="4" width="84" height="50" rx="3" fill="#344d50"/>
      {equipment === 'monitor' ? <path className="ls-monitor-trace" d="M13 32h13l7-13 8 26 9-35 9 22h27" stroke="#a7d6b3" fill="none" strokeWidth="3"/> : <><path d="M50 11 17 46q30 17 65 0Z" fill="#adbcb6"/><path className="ls-ultrasound-sweep ls-loop" d="M50 13v39" stroke="#edf3e7" strokeWidth="3"/></>}<path d="M49 63v18m-25 0h51" stroke="#718c8a" strokeWidth="5"/>
      {equipment === 'ultrasound' && <path d="M99 35q26 0 10 47m-6-5 12 7" stroke="#8d9b96" strokeWidth="5" fill="none"/>}
    </g>}
    {equipment === 'surgical' && <g><path d="M47-133v45m0-45h-45" stroke="#8fa7a0" strokeWidth="6"/><ellipse cx="47" cy="-74" rx="49" ry="23" fill="#b9d1c7"/>{[-22, 0, 22].map(x => <circle key={x} cx={47 + x} cy="-74" r="8" fill="#f9fbde"/>)}<rect x="-6" y="78" width="112" height="12" rx="5" fill="#b3c8c1"/><path d="M50 90v43m-33 0h66" stroke="#8fa7a0" strokeWidth="6"/><path d="M10 71h30m10 0h23m9-6v12" stroke="#7c9692" strokeWidth="3"/></g>}
    {equipment === 'toys' && <g><path d="M0-18h88" stroke="#b79e74" strokeWidth="3"/>{[0, 1, 2].map(n => <g key={n} transform={`translate(${15 + n * 30} 0)`}><g className="ls-mobile-toy ls-loop" style={{ animationDelay: `${-n * 1.6}s` }}><path d={`M0-18v${22 + n % 2 * 14}`} stroke="#b79e74" strokeWidth="2"/><circle cx="0" cy={13 + n % 2 * 14} r="11" fill={['#b8cfa8', '#dbb6a9', '#bdc6dc'][n]}/></g></g>)}<rect x="2" y="61" width="23" height="22" rx="3" fill="#ce9b78"/><rect x="29" y="60" width="23" height="23" rx="3" fill="#8caac0"/><path d="m29 58 12-21 12 21Z" fill="#bdbe83"/><circle cx="80" cy="68" r="15" fill="#ddc48d"/></g>}
    {equipment === 'counseling' && <g><rect x="-8" y="0" width="113" height="105" rx="27" fill="#b9b8a1"/><rect x="-17" y="60" width="132" height="49" rx="16" fill="#a5a78e"/><path d="M0 109v26m97-26v26" stroke="#8a927d" strokeWidth="7"/><rect x="11" y="20" width="61" height="43" rx="11" fill="#ded5bc"/></g>}
    {equipment === 'mobility' && <g stroke="#94aaa0" strokeWidth="7" fill="none"><path d="M-12 35h125M-4 36v96m108-96v96M10 4h88m-77 0v123m66-123V4"/><path d="m30-38 12 167m43-167-12 167M29-25h17m24 0h17" stroke="#b4a18b" strokeWidth="5"/></g>}
    {equipment === 'imaging' && <g><rect x="-8" y="-54" width="117" height="126" rx="5" fill="#60767d"/><rect x="0" y="-46" width="101" height="109" fill="#d6e0dc"/><g transform="translate(51 4)"><Anatomy motif="lung"/></g><path className="ls-imaging-scan ls-loop" d="M4-40h93" stroke="#f4fbef" strokeWidth="5"/><path d="M48 72v10" stroke="#72898b" strokeWidth="6"/></g>}
    {equipment === 'microscope' && <g><path d="M22 79h70M66 76q34-27-4-53M51 21l15 9" stroke="#738d96" strokeWidth="11" fill="none"/><path d="m32-8 19-9 23 39-19 10Z" fill="#9cb4b9"/><path d="m30-9 23-13" stroke="#617b88" strokeWidth="7"/><path d="M29 54h47" stroke="#789591" strokeWidth="6"/><circle cx="81" cy="48" r="8" fill="#b7c8c3"/></g>}
    {equipment === 'eye' && <g><rect x="0" y="-62" width="82" height="79" rx="4" fill="#f8f6e9"/>{[0, 1, 2].map(n => <path key={n} d={`M${22 - n * 5} ${-44 + n * 18}h${37 + n * 6}`} stroke="#596c68" strokeWidth={6 - n}/>)}<path d="M50 83V40m-20 0h49m-28 0 11-18" stroke="#789291" strokeWidth="7"/><circle cx="61" cy="23" r="12" fill="#afc3c2"/></g>}
    {equipment === 'scope' && <g><path d="M28 82V6m0 17h30m0 0v24q0 22 27 21" stroke="#8fa7a2" strokeWidth="7" fill="none"/><circle cx="27" cy="0" r="23" fill="#c7d7cc"/><circle cx="27" cy="0" r="13" fill="#f4f3d9"/><rect x="73" y="52" width="23" height="25" rx="5" fill="#839b97"/></g>}
    {equipment === 'skin' && <g><rect x="-2" y="-34" width="105" height="89" rx="6" fill="#f7efe3"/>{[0, 1, 2, 3].map(n => <path key={n} d={`M7 ${-19 + n * 17}q22-9 45 0t43 0v14H7Z`} fill={['#d7ba99', '#c79d8c', '#ad8a89', '#c1a3a1'][n]}/>)}<path d="M36 80h44" stroke="#8da09a" strokeWidth="5"/></g>}
    {equipment === 'safety' && <g><path d="M5 51q0-52 40-52t40 52Z" fill="#d4b56c"/><path d="M-2 53h94M45-1v47" stroke="#b59853" strokeWidth="6"/><rect x="12" y="65" width="74" height="17" rx="7" fill="#a4c2c4"/></g>}
    {equipment === 'community' && <g><rect x="-11" y="-61" width="117" height="127" rx="4" fill="#faf6e9"/><path d="m5-33 33-16 19 21 32-4-4 71-30 12-26-21-24 5Z" fill="#b1c4a2"/><path d="m12-21 61 54M39-37l-8 61" stroke="#f3ecd6" strokeWidth="5"/>{[[24,-10],[67,12],[39,38]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="5" fill="#ba8f72"/>)}</g>}
    {equipment === 'chart' && <g><rect x="-8" y="-2" width="117" height="80" rx="5" fill="#ced8c8"/><path d="M3 17h93M4 46h92m-63-38v62" stroke="#f8f8ee" strokeWidth="3"/><path d="M45 28h38m-38 29h38" stroke="#8fa38e" strokeWidth="4"/></g>}
  </g>;
}

export function RoomFurniture({ room, specialty, children, exercise, extraStudy, retired, variant = 0 }: { variant?: DesignVariant; room: VisualRoom; specialty?: string; children: string; exercise?: boolean; extraStudy?: boolean; retired: boolean }) {
  const clinical = ['ward', 'clinic', 'military-clinic', 'public-health'].includes(room);
  const design = specialty ? SPECIALTY_VISUALS[specialty] : undefined;
  return <g className="ls-room-furniture" data-scenery={room}>
    <RoomDesign room={room} variant={variant}/>
    {room === 'research' && variant > 0 && <ClinicalEquipment equipment="microscope"/>}
    {room === 'library' && variant === 0 && <g>
      <rect x="85" y="70" width="207" height="242" rx="4" fill="#c9b89c"/>
      {[91, 165, 239].map(y => <g key={y}><Books x={103} y={y} count={9}/><path d={`M94 ${y + 52}h190`} stroke="#a6947c" strokeWidth="7"/></g>)}
      <path d="M574 311h144m-130 0v58m116-58v58" stroke="#a99e86" strokeWidth="8"/><Books x={589} y={261} count={5}/>
    </g>}
    {room === 'preparation' && variant === 0 && <g>
      <rect x="95" y="69" width="188" height="139" rx="5" fill="#c9b799" stroke="#ab987d" strokeWidth="5"/>
      {[0,1,2,3].map(n => <g key={n} transform={`translate(${111 + n % 2 * 84} ${87 + Math.floor(n/2)*55})`}><rect width="61" height="43" rx="2" fill={n%2 ? '#e9e2bc' : '#f7f1de'}/><path d="M9 14h39m-39 9h29" stroke="#afa387" strokeWidth="3"/><circle cx="30" cy="3" r="3" fill="#a47868"/></g>)}
      <rect x="578" y="281" width="139" height="62" rx="4" fill="#c8b69c"/><Books x={589} y={233}/><path d="M592 344v23m111-23v23" stroke="#9d927e" strokeWidth="6"/>
    </g>}
    {room === 'research' && variant === 0 && <g>
      <rect x="92" y="72" width="188" height="112" rx="5" fill="#f5f6ed" stroke="#b7c4c2" strokeWidth="4"/>
      <path d="M112 160V95m0 65h145m-133-14 28-18 22 9 27-30 36 6" fill="none" stroke="#829c9d" strokeWidth="3"/>
      <path d="M102 288h170m-155 0v68m136-68v68" stroke="#8fa09b" strokeWidth="7"/>
      {[0,1,2].map(n => <g key={n} transform={`translate(${130+n*43} 231)`}><path d="M-7-18h14m-10 0v18L-17 35q17 7 34 0L3 0v-18" fill="#d8e6df" stroke="#88a8a4" strokeWidth="2"/><path d="m-9 20-7 14q16 6 32 0l-7-14Z" fill={n%2 ? '#d1b3a5' : '#a5c5ba'}/></g>)}
      <ClinicalEquipment equipment="microscope"/>
    </g>}
    {clinical && <g data-specialty-art={design ? specialty : undefined}>
      <rect x="97" y="74" width="166" height="128" rx="4" fill="#f7f7ee" stroke={design?.color ?? '#b5c6ba'} strokeWidth="5"/>
      <g transform="translate(180 137)"><Anatomy motif={design?.motif ?? 'general'}/></g>
      {variant > 0 ? <ClinicalStorage variant={variant}/> : <><rect x="93" y="241" width="167" height="101" rx="5" fill="#f1f4e9"/><path d="M97 276h159m-159 32h159m-94-55h29m-29 36h29m-29 33h29" stroke="#b6c9bc" strokeWidth="3"/></>}
      {room === 'military-clinic' && <g><rect x="114" y="211" width="58" height="28" rx="4" fill="#737f61"/><path d="M143 216v18m-9-9h18" stroke="#f2f1dc" strokeWidth="4"/></g>}
      {specialty?.includes(':') ? <ProfessionEquipment specialty={specialty}/> : <ClinicalEquipment equipment={room === 'public-health' ? 'community' : design?.equipment ?? (room === 'ward' ? 'monitor' : 'chart')}/>}
    </g>}
    {room === 'home' && variant === 0 && <g>
      <rect x="106" y="91" width="128" height="95" rx="3" fill="#fbf6e8" stroke="#c7b398" strokeWidth="5"/><path d="m118 172 35-39 25 23 43-47v63Z" fill="#b0b698"/><circle cx="140" cy="116" r="10" fill="#dbc78d"/>
      <ellipse cx="400" cy="364" rx="210" ry="37" fill="#d7c5b1" opacity=".55"/>
      <path d="M225 348v22m133-22v22" stroke="#958675" strokeWidth="7"/><rect x="213" y="264" width="160" height="84" rx="22" fill="#b9bca7"/><rect x="207" y="305" width="171" height="46" rx="15" fill="#aab29a"/>
      <rect x="225" y="276" width="45" height="37" rx="9" fill="#dacbb3"/><path d="M314 276h44v72h-44Z" fill="#9da997"/>
      <path d="M667 327V174m-23 154h47" stroke="#b19a7c" strokeWidth="6"/><path d="m638 137 56 0 17 46h-91Z" fill="#e5d2ab"/>
      {retired && <g data-prop="retirement-books"><Books x={96} y={280} count={5}/><path d="M86 333h120" stroke="#b6a486" strokeWidth="7"/></g>}
    </g>}
    {room === 'lounge' && variant === 0 && <g>
      <rect x="100" y="85" width="151" height="94" rx="4" fill="#b4bea8"/><path d="M112 97h127v70H112Z" fill="#e4e8d9"/><path d="m122 149 27-26 28 17 49-31" fill="none" stroke="#a5b598" strokeWidth="6"/>
      <path d="M92 293h171m-161 0v70m151-70v70" stroke="#a99b82" strokeWidth="8"/><rect x="120" y="214" width="68" height="74" rx="7" fill="#84958c"/><path d="M133 242h43v20h-43Z" fill="#dce1d5"/><path d="M149 269h19v15h-19Z" fill="#f5f0e0"/>
      <rect x="211" y="269" width="25" height="20" rx="4" fill="#d1be99"/>
      <rect x="568" y="285" width="145" height="62" rx="20" fill="#bac1a7"/><path d="M585 347v21m111-21v21" stroke="#94a087" strokeWidth="6"/>
    </g>}
    {room === 'home' && variant > 0 && retired && <g data-prop="retirement-books"><Books x={96} y={280} count={5}/><path d="M86 333h120" stroke="#b6a486" strokeWidth="7"/></g>}
    {(room === 'home' || room === 'lounge') && children === 'young' && <g data-prop="child-toys"><rect x="561" y="378" width="25" height="24" rx="4" fill="#c9a078"/><rect x="589" y="386" width="22" height="17" rx="3" fill="#95b3b7"/><path d="m562 374 12-21 13 21Z" fill="#b6bc8c"/></g>}
    {(room === 'home' || room === 'lounge') && children === 'school' && <g data-prop="school-bag"><rect x="618" y="344" width="46" height="57" rx="12" fill="#9bacb4"/><path d="M629 345v-10h23v10" stroke="#7c939d" strokeWidth="5" fill="none"/><rect x="626" y="370" width="29" height="21" rx="5" fill="#bac8c7"/></g>}
    {room === 'home' && exercise && <g data-prop="exercise-kit"><rect x="96" y="373" width="105" height="14" rx="7" fill="#9caeaa"/><path d="M124 361h35m-35-6v12m35-12v12" stroke="#778d89" strokeWidth="8"/></g>}
    {room === 'home' && extraStudy && <g data-prop="study-books"><Books x={94} y={222} count={5}/><path d="M86 274h120" stroke="#b6a486" strokeWidth="6"/></g>}
  </g>;
}
