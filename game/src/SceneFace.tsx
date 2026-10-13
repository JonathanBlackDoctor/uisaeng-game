export interface ActorAppearance {
  face: 'oval' | 'round' | 'angular';
  brows: 'soft' | 'straight' | 'thick';
  glasses: 'none' | 'round' | 'rectangular';
}

// Cosmetic only: stable across rooms, ages and saves, without consuming game RNG.
export function actorAppearance(seed: number, identity: string): ActorAppearance {
  let value = (Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0) ^ 0x51face;
  for (const letter of identity) value = Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return {
    face: (['oval', 'round', 'angular'] as const)[value % 3],
    brows: (['soft', 'straight', 'thick'] as const)[(value >>> 8) % 3],
    glasses: (['none', 'none', 'none', 'round', 'rectangular'] as const)[(value >>> 16) % 5],
  };
}

export function FaceShape({ shape, skin }: { shape: ActorAppearance['face']; skin: string }) {
  return <g data-face={shape} fill={skin}>
    {shape === 'oval' ? <rect x="-20" y="-162" width="40" height="48" rx="19"/>
      : shape === 'round' ? <path d="M-21-145q0-19 21-19t21 19v10q0 20-21 20t-21-20Z"/>
        : <path d="M-20-145q0-18 20-18t20 18v15l-9 13q-11 6-22 0l-9-13Z"/>}
  </g>;
}

export function FaceDetails({ appearance }: { appearance: ActorAppearance }) {
  const brow = {
    soft: 'M-9-150q4-3 8-1M6-151q4-2 8 1',
    straight: 'M-9-150h8m7 0h8',
    thick: 'M-10-150q5-2 9-1m7 0q5-1 9 1',
  }[appearance.brows];
  return <>
    <path data-brows={appearance.brows} d={brow} fill="none" stroke="#343d3b" strokeWidth={appearance.brows === 'thick' ? 2.8 : 1.8} strokeLinecap="round"/>
    <g className="ls-eyes" fill="#303936"><circle cx="-5" cy="-140" r="1.8"/><circle cx="10" cy="-140" r="1.8"/></g>
    <path d="M1-126q4 3 8-1" fill="none" stroke="#805f4c" strokeWidth="1.7" strokeLinecap="round"/>
    {appearance.glasses !== 'none' && <g data-glasses={appearance.glasses} stroke="#526462" strokeWidth="1.8" strokeLinejoin="round">
      <g fill="#fffdf4" fillOpacity=".12">
        {appearance.glasses === 'round' ? <><circle cx="-5" cy="-140" r="6.5"/><circle cx="10" cy="-140" r="6.5"/></>
          : <><rect x="-12" y="-146" width="14" height="12" rx="2.5"/><rect x="3" y="-146" width="14" height="12" rx="2.5"/></>}
      </g>
      <path d="M1.5-141h2m-21-2 6 2m28 0 4-2" fill="none" strokeLinecap="round"/>
    </g>}
  </>;
}
