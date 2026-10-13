import type { GameState, EventChoice } from './contracts';
import type { Story, StoryChoice } from './life-stories';
import { campusClub } from './campus';
import { SPECIALTIES } from './career';

// Fictional continuing thread. It replaces one existing story slot per stage.
export const STORYLINE_IDS = ['shared-notebook', 'notebook-return', 'notebook-handover', 'notebook-ending'] as const;
const choice = (id: string, label: string, outcome: string, followup: string, effects: EventChoice['effects'], experience?: StoryChoice['experience']): StoryChoice =>
  ({ id, label, description: outcome, outcome, followup, effects, experience });
export const STORYLINE_STORIES: Story[] = STORYLINE_IDS.map((id, stage) => ({ id, stage, title: '', body: '', choices: ['lead', 'share', 'decline'].map(id => choice(id, '', '', '', {})) }));

function previous(s: GameState, stage: number, stories: Story[]) {
  const records = Object.entries(s.stories?.decisions ?? {}).flatMap(([id, record]) => {
    const story = stories.find(x => x.id === id), selected = story?.choices.find(x => x.id === record.choice);
    return story && story.stage < stage ? [{ story, record, selected }] : [];
  }).sort((a, b) => b.record.month - a.record.month);
  return records.find(x => x.story.id === STORYLINE_IDS[stage - 1]) ?? records[0];
}
function companion(s: GameState, stage: number) {
  const club = campusClub(s);
  if (club) return `${club.mentor.split(' 선배 ')[1]} 선배`;
  return stage === 0 || s.stories?.decisions['shared-notebook'] ? '같은 조였던 동기' : stage === 3 ? '모임의 후배' : '함께 일하는 동료';
}
function work(s: GameState, legacy = false) {
  const c = s.career!, specialty = SPECIALTIES.find(x => x.id === c.specialty)?.name;
  if (c.practice === 'research') return legacy ? '연구 자료의 확인 과정' : `${c.application === 'rejected' ? '지원에서 탈락한 뒤 ' : c.application === 'untrained' ? '수련을 택하지 않고 ' : ''}연구하며 남긴 자료의 확인 과정`;
  if (c.application === 'rejected') return '지원에서 탈락한 뒤 다시 준비하며 적은 질문';
  if (c.application === 'untrained') return '수련을 택하지 않고 일하며 확인한 업무 범위';
  if (c.application === 'accepted') return `${!legacy && c.attempts > 1 ? '재지원 끝에 들어간 ' : ''}${specialty ?? '선택한 과'}에서 배운 인계와 설명 과정`;
  return '지금 배우는 일의 확인 과정';
}
function home(s: GameState, legacy = false) {
  if (s.family?.status === 'single') return !legacy && s.stageIndex === 3 ? '새로 생긴 시간을 모두 약속으로 채우고 싶지는 않습니다.' : '퇴근 뒤 내 시간도 남겨 두고 싶습니다.';
  const who = s.family?.partner?.name ?? (s.family?.status === 'married' ? '배우자' : '연인');
  return `${withParticle(who)} 잡은 약속도 있어 저녁을 모두 쓸 수는 없습니다.`;
}
const withParticle = (name: string) => `${name}${(name.charCodeAt(name.length - 1) - 0xac00) % 28 === 0 ? '와' : '과'}`;
export function linkedStory(s: GameState, id: string, stories: Story[], legacy = false): Story | null {
  const stage = STORYLINE_IDS.indexOf(id as typeof STORYLINE_IDS[number]);
  if (stage < 0) return null;
  const who = companion(s, stage), prior = previous(s, stage, stories);
  const mode = prior?.record.choice === 'decline' ? 'decline' : prior?.record.choice === 'share' ? 'share' : 'lead';
  const earlier = prior && !STORYLINE_IDS.includes(prior.story.id as typeof STORYLINE_IDS[number]) && prior.selected
    ? `전에 ${prior.story.title}에서 ${prior.selected.label.replace(/기$/, '')}기로 했던 일을 떠올립니다. ` : '';
  if (stage === 0) return { id, stage, title: '끝내지 못한 작은 노트', body: `${who}가 실습 때 막혔던 질문을 모은 노트를 보여 줍니다. 다음 학년에게 주려면 틀린 답과 빈칸부터 확인해야 합니다. 시험 전이라 모두 맡기는 어렵습니다.`, choices: [
    choice('lead', '질문 하나를 맡아 끝까지 확인하기', '한 질문만 맡고 답이 없는 부분도 남깁니다.', `${who}가 다음 모임에서 그 질문을 꺼냈습니다. 다른 항목까지 부탁받아 맡을 범위를 다시 정했습니다.`, { knowledge: 3, health: -1 }, 'clinical'),
    choice('share', '각자 확인할 부분과 이름 적기', '혼자 완성하는 대신 누가 확인했는지 남깁니다.', `확인한 사람이 적힌 부분부터 후배가 읽었습니다. 답이 서로 다른 항목은 지우지 않고 다음에 비교하기로 했습니다.`, { relationships: 3, knowledge: 1 }, 'people'),
    choice('decline', '이번에는 맡지 않겠다고 말하기', '시험 준비를 위해 거절하고 받은 자료를 돌려줍니다.', `${who}가 다른 사람에게 부탁했습니다. 시험이 끝난 뒤에는 일 부탁 없이 안부만 물었습니다.`, { health: 3 }, 'study')] };
  if (stage === 1) {
    const link = prior?.story.id === 'shared-notebook'
      ? mode === 'decline' ? `${who}가 예전에 돌려준 노트를 다시 보내 왔습니다. 이번에도 맡으라는 뜻은 아니라며, 지금 하는 일과 맞지 않는 부분만 알려 달라고 합니다.`
        : mode === 'share' ? `${who}가 함께 나눠 적었던 노트를 보내 왔습니다. 작성자마다 답이 달라 후배가 어느 쪽을 따라야 할지 물었습니다.`
          : `${who}가 내가 확인했던 질문 옆에 새 질문들을 붙여 보냈습니다. 후배가 노트 전체도 확인한 줄 알고 물었다고 합니다.`
      : `${earlier}${who}가 새로 일하는 사람에게 줄 짧은 메모를 같이 보자고 합니다.`;
    return { id, stage, title: '다시 돌아온 질문', body: `${link} ${work(s, legacy)}에 맞춰 범위를 고쳐야 합니다.`, choices: [
      choice('lead', '직접 확인한 한 항목만 고쳐 보내기', mode === 'decline' ? '새 부탁은 한 항목만 맡겠다고 먼저 정합니다.' : '내가 확인한 범위와 확인하지 못한 부분을 구분합니다.', `${who}에게 확인한 항목과 한계를 보냈습니다. 후배는 나머지를 담당자에게 묻고 답을 기다리기로 했습니다.`, { knowledge: 3, health: -1 }, s.career?.practice === 'research' ? 'research' : 'study'),
      choice('share', '질문을 모아 각 담당자에게 확인하기', '답이 다른 항목은 담당자와 확인 날짜를 함께 남깁니다.', `서로 다른 답이 쓰인 이유를 담당자들과 확인했습니다. ${who}와 오래된 답에는 확인 날짜를 붙이기로 했습니다.`, { relationships: 3, knowledge: 1 }, 'people'),
      choice('decline', '현재 맡을 수 없다고 답하고 자료 돌려주기', '맡지 않은 일을 확인한 것처럼 남기지 않습니다.', `${who}가 담당자를 새로 찾았습니다. 내 이름은 확인자에서 빠졌고, 다음에는 안부만 나눴습니다.`, { health: 3, happiness: 1 })] };
  }
  if (stage === 2) {
    const link = prior?.story.id === 'notebook-return'
      ? mode === 'decline' ? `${who}가 이번에는 완성을 부탁하지 않고 새 담당자의 초안에 의견 한 가지만 묻습니다. 예전에 거절한 뒤 내 이름을 확인자에서 뺀 일이 떠오릅니다.`
        : mode === 'share' ? `함께 붙인 확인 날짜가 오래됐습니다. ${who}가 담당자가 바뀐 항목을 보여 주며 후배가 계속 쓸 수 있는지 묻습니다.`
          : `${who}가 내가 고쳤던 항목을 보내 왔습니다. 업무가 바뀌었는데도 내 이름이 남아 후배가 그대로 사용하려고 합니다.`
      : `${earlier}${who}가 새 담당자에게 넘길 설명을 부탁합니다.`;
    return { id, stage, title: '내 이름이 남은 자리', body: `${link} ${work(s, legacy)}도 예전과 같지는 않습니다. ${home(s, legacy)}`, choices: [
      choice('lead', '한 번 검토하고 다음 담당자 정하기', '오늘 확인할 범위와 내가 손을 뗄 날짜를 적습니다.', `정한 날에 다음 담당자가 질문을 받아 갔습니다. ${who}도 이후 연락을 그쪽으로 연결해 저녁 시간을 지킬 수 있었습니다.`, { knowledge: 2, health: -1, relationships: 1 }, 'study'),
      choice('share', '후배와 함께 오래된 항목부터 고치기', '답을 대신 써 주기보다 후배가 확인할 방법을 같이 찾습니다.', `후배가 직접 담당자에게 질문하고 수정 이유를 남겼습니다. ${who}에게 다음 검토는 후배가 맡기로 했다고 전했습니다.`, { relationships: 3, knowledge: 1 }, 'people'),
      choice('decline', '검토는 거절하고 내 확인 표시 지우기', '확인하지 못하는 자료에 책임자로 남지 않습니다.', `내 확인 표시는 빠졌고 새 담당자가 따로 검토했습니다. ${who}와는 자료 부탁 대신 가끔 근황을 나눴습니다.`, { health: 3, happiness: 1 })] };
  }
  const link = prior?.story.id === 'notebook-handover'
    ? mode === 'decline' ? `${who}가 내 이름이 빠진 새 노트를 보여 줍니다. 다른 담당자가 이어 썼고, 예전 자료는 이제 기록으로만 남았습니다.`
      : mode === 'share' ? `${who}가 후배가 다시 고친 노트를 가져왔습니다. 내가 대신 답하지 않고 함께 확인했던 부분에 새 담당자의 설명이 붙었습니다.`
        : `${who}가 내가 손을 뗀 뒤의 노트를 보여 줍니다. 정해 둔 담당자가 내용을 고쳤고 지금은 다른 후배가 이어받았습니다.`
    : `${earlier}${who}가 지나온 일을 다음 사람에게 어떻게 남길지 묻습니다.`;
  return { id, stage, title: '노트의 마지막 빈칸', body: `${link} ${home(s, legacy)} 지금 맡을 일을 늘리는 대신, 남길 범위를 정하려 합니다.`, choices: [
    choice('lead', '내가 겪은 한계와 바뀐 생각 적기', '잘된 결과뿐 아니라 틀렸던 판단과 거절한 이유도 적습니다.', `기록을 읽은 후배가 답을 그대로 따르기보다 지금 상황을 확인하겠다고 했습니다. 이후 수정은 현재 담당자에게 맡겼습니다.`, { knowledge: 2, happiness: 2 }, 'study'),
    choice('share', '남길 내용은 함께 정하고 후배에게 넘기기', '공유해도 되는 경험만 골라 다음 담당자에게 넘깁니다.', `${who}와 남길 내용을 확인했습니다. 노트는 후배에게 넘어갔고 다음 만남에는 일 대신 서로의 근황을 이야기했습니다.`, { relationships: 3, happiness: 1 }, 'people'),
    choice('decline', '개인 기록만 남기고 참여 마치기', '공유하지 않을 경험은 내 기록에 두고 더는 맡지 않겠다고 전합니다.', `${who}가 내 결정을 받아들였습니다. 기록은 개인 노트에 남았고 다른 사람의 작업은 다음 담당자가 이어갔습니다.`, { health: 3, happiness: 1 })] };
}

