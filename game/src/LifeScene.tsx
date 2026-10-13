import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { sceneRoom, seasonIndex, type NotebookState, type SceneActivity } from './scene-state';
import './life-scene.css';
import type { ServiceRoute } from './identity';
import { OutdoorBackdrop, RoomFurniture, SeasonalDetails, SPECIALTY_VISUALS } from './SceneScenery';

export interface LifeSceneProps {
  stage: 'university' | 'training' | 'career' | 'retirement';
  age: number;
  month: number;
  running: boolean;
  focus: SceneActivity;
  seed: number;
  relationship: 'single' | 'dating' | 'married';
  partnerName?: string;
  children?: 'none' | 'young' | 'school' | 'adult';
  eventTitle?: string;
  workContext?: 'research' | 'preparation';
  reaction?: 'learning' | 'connection' | 'rest' | null;
  companionName?: string;
  notebook?: NotebookState;
  guestName?: string;
  awaitingChoice?: boolean;
  serviceRoute?: ServiceRoute;
  specialty?: string;
  exercise?: boolean;
  extraStudy?: boolean;
}

const ROOMS = {
  campus: { title: '캠퍼스', accent: '#85966c', wall: '#e9eddb', label: '수업 사이의 여유' },
  park: { title: '공원', accent: '#859c7b', wall: '#e7edde', label: '동네에서 쉬어 가는 중' },
  'military-clinic': { title: '군 진료실', accent: '#788967', wall: '#e0e6d8', label: '진료실에서' },
  'public-health': { title: '보건지소', accent: '#879e7c', wall: '#e9ecdd', label: '지역의 진료실에서' },
  barracks: { title: '부대 생활관', accent: '#59684c', wall: '#dfe3d7', label: '생활관에서' },
  library: { title: '열람실', accent: '#b48a43', wall: '#f0eee7', label: '책을 펼쳐 둔 오후' },
  ward: { title: '병동', accent: '#517f80', wall: '#e8eeeb', label: '차트를 확인하는 중' },
  clinic: { title: '진료실', accent: '#577f79', wall: '#e9eeea', label: '일터에서' },
  research: { title: '연구실', accent: '#6c799a', wall: '#e9ebef', label: '자료를 살펴보는 중' },
  preparation: { title: '작업 공간', accent: '#a18356', wall: '#efede7', label: '다음 지원을 준비하며' },
  home: { title: '집', accent: '#b77a60', wall: '#f1eae3', label: '잠깐 쉬어 가는 중' },
  lounge: { title: '휴게 공간', accent: '#7d8a60', wall: '#eceee5', label: '일상 사이의 여유' },
};
const SEASONS = [
  { name: '봄', sky: '#dce7df', leaf: '#9eb69b' },
  { name: '여름', sky: '#cddfe4', leaf: '#78998a' },
  { name: '가을', sky: '#e8d9c6', leaf: '#c49d70' },
  { name: '겨울', sky: '#dce2e8', leaf: '#b6c4c5' },
];
const SKINS = ['#d9ad8e', '#b78063', '#e3bda2', '#956d59'];
type Vars = CSSProperties & Record<`--${string}`, string | number>;

// Sample the latest season on a wall-clock cadence. Fast-forward never queues
// intermediate seasons; the actual date remains in the game's time ribbon.
function useAmbientSeason(month: number, running: boolean) {
  const target = seasonIndex(month);
  const latest = useRef(target);
  latest.current = target;
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (!running) { setShown(latest.current); return; }
    const timer = window.setInterval(() => setShown(latest.current), 3000);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => { if (!running) setShown(target); }, [target, running]);
  return { ...SEASONS[shown], index: shown };
}

function useStoryGuest(name: string | undefined, notebook: NotebookState) {
  const [shown, setShown] = useState(name);
  const previous = useRef(notebook);
  useEffect(() => {
    const wasOffered = previous.current === 'offered';
    previous.current = notebook;
    if (name) { setShown(name); return; }
    if (wasOffered && notebook === 'kept') {
      const timer = window.setTimeout(() => setShown(undefined), 2800);
      return () => window.clearTimeout(timer);
    }
    setShown(undefined);
  }, [name, notebook]);
  return shown;
}

