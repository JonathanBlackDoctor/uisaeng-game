// Decorative admission scene; the seed only matches the student's clothing palette.
export default function AdmissionCampus({ seed }: { seed: number }) {
  const palette = ((Math.trunc(seed) % 4) + 4) % 4;
  return <svg className="admission-campus-art" viewBox="0 0 960 480" aria-hidden="true">
    <rect width="960" height="480" fill="#e7eeeb"/>
    <circle cx="768" cy="80" r="30" fill="#f3dfae"/>
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
    {[150,815].map(x => <g key={x} transform={`translate(${x} 335)`}><path d="M0 0V-110" stroke="#a5957c" strokeWidth="8"/><ellipse cy="-118" rx="46" ry="59" fill="#98ad92"/><path d="M0-62V-133M0-91L-23-111M0-104L21-131" fill="none" stroke="#b3bf9e" strokeWidth="3"/></g>)}
    <g transform="translate(480 401)">
      <ellipse cy="5" rx="22" ry="5" fill="#3c4b431a"/>
      <path d="M-12-35L-14 0H-3L0-25L4 0H15L12-35" fill="#4c5c60"/>
      <path d="M-18-76Q0-85 18-76L23-34H-23Z" fill={['#657b72','#ad785e','#76819a','#867b62'][palette]}/>
      <path d="M-18-71L-25-40M18-71L25-40" stroke={['#657b72','#ad785e','#76819a','#867b62'][palette]} strokeWidth="10" strokeLinecap="round"/>
      <ellipse cy="-98" rx="17" ry="21" fill="#d5a484"/>
      <path d="M-17-99Q-23-127 1-124Q23-124 18-100L12-111Q-2-105-14-110Z" fill="#3e3934"/>
      <path d="M-6-98H-5M6-98H7" stroke="#473a32" strokeWidth="2" strokeLinecap="round"/>
      <rect x="18" y="-55" width="18" height="25" rx="2" fill="#d9bd81" transform="rotate(-10 18 -55)"/>
    </g>
  </svg>;
}
