// Separate visual fixture: never opens or changes a player's saved game.
import { createRoot } from 'react-dom/client';
import PlayLog, { JournalHistory } from '../../src/PlayLog';
import CareerPanel from '../../src/CareerPanel';
import { createCareerGame } from '../../src/career-runtime';
import type { JournalEntry } from '../../src/contracts';
import '../../src/style.css';
import '../../src/brand.css';
import '../../src/refinement.css';
import '../../src/scene-layout.css';
import '../../src/play-layout.css';

const game = createCareerGame('compact-journal-qa', 42);
const noop = () => {};
const entries: JournalEntry[] = [
  ...game.journal,
  ...Array.from({ length: 120 }, (_, i): JournalEntry => ({ id: `auto:money:${i}`, stage: 'university', title: '이번 달 수입과 지출', detail: '22세 · 수입 1000000원 · 지출 800000원 · 현금 2400000원 · 부채 0원', effects: {} })),
  { id: 'club', stage: 'university', title: '동아리 모집', detail: '20세 1개월 · 가입하지 않기', choice: { label: '가입하지 않기', context: '동아리 모집이 시작됐습니다. 모임에 나가면 공부와 휴식 시간이 줄어듭니다.', detail: '동아리에 가입하지 않고 공부와 휴식 시간을 남겼습니다.', effects: { knowledge: 1, health: 1 } }, effects: {} },
  { id: 'team', stage: 'university', title: '발표 준비', detail: '21세 2개월 · 동료와 나눠 맡기', choice: { label: '동료와 나눠 맡기', context: '발표 일주일 전, 팀원이 빠졌습니다.', detail: '남은 팀원들과 역할을 다시 나눴습니다. 맡을 분량을 줄여 발표를 마쳤습니다.', effects: { relationships: 2 } }, effects: {} },
  { id: 'incident:diagnosis:response', stage: 'career', title: '치료와 생활 조정', detail: '40세 3개월 · 치료비 1200000원을 냈습니다. 3개월간 업무량을 줄입니다.', importance: 'major', effects: { health: -15, happiness: -6 } },
  { id: 'choice:research', stage: 'career', title: '연구 교실', detail: '41세 · 연구 시작', choice: { label: '연구 교실로 가기', context: '연구와 교육에도 관심이 생겼습니다.', detail: '연구자로 일하며 교수 임용을 준비하기로 했습니다. 연구실의 동료와 계획을 의논했습니다.', effects: { knowledge: 2 } }, effects: {} },
];
createRoot(document.getElementById('root')!).render(<div className="app-shell play-shell"><main className="content"><div className="life-layout"><div className="life-primary"><CareerPanel game={game} busy={false} act={noop}/></div><aside className="life-companions"><PlayLog entries={entries} onOpenJournal={noop}/></aside></div><section className="panel journal"><h3>나의 생애 기록</h3><JournalHistory entries={entries}/></section></main></div>);