function Actor({ x, scale = 1, palette, older = false, medical = false, military = false, visible = true, pose = 'study', identity, facing = 1, outfit = 'casual', season = 0 }: {
  x: number; scale?: number; palette: number; older?: boolean; medical?: boolean;
  visible?: boolean; pose?: SceneActivity | 'wait'; identity: string; facing?: number; military?: boolean;
  outfit?: 'casual' | 'hoodie' | 'cardigan' | 'scrubs' | 'lab-coat'; season?: number;
}) {
  const previousX = useRef(x);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (previousX.current === x) return;
    previousX.current = x;
    setMoving(true);
    const timer = window.setTimeout(() => setMoving(false), 850);
    return () => window.clearTimeout(timer);
  }, [x]);
  const leaning = pose === 'rest' ? -8 : pose === 'study' ? 7 : 0;
  return <g className="ls-actor-position" data-actor={identity} data-outfit={military ? 'military-tracksuit' : medical && outfit === 'casual' ? 'medical' : outfit} data-pose={pose} data-moving={moving} style={{ transform: `translate(${x}px, 350px)`, opacity: visible ? 1 : 0 }}>
    <g style={{ transform: `scale(${scale * facing}, ${scale})` }}>
      <ellipse cy="19" rx="35" ry="7" fill="#273e38" opacity=".09" />
      <g className="ls-legs" fill="none" stroke={military ? '#303d43' : '#344441'} strokeWidth="15" strokeLinecap="round">
        <g className="ls-leg-left"><path d="M-11-40 -18-13 -12 13" /><path d="M-16 14h20" strokeWidth="9" /></g>
        <g className="ls-leg-right"><path d="M10-40 26-12 23 13" /><path d="M20 14h19" strokeWidth="9" /></g>
      </g>
      <g className="ls-torso-pose" style={{ transform: `rotate(${leaning}deg)` }}>
        <g className="ls-breath">
          <path className="ls-shirt" d="M-26-108 Q0-120 26-108 L31-43 Q0-33-30-43Z" fill="var(--ls-sleeve)" />
          {!military && <g className="ls-outfit-details" fill="none" stroke={outfit === 'scrubs' ? '#c4ddd1' : '#dce2d2'} strokeWidth="2.5">
            {outfit === 'hoodie' && <><path d="M-17-107q17 21 34 0M-8-100v21m16-21v21M-14-62h28v12h-28Z"/><path d="M-24-108q-7-17 10-19h28q17 2 10 19"/></>}
            {outfit === 'cardigan' && <><path d="M-13-108 0-81l13-27M0-81v37"/>{[-73,-62,-51].map(y => <circle key={y} cx="4" cy={y} r="1.4" fill="#e4dbc7" stroke="none"/>)}</>}
            {outfit === 'scrubs' && <><path d="m-12-108 12 17 12-17M11-87h13v12H11Z"/><path d="M-22-49h44" opacity=".5"/></>}
            {outfit === 'lab-coat' && <path d="m-11-109 11 24 11-24M0-85v41m-21-24h13v14h-13m21-32h15v12H13Z" stroke="#a8bab6"/>}
            {outfit === 'casual' && !medical && season === 1 && <path d="M-23-86h46m-47 9h48" opacity=".55"/>}
          </g>}
          {military && <g className="ls-tracksuit-details" fill="none" stroke="#d6dcd7" strokeWidth="3">
            <path d="M-24-94h48M0-108v64"/><path d="M-11-110 0-101 11-110"/>
            <path d="M12-84h10" stroke="#bcc6ab" strokeWidth="5"/>
          </g>}
          <path d="M-6-121v16q6 8 12 0v-16" fill={SKINS[palette]} />
          <g className="ls-head-pose" style={{ transform: `rotate(${pose === 'study' ? 9 : pose === 'connect' ? -6 : 0}deg)` }}>
            <rect x="-20" y="-162" width="40" height="48" rx="19" fill={SKINS[palette]} />
            <path d="M-21-140v-12q0-25 24-23 23 1 20 29l-9-11q-11 12-32 6v15Z" fill={older ? '#b2b2a8' : '#343d3b'} />
            <g className="ls-eyes" fill="#303936"><circle cx="-5" cy="-140" r="1.8"/><circle cx="10" cy="-140" r="1.8"/></g>
            <path d="M1-126q4 3 8-1" fill="none" stroke="#805f4c" strokeWidth="1.7" strokeLinecap="round" />
          </g>
          <g className="ls-coat-details" style={{ opacity: medical ? 1 : 0 }} fill="none" stroke="#698c85" strokeWidth="2">
            <path d="m-10-105 10 17 10-17M0-88v42M-14-100v20q0 12 10 10t10-11"/><circle cx="7" cy="-82" r="4"/><path d="M14-86h12v12H14z" fill="#c1d4cb" stroke="none"/>
          </g>
          <g className="ls-arm-pose ls-arm-back" style={{ transform: `rotate(${pose === 'rest' ? 18 : pose === 'study' ? -36 : -14}deg)` }}>
            <path d="M-22-99 -34-67 -12-56" fill="none" stroke="var(--ls-sleeve)" strokeWidth="15" strokeLinecap="round"/><path d="M-12-56 -4-54" stroke={SKINS[palette]} strokeWidth="11" strokeLinecap="round"/>
          </g>
          <g className="ls-arm-pose ls-arm-front" style={{ transform: `rotate(${pose === 'study' ? -58 : pose === 'connect' ? -82 : pose === 'rest' ? 12 : -23}deg)` }}>
            <g className="ls-hand-motion" style={{ '--ls-hand-angle': pose === 'study' ? '6deg' : pose === 'connect' ? '12deg' : '1deg' } as Vars}>
              <path d="M24-99 30-66 39-43" fill="none" stroke="var(--ls-sleeve)" strokeWidth="15" strokeLinecap="round"/><path d="M39-43 40-35" stroke={SKINS[palette]} strokeWidth="11" strokeLinecap="round"/>
              <path className="ls-pen" d="M35-38 49-29" stroke="#36443e" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: pose === 'study' ? 1 : 0 }}/>
            </g>
          </g>
        </g>
      </g>
    </g>
  </g>;
}

