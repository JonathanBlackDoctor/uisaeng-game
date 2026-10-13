import { useId } from 'react';
import './life-scene.css';

export interface LifeSceneProps {
  stage: 'university' | 'training' | 'career' | 'retirement';
  age: number;
  month: number;
  running: boolean;
  focus: 'study' | 'connect' | 'rest';
  seed: number;
  relationship: 'single' | 'dating' | 'married';
  partnerName?: string;
  children?: 'none' | 'young' | 'school' | 'adult';
  eventTitle?: string;
  workContext?: 'research' | 'preparation';
  reaction?: 'learning' | 'connection' | 'rest' | null;
  companionName?: string;
}

const STAGES = {
  university: { title: '캠퍼스', label: '대학 생활', place: '캠퍼스' },
  training: { title: '수련 병원', label: '수련 생활', place: '병원' },
  career: { title: '일터', label: '의사 생활', place: '진료 공간' },
  retirement: { title: '공원', label: '은퇴 생활', place: '공원' },
};
const FOCUS = { study: '공부', connect: '친구 만나기', rest: '휴식' };
const SEASONS = [
  { key: 'spring', name: '봄', sky: '#e7eeeb', ground: '#d8dfba', leaf: '#8bac83', accent: '#dfada4' },
  { key: 'summer', name: '여름', sky: '#dcecee', ground: '#c8d7ad', leaf: '#608b72', accent: '#e0bd76' },
  { key: 'autumn', name: '가을', sky: '#f2e6d6', ground: '#ded1ae', leaf: '#bd8556', accent: '#cc735c' },
  { key: 'winter', name: '겨울', sky: '#e3e9ed', ground: '#e9e9df', leaf: '#a3b6ad', accent: '#afbec5' },
];
const SKIN = ['#b97c5c', '#e3b68e', '#93614e', '#d29973'];
const HAIR = ['#39312e', '#635047', '#443b39', '#775846'];
const CLOTHES = ['#417a78', '#a46253', '#656e8d', '#8c794d'];

// These decorative scenes are game illustrations, not biographical facts.
// Only the supplied relationship/children state determines who is present.
function Person({ x, y, scale = 1, skin, hair, shirt, older = false, medical = false, book = false }: {
  x: number; y: number; scale?: number; skin: string; hair: string; shirt: string;
  older?: boolean; medical?: boolean; book?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="3" rx="26" ry="6" fill="#3c4b43" opacity=".13" />
      <g className="ls-person">
        <path d="M-14-52l-3 49h12l7-39 6 39h12l-3-49" fill="#46545b" />
        <path d="M-19-1h15v6h-21q-1-5 6-6m27 0h13q7 1 7 6H8" fill="#343c3e" />
        <path d="M-20-100q20-13 40 0l8 52q-28 9-56 0z" fill={medical ? '#faf7ed' : shirt} />
        <path d="M-21-97l-13 39q-3 9 3 10t9-8l11-32m32-9 13 39q3 9-3 10t-9-8L11-88" fill={medical ? '#faf7ed' : shirt} stroke={medical ? '#d7d9d2' : shirt} strokeWidth="2" />
        <path d="M-30-54v9m60-9v9" stroke={skin} strokeWidth="9" strokeLinecap="round" />
        <path d="M-7-112v15q7 7 14 0v-15" fill={skin} />
        <ellipse cy="-127" rx="20" ry="24" fill={skin} />
        <path d="M-20-125q-7-32 19-31 29-2 22 33l-7-15q-16 8-31 1z" fill={older ? '#a5a49b' : hair} />
        <path d="M-7-125h1m12 0h1" stroke="#3e3430" strokeWidth="3" strokeLinecap="round" />
        <path d="M-4-115q4 3 8 0" fill="none" stroke="#754f43" strokeWidth="1.7" strokeLinecap="round" />
        {older && <path d="M-13-120l4 1m18 0 4-1" stroke="#886d60" strokeWidth="1" />}
        {medical && <>
          <path d="m-9-99 9 18 9-18M0-81v31" fill="none" stroke="#c4cfc8" strokeWidth="2" />
          <path d="M-12-95v17q0 10 8 10t8-10v-15" fill="none" stroke="#527875" strokeWidth="2.5" />
          <circle cx="5" cy="-77" r="3.5" fill="#527875" />
          <rect x="10" y="-80" width="10" height="8" rx="1" fill="#d6e4dd" />
        </>}
        {book && <g transform="translate(17 -66) rotate(-12)"><rect width="20" height="27" rx="2" fill="#e0bb76" /><path d="M4 0v27m4-19h9m-9 5h7" stroke="#fff4d9" strokeWidth="2" /></g>}
      </g>
    </g>
  );
}

