import type { VisualRoom } from './SceneScenery';
import type { Gender } from './identity';

export type DesignVariant = 0 | 1 | 2;
// Cosmetic choices are stable across saves and never consume the game RNG.
export function sceneDesign(seed: number, room: string): DesignVariant {
  let value = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
  for (const letter of room) value = Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0;
  return (value % 3) as DesignVariant;
}

export function Plant({ x, y, tall = false }: { x: number; y: number; tall?: boolean }) {
  return <g transform={`translate(${x} ${y})`}>
    <path d="M-15 0h30l-5 27h-20Z" fill="#bd9c7b"/><path d={tall ? 'M0 0v-92' : 'M0 0v-47'} stroke="#82917a" strokeWidth="3"/>
    <path d="M0-11q-32 0-27-24Q-4-36 0-11M0-26q2-32 25-27Q33-28 0-26" fill="#91a48a"/>
    {tall && <path d="M0-55q-33-1-26-27Q-4-80 0-55M0-70q1-34 24-29Q29-73 0-70" fill="#a3b397"/>}
  </g>;
}

function Books({ x, y, count = 6 }: { x: number; y: number; count?: number }) {
  return <g transform={`translate(${x} ${y})`}>{Array.from({ length: count }, (_, n) => <g key={n} transform={`translate(${n * 17} 0)`}>
    <rect y={n % 3 * 4} width="13" height={39 - n % 3 * 4} rx="1" fill={['#9da98d', '#bf997f', '#8eabb1', '#c7b88c'][n % 4]}/><path d="M3 29h7" stroke="#eee6d5" strokeWidth="2"/>
  </g>)}</g>;
}