export default function LifeScene({ stage, age, month, running, focus, seed, relationship, partnerName, children = 'none', eventTitle, workContext, reaction, companionName, guestName, notebook = 'none', awaitingChoice = false, serviceRoute, specialty, exercise, extraStudy }: LifeSceneProps) {
  const id = useId();
  const room = serviceRoute ? serviceRoute === 'army' ? 'barracks' : serviceRoute === 'doctor' ? 'military-clinic' : 'public-health' : sceneRoom(stage, focus, workContext, notebook);
  const military = room === 'barracks';
  const scene = ROOMS[room];
  const season = useAmbientSeason(month, running);
  const storyGuest = useStoryGuest(guestName, notebook);
  const palette = Number.isFinite(seed) ? ((Math.trunc(seed) % 4) + 4) % 4 : 0;
  const outdoor = room === 'campus' || room === 'park';
  const domestic = room === 'home' || room === 'lounge' || outdoor;
  const medical = room === 'ward' || room === 'clinic' || room === 'military-clinic' || room === 'public-health';
  const shownSpecialty = medical && !serviceRoute ? specialty : undefined;
  const equipment = shownSpecialty ? SPECIALTY_VISUALS[shownSpecialty]?.equipment : undefined;
  const outfit = military ? 'casual' : room === 'research' ? 'lab-coat' : medical ? (equipment === 'surgical' || equipment === 'monitor') ? 'scrubs' : 'casual' : season.index === 1 ? 'casual' : stage === 'university' ? 'hoodie' : 'cardigan';
  const computer = room === 'research' || room === 'clinic';
  const guest = storyGuest || (focus === 'connect' ? companionName : undefined);
  const partner = domestic && relationship !== 'single' && !guest;
  const child = domestic && children !== 'none';
  const guestLabel = guest || (partner ? partnerName || (relationship === 'married' ? '배우자' : '연인') : '');
  const pose = awaitingChoice ? 'wait' : storyGuest && notebook === 'kept' ? 'study' : guestLabel || reaction === 'connection' ? 'connect' : reaction === 'rest' ? 'rest' : reaction === 'learning' ? 'study' : focus;
  const activity = awaitingChoice ? '이야기를 듣는 중' : pose === 'study' ? (computer ? '자료를 살펴보는 중' : '책을 읽는 중') : pose === 'connect' ? guestLabel ? '함께 이야기하는 중' : '잠깐의 여유' : '쉬는 중';
  const childLabel = { none: '', young: '어린 자녀', school: '학령기 자녀', adult: '성인 자녀' }[children];
  const description = `${scene.title}. 주인공 ${age}세. ${military ? '관물대와 군용 침구가 놓인 침상. 활동복을 입고 있습니다. ' : ''}${activity}.${guestLabel ? ` 함께 있는 사람: ${guestLabel}.` : ''}${child ? ` ${childLabel}.` : ''}${notebook === 'kept' ? ' 함께 확인한 노트가 책상에 놓여 있습니다.' : ''}`;
  const vars: Vars = { '--ls-accent': scene.accent, '--ls-wall': scene.wall, '--ls-sky': season.sky, '--ls-leaf': season.leaf, '--ls-sleeve': military ? '#495961' : outfit === 'scrubs' ? '#638b87' : medical || outfit === 'lab-coat' ? '#fcfcf7' : ['#657b72', '#ad785e', '#76819a', '#867b62'][palette] };

  return <section className="ls-root" data-running={running} data-room={room} data-service={serviceRoute} data-notebook={notebook} aria-labelledby={`${id}-heading`} style={vars}>
    <header className="ls-header"><h2 id={`${id}-heading`}>{scene.title}</h2><span>{SEASONS[seasonIndex(month)].name}</span></header>
    <div className="ls-art">
      <svg className="ls-canvas" viewBox="0 0 800 460" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{`${scene.title}에서의 일상`}</title><desc id={`${id}-desc`}>{description}</desc>
        <defs>
          <clipPath id={`${id}-window`}><rect x="435" y="48" width="230" height="192" rx="56"/></clipPath>
          <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fffdf0" stopOpacity=".7"/><stop offset="1" stopColor="#fffdf0" stopOpacity="0"/></linearGradient>
        </defs>
        <g aria-hidden="true">
          <g style={{ display: outdoor ? 'none' : undefined }}>
          <path className="ls-wall" d="M0 0h800v460H0z"/>
          <path d="M0 340h800v120H0z" fill="#d9dbd2" opacity=".42"/>
          <path d="M0 340h800" stroke="#9ba69a" opacity=".2"/>
          <g clipPath={`url(#${id}-window)`}>
            <rect className="ls-sky" x="435" y="48" width="230" height="192"/>
            <circle cx="606" cy="99" r="24" fill="#faf5dc"/>
            <g className="ls-cloud"><path d="M442 107q8-19 26-10 6-15 23-6 17-4 20 16Z" fill="#fafbf4" opacity=".72"/></g>
            <path d="M410 218 485 177 533 199 583 160 685 224v35H410Z" fill="#8ea8a0" opacity=".25"/>
            <g className="ls-tree"><path d="M621 256V139m0 58-24-21m24 1 17-17" stroke="#6b8273" strokeWidth="3" fill="none"/><path className="ls-leaf" d="M585 177q-16-24 10-36-4-25 23-28 26-1 26 28 25 15 7 39-29 17-66-3"/></g>
            <SeasonalDetails season={season.index}/>
          </g>
          <rect x="435" y="48" width="230" height="192" rx="56" fill="none" stroke="#fcfcf7" strokeWidth="10"/>
          <path d="M550 50v190M425 244h250" stroke="#fcfcf7" strokeWidth="8"/>
          <path d="M449 246h201L518 394H229Z" fill={`url(#${id}-light)`} opacity=".5"/>
          </g>
          {outdoor && <OutdoorBackdrop room={room} season={season.index}/>}
          <RoomFurniture room={room} specialty={shownSpecialty} children={children} exercise={exercise} extraStudy={extraStudy} retired={stage === 'retirement'}/>

          {military && <g className="ls-barracks-furniture">
            <path d="M0 340h800v120H0z" fill="#b7bdaf"/>
            <path d="M0 380h800M0 420h800" stroke="#9fa795" strokeWidth="2"/>
            {[98, 172, 246].map(x => <g key={x}>
              <rect x={x} y="68" width="68" height="207" rx="3" fill="#7a856f" stroke="#56634f" strokeWidth="3"/>
              <path d={`M${x + 10} 90h48m-48 7h48m-48 7h48M${x + 55} 157v22`} stroke="#c0c8b6" strokeWidth="3"/>
              <rect x={x + 21} y="119" width="26" height="12" rx="1" fill="#e1e4d7"/>
            </g>)}
            <g stroke="#586452" strokeWidth="7" strokeLinecap="round">
              <path d="M555 269v105m181-105v105M555 342h181"/>
              <rect x="550" y="292" width="192" height="45" rx="4" fill="#747f60" strokeWidth="3"/>
            </g>
            <rect x="563" y="282" width="52" height="21" rx="7" fill="#d4d9c7"/>
            <path d="M622 287h110v47H622z" fill="#626f50"/>
            <path d="M635 289v42m9-42v42" stroke="#a0ab8b" strokeWidth="3"/>
            <path d="M565 357h30v12h-34v-6zm47 0h30v12h-34v-6z" fill="#3c4640"/>
          </g>}
          <g className="ls-prop" style={{ opacity: domestic ? 0 : 1 }} stroke="#7d8c7f" strokeWidth="7" fill="none" strokeLinecap="round">
            <path d="M309 309h63m-51 0-9 59m48-59 8 59M306 302v-48q0-10 11-10h22"/>
          </g>
          <g style={{ '--ls-sleeve': '#85948b' } as Vars}>
            <Actor identity="guest" x={guestLabel ? 494 : 706} palette={(palette + 1) % 4} visible={!!guestLabel} pose={storyGuest && notebook === 'kept' ? 'study' : 'connect'} older={age >= 60 && partner} facing={-1}/>
          </g>
          <Actor identity="protagonist" x={domestic ? 295 : 346} palette={palette} older={age >= 60} medical={medical && outfit !== 'scrubs'} military={military} outfit={outfit} season={season.index} pose={pose}/>
          <g style={{ '--ls-sleeve': '#b49967' } as Vars}>
            <Actor identity="child" x={child ? 598 : 725} scale={children === 'young' ? .5 : children === 'school' ? .65 : .92} palette={(palette + 2) % 4} visible={child} pose="connect"/>
          </g>

          <g className="ls-desk-position" style={{ transform: domestic ? 'translate(27px, 45px)' : 'translate(0px, 0px)' }}>
            <path d="m365 303-12 86m169-86 12 86" fill="none" stroke="#758275" strokeWidth="9" strokeLinecap="round"/>
            <rect x="330" y="291" width="223" height="13" rx="6" fill="#b7ab92"/>
            <path d="M336 294h211" stroke="#dfd8c6" strokeWidth="2"/>
            <g className="ls-prop" style={{ opacity: !domestic && !computer ? 1 : 0 }}>
              <path d="M365 280q20-7 39 0 19-7 39 0v9h-78Z" fill="#fffdf3"/><path d="M404 280v9m-25-5h16m20 0h16" stroke="#bdb69f" strokeWidth="1.5"/>
            </g>
            <g className="ls-prop" style={{ opacity: computer ? 1 : 0 }}>
              <rect x="409" y="227" width="77" height="50" rx="4" fill="#718883"/><rect x="414" y="232" width="67" height="39" rx="2" fill="#dbe6df"/><path d="M449 277v10m-22 2h42" stroke="#718883" strokeWidth="5"/>
              <path d="M424 245h35m-35 7h47m-47 7h26" stroke="#7d9e95" strokeWidth="2"/>
            </g>
            <g className="ls-notebook" data-visible={notebook === 'offered' || notebook === 'kept'} style={{ opacity: notebook === 'offered' || notebook === 'kept' ? 1 : 0, transform: notebook === 'offered' ? 'translate(8px, -3px) rotate(-4deg)' : 'translate(0px, 0px) rotate(0deg)' }}>
              <rect x="451" y="279" width="36" height="10" rx="2" fill="var(--ls-accent)"/><path d="M458 280v8m5-5h17" stroke="#f8f5e9" strokeWidth="1.5"/>
            </g>
            <g><path d="M503 270h16v15q-8 6-16 0Z" fill="#fdfbf2"/><path d="M519 273q13 0 0 10" fill="none" stroke="#fdfbf2" strokeWidth="3"/>
              <path className="ls-steam" d="M510 263q-6-7 0-14" stroke="#faf9ee" strokeWidth="2" fill="none"/>
            </g>
          </g>
          <g className="ls-prop" style={{ opacity: room === 'library' || room === 'preparation' ? 1 : 0 }}>
            <path d="M353 288h-38m19-2v-60l-21-17" stroke="#7c8572" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <path d="m302 204 23 11-29 18-12-11Z" fill="var(--ls-accent)"/><path d="m291 229 27-8 48 69h-102Z" fill="#f0d890" opacity=".17"/>
          </g>
          {room === 'home' && !child && <g transform="translate(728 335)"><path d="M-17 0h34l-5 34h-25Z" fill="#a8b3a4"/><path d="M0 0v-55m0 33q-34-2-26-23 27-2 26 23m0-17q1-30 22-29 13 24-22 29" fill="#7c9683"/></g>}
          <path d="M81 391h92m483 23h53" stroke="#9da995" opacity=".22" strokeWidth="2" strokeLinecap="round"/>
        </g>
      </svg>
      <div className="ls-scene-caption"><span className="ls-activity-dot" aria-hidden="true"/>{activity}</div>
    </div>
    <footer className="ls-footer">
      <details className="ls-people"><summary>장면 속 인물 <span aria-hidden="true">＋</span></summary><ul>
        <li><strong>주인공</strong><span>{age}세</span></li>
        {guestLabel && <li><strong>{guestLabel}</strong><span>{partner ? relationship === 'married' ? '배우자' : '연인' : '함께 있는 사람'}</span></li>}
        {child && <li><strong>자녀</strong><span>{childLabel}</span></li>}
      </ul></details>
      {eventTitle?.trim() && <p className="ls-event">{eventTitle}</p>}
    </footer>
  </section>;
}
