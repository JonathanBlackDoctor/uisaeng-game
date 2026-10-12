import type { Activity, GameEvent, LifeStage, Stats } from '../contracts';

// Integration-only sample values. No institutional rules, personal probabilities, or approved balancing.
export const STAGES: { id: LifeStage; label: string; chapter: string; subtitle: string }[] = [
  { id: 'university', label: '대학 생활', chapter: '배움의 시작', subtitle: '처음 입은 흰 가운보다, 앞으로의 내가 더 궁금한 날.' },
  { id: 'training', label: '수련 생활', chapter: '함께 배우는 시간', subtitle: '혼자 아는 것에서, 함께 해내는 것으로.' },
  { id: 'career', label: '의사의 일상', chapter: '나만의 방향', subtitle: '작은 선택들이 쌓여 당신만의 길이 됩니다.' },
  { id: 'retirement', label: '은퇴와 회고', chapter: '다시, 나를 만나다', subtitle: '지나온 길에 남은 것은 성적표만이 아닙니다.' },
];
export const ACTIVITIES: Record<Activity, { label: string; description: string; icon: string; effects: Partial<Stats> }> = {
  study: { label: '배움에 집중하기', description: '책을 펼치고 호기심을 따라갑니다.', icon: '책', effects: { knowledge: 6, health: -2 } },
  connect: { label: '사람들과 함께하기', description: '같이 걷는 사람의 이야기를 듣습니다.', icon: '벗', effects: { relationships: 6, happiness: 2 } },
  rest: { label: '나를 돌보기', description: '잠시 멈추고 숨을 고릅니다.', icon: '쉼', effects: { health: 6, happiness: 3 } },
};
export const FIXTURE_EVENTS: GameEvent[] = [
  { id: 'fixture-campus', stage: 'university', title: '도서관 창밖의 봄', body: '공부를 마치려던 순간, 동기가 잠깐 산책하자고 합니다. 계획해 둔 시간이 조금 남아 있습니다. 오늘은 무엇을 남기고 싶나요?', provenance: 'integration-fixture', choices: [
    { id: 'walk', label: '같이 걸으며 이야기를 듣는다', description: '관계 +4 · 행복 +2', effects: { relationships: 4, happiness: 2 } },
    { id: 'finish', label: '한 장만 더 읽고 합류한다', description: '지식 +4 · 관계 +1', effects: { knowledge: 4, relationships: 1 } },
  ] },
  { id: 'fixture-training', stage: 'training', title: '모르는 것을 묻는 용기', body: '함께 공부하던 내용에 설명하기 어려운 부분이 있습니다. 동료도 같은 지점에서 잠시 멈춥니다. 이 시간을 어떻게 보낼까요?', provenance: 'integration-fixture', choices: [
    { id: 'together', label: '함께 질문을 정리한다', description: '지식 +3 · 관계 +3', effects: { knowledge: 3, relationships: 3 } },
    { id: 'pause', label: '잠깐 쉬고 다시 살펴본다', description: '건강 +3 · 행복 +2', effects: { health: 3, happiness: 2 } },
  ] },
  { id: 'fixture-career', stage: 'career', title: '오래 가져가고 싶은 것', body: '하루를 정리하는 시간. 배운 것을 글로 남길 수도, 오랜 친구에게 안부를 전할 수도 있습니다. 당신은 어느 쪽에 마음이 가나요?', provenance: 'integration-fixture', choices: [
    { id: 'write', label: '오늘의 배움을 기록한다', description: '지식 +4 · 행복 +1', effects: { knowledge: 4, happiness: 1 } },
    { id: 'call', label: '소중한 사람에게 연락한다', description: '관계 +4 · 행복 +3', effects: { relationships: 4, happiness: 3 } },
  ] },
  { id: 'fixture-retirement', stage: 'retirement', title: '다음 페이지의 제목', body: '메모가 빼곡한 노트를 다시 펼칩니다. 당신이 선택한 순간들이 하나의 이야기가 되어 있습니다. 마지막 장에는 어떤 말을 적을까요?', provenance: 'integration-fixture', choices: [
    { id: 'learn', label: '배움은 계속된다', description: '지식 +2 · 행복 +3', effects: { knowledge: 2, happiness: 3 } },
    { id: 'people', label: '함께해 줘서 고마워', description: '관계 +2 · 행복 +3', effects: { relationships: 2, happiness: 3 } },
  ] },
];
export const FIXTURE_INITIAL_STATS: Stats = { health: 60, happiness: 55, knowledge: 40, relationships: 50 };