export function RoomDesign({ room, variant }: { room: VisualRoom; variant: DesignVariant }) {
  if (!variant) return null;
  const blue = variant === 2;
  const wood = blue ? '#aabac0' : '#c9ad8c';
  const dark = blue ? '#7d939e' : '#a58d70';
  return <g data-room-design={`${room}-${variant}`}>
    {room === 'library' && (blue ? <g>
      <path d="M89 74h199v166H89Z" fill="#dbe1df"/><path d="M88 241h203" stroke={dark} strokeWidth="8"/>
      {[0, 1, 2].map(n => <g key={n}><Books x={102} y={91 + n * 51} count={10}/><path d={`M90 ${133 + n * 51}h199`} stroke={wood} strokeWidth="6"/></g>)}
      <rect x="102" y="279" width="147" height="15" rx="5" fill={wood}/><path d="M115 294v68m122-68v68" stroke={dark} strokeWidth="7"/><Plant x={268} y={325} tall/>
    </g> : <g>
      <path d="M89 325V145q0-70 85-70t85 70v180Z" fill="#bba07d"/><path d="M103 311V146q0-55 71-55t71 55v165Z" fill="#e6d9bd"/>
      {[157, 224].map(y => <g key={y}><Books x={117} y={y} count={7}/><path d={`M103 ${y + 43}h142`} stroke="#b59d7b" strokeWidth="6"/></g>)}
      <Plant x={633} y={331} tall/><rect x="615" y="358" width="69" height="8" rx="4" fill="#b7a283"/>
    </g>)}
    {room === 'preparation' && <g>
      {blue ? <><rect x="90" y="75" width="203" height="136" rx="5" fill="#fafaf1" stroke={wood} strokeWidth="5"/>{[0,1,2,3].map(n => <g key={n}><path d={`M105 ${99+n*25}h172`} stroke="#d5dfd6" strokeWidth="2"/><rect x={114+n*32} y={90+n*25} width="37" height="14" rx="2" fill={n%2 ? '#b8cbbb' : '#c2cadb'}/></g>)}</> : <><path d="M96 92h191m-191 96h191" stroke="#b69b7c" strokeWidth="7"/>{[0,1,2].map(n => <g key={n} transform={`translate(${110+n*58} 106)`}><rect width="45" height="61" rx="2" fill="#fff9e7" transform={`rotate(${n%2 ? 5 : -4})`}/><path d="M9 18h25m-25 10h20m-20 10h25" stroke="#bba98c" strokeWidth="3"/></g>)}</>}
      <rect x="94" y="271" width="176" height="73" rx="4" fill={wood}/><path d="M105 301h154m-96-18h39m-39 40h39" stroke="#f3eee0" strokeWidth="3"/><Books x={109} y={231}/><Plant x={685} y={330} tall/>
    </g>}
    {room === 'research' && <g>
      <rect x="88" y="78" width="204" height="100" rx="4" fill={blue ? '#596f79' : '#f8f5e9'} stroke={wood} strokeWidth="5"/>
      {blue ? <g stroke="#c1d5cf" strokeWidth="2" fill="none"><path d="M108 128h160M130 97v63m42-63v63m43-63v63" opacity=".3"/><path d="m112 151 26-17 24 9 36-42 26 17 39-22"/>{[127,174,222,258].map((x,n)=><circle key={x} cx={x} cy={151-n*15} r="3" fill="#dbd9aa"/>)}</g> : <g stroke="#99aaa5" strokeWidth="3" fill="none"><path d="M118 106q26 45 50 0t50 0m-100 44q26-45 50 0t50 0"/>{[0,1,2,3,4,5].map(n=><path key={n} d={`M${121+n*17} 118v19`}/>)}</g>}
      <path d="M92 286h191m-176 0v71m162-71v71" stroke={dark} strokeWidth="7"/>
      <rect x="99" y="236" width="80" height="47" rx="6" fill={wood}/><circle cx="122" cy="256" r="12" fill="#e6ece5"/><path d="M151 248v17m-7-8h14" stroke="#e9eee4" strokeWidth="3"/>
      <g fill="#dce9e2" stroke="#8fa79c" strokeWidth="2">{[0,1,2,3].map(n=><path key={n} d={`M${204+n*17} 237v32q5 9 10 0v-32Z`}/>)}</g><path d="M197 251h74m-74 29h74" stroke={wood} strokeWidth="5"/>
    </g>}
    {room === 'home' && <g>
      <ellipse cx="386" cy="362" rx="198" ry="36" fill={blue ? '#bfcdd1' : '#dfc8af'} opacity=".6"/>
      <rect x="201" y="261" width="177" height="81" rx={blue ? 10 : 27} fill={blue ? '#9caebc' : '#cdab91'}/><rect x="196" y="306" width="187" height="41" rx="13" fill={blue ? '#899faa' : '#bd9b82'}/><path d="M215 346v23m149-23v23" stroke={dark} strokeWidth="7"/>
      <rect x="215" y="277" width="39" height="34" rx="7" fill={blue ? '#d2d9d1' : '#eee0b9'}/><path d="M331 276h35v65h-35Z" fill={blue ? '#b4c1aa' : '#b4b595'}/>
      {blue ? <><rect x="105" y="87" width="152" height="105" rx="4" fill="#f4f1e3" stroke={wood} strokeWidth="5"/><path d="M117 174q22-45 58-18t69-21v45H117Z" fill="#95b1b6"/><circle cx="218" cy="116" r="15" fill="#ddc18d"/><Plant x={667} y={335} tall/></> : <><circle cx="176" cy="131" r="53" fill="#d9c5a8"/><circle cx="176" cy="131" r="43" fill="#efe6d5"/><path d="M176 104v30l22 11" fill="none" stroke="#a48f73" strokeWidth="4"/><path d="M660 333V153m-28 182h57" stroke={dark} strokeWidth="6"/><path d="M621 158q40-58 80 0Z" fill="#e2c691"/></>}
    </g>}
    {room === 'lounge' && <g>
      {blue ? <><rect x="91" y="92" width="192" height="98" rx="8" fill="#cedad2"/><Plant x={121} y={160}/><Plant x={191} y={160}/><path d="M100 190h178" stroke={dark} strokeWidth="6"/></> : <><path d="M95 110h191m-179 0v72m166-72v72" stroke={dark} strokeWidth="6"/><path d="M125 111v34m117-34v34" stroke="#c1aa89" strokeWidth="2"/><path d="M106 145h38l-7 28h-24Zm117 0h38l-7 28h-24Z" fill="#b4bda5"/></>}
      <rect x="91" y="260" width="186" height="77" rx="4" fill={wood}/><path d="M104 268v61m53-61v61m53-61v61m53-61v61" stroke={dark} opacity=".3" strokeWidth="3"/>
      <path d="M87 258h194" stroke={dark} strokeWidth="8"/>
      {blue ? <><rect x="116" y="201" width="42" height="54" rx="5" fill="#7d99a4"/><rect x="123" y="209" width="27" height="25" rx="3" fill="#d4e3dd"/><path d="M137 239v12" stroke="#f1f4e8" strokeWidth="3"/></> : <><path d="M116 222h45v30h-45Z" fill="#ece0c7"/><path d="M161 227q20 0 0 19" fill="none" stroke="#ece0c7" strokeWidth="5"/><path d="M122 217h32" stroke="#a48f6d" strokeWidth="4"/></>}
      <rect x="574" y="290" width="137" height="55" rx="20" fill={blue ? '#a5bbc0' : '#d0b999'}/><path d="M590 345v20m105-20v20" stroke={dark} strokeWidth="7"/>
    </g>}
  </g>;
}