export function storylineRecap(s: GameState, stories: Story[]): string | null {
  const parts = STORYLINE_IDS.flatMap((id, stage) => {
    const selected = s.stories?.decisions[id];
    if (!selected) return [];
    const beat = linkedStory(s, id, stories)!, action = beat.choices.find(x => x.id === selected.choice)!;
    return [`${['대학 때', '일을 배우며', '일을 맡으며', '은퇴 뒤'][stage]} ${action.label.replace(/기$/, '')}기로 했습니다.`];
  });
  if (!parts.length) return null;
  const c = s.career!;
  const path = c.application === 'untrained' ? '수련을 택하지 않은 경로' : c.application === 'rejected' ? '지원에서 탈락한 뒤 이어 간 경로' : c.practice === 'research' ? '연구하며 이어 간 경로' : c.application === 'accepted' ? `${c.attempts > 1 ? '재지원 끝에 ' : ''}${SPECIALTIES.find(x => x.id === c.specialty)?.name ?? '선택한 과'} 수련을 거친 경로` : '내가 이어 간 경로';
  const relation = s.family?.status === 'single' ? '결혼을 택하지 않고' : withParticle(s.family?.partner?.name ?? (s.family?.status === 'married' ? '배우자' : '연인'));
  return `${parts.join(' ')} ${path}에서 맡은 일과 거절한 일이 함께 남았습니다. ${relation} 지내 온 생활도 이 기록의 일부입니다.`;
}
