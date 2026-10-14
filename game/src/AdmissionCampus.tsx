import { useId } from 'react';
// Decorative admission scene; the seed only matches the student's clothing palette.
export default function AdmissionCampus({ seed, walking = false }: { seed: number; walking?: boolean }) {
  const palette = ((Math.trunc(seed) % 4) + 4) % 4;
  const id = useId().replaceAll(':', '');
  return <svg className="admission-campus-art" viewBox="0 0 960 480" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="#dceae6"/><stop offset="1" stopColor="#f8f1da"/></linearGradient>
      <radialGradient id={`${id}-sun`}><stop stopColor="#fff9df" stopOpacity=".9"/><stop offset="1" stopColor="#fff9df" stopOpacity="0"/></radialGradient>
    </defs>
    <rect width="960" height="480" fill={`url(#${id}-sky)`}/>
    <circle cx="768" cy="80" r="140" fill={`url(#${id}-sun)`}/>
    <circle cx="768" cy="80" r="25" fill="#fff7dc"/>
    <path d="M60 104h130m-95 12h62m510-67h92m-60 12h45" stroke="#fffdf6" strokeWidth="5" strokeLinecap="round" opacity=".55"/>
    <path d="M0 264Q130 170 265 251T600 236T960 228V365H0Z" fill="#c5d5c7" opacity=".65"/>
    <path d="M0 300Q170 245 340 288T670 278T960 296V480H0Z" fill="#d6ddc6"/>
    <path d="M430 320Q400 380 300 480H730Q540 376 490 320" fill="#eee2cc"/>
    <g fill="#c5b29b" stroke="#b8a58f" strokeWidth="2">
      <rect x="242" y="166" width="476" height="166" rx="3"/>
      <rect x="370" y="136" width="220" height="196"/>
    </g>
    <path d="M349 138L480 78L611 138Z" fill="#647d70"/>
    <path d="M228 166H732M359 149H602" stroke="#e6ddc7" strokeWidth="10"/>
    <circle cx="480" cy="116" r="15" fill="#f4ecd9"/>
    <path d="M480 106V117L487 121" stroke="#647d70" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <g fill="#75908a" stroke="#e8dfc9" strokeWidth="3">
      {[276,324,404,454,504,554,640,688].map(x => <g key={x}><rect x={x-12} y="192" width="25" height="32"/><rect x={x-12} y="246" width="25" height="32"/></g>)}
    </g>
    <path d="M458 332V288Q480 268 502 288V332" fill="#4e6e60"/>
    <path d="M480 286V331" stroke="#bbc9b9" strokeWidth="2"/>
    <path d="M0 415Q140 370 320 430M690 424Q830 365 960 398" fill="none" stroke="#bacbb1" strokeWidth="40"/>
    {[150,815].map(x => <g key={x} transform={`translate(${x} 335)`}><ellipse cy="10" rx="55" ry="8" fill="#6d81621a"/><path d="M0 0V-110" stroke="#a5957c" strokeWidth="8"/><g className="campus-leaves"><ellipse cy="-118" rx="46" ry="59" fill="#98ad92"/><ellipse cx="-17" cy="-130" rx="27" ry="39" fill="#b3c1a1"/><path d="M0-62V-133M0-91L-23-111M0-104L21-131" fill="none" stroke="#c3cbaa" strokeWidth="3"/></g></g>)}
    <g fill="#7f9587" opacity=".7"><circle cx="398" cy="301" r="5"/><path d="M394 307h8l3 17h-14z"/><circle cx="580" cy="308" r="5"/><path d="M576 314h8l3 17h-14z"/></g>
    <g transform="translate(480 415)"><g className={walking ? 'campus-student campus-student-walking' : 'campus-student'}>
      <ellipse cy="5" rx="22" ry="5" fill="#3c4b431a"/>
      <path className="campus-leg campus-leg-left" d="M-12-35L-14 0H-3L2-35" fill="#4c5c60"/>
      <path className="campus-leg campus-leg-right" d="M0-35L4 0H15L12-35" fill="#4c5c60"/>
      <path d="M-18-76Q0-85 18-76L23-34H-23Z" fill={['#657b72','#ad785e','#76819a','#867b62'][palette]}/>
      <path d="M-18-71L-25-40M18-71L25-40" stroke={['#657b72','#ad785e','#76819a','#867b62'][palette]} strokeWidth="10" strokeLinecap="round"/>
      <ellipse cy="-98" rx="17" ry="21" fill="#d5a484"/>
      <path d="M-17-99Q-23-127 1-124Q23-124 18-100L12-111Q-2-105-14-110Z" fill="#3e3934"/>
      {walking ? <><path d="M-17-99Q-23-127 1-124Q23-124 18-97L12-85H-11Z" fill="#3e3934"/><rect x="-13" y="-69" width="26" height="30" rx="7" fill="#d1b68c"/><path d="M-12-68Q0-75 12-68" stroke="#ac916c" strokeWidth="3" fill="none"/></> : <path d="M-6-98H-5M6-98H7" stroke="#473a32" strokeWidth="2" strokeLinecap="round"/>}
      <rect x="18" y="-55" width="18" height="25" rx="2" fill="#d9bd81" transform="rotate(-10 18 -55)"/>
    </g></g>
    <g fill="#91a77e" opacity=".6"><path d="M90 392q10-20 20-5q-12 14-20 5"/><path d="M858 356q12-18 20-3q-10 12-20 3"/></g>
  </svg>;
}
