// Isolated visual QA: no database, saved games, or game-clock updates.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import LifeScene, { type LifeSceneProps } from '../../src/LifeScene';
import { SPECIALTIES } from '../../src/career';

const base: LifeSceneProps = { stage: 'university', age: 23, month: 3, running: false, focus: 'study', seed: 42, relationship: 'single' };
const rooms: [string, Partial<LifeSceneProps>][] = [
  ['열람실', {}], ['캠퍼스', { focus: 'connect', month: 3, companionName: '동기' }],
  ['병동', { stage: 'training', age: 28 }], ['진료실', { stage: 'career', age: 38, specialty: 'internal' }],
  ['연구실', { stage: 'career', age: 38, workContext: 'research' }], ['지원 준비', { stage: 'career', workContext: 'preparation' }],
  ['집', { stage: 'career', age: 39, focus: 'rest', relationship: 'married', partnerName: '하람', children: 'young' }],
  ['휴게 공간', { stage: 'training', focus: 'connect', companionName: '동료' }],
  ['은퇴 후 공원', { stage: 'retirement', age: 68, focus: 'connect', relationship: 'married', month: 9 }],
  ['부대 생활관', { serviceRoute: 'army' }], ['군 진료실', { serviceRoute: 'doctor' }], ['보건지소', { serviceRoute: 'public-health' }],
];
const seasons: [string, Partial<LifeSceneProps>][] = [
  ...[2, 5, 8, 11].map((month, i): [string, Partial<LifeSceneProps>] => [['봄 캠퍼스', '여름 캠퍼스', '가을 캠퍼스', '겨울 캠퍼스'][i], { month, focus: 'connect' }]),
  ['어린 자녀', { stage: 'career', focus: 'rest', age: 36, relationship: 'married', children: 'young' }],
  ['학령기 자녀', { stage: 'career', focus: 'rest', age: 42, relationship: 'married', children: 'school' }],
  ['운동과 공부', { stage: 'career', focus: 'rest', exercise: true, extraStudy: true }],
  ['은퇴 후 집', { stage: 'retirement', age: 68, focus: 'rest', month: 11 }],
];
function Gallery() {
  const [group, setGroup] = useState('rooms');
  const [narrow, setNarrow] = useState(false);
  const [running, setRunning] = useState(false);
  const scenes: [string, Partial<LifeSceneProps>][] = group === 'rooms' ? rooms : group === 'seasons' ? seasons : SPECIALTIES.map(s => [s.name, { stage: 'career', age: 38, specialty: s.id }]);
  return <main>
    <style>{`*{box-sizing:border-box}body{margin:0;background:#edf0e8;color:#34443e;font-family:system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:24px}h1{font-size:22px;margin:0 0 8px}nav{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 24px}button{padding:9px 16px;border:1px solid #c8d0c3;border-radius:6px;background:#fafbf7;color:inherit;cursor:pointer}button[aria-pressed=true]{background:#d9e2d0}section.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.tile{min-width:0;border-radius:10px;overflow:hidden;background:#fafbf7;box-shadow:0 2px 10px #273e3808}.tile>h2{font-size:12px;font-weight:500;margin:0;padding:10px 16px;background:#e1e7db}.tile .ls-header{padding:12px 16px}.tile .ls-header h2{font-size:15px}.tile .ls-footer{padding:0 16px}.tile .ls-scene-caption{bottom:10px;left:16px;font-size:11px}.gallery.narrow{width:390px;max-width:100%;grid-template-columns:1fr}@media(max-width:900px){section.gallery{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){main{padding:12px}section.gallery{grid-template-columns:1fr}}`}</style>
    <h1>의생게임 장면 모음</h1><p style={{ margin: 0, fontSize: 13 }}>장소 · 전공 · 계절 · 생활</p>
    <nav aria-label="미리보기 설정">
      <button aria-pressed={group === 'rooms'} onClick={() => setGroup('rooms')}>장소 12종</button>
      <button aria-pressed={group === 'specialties'} onClick={() => setGroup('specialties')}>전공 26종</button>
      <button aria-pressed={group === 'seasons'} onClick={() => setGroup('seasons')}>계절과 생활</button>
      <button onClick={() => setNarrow(v => !v)}>{narrow ? '전체 폭' : '390px 폭'}</button>
      <button onClick={() => setRunning(v => !v)}>{running ? '일시정지' : '움직임 재생'}</button>
    </nav>
    <section className={`gallery${narrow ? ' narrow' : ''}`} aria-label="장면 목록">
      {scenes.map(([name, props]) => <article className="tile" key={name}><h2>{name}</h2><LifeScene {...base} {...props} running={running}/></article>)}
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Gallery/>);
