import type { GameState, Person, Stats } from './contracts';
import type { Story, StoryChoice } from './life-stories';
import { elapsedMonths, lifeAge } from './random-life';

// Authored people and opportunities, selected once from the run's starting seed.
export const PEER_IDS = ['peer-seat', 'peer-distance', 'peer-offer', 'peer-retirement'] as const;
export interface PeerMemory { version: 1; person: Person; route: 'hospital' | 'community' | 'research'; since: number }
const NAMES = ['지민', '서윤', '도현', '수빈', '민준', '하린'];
const ROUTES = ['hospital', 'community', 'research'] as const;
const choice = (id: string, label: string, outcome: string, followup: string, effects: Partial<Stats>, experience?: StoryChoice['experience']): StoryChoice => ({ id, label, description: outcome, outcome, followup, effects, experience });
export const PEER_STORIES: Story[] = PEER_IDS.map((id, stage) => ({ id, stage, title: '', body: '', choices: [['share', 'solo', 'rest'], ['team', 'meet', 'later'], ['join', 'visit', 'meet', 'decline'], ['reunion', 'walk', 'letter']][stage].map(id => choice(id, '', '', '', {})) }));
export function initialPeer(s: GameState): PeerMemory {
  const seed = s.life!.initialSeed >>> 0;
  return { version: 1, person: { id: `peer:${seed}`, name: NAMES[seed % NAMES.length], temperament: '계획을 세우고도 가끔 바꾸는 동기', occupation: '같은 조 동기' }, route: ROUTES[Math.floor(seed / NAMES.length) % 3], since: elapsedMonths(s) };
}
export function peerOccupation(s: GameState): string {
  const p = s.stories?.peer; if (!p) return '';
  return s.stageIndex === 0 ? '같은 조 동기' : s.stageIndex === 3 ? '일을 줄이고 동네 모임에 나가는 동기'
    : p.route === 'research' ? '연구실로 진로를 바꾼 동기' : p.route === 'community' ? '지역 병원에서 일하는 동기' : '다른 병원에서 일하는 동기';
}
export function peerRelationship(s: GameState): string {
  const d = s.stories?.decisions;
  if (d?.['peer-retirement']) return d['peer-retirement'].choice === 'letter' ? '편지로 안부를 나누는 사이' : '일 밖에서도 만나는 사이';
  if (d?.['peer-offer']) return d['peer-offer'].choice === 'join' ? '작은 일을 함께 마친 사이' : d['peer-offer'].choice === 'decline' ? '일 부탁 없이 안부를 묻는 사이' : '가끔 만나 근황을 듣는 사이';
  if (d?.['peer-distance']) return d['peer-distance'].choice === 'team' ? '서로 맡을 범위를 아는 사이' : d['peer-distance'].choice === 'meet' ? '멀리서도 만나려는 사이' : '각자 생활에 집중하는 사이';
  return d?.['peer-seat']?.choice === 'share' ? '함께 실습을 정리한 사이' : '같은 조에서 알게 된 사이';
}
export function peerStory(s: GameState, id: string): Story | null {
  const stage = PEER_IDS.indexOf(id as typeof PEER_IDS[number]), p = s.stories?.peer;
  if (stage < 0 || !p) return null;
  const n = p.person.name, d = s.stories!.decisions;
  const workplace = p.route === 'research' ? '연구실' : p.route === 'community' ? '지역 병원' : '다른 병원';
  if (stage === 0) return { id, stage, title: `${n}의 빈 실습 자리`, body: `같은 조 ${n}이 가족을 데리러 가야 한다며 실습 마지막 시간에 빠집니다. 내일 함께 내야 할 관찰 기록이 남았습니다. 내 시험 준비도 아직 끝나지 않았습니다.`, choices: [
    choice('share', '내가 본 부분을 적고 나머지는 같이 마치기', '오늘 본 내용만 먼저 적고 내일 나눠 마칩니다.', `${n}이 다음 날 일찍 와 남은 기록을 마쳤습니다. 다음 실습에서는 먼저 내 시간을 물었습니다.`, { relationships: 3, health: -1 }, 'people'),
    choice('solo', '각자 본 내용만 따로 제출하기', '대신 관찰했다고 쓰지 않고 제출 방식을 묻습니다.', `따로 쓴 기록을 비교하니 서로 놓친 부분이 보였습니다. ${n}과 필요한 때만 기록을 교환하기로 했습니다.`, { knowledge: 3 }, 'clinical'),
    choice('rest', '오늘은 쉬고 내일 담당자와 상의하기', '오늘 남아 마무리하는 일은 맡지 않습니다.', `${n}이 담당자와 보충 시간을 잡았습니다. 나는 다음 날 정해진 실습에 참석했습니다.`, { health: 3, happiness: 1 })] };
  if (stage === 1) {
    const earlier = d['peer-seat']?.choice;
    return { id, stage, title: '동기가 옮긴 곳', body: `${n}이 ${workplace}에서 새로 시작했다고 연락했습니다. 예상과 달라 이사를 다시 고민하고 있습니다. ${earlier === 'share' ? '실습 때 함께 마무리했던 일을 기억한다며, 이번에는 내가 바쁜 날에 맞추겠다고 합니다.' : earlier === 'solo' ? '예전처럼 서로 확인한 부분만 나누자며 새 환경에서 배운 것을 보내왔습니다.' : earlier === 'rest' ? '그때 대신 맡지 않아도 괜찮았다며 이번에도 무리하지 말라고 합니다.' : '학교를 떠난 뒤 처음으로 길게 근황을 전합니다.'}`, choices: [
      choice('team', '서로 쓸 수 있는 자료를 한 번씩 교환하기', '매주가 아닌 한 번의 교환으로 범위를 정합니다.', `${n}이 먼저 자료를 보내왔습니다. 서로 도움이 된 부분을 알려 주고 다음 연락은 필요할 때 하기로 했습니다.`, { knowledge: 2, relationships: 2 }, 'research'),
      choice('meet', '쉬는 날 만나 일 말고 근황 듣기', '지금 맡은 일을 늘리지 않고 만날 날을 잡습니다.', `${n}과 이사와 생활 이야기를 나눴습니다. 당장 진로를 정하지 않아도 다시 연락하기로 했습니다.`, { happiness: 3, relationships: 2 }, 'people'),
      choice('later', '내 일정을 말하고 이번에는 안부만 전하기', '정기 연락을 약속하지 않고 지금 할 수 있는 만큼 답합니다.', `${n}이 새 동료에게 도움을 구했습니다. 한동안 뜸했지만 이사를 마쳤다는 짧은 연락이 왔습니다.`, { health: 3 })] };
  }
  if (stage === 2) {
    const invited = d['peer-distance']?.choice === 'team', close = d['peer-distance']?.choice === 'meet';
    const topic = p.route === 'research' ? '작은 연구 발표를' : p.route === 'community' ? '동네 주민을 위한 설명 모임을' : '새 동료를 위한 적응 모임을';
    return { id, stage, title: invited ? '같이 해보자는 연락' : '동기의 새 소식', body: `${n}이 ${workplace}에서 자리를 잡고 ${topic} 준비합니다. ${invited ? '전에 주고받은 자료가 도움이 됐다며 내게 한 부분을 맡아 달라고 합니다. 두 번의 저녁 시간이 필요합니다.' : close ? '일보다 생활 이야기를 나눴던 사이여서, 일을 맡기기 전에 구경하러 올지부터 묻습니다.' : '새 동료들과 준비를 마쳤다며 소식을 전합니다. 이번에는 담당을 부탁하지 않고 와서 볼 수 있는 날을 알려 줍니다.'} ${s.family?.status === 'single' ? '그 시간에는 쉬거나 다른 약속을 잡을 수도 있습니다.' : '집에서 함께 보내기로 한 시간도 조정해야 합니다.'}`, choices: [
      invited ? choice('join', '한 부분만 맡고 두 번의 저녁 비우기', '내가 맡을 범위와 끝낼 날을 확인합니다.', `${n}과 약속한 부분을 마쳤습니다. 다음 모임은 새 담당자가 맡았고, 내 저녁 일정은 다시 비워 두었습니다.`, { knowledge: 4, health: -2, relationships: 2 }, p.route === 'research' ? 'research' : 'people')
        : choice('visit', '참석자로 가서 새 동료들 만나기', '준비를 맡는 대신 하루만 참석합니다.', `${n}이 함께 준비한 사람들을 소개했습니다. 각자 하는 일을 듣고 다음에는 일 밖에서 만나기로 했습니다.`, { happiness: 2, relationships: 3 }, 'people'),
      choice('meet', '모임 뒤 둘이 따로 만나기', '준비에는 참여하지 않고 끝난 뒤의 시간을 잡습니다.', `${n}이 모임을 마친 뒤 연락했습니다. 잘된 일과 아쉬웠던 일을 듣고 저녁을 함께 먹었습니다.`, { happiness: 3, relationships: 1 }, 'people'),
      choice('decline', '이번에는 가지 않고 안부 전하기', '현재의 일정과 쉬는 시간을 지킵니다.', `${n}이 다른 동료들과 모임을 마쳤습니다. 사진 한 장을 보내왔고 내게 일을 넘기지는 않았습니다.`, { health: 3 })] };
  }
  const joined = d['peer-offer']?.choice === 'join';
  return { id, stage, title: '일 얘기 없는 약속', body: `${n}도 일을 줄이고 동네 모임에 나가기 시작했습니다. ${joined ? '함께 준비했던 모임은 이제 다른 사람들이 이어 간다고 합니다.' : d['peer-offer'] ? '예전에 함께하지 못한 모임은 다른 동료들이 이어 갔다고 합니다.' : '각자 생활하느라 연락이 뜸했던 때도 있었습니다.'} 앞으로는 마감 없이 만나자며 언제가 편한지 묻습니다.`, choices: [
    choice('reunion', '한 달에 한 번 점심 약속 잡기', '정기 약속을 잡되 힘든 달에는 미루기로 합니다.', `${n}과 번갈아 식당을 골랐습니다. 바쁜 달에는 미뤘다가 다음 달에 다시 만났습니다.`, { happiness: 3, relationships: 3 }, 'people'),
    choice('walk', '날씨 좋은 날 산책하자고 하기', '날짜를 채우기보다 둘 다 괜찮은 날에 만납니다.', `${n}과 산책하다 각자 다니는 모임 이야기를 들었습니다. 다음 만남은 날이 풀리면 정하기로 했습니다.`, { health: 2, happiness: 2 }, 'people'),
    choice('letter', '가끔 편지로 소식 나누기', '자주 만나기 어려운 사정을 말하고 연락을 이어갑니다.', `${n}에게 책 한 권 이야기를 보냈습니다. 며칠 뒤 동네에서 찍은 사진과 짧은 답장이 왔습니다.`, { health: 1, relationships: 2 })] };
}
export function advancePeer(s: GameState): void {
  const p = s.stories?.peer; if (!p) return;
  const occupation = peerOccupation(s); p.person.occupation = occupation;
  const key = `auto:peer:stage:${s.stageIndex}`;
  if (!PEER_IDS.some(id => s.stories?.decisions[id]) || s.journal.some(x => x.id === key)) return;
  s.journal.push({ id: key, stage: ['university', 'training', 'career', 'retirement'][s.stageIndex] as 'university', title: `${p.person.name}의 근황`, detail: `${lifeAge(s)} · ${occupation}. ${peerRelationship(s)}로 연락을 이어갑니다.`, effects: {} });
}
export function validPeer(p: PeerMemory | undefined, month: number): boolean {
  return p === undefined || !!p && p.version === 1 && ROUTES.includes(p.route) && Number.isSafeInteger(p.since) && p.since >= 0 && p.since <= month && !!p.person && /^peer:\d+$/.test(p.person.id) && NAMES.includes(p.person.name) && typeof p.person.occupation === 'string' && typeof p.person.temperament === 'string';
}
