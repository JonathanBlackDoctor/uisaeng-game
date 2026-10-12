import { STAT_LABELS, type EventChoice, type FamilyScene, type FamilyState, type GameEvent, type LifeStage, type MeetingRoute, type Stats } from './contracts';

// Fictional characters and adjustable preview effects, not evidence or personal probabilities.
export const MEETINGS: Record<MeetingRoute, { label: string; name: string; context: string }> = {
  gwating: { label: '과팅', name: '지우', context: '다른 학교 학생들과의 과팅에서 만난 지우' },
  'blind-date': { label: '소개팅', name: '서우', context: '친구의 소개로 만난, 다른 분야에서 일하는 서우' },
  campus: { label: 'CC', name: '하람', context: '같은 캠퍼스 동아리에서 자주 마주치던 하람' },
};
export const initialFamily = (): FamilyState => ({ status: 'single', meeting: null, children: 'none', care: 'none' });
export function familySummary(f: FamilyState): string {
  const person = f.meeting ? { ...MEETINGS[f.meeting], ...(f.partner ? { name: f.partner.name } : {}) } : null;
  const relation = f.status === 'single' ? f.partner ? `${f.partner.name} · 서로 알아가는 중 · ${person?.label}에서 시작된 인연` : '나의 속도로 지내는 중' : `${person?.name} · ${f.status === 'married' ? '배우자' : f.meeting === 'campus' ? '캠퍼스에서 시작한 연인 (CC)' : '연인'} · ${person?.label}에서 시작된 인연`;
  const children = { none: '자녀 없음', young: '어린 자녀와 함께', school: '학령기 자녀와 함께', adult: '성장한 자녀와 함께' }[f.children];
  const care = { none: '', shared: ' · 돌봄을 함께 분담', support: ' · 외부 돌봄 지원을 함께 활용' }[f.care];
  return `${relation} · ${children}${care}`;
}
type Option = EventChoice & { next: FamilyScene | null; update?: Partial<FamilyState> };
type Scene = { stage: LifeStage; title: string; body: string; options: Option[] };
function option(id: string, label: string, detail: string, effects: Partial<Stats>, next: FamilyScene | null = null, update?: Partial<FamilyState>): Option {
  const numbers = Object.entries(effects).map(([key, value]) => `${STAT_LABELS[key as keyof Stats]} ${value > 0 ? '+' : ''}${value}`).join(' · ');
  return { id, label, description: [detail, numbers].filter(Boolean).join(' · '), effects, next, update };
}
export function firstFamilyScene(stage: LifeStage, f: FamilyState): FamilyScene {
  if (stage === 'university') return 'meeting';
  if (stage === 'training') return f.status === 'single' ? 'single-life' : 'distance';
  if (stage === 'career') return f.children === 'young' ? 'care' : f.status === 'single' ? 'single-life' : 'couple-life';
  return 'family-recap';
}
function scene(id: FamilyScene, f: FamilyState, stage: LifeStage): Scene | null {
  const name = f.meeting ? MEETINGS[f.meeting].name : '';
  const withName = f.meeting === 'campus' ? '하람과' : `${name}와`;
  switch (id) {
    case 'meeting':
      if (f.status !== 'single' || f.meeting) return null;
      return { stage: 'university', title: '봄, 새로운 인연의 시작', body: '수업과 공부 사이에도 새로운 사람을 만날 시간은 있습니다. 어떤 만남에 마음이 가나요? 연애를 선택하지 않아도 당신의 이야기는 계속됩니다.', options: [
        option('gwating', '과팅에 나간다', '친구들과 다른 학교 학생들을 만납니다', {}, 'gwating', { meeting: 'gwating' }),
        option('blind-date', '친구에게 소개팅을 부탁한다', '서로를 알아가는 일대일 만남', {}, 'blind-date', { meeting: 'blind-date' }),
        option('campus', '같은 캠퍼스의 인연을 알아간다 (CC)', '동아리에서 시작되는 만남', {}, 'campus', { meeting: 'campus' }),
        option('single', '지금은 친구와 나의 생활에 집중한다', '연애 없이 다음 시기로 이어집니다', { happiness: 2 }),
      ] };
    case 'gwating':
    case 'blind-date':
    case 'campus': {
      if (f.meeting !== id || f.status !== 'single') return null;
      const stories = {
        gwating: ['과팅, 여럿 사이의 한 사람', '다른 학교 학생들과 모인 자리. 지우와 좋아하는 음악 이야기가 이어집니다. 친구들이 자리를 옮기자고 할 때, 지우가 다음에 따로 만나도 좋겠다고 말합니다.', '연락처를 나누고 둘이 만날 약속을 한다'],
        'blind-date': ['소개팅, 처음 마주한 오후', '친구가 소개해 준 서우와 카페에 앉았습니다. 서로 다른 일상을 듣다 보니 시간이 금방 갑니다. 서우도 다음 만남을 제안합니다.', '다음 쉬는 날에 다시 만나기로 한다'],
        campus: ['CC의 시작, 수업 뒤의 산책', '동아리 활동을 마치고 하람과 캠퍼스를 걷습니다. 같은 시험 기간, 자주 가는 식당 이야기에 웃음이 납니다. 하람이 둘만의 산책을 또 하자고 합니다.', '다음에도 둘이 만나기로 한다'],
      }[id];
      return { stage: 'university', title: stories[0], body: stories[1], options: [
        option('again', stories[2], '서로의 마음을 더 알아갑니다', { relationships: 2, happiness: 2 }, 'confession'),
        option('friends', '좋은 만남으로 남기고 연애는 시작하지 않는다', '서로의 선택을 존중합니다', {}, null, { meeting: null }),
      ] };
    }
    case 'confession':
      if (!f.meeting || f.status !== 'single') return null;
      return { stage: 'university', title: `${withName} 서로의 마음을 확인하다`, body: `몇 차례 만남 뒤, ${name}도 당신과 연인으로 만나고 싶다고 이야기합니다. 공부와 각자의 시간을 존중하며 관계를 시작할까요?`, options: [
        option('date', f.meeting === 'campus' ? '서로 동의하고 CC가 된다' : '서로 동의하고 연인이 된다', '교제를 시작합니다', { happiness: 3, relationships: 2 }, f.meeting === 'campus' ? 'cc-life' : null, { status: 'dating' }),
        option('friends', '친구로 지내고 싶다고 솔직하게 말한다', '연애를 시작하지 않습니다', {}, null, { meeting: null }),
      ] };
    case 'cc-life':
      if (f.meeting !== 'campus' || f.status !== 'dating') return null;
      return { stage: 'university', title: 'CC, 함께 있는 시간과 각자의 시간', body: '수업과 동아리에서도 자주 마주칩니다. 친구들이 두 사람의 관계를 묻기 시작하자, 하람과 어디까지 알릴지 이야기합니다.', options: [
        option('open', '둘이 합의한 친구들에게 알린다', '함께하는 시간과 공부 시간을 나눕니다', { relationships: 3, knowledge: 1 }),
        option('private', '당분간 둘만 알고 지낸다', '서로의 사생활과 각자의 시간을 지킵니다', { happiness: 2, knowledge: 2 }),
      ] };
    case 'distance':
      if (f.status !== 'dating') return null;
      return { stage: 'training', title: '수련과 연애, 엇갈린 약속', body: `수련 일정 때문에 ${withName}의 약속을 바꿨습니다. ${name}도 자기 일정을 계속 미루기는 어렵다고 말합니다. 서로의 생활을 어떻게 조율할까요?`, options: [
        option('schedule', '당직표를 공유하고 지킬 수 있는 약속을 잡는다', '둘의 일정과 휴식을 함께 고려합니다', { relationships: 3, health: 1 }, 'marriage'),
        option('talk', '서운했던 마음부터 차분히 듣는다', '오늘은 공부 시간을 줄여 대화합니다', { relationships: 4, knowledge: -1 }, 'marriage'),
        option('breakup', '대화 끝에 관계를 마무리한다', '각자의 생활로 돌아갑니다', {}, null, { status: 'single', meeting: null }),
      ] };
    case 'marriage':
      if (f.status !== 'dating') return null;
      return { stage: 'training', title: '둘이 그리는 다음 생활', body: `${withName} 앞으로 살 곳과 서로의 진로를 이야기합니다. 결혼 여부도 함께 결정하기로 했습니다.`, options: [
        option('marry', '서로의 진로와 생활을 의논하고 결혼한다', '배우자와 함께하는 생활을 시작합니다', { relationships: 2 }, 'parenthood', { status: 'married' }),
        option('stay', '결혼하지 않고 연인으로 함께한다', '교제를 이어가며 자녀 계획을 이야기합니다', { relationships: 2 }, 'parenthood'),
        option('separate', '원하는 삶이 달라 각자의 길을 선택한다', '혼자 살아가는 경로로 이어집니다', {}, null, { status: 'single', meeting: null }),
      ] };
    case 'parenthood':
      if (f.status === 'single') return null;
      return { stage: 'training', title: '우리의 자녀 계획', body: '아이를 키우고 싶은지, 돌봄에 쓸 시간과 지원을 마련할 수 있는지 함께 이야기합니다. 이 미리보기에서는 아이를 맞이하는 과정을 하나의 장면으로 묶습니다.', options: [
        option('child', '함께 준비하고 아이를 맞이한다', '다음 시기에 돌봄과 성장 사건이 이어집니다', {}, null, { children: 'young' }),
        option('childfree', '자녀 없이 둘의 삶을 이어간다', '자녀 없는 삶도 끝까지 이어집니다', {}),
      ] };
    case 'care':
      if (f.children !== 'young' || f.status === 'single') return null;
      return { stage: 'career', title: '육아, 오늘의 돌봄을 나누다', body: `${withName} 당신 모두 일정이 있는 주입니다. 아이의 등하원과 저녁 돌봄을 누가 맡을지, 휴식은 어떻게 확보할지 함께 정합니다.`, options: [
        option('share', '근무 일정을 조율하고 번갈아 돌본다', '돌봄 분담 · 공부할 시간은 조금 줄어듭니다', { relationships: 3, knowledge: -1 }, 'growth', { care: 'shared', children: 'school' }),
        option('support', '이용 가능한 돌봄 지원을 함께 알아본다', '지원과 직접 돌봄을 조합합니다', { health: 2, relationships: 1 }, 'growth', { care: 'support', children: 'school' }),
      ] };
    case 'growth':
      if (f.children !== 'school' || f.care === 'none') return null;
      return { stage: 'career', title: '자라는 아이, 달라지는 부모의 역할', body: '아이가 학교에서 있었던 일을 이야기하고 싶어 합니다. 준비하던 공부도 남아 있습니다. 가족과 의논해 아이의 이야기를 들을 시간을 마련합니다.', options: [
        option('listen', '오늘은 공부를 줄이고 충분히 듣는다', '아이와 대화하는 시간을 보냅니다', { relationships: 3, knowledge: -1 }),
        option('ritual', '함께 이야기하는 시간을 정해 꾸준히 지킨다', '가족 시간과 각자의 일정을 함께 지킵니다', { relationships: 2, happiness: 1 }),
      ] };
    case 'couple-life':
      if (f.status === 'single' || f.children !== 'none') return null;
      return { stage: 'career', title: '둘의 삶과 서로의 진로', body: `${name}에게 다른 지역에서 일할 기회가 생겼습니다. 당신의 근무와 상대의 진로를 함께 놓고 다음 생활을 의논합니다.`, options: [
        option('move', '근무지를 조율하며 함께 이동할 방법을 찾는다', '서로의 진로를 함께 고려합니다', { relationships: 2, knowledge: 1 }),
        option('apart', '각자의 진로를 지키며 만날 시간을 정한다', '거리가 있어도 함께할 계획을 세웁니다', { relationships: 2, health: 1 }),
      ] };
    case 'single-life':
      if (f.status !== 'single' || !['training', 'career'].includes(stage)) return null;
      return { stage, title: '나의 생활, 곁의 사람들', body: '연애나 결혼을 하지 않아도 일상에는 함께할 사람이 있습니다. 동료와 친구, 나 자신을 위한 시간을 어떻게 보내고 싶나요?', options: [
        option('friends', '친구와 동료에게 시간을 낸다', '일상 속 인연을 이어갑니다', { relationships: 3, happiness: 1 }),
        option('self', '휴식과 좋아하는 일에 시간을 쓴다', '나에게 맞는 생활을 가꿉니다', { health: 3, happiness: 1 }),
      ] };
    case 'family-recap':
      return { stage: 'retirement', title: '함께 살아온 모양', body: `${familySummary(f)}. ${f.children !== 'none' ? '이제 성장한 아이와 서로의 삶을 응원합니다.' : '선택한 생활 속에서 소중했던 순간을 떠올립니다.'} 어떤 시간을 다음 장에도 이어가고 싶나요?`, options: [
        option('people', '소중한 사람들과 시간을 나눈다', '나의 선택을 회고에 남깁니다', { relationships: 2, happiness: 2 }, null, f.children !== 'none' ? { children: 'adult' } : undefined),
        option('new', '서로를 응원하며 새로운 배움을 시작한다', '나의 선택을 회고에 남깁니다', { knowledge: 2, happiness: 2 }, null, f.children !== 'none' ? { children: 'adult' } : undefined),
      ] };
  }
}
export function familyEvent(id: FamilyScene, f: FamilyState, stage: LifeStage): GameEvent | null {
  const item = scene(id, f, stage);
  if (!item || item.stage !== stage) return null;
  return { id: `family-${id}`, familyScene: id, stage, title: item.title, body: item.body, provenance: 'family-preview', choices: item.options.map(({ next: _next, update: _update, ...choice }) => choice) };
}
export function settleFamily(id: FamilyScene, f: FamilyState, stage: LifeStage, choiceId: string) {
  const item = scene(id, f, stage);
  const choice = item?.stage === stage ? item.options.find(o => o.id === choiceId) : undefined;
  return choice ? { family: { ...f, ...choice.update }, next: choice.next, effects: choice.effects } : null;
}