function Tree({ x, y, leaf, winter, scale = 1 }: { x: number; y: number; leaf: string; winter: boolean; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d="M0 0v-119m0 54-29-33m29 14 29-40" fill="none" stroke="#8c7862" strokeWidth="9" strokeLinecap="round" />
    <g className="ls-canopy" fill={leaf} opacity={winter ? '.35' : '1'}>
      <ellipse cx="-24" cy="-119" rx="38" ry="45" /><ellipse cx="22" cy="-131" rx="43" ry="49" /><ellipse cy="-162" rx="38" ry="40" />
      <path d="M-43-139q20-22 44-24" fill="none" stroke="#fff9e9" strokeWidth="5" opacity=".22" strokeLinecap="round" />
    </g>
    {winter && <path d="M-46-159q15-21 31-12m8-27q24-12 39 9" fill="none" stroke="#faf8ef" strokeWidth="7" strokeLinecap="round" />}
  </g>;
}

function Building({ stage }: { stage: LifeSceneProps['stage'] }) {
  if (stage === 'retirement') return <g>
    <path d="M218 298v-103m130 103V195" stroke="#a79377" strokeWidth="9" />
    <path d="m191 199 92-58 92 58z" fill="#818f80" /><path d="M205 201h156" stroke="#586f64" strokeWidth="8" />
    <path d="M220 266h125m-125 17h125m-115 0v23m104-23v23" stroke="#aa8062" strokeWidth="8" strokeLinecap="round" />
    <path d="M707 240v66m-40-46h80m-80 16h80m-69 0v30m59-30v30" stroke="#aa8062" strokeWidth="7" strokeLinecap="round" />
    <path d="M703 222v-45" stroke="#6e8079" strokeWidth="5" /><circle cx="703" cy="166" r="13" fill="#f5dfab" />
  </g>;
  const campus = stage === 'university';
  const training = stage === 'training';
  return <g>
    <rect x="220" y={campus ? 155 : 133} width="360" height={campus ? 153 : 175} rx="5" fill={campus ? '#c3a58a' : '#e6dfcf'} />
    <rect x="234" y={campus ? 166 : 145} width="332" height="10" fill={campus ? '#e3cdb0' : '#c4d2cb'} />
    {campus ? <>
      <path d="m209 157 192-68 192 68z" fill="#73847c" /><path d="M246 144h309" stroke="#d4d5bc" strokeWidth="4" />
      <circle cx="400" cy="126" r="17" fill="#f8edcf" /><path d="M400 115v12l8 4" fill="none" stroke="#637b75" strokeWidth="3" strokeLinecap="round" />
    </> : <>
      <rect x="360" y="110" width="86" height="36" rx="5" fill="#54847d" />
      <path d="M403 118v20m-10-10h20" stroke="#f6f1df" strokeWidth="6" />
      <rect x="590" y="192" width="111" height="115" rx="4" fill="#c0cdc4" />
      <rect x="601" y="206" width="86" height="31" rx="2" fill="#729b99" />
      <path d="M603 252h84m-84 14h84" stroke="#e6e9dc" strokeWidth="4" />
    </>}
    {[264, 324, 456, 516].map(x => <g key={x}>
      <rect x={x} y="187" width="34" height="43" rx="2" fill="#72928e" />
      <path d={`M${x + 3} 190l28 35m-13-38v43m-18-21h34`} stroke="#d6e2d4" strokeWidth="2" />
      <rect x={x - 3} y="231" width="40" height="5" rx="1" fill="#f1e5cf" />
      <rect x={x} y="252" width="34" height="39" rx="2" fill="#73958e" />
      <path d={`M${x + 17} 252v39`} stroke="#d6e2d4" strokeWidth="2" />
    </g>)}
    <path d="M376 308v-77q24-23 48 0v77" fill="#597b77" />
    <path d="M400 237v70m-20-47h40" stroke="#bccdc0" strokeWidth="3" />
    <path d="M369 308h62m-67 7h72" stroke="#b5ad99" strokeWidth="6" />
    {training && <path d="M231 267h20m-10-10v20" stroke="#f6f2e5" strokeWidth="5" />}
    {!campus && <path d="M467 162h76" stroke="#7c9d90" strokeWidth="4" />}
  </g>;
}

export default function LifeScene({ stage, age, month, running, focus, seed, relationship, partnerName, children = 'none', eventTitle, workContext, reaction, companionName }: LifeSceneProps) {
  const id = useId();
  const scene = workContext && stage !== 'retirement' ? workContext === 'research'
    ? { title: '연구실', label: '연구 생활', place: '연구실' }
    : { title: '다음 지원 준비', label: '진로 준비', place: '작업 공간' } : STAGES[stage];
  const season = SEASONS[month < 2 || month === 11 ? 3 : month < 5 ? 0 : month < 8 ? 1 : 2];
  const palette = Number.isFinite(seed) ? ((Math.trunc(seed) % 4) + 4) % 4 : 0;
  const partnerRole = relationship === 'married' ? '배우자' : '연인';
  const partner = relationship !== 'single';
  const partnerLabel = partnerName?.trim() ? `${partnerName.trim()} · ${partnerRole}` : partnerRole;
  const childLabel = { none: '', young: '어린 자녀', school: '학령기 자녀', adult: '성인 자녀' }[children];
  const peopleDescription = `주인공 · ${age}세${partner ? `, ${partnerLabel}` : ''}${childLabel ? `, ${childLabel}` : ''}${companionName ? `, 동기 ${companionName}` : ''}`;
  const description = `${season.name}의 ${scene.place}. ${peopleDescription}. ${FOCUS[focus]}. ${running ? '시간이 흐르고 있습니다.' : '시간이 멈춰 있습니다.'}`;
  const childScale = children === 'young' ? .49 : children === 'school' ? .66 : .92;
  const medical = !workContext && (stage === 'training' || stage === 'career') && focus !== 'rest';

  return <section className="ls-root" data-running={running} data-season={season.key} aria-labelledby={`${id}-heading`}>
    <header className="ls-header">
      <div><p className="ls-eyebrow">{scene.label} <span aria-hidden="true">/</span> {season.name}</p><h2 id={`${id}-heading`}>{scene.title}</h2></div>
    </header>
    <div className="ls-art">
      <svg className="ls-canvas" viewBox="0 0 960 480" role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{`${season.name}의 ${scene.place}와 인물`}</title>
        <desc id={`${id}-description`}>{description}</desc>
        <g aria-hidden="true">
          <rect width="960" height="480" fill={season.sky} />
          <circle cx="741" cy="78" r="33" fill="#f6dc9f" opacity=".8" /><circle cx="741" cy="78" r="46" fill="#faf1d7" opacity=".35" />
          <g className="ls-cloud ls-cloud-one" fill="#fffaf0" opacity=".8"><path d="M75 96q-8-17 13-23 6-26 29-19 22-15 34 11 27-1 26 24 11 13-10 15H85q-12 0-10-8" /></g>
          <g className="ls-cloud ls-cloud-two" fill="#fffaf0" opacity=".65"><path d="M503 71q-6-15 15-18 7-23 25-17 19-11 29 9 25-1 24 21 9 12-8 13h-75q-12 0-10-8" /></g>
          <path d="M0 270q114-69 224-30t189 2 226-14 321 18v234H0z" fill={season.ground} />
          <path d="M0 273q170-52 291-13t246-6 423-3" fill="none" stroke={season.leaf} opacity=".15" strokeWidth="18" />
          <Building stage={stage} />
          <path d="M395 310q-31 42 50 64t-67 106H738q-23-76-145-107T424 310" fill="#f0e2c7" />
          <path d="M420 319q-8 37 106 58t53 103" fill="none" stroke="#fff8e8" strokeWidth="3" opacity=".6" />
          <Tree x={130} y={340} leaf={season.leaf} winter={season.key === 'winter'} scale={1.15} />
          <Tree x={830} y={329} leaf={season.leaf} winter={season.key === 'winter'} />
          <Tree x={916} y={302} leaf={season.leaf} winter={season.key === 'winter'} scale={.7} />
          <g fill={season.leaf}><ellipse cx="244" cy="324" rx="44" ry="20" /><ellipse cx="290" cy="330" rx="32" ry="15" /><ellipse cx="744" cy="323" rx="39" ry="19" /></g>
          <g fill={season.accent}>
            {[248, 267, 289, 729, 751].map((x, i) => <circle key={x} cx={x} cy={314 + (i % 3) * 6} r="4" />)}
          </g>
          <g transform="translate(342 350)"><path d="M0 0h47m-47 10h47M5 11v19m37-19v19" stroke="#9d795b" strokeWidth="6" strokeLinecap="round" /></g>
          <g transform="translate(675 365)"><rect x="-12" y="-28" width="25" height="28" rx="3" fill="#7f9687" /><path d="M-14-29h29" stroke="#536f66" strokeWidth="4" /></g>
          <Person x={partner || childLabel ? 472 : 495} y={400} skin={SKIN[palette]} hair={HAIR[palette]} shirt={CLOTHES[palette]} older={age >= 60} medical={medical} book={reaction ? reaction === 'learning' : focus === 'study'} />
          {companionName && <Person x={380} y={401} scale={.95} skin={SKIN[(palette + 3) % 4]} hair={HAIR[(palette + 1) % 4]} shirt={CLOTHES[(palette + 3) % 4]} older={age >= 60}/>}
          {partner && <Person x={550} y={397} scale={.94} skin={SKIN[(palette + 1) % 4]} hair={HAIR[(palette + 2) % 4]} shirt={CLOTHES[(palette + 1) % 4]} />}
          {childLabel && <Person x={partner ? 617 : 565} y={412} scale={childScale} skin={SKIN[(palette + 2) % 4]} hair={HAIR[(palette + 1) % 4]} shirt={CLOTHES[(palette + 2) % 4]} book={children === 'school'} />}
          {season.key !== 'winter' && <g className="ls-leaves" fill={season.accent}><path d="M178 282q12-8 16 3-12 7-16-3m593-78q12-8 16 3-12 7-16-3" /></g>}
          <g fill={season.leaf} opacity=".7"><path d="m70 421 4-13 4 13m120 20 4-12 4 12m572-24 4-13 4 13m76 28 4-12 4 12" /></g>
          {season.key === 'winter' && <g fill="#faf8ef" opacity=".8"><ellipse cx="237" cy="428" rx="27" ry="5" /><ellipse cx="756" cy="390" rx="18" ry="4" /><ellipse cx="128" cy="345" rx="45" ry="6" /></g>}
        </g>
      </svg>
      <div className="ls-scene-caption"><span>{FOCUS[focus]}</span></div>
    </div>
    <footer className="ls-footer">
      <details className="ls-people">
        <summary><span className="ls-people-icon" aria-hidden="true">◎</span> 장면 속 인물 <span className="ls-disclosure" aria-hidden="true">⌄</span></summary>
        <ul><li><strong>주인공</strong><span>{age}세 · {scene.label}</span></li>{partner && <li><strong>{partnerName?.trim() || partnerRole}</strong><span>{partnerRole}</span></li>}{childLabel && <li><strong>자녀</strong><span>{childLabel}</span></li>}</ul>
      </details>
      {eventTitle?.trim() && <p className="ls-event"><span className="ls-event-label">최근 사건</span><span>{eventTitle}</span></p>}
    </footer>
  </section>;
}
