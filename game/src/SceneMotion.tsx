import type { CSSProperties } from 'react';

export function sceneMotion(pose: string, context: { computer: boolean; outdoor: boolean; company: boolean; medical: boolean }) {
  if (pose === 'wait') return 'wait';
  if (pose === 'study') return context.computer ? 'typing' : context.medical ? 'chart' : 'study';
  if (pose === 'connect' && context.outdoor && !context.company) return 'stroll';
  return pose === 'rest' ? 'sip' : pose;
}

export function SipAction({ skin }: { skin: string }) {
  return <g className="ls-sip-action" data-motion-prop="held-cup">
    <path className="ls-sip-arm ls-loop" d="M24-99 38-74 40-48" fill="none" stroke="var(--ls-sleeve)" strokeWidth="15" strokeLinecap="round"/>
    <g transform="translate(40 -48)"><g className="ls-sip-cup ls-loop">
      <path d="M-9-6H8V7q-8 6-17 0Z" fill="#f8f3df"/><path d="M8-3q14 0 0 9" fill="none" stroke="#f8f3df" strokeWidth="3"/>
      <ellipse cx="-1" cy="-6" rx="8" ry="2" fill="#a88d6b"/><circle cx="6" cy="4" r="5" fill={skin}/>
    </g></g>
  </g>;
}

export function HeldChart() {
  return <g className="ls-held-chart ls-loop" data-motion-prop="held-chart">
    <rect x="56" y="-84" width="43" height="38" rx="3" fill="#a6b7a3"/><rect x="60" y="-80" width="35" height="30" rx="1" fill="#f9f7e9"/>
    <path d="M72-82h14" stroke="#7e9790" strokeWidth="4"/><path d="M65-70h24m-24 6h24m-24 6h16" stroke="#b6c7b6" strokeWidth="2"/>
    <path className="ls-chart-mark ls-loop" pathLength="1" d="m66-74 3 2 4-5" fill="none" stroke="#678d80" strokeWidth="1.6"/>
  </g>;
}

export function OutdoorMotion({ pond }: { pond: boolean }) {
  return <g data-motion-prop="outdoor-air">
    <g className="ls-breeze ls-loop" fill="none" stroke="#fcfcf0" strokeWidth="2" opacity=".5"><path d="M88 84q25-8 49 0m-28 9h33M657 112q22-8 46 0"/></g>
    {pond && <g fill="none" stroke="#ecf4e8" strokeWidth="1.8">{[0,1,2].map(n => <g key={n} transform={`translate(${103+n*45} ${286+n%2*13})`}><ellipse className="ls-water-ring ls-loop" style={{ animationDelay: `${-n*1.8}s` }} rx="14" ry="3"/></g>)}</g>}
  </g>;
}

// All cycles use wall-clock CSS time. No game RNG, timers or saved state.
export function WindowMotion({ season }: { season: number }) {
  return <g className="ls-window-motion">
    {season === 0 && [0, 1, 2, 3].map(n => <g key={n} transform={`translate(${470 + n * 47} ${90 + n % 2 * 35})`}><path className="ls-petal ls-loop" style={{ animationDelay: `${-n * 2.1}s` }} d="M0 0q9-8 11 1Q4 10 0 0" fill="#e9b9be"/></g>)}
    {season === 1 && <g className="ls-bird-flight ls-loop"><path className="ls-bird-wings ls-loop" d="M476 114q8-9 16 0 8-9 16 0" fill="none" stroke="#708b80" strokeWidth="2" strokeLinecap="round"/></g>}
  </g>;
}

export function RoomMotion({ room, variant = 0 }: { room: string; variant?: number }) {
  return <g data-room-motion={room}>
    {room === 'research' && [0, 1, 2].map(n => <g key={n} transform={`translate(${variant ? 209 + n * 17 : 130 + n * 43} 258)`}><circle className="ls-lab-bubble ls-loop" style={{ animationDelay: `${-n * 1.7}s` }} r="2.4" fill="#f1f8ec"/></g>)}
    {['home', 'library', 'preparation', 'lounge', 'barracks'].includes(room) && <g className="ls-light-dust" fill="#fffdf0">{[0, 1, 2, 3].map(n => <circle key={n} className="ls-dust ls-loop" style={{ animationDelay: `${-n * 2.6}s` }} cx={405 + n * 35} cy={257 + n % 3 * 18} r={1.4 + n % 2 * .5}/>)}</g>}
  </g>;
}

export function DeskMotion({ computer, studying }: { computer: boolean; studying: boolean }) {
  if (!studying) return null;
  return <g data-desk-motion={computer ? 'typing' : 'reading'}>
    {computer ? <>
      <path className="ls-screen-cursor ls-loop" d="M453 259v5" stroke="#587f72" strokeWidth="2"/>
      <g className="ls-screen-lines ls-loop" stroke="#9bb8ab" strokeWidth="2"><path d="M424 238h22m-22 27h36"/></g>
      <path d="M389 284h68l8 5h-84Z" fill="#d4ddd2" stroke="#91a69b" strokeWidth="1"/>
      <path d="M392 286h57" stroke="#8a9f96" strokeWidth="1" strokeDasharray="3 2"/>
    </> : <>
      <path className="ls-page-turn ls-loop" d="M404 280q20-11 39-5v11q-20-5-39 3Z" fill="#faf8e9" stroke="#c9c1a7" strokeWidth=".7"/>
      <path className="ls-writing-line ls-loop" pathLength="1" d="M377 283h17" stroke="#8c9681" strokeWidth="1"/>
    </>}
  </g>;
}

export function ChildPlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <g transform="translate(624 394)"><g className="ls-play-ball ls-loop" data-motion-prop="play-ball"><circle r="12" fill="#d2b38c"/><path d="M-11 0h22M0-12q-8 12 0 24M0-12q8 12 0 24" fill="none" stroke="#f4e6c9" strokeWidth="1.5"/></g></g>;
}

export const actorPhase = (identity: string): CSSProperties => ({
  '--ls-phase': identity === 'guest' ? '-4s' : identity === 'child' ? '-2s' : '0s',
} as CSSProperties);