export function ClinicalStorage({ variant }: { variant: DesignVariant }) {
  return variant === 1 ? <g data-clinical-design="wood-cabinet"><rect x="93" y="240" width="169" height="100" rx="5" fill="#c7b59c"/><path d="M177 241v99M105 271h58m-58 33h58m30-49v32" stroke="#f3efdf" strokeWidth="3"/><rect x="111" y="209" width="29" height="28" rx="5" fill="#e8e9df"/><Plant x={235} y={208}/></g>
    : <g data-clinical-design="care-cart"><path d="M103 249h156m-149 0v91m142-91v91M110 299h142" fill="none" stroke="#9aafb3" strokeWidth="6"/><rect x="115" y="258" width="133" height="34" rx="5" fill="#c5d8d8"/><path d="M167 267h30" stroke="#8da8aa" strokeWidth="4"/><circle cx="114" cy="346" r="9" fill="#7d9295"/><circle cx="245" cy="346" r="9" fill="#7d9295"/><rect x="124" y="215" width="48" height="30" rx="5" fill="#eff1e6"/><path d="M148 221v18m-9-9h18" stroke="#9bb5ab" strokeWidth="4"/></g>;
}

export function OutdoorDesign({ room, variant }: { room: 'campus' | 'park'; variant: DesignVariant }) {
  const blue = variant === 2;
  return <g data-outdoor-design={`${room}-${variant}`}>
    {room === 'campus' ? blue ? <g>
      <rect x="77" y="115" width="306" height="198" rx="4" fill="#c1cdd0"/><path d="M91 132h278v128H91Z" fill="#91afb4"/>
      {[0,1,2,3,4,5].map(n=><path key={n} d={`M${106+n*49} 133v125`} stroke="#e6eeea" strokeWidth="5"/>)}<path d="M92 194h276" stroke="#e6eeea" strokeWidth="5"/><path d="M198 313v-48h63v48" fill="#759397"/><path d="M63 314h331" stroke="#a4b4b5" strokeWidth="9"/>
    </g> : <g><path d="M75 149 225 72l169 77Z" fill="#a68b7b"/><rect x="92" y="147" width="283" height="164" fill="#ddc8ab"/>{[0,1,2,3,4].map(n=><g key={n}><path d={`M${109+n*53} 215v-28a17 17 0 0 1 34 0v28Z`} fill="#9fb6b1"/><path d={`M${126+n*53} 171v44`} stroke="#e9e6d3" strokeWidth="3"/></g>)}<path d="M211 311v-55q20-26 40 0v55Z" fill="#92a299"/><path d="M77 313h313" stroke="#c0aa8c" strokeWidth="9"/></g>
      : blue ? <g><ellipse cx="159" cy="290" rx="128" ry="38" fill="#a9c9cb"/><path d="M63 283q51-15 106 0m-56 20q51-13 97 0" fill="none" stroke="#dce8df" strokeWidth="3"/><path d="M83 239q83-51 150 0m-150 0v28m150-28v28" fill="none" stroke="#b3a383" strokeWidth="10"/><path d="M117 224v29m75-30v30" stroke="#b3a383" strokeWidth="5"/><Plant x={45} y={304} tall/></g> : <g><path d="M60 164 167 105l108 59Z" fill="#a39b7c"/><path d="M78 166v144m178-144v144M67 311h200" stroke="#b5aa8b" strokeWidth="9"/><path d="M86 275h160m-147 0v37m132-37v37" stroke="#a09477" strokeWidth="8"/><path d="M84 245h163v24H84Z" fill="#c5b794"/><Plant x={285} y={301} tall/></g>}
  </g>;
}

