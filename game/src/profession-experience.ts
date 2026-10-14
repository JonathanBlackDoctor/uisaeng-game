import type { GameState, EventChoice } from './contracts';
import { PROFESSION_STORIES, type ProfessionStory } from './profession-stories';
import { professionOf, professionDefinition, type AddedProfession } from './professions';
import { elapsedMonths } from './random-life';
import { shortPacing, condensedStory } from './pacing';

// Fictional situations and adjustable pacing; no claims about clinical outcomes.
const academic: Record<AddedProfession, [string, string]> = {
  dentistry: ['구강건강 연구의 첫 자료', '구강검진 자료에서 누락된 방문 기록을 발견했습니다. 지도자가 분석 전에 확인할 범위를 묻습니다.'],
  'korean-medicine': ['증례 자료를 모으는 날', '기관마다 증상 기록 방식이 다릅니다. 지도자와 비교할 수 있는 항목부터 정해야 합니다.'],
  nursing: ['돌봄 경험을 연구로', '환자 경험 설문에 퇴원 직전의 응답이 몰렸습니다. 지도자와 수집 시점의 영향을 검토합니다.'],
};
const endings: Record<AddedProfession, [string, string, string, string][]> = {
  dentistry: [
    ['현장을 떠난 뒤', '후배가 함께 다뤘던 기록을 두고 연락했습니다. 정기적으로 도울지, 이번 질문만 받을지 정합니다.', '정기적인 기록 검토 시간을 정하기', '이번 질문만 함께 확인하기'],
    ['남겨 둔 모형', '정리하던 모형과 설명 자료를 후배가 교육에 쓰고 싶다고 합니다.', '교육에 쓸 자료를 골라 정리하기', '후배와 설명 방법을 함께 점검하기'],
  ],
  'korean-medicine': [
    ['현장을 떠난 뒤', '후배가 예전에 함께 정리한 증례를 다시 묻습니다. 은퇴 후 어느 정도 참여할지 생각합니다.', '월 한 번 증례를 검토하기', '필요한 기록만 전달하기'],
    ['책장에 남은 일지', '오래된 일지에는 관찰과 해석이 섞여 있습니다. 후배가 배울 자료로 남겨 달라고 합니다.', '확인된 관찰부터 다시 정리하기', '후배와 해석의 한계를 검토하기'],
  ],
  nursing: [
    ['일을 내려놓은 뒤', '이제 출근 시간에 맞춰 일어나지 않습니다. 후배가 신규 교육에 가끔 참여해 달라고 연락했습니다.', '한 달에 한 번 교육 돕기', '자료를 보내고 쉬는 일정 지키기'],
    ['인계 노트를 건네며', '후배가 오래 써 온 인계 노트를 교육 자료로 정리하고 싶다고 합니다.', '개인정보를 빼고 사례 정리하기', '후배와 보고 순서를 다시 검토하기'],
  ],
};
export const EXPERIENCE_STORIES: ProfessionStory[] = (Object.keys(academic) as AddedProfession[]).flatMap(profession => {
  const [title, body] = academic[profession];
  return [
    { id: `${profession}:research:start`, profession, phase: 'training', track: 'research', title, body, actions: ['자료의 누락부터 확인하기', '지도자와 분석 범위 정하기'] },
    { id: `${profession}:research:protocol`, profession, phase: 'career', track: 'research', title: '자료를 받기 전', body: '초기에 정한 방법으로 새 자료를 받습니다. 참여 동의 범위와 보관 절차를 다시 확인해야 합니다.', actions: ['동의 범위와 보관 기록 대조하기', '연구팀과 수집 절차 점검하기'] },
    { id: `${profession}:research:review`, profession, phase: 'career', track: 'research', title: '심사 의견이 돌아왔다', body: '검토자가 자료의 한계와 현장 적용 범위를 물었습니다. 후배는 분석 결과만 먼저 고치자고 합니다.', actions: ['해석의 한계부터 다시 쓰기', '후배와 검토 의견을 나눠 살피기'] },
    { id: `${profession}:research:teaching`, profession, phase: 'career', track: 'research', title: '후배의 첫 발표', body: '후배가 연구 결과를 단정적으로 설명했습니다. 발표를 마친 뒤 질문과 답변을 함께 돌아봅니다.', actions: ['관찰과 해석을 나눠 정리하기', '후배와 다음 발표를 연습하기'] },
    ...endings[profession].map(([title, body, a, b], index): ProfessionStory => ({ id: `${profession}:retirement:${index}`, profession, phase: 'retirement', title, body, actions: [a, b] })),
  ];
});
export const professionStories = (s: GameState) => s.professional?.experienceVersion === 1 ? [...PROFESSION_STORIES, ...EXPERIENCE_STORIES] : PROFESSION_STORIES;
export function storyAvailable(s: GameState, e: ProfessionStory) {
  if (s.professional?.experienceVersion !== 1) return true;
  if (e.phase === 'retirement') return true;
  if (e.phase === 'university') {
    const index = Number(e.id.split(':life:')[1]);
    const band = Math.min(2, Math.floor(elapsedMonths(s) / professionDefinition(s).studyMonths * 3));
    return Math.floor(index / 4) === band;
  }
  if (s.career?.practice === 'research') return e.track === 'research';
  if (s.career?.specialty === 'nursing:research') return e.track === 'research' || e.specialty === 'nursing:research';
  if (e.track === 'research' || e.id.endsWith(':life:27')) return false;
  if (['nursing:insurance', 'nursing:education', 'nursing:management'].includes(s.career?.specialty ?? '') && e.profession === 'nursing' && e.id.includes(':life:')) {
    return [18,19,20,23,24,25,26].includes(Number(e.id.split(':life:')[1]));
  }
  if (e.id === 'dentistry:life:25') return s.career?.practice === 'clinic';
  return true;
}
export function professionStorySchedule(s: GameState, phase: ProfessionStory['phase']) {
  const short = shortPacing(s);
  const limits = condensedStory(s)
    ? { university: 1, training: 1, career: 2, retirement: 1 }
    : { university: short ? 4 : 7, training: short ? 3 : 4, career: short ? 8 : 10, retirement: 2 };
  const spans = { university: professionOf(s) === 'nursing' ? 48 : 72, training: s.professional!.trainingEnd - (s.progress!.trainingStartMonth ?? s.professional!.licenseMonth ?? 0), career: 564 - s.professional!.trainingEnd, retirement: 120 };
  return { limit: limits[phase], spacing: Math.max(3, Math.floor(spans[phase] / (limits[phase] + 1))) };
}
function previousStory(s: GameState, e: ProfessionStory) {
  const cutoff = s.professional!.decisions[`story:${e.id}`]?.month ?? elapsedMonths(s);
  const previousId = e.id.endsWith(':work') ? e.id.replace(/:work$/, ':learn') : e.id.endsWith(':improve') ? e.id.replace(/:improve$/, ':work') : e.id.endsWith(':research:review') ? `${e.profession}:research:protocol` : e.id.endsWith(':research:teaching') ? `${e.profession}:research:review` : undefined;
  return professionStories(s).filter(prior => prior.id !== e.id && prior.profession === e.profession && (!prior.specialty || prior.specialty === e.specialty))
    .map(prior => ({ scene: prior, decision: s.professional!.decisions[`story:${prior.id}`] }))
    .filter(x => x.decision && x.decision.month + 3 <= cutoff)
    .sort((a,b) => Number(b.scene.id === previousId) - Number(a.scene.id === previousId) || b.decision.month - a.decision.month || a.scene.id.localeCompare(b.scene.id))[0];
}
function completedAction(action: string) {
  const endings: [RegExp, string][] = [[/하기$/, '했습니다.'], [/보기$/, '봤습니다.'], [/묻기$/, '물었습니다.'], [/듣기$/, '들었습니다.'], [/살피기$/, '살폈습니다.'], [/받기$/, '받았습니다.'], [/나누기$/, '나눴습니다.'], [/맞추기$/, '맞췄습니다.'], [/쓰기$/, '썼습니다.'], [/세우기$/, '세웠습니다.'], [/만들기$/, '만들었습니다.'], [/고치기$/, '고쳤습니다.'], [/기다리기$/, '기다렸습니다.'], [/바꾸기$/, '바꿨습니다.'], [/맡기$/, '맡았습니다.'], [/잡기$/, '잡았습니다.'], [/줄이기$/, '줄였습니다.'], [/짜기$/, '짰습니다.'], [/내기$/, '냈습니다.'], [/읽기$/, '읽었습니다.'], [/적기$/, '적었습니다.'], [/짚기$/, '짚었습니다.'], [/지키기$/, '지켰습니다.'], [/알리기$/, '알렸습니다.'], [/찾기$/, '찾았습니다.'], [/주기$/, '줬습니다.'], [/고르기$/, '골랐습니다.'], [/남기기$/, '남겼습니다.'], [/모으기$/, '모았습니다.'], [/돕기$/, '도왔습니다.']];
  const ending = endings.find(([pattern]) => pattern.test(action));
  return ending ? action.replace(ending[0], ending[1]) : '정한 범위까지 확인하고 기록을 남겼습니다.';
}
export function professionStoryOutcome(s: GameState, e: ProfessionStory, id: string) {
  if (id === 'defer') return '담당자와 인계할 내용을 확인하고 맡을 범위를 줄였습니다. 남는 시간은 회복에 썼습니다.';
  if (id === 'reuse') return `‘${previousStory(s,e)!.scene.title}’에서 남긴 기록을 이번 상황에 맞게 고쳤습니다. 동료와 달라진 부분도 확인했습니다.`;
  return completedAction(e.actions[id === 'team' ? 1 : 0]);
}
export function connectedProfessionStory(s: GameState, e: ProfessionStory) {
  const previous = previousStory(s, e);
  const reusable = previous && previous.decision.choice !== 'defer';
  const choices: EventChoice[] = [
    { id: 'review', label: e.actions[0], description: '직접 확인할 시간을 더 씁니다. 지식 +3 · 건강 -2.', effects: { knowledge: 3, health: -2 } },
    { id: 'team', label: e.actions[1], description: e.phase === 'retirement' ? '참여할 범위를 줄여 여유를 남깁니다. 건강 +2 · 관계 +1.' : '역할을 나누고 함께 확인합니다. 관계 +3 · 지식 +1.', effects: e.phase === 'retirement' ? { health: 2, relationships: 1 } : { relationships: 3, knowledge: 1 } },
    ...(reusable ? [{ id: 'reuse', label: '앞서 남긴 기록을 고쳐 쓰기', description: `‘${previous.scene.title}’에서 정리한 내용을 활용합니다. 지식 +2 · 관계 +1.`, effects: { knowledge: 2, relationships: 1 } }] : []),
    { id: 'defer', label: '맡을 범위를 줄이고 인계하기', description: '학습보다 회복을 먼저 챙깁니다. 건강 +3 · 행복 +1.', effects: { health: 3, happiness: 1 } },
  ];
  const memory = previous ? `\n\n지난 ‘${previous.scene.title}’에서는 ${previous.decision.result}` : '';
  return { title: e.title, body: e.body + memory, choices };
}