export function Hair({ variant, older, gender, layer = 'front' }: { variant: number; older: boolean; gender?: Gender; layer?: 'back' | 'front' }) {
  const shapes = [
    'M-21-140v-12q0-25 24-23 23 1 20 29l-9-11q-11 12-32 6v15Z',
    'M-23-121v-35q0-23 26-21 23 2 22 26v30l-9-2v-27q-16 3-27-13l-3 35Z',
    'M-22-143q-13-7-5-17-3-15 11-14 4-14 15-7 13-10 20 3 15-1 13 13 9 10-6 19l-6-15q-10 9-29 4Z',
    'M-22-143q-4-35 21-35 28-3 28 31l-9-5-6-16q-8 22-34 25Z',
  ];
  const index = Number.isFinite(variant) ? ((Math.trunc(variant) % shapes.length) + shapes.length) % shapes.length : 0;
  // The back layer sits behind the face so longer styles never cover the eyes.
  const female = [
    { name: 'bob', back: 'M-24-143q-2-34 24-34t25 34v27q-9 8-18 4H-9q-10 4-17-4Z', front: 'M-24-142v-14q1-22 25-21 25 0 24 28l-8-5-6-13q-8 16-29 17l-1 16Z' },
    { name: 'shoulder', back: 'M-25-144q-1-35 25-35t26 35l6 44q-15 9-32 2-17 7-32-2Z', front: 'M-25-141v-17q4-24 27-21 24 2 24 34l-8-5-7-17q-10 15-29 15l-2 15Z' },
    { name: 'ponytail', back: 'M-18-158q-19-13-25 3-5 17-1 40l9 13q8-14 6-31 0-17 11-16Z', front: 'M-22-142v-15q1-22 23-20 23 1 22 27l-8-5-5-12q-10 14-27 15v12Z' },
    { name: 'bun', back: 'M-15-170q-7-23 12-25 22-2 20 21l-5 10Z', front: 'M-22-141v-16q2-22 24-20 22 2 21 27l-8-5-6-13q-9 15-26 16v13Z' },
  ];
  const male = [...shapes];
  male[1] = 'M-23-141v-17q2-22 27-19 22 3 20 28l-8-7-5-9q-15 12-28 11v15Z';
  const style = gender === 'female' ? female[index] : undefined;
  if (layer === 'back' && !style) return null;
  return <path data-hair={index} data-hair-style={style?.name ?? (gender === 'male' ? ['crop', 'side-part', 'curly', 'swept'][index] : undefined)} data-hair-layer={layer} d={style ? style[layer] : gender === 'male' ? male[index] : shapes[index]} fill={older ? '#b2b2a8' : '#343d3b'}/>;
}
