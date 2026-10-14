import type { EventChoice, GameEvent, GameState, Stats } from './contracts';
import { compactPacing, pacingArc, pacingStoryLimit } from './pacing';
import type { Experience } from './career';
import { elapsedMonths } from './random-life';
import { opportunitySubset } from './opportunities';
import { STAGES } from './fixtures/content';
import { lifeAge } from './random-life';
import { linkedStory, STORYLINE_IDS, STORYLINE_STORIES, storylineRecap } from './storyline';
import { PEER_IDS, PEER_STORIES, peerStory, initialPeer, advancePeer, validPeer, validPeerIdentity, peerRelationship, type PeerMemory } from './relationships';
import { SPECIALTY_CHAPTERS, specialtyChapter } from './specialty-chapters';

// Authored fictional situations; scheduling and effects are adjustable game rules.
export const STORY_RULES = { version: 'life-stories-provisional-4', provisional: true, spacing: [18, 18, 84, 30], perStage: [2, 2, 3, 2], followupMonths: 3, experience: 4 } as const;
export interface LifeStories { version: 1; narrativeVersion?: 1; peer?: PeerMemory; since: number; decisions: Record<string, { choice: string; month: number; followed: boolean }> }
export type StoryChoice = EventChoice & { outcome: string; followup: string; experience?: keyof Experience };
export type Story = { id: string; stage: number; title: string; body: string; choices: StoryChoice[]; eligible?: (s: GameState) => boolean };
const c = (id: string, label: string, effects: Partial<Stats>, outcome: string, followup: string, experience?: keyof Experience): StoryChoice => ({ id, label, description: outcome, effects, outcome, followup, experience });
export const LIFE_STORIES: Story[] = [
  { id: 'missed-lab', stage: 0, title: '실습 자리 하나', body: '보충 실습 자리가 하나 남았습니다. 같은 조 동기도 참석하고 싶어 합니다. 둘 다 다음 주 시험을 앞두고 있습니다.', choices: [
    c('share', '번갈아 참관할 수 있는지 묻기', { relationships: 2, knowledge: 1 }, '담당자에게 두 사람의 일정을 함께 보냅니다.', '짧게 나눠 참관한 뒤 동기와 서로 놓친 장면을 정리했습니다.', 'clinical'),
    c('take', '이번에는 내가 참석하기', { knowledge: 3, health: -1 }, '실습에 참석하고 동기에게 정리한 내용을 전합니다.', '동기가 보낸 질문을 들고 실습 선배를 다시 찾아갔습니다.', 'clinical'),
    c('yield', '동기에게 양보하고 시험 준비하기', { health: 1, knowledge: 1 }, '자리를 넘기고 남은 공부를 마칩니다.', '실습을 다녀온 동기가 필기와 함께 점심을 사 왔습니다.', 'study')] },
  { id: 'group-chat', stage: 0, title: '단체방에 올라온 답안', body: '시험 복기 자료에 출처가 불분명한 답이 섞였습니다. 동기들은 이대로 외워도 되는지 묻습니다.', choices: [
    c('check', '교재와 대조해 수정하기', { knowledge: 3, health: -1 }, '틀린 항목에 근거와 쪽수를 붙입니다.', '다음 시험에는 동기들이 나눠 확인한 자료를 보내왔습니다.', 'study'),
    c('ask', '조교에게 애매한 부분 묻기', { knowledge: 1, relationships: 2 }, '단정하지 않고 질문 목록을 모읍니다.', '조교의 답을 받아 단체방 자료를 함께 고쳤습니다.', 'people'),
    c('own', '내 정리본으로 공부하기', { health: 2 }, '자료 수정을 맡지 않고 공부 시간을 지킵니다.', '시험 뒤 틀린 문제만 골라 개인 노트에 남겼습니다.', 'study')] },
  { id: 'poster-print', stage: 0, title: '발표 전날 사라진 그림', body: '학생 발표 자료를 열었더니 그림 파일 일부가 빠져 있습니다. 공동 발표자는 야간 아르바이트 중입니다.', choices: [
    c('restore', '원자료에서 그림 다시 만들기', { knowledge: 3, health: -2 }, '분석 과정을 다시 확인하며 그림을 복원합니다.', '발표 때 그림을 만든 과정을 묻는 질문에 직접 답했습니다.', 'research'),
    c('simplify', '표 하나로 발표 줄이기', { knowledge: 1, health: 1 }, '확인된 결과만 남기고 발표 범위를 줄입니다.', '발표자는 분량이 줄어 핵심을 설명하기 편했다고 말했습니다.', 'research'),
    c('split', '연락해서 역할 다시 나누기', { relationships: 3 }, '서로 할 수 있는 작업과 마감 시간을 정합니다.', '발표가 끝난 뒤 다음 작업은 파일부터 함께 보관하기로 했습니다.', 'people')] },
  { id: 'roommate-exam', stage: 0, title: '룸메이트의 밤샘', body: '같이 사는 친구가 시험 때문에 밤마다 불을 켭니다. 며칠째 잠을 설쳤지만 친구도 초조해 보입니다.', choices: [
    c('agree', '불 끄는 시간 함께 정하기', { health: 2, relationships: 2 }, '서로 잘 시간과 공부할 장소를 정합니다.', '시험 뒤에도 약속한 시간을 지키며 같이 사는 일이 편해졌습니다.', 'people'),
    c('library', '도서관에서 같이 공부하기', { knowledge: 2, health: -1 }, '공부를 마치고 함께 돌아오기로 합니다.', '밤샘을 줄이고도 준비를 마친 경험이 다음 시험 계획에 남았습니다.', 'study'),
    c('rest', '오늘은 다른 곳에서 자기', { health: 3, happiness: -1 }, '친구에게 말하고 조용한 곳에서 잠을 보충합니다.', '푹 잔 뒤 친구와 다시 생활 시간을 이야기했습니다.')] },
  { id: 'club-reservation', stage: 0, title: '겹쳐 잡힌 모임 장소', body: '동아리 모임 장소가 다른 팀과 겹쳤습니다. 이미 도착한 신입 부원들이 복도에서 기다립니다.', eligible: s => !!s.campus?.club, choices: [
    c('outside', '근처에서 작은 모임 열기', { relationships: 3, happiness: 1 }, '오늘 할 수 있는 활동으로 내용을 바꿉니다.', '신입 부원 한 명이 다음 모임 장소를 직접 찾아왔습니다.', 'people'),
    c('negotiate', '다른 팀과 시간 나누기', { relationships: 2, knowledge: 1 }, '양쪽 계획을 듣고 짧게 나눠 쓰기로 합니다.', '장소 담당자와 공용 예약표를 만들었습니다.', 'people'),
    c('reschedule', '사과하고 다음 날짜 잡기', { health: 2, happiness: -1 }, '연락처를 확인하고 일정을 다시 안내합니다.', '다음 모임에는 기다리던 부원들이 다시 와 주었습니다.')] },
  { id: 'practice-note', stage: 0, title: '일지에서 빠진 한 문장', body: '실습 일지를 읽던 선배가 환자에게 어떤 설명을 했는지 묻습니다. 검사 내용만 적어 두어 기억이 흐립니다.', choices: [
    c('ask', '설명 과정을 선배와 되짚기', { knowledge: 2, relationships: 1 }, '확실히 기억하는 부분과 모르는 부분을 나눕니다.', '다음 실습 일지에는 환자의 질문과 설명도 함께 남겼습니다.', 'clinical'),
    c('template', '일지 양식부터 고치기', { knowledge: 3 }, '다음 기록에서 빠뜨리지 않을 칸을 만듭니다.', '동기가 새 양식을 써 보고 자신의 항목도 보탰습니다.', 'research'),
    c('limit', '기억나지 않는다고 말하기', { health: 1, relationships: 1 }, '추측해서 기록하지 않고 한계를 알립니다.', '선배가 다음 실습에서 설명을 함께 들어보자고 했습니다.', 'people')] },
  { id: 'handover', stage: 1, title: '인계 메모의 빈칸', body: '근무 교대 직전 인계 메모에 확인할 검사 한 가지가 빠졌습니다. 이전 근무자는 아직 병원을 나서지 않았습니다.', eligible: s => s.career?.application === 'accepted', choices: [
    c('call', '이전 근무자와 함께 확인하기', { relationships: 2, knowledge: 2 }, '확인한 내용과 담당자를 메모에 남깁니다.', '다음 교대에서 같은 누락을 발견해 공용 점검표에 항목을 추가했습니다.', 'clinical'),
    c('review', '기록을 다시 읽고 선배에게 묻기', { knowledge: 3, health: -1 }, '모호한 내용을 혼자 단정하지 않습니다.', '선배와 다시 검토하며 인계 전에 확인할 순서를 익혔습니다.', 'study'),
    c('pause', '인계를 잠시 멈추고 팀에 알리기', { health: 1, relationships: 1 }, '확인이 끝날 때까지 담당 공백을 막습니다.', '팀 회의에서 교대 시간이 겹치도록 일정을 조정했습니다.', 'people')] },
  { id: 'training-presentation', stage: 1, title: '갑자기 맡은 증례 발표', body: '발표 담당 동료가 아파 다음 주 발표를 부탁합니다. 자료는 절반만 정리되어 있습니다.', choices: [
    c('take', '범위를 줄여 발표 맡기', { knowledge: 3, health: -2 }, '확실히 설명할 수 있는 질문 하나에 집중합니다.', '발표 뒤 받은 질문을 동료와 나눠 다음 자료에 보탰습니다.', 'study'),
    c('pair', '둘이 나눠 발표하자고 제안하기', { relationships: 3, knowledge: 1 }, '동료의 회복과 준비 시간을 함께 고려합니다.', '짧게 나눈 발표가 끝나고 서로의 설명 방식에 관해 이야기했습니다.', 'people'),
    c('later', '일정을 바꿀 수 있는지 묻기', { health: 2 }, '무리해서 맡기 전에 담당자와 조율합니다.', '발표가 미뤄져 원래 담당 동료가 회복한 뒤 함께 준비했습니다.')] },
  { id: 'quiet-patient', stage: 1, title: '질문 없이 고개만 끄덕이는 환자', body: '설명이 끝나자 환자는 괜찮다고 합니다. 옆에 있던 보호자는 집에서 어떻게 해야 할지 다시 묻습니다.', eligible: s => s.career?.application === 'accepted', choices: [
    c('repeat', '환자의 말로 설명해 달라고 부탁하기', { knowledge: 2, relationships: 2 }, '어디까지 이해했는지 듣고 빠진 부분을 설명합니다.', '다음 방문에서 환자가 직접 적어 온 질문을 꺼냈습니다.', 'clinical'),
    c('write', '핵심 내용을 짧게 적어 주기', { knowledge: 2, health: -1 }, '집에서 확인할 내용과 연락할 곳을 함께 씁니다.', '동료와 안내문을 검토해 어려운 표현 몇 개를 고쳤습니다.', 'study'),
    c('team', '담당 팀과 다시 설명하기', { relationships: 3 }, '혼자 답하기 어려운 부분은 팀에 연결합니다.', '팀원이 같은 질문을 모아 설명 순서를 제안했습니다.', 'people')] },
  { id: 'weekend-swap', stage: 1, title: '동료의 근무 교환 부탁', body: '동료가 가족 행사 때문에 주말 근무를 바꿔 달라고 합니다. 내게도 오래전 잡은 약속이 있습니다.', choices: [
    c('half', '가능한 시간만 나눠 맡기', { relationships: 2, health: -1 }, '맡을 수 있는 시간을 분명히 말합니다.', '동료가 다음 일정에서 먼저 빈 시간을 나눠 주었습니다.', 'people'),
    c('refuse', '이번 약속은 지키겠다고 말하기', { health: 2, happiness: 1 }, '어려운 이유를 설명하고 다른 방법을 함께 찾습니다.', '동료가 다른 교환 상대를 찾아 약속을 지킬 수 있었습니다.'),
    c('schedule', '팀 전체 일정에서 교환 찾기', { relationships: 3, knowledge: 1 }, '한 사람에게 몰리지 않게 조정안을 만듭니다.', '다음 달부터 교환 요청을 모아 확인하는 표가 생겼습니다.', 'people')] },
  { id: 'training-budget', stage: 1, title: '배우고 싶은 교육, 빠듯한 시간', body: '관심 있는 교육 일정이 나왔습니다. 녹화 강의는 무료지만 직접 참석하려면 다른 일정을 줄여야 합니다.', choices: [
    c('recording', '녹화 강의를 나눠 듣기', { knowledge: 2, health: 1 }, '틈날 때 볼 분량을 정합니다.', '강의를 마친 뒤 헷갈린 부분을 동료와 비교했습니다.', 'study'),
    c('attend', '일정을 조정해 현장에 가기', { knowledge: 3, health: -2 }, '직접 질문할 내용을 준비합니다.', '교육에서 만난 동료가 관련 자료를 보내왔습니다.', 'clinical'),
    c('rest', '이번에는 쉬고 자료만 받기', { health: 3 }, '회복 시간을 먼저 확보합니다.', '쉬고 돌아와 필요한 자료 한 편부터 읽었습니다.')] },
  { id: 'first-pay', stage: 1, title: '첫 수입으로 정한 약속', body: '수입이 생기자 친구가 오랜만에 같이 저녁을 먹자고 합니다. 미뤄 둔 공부와 잠도 떠오릅니다.', choices: [
    c('meal', '가까운 곳에서 짧게 만나기', { happiness: 2, relationships: 2 }, '늦지 않게 돌아올 시간을 정합니다.', '짧은 저녁 뒤에도 서로 안부를 묻는 연락이 이어졌습니다.', 'people'),
    c('study', '오늘은 공부하고 주말에 만나기', { knowledge: 2, health: -1 }, '새 날짜를 정하고 오늘 계획을 마칩니다.', '약속한 주말에 만나 그동안의 생활을 이야기했습니다.', 'study'),
    c('sleep', '쉬고 나서 다시 연락하기', { health: 3 }, '피곤한 상태를 솔직하게 전합니다.', '친구가 쉬는 날에 맞춰 산책하자고 연락했습니다.')] },
  { id: 'work-queue', stage: 2, title: '밀린 일정과 늦은 예약', body: '오후 일정이 밀리는데 마지막 예약자가 먼 곳에서 왔다고 연락합니다. 팀원들도 퇴근 시간을 걱정합니다.', eligible: s => s.career?.practice !== 'research', choices: [
    c('team', '팀과 가능한 범위를 정해 안내하기', { relationships: 3, knowledge: 1 }, '기다릴 시간과 다른 가능한 일정을 설명합니다.', '팀이 비슷한 날에 쓸 안내 순서를 함께 정했습니다.', 'people'),
    c('extend', '오늘은 일정을 늘려 맡기', { knowledge: 2, health: -3 }, '팀원에게 먼저 묻고 남은 일정을 마칩니다.', '늦어진 근무 뒤 다음 주 일정 하나를 줄이기로 했습니다.', 'clinical'),
    c('reschedule', '다음 가능한 시간으로 조정하기', { health: 2, happiness: -1 }, '먼저 사정을 설명하고 다음 예약을 확인합니다.', '예약자가 다시 방문했고 처음 안내가 충분했는지 돌아봤습니다.')] },
  { id: 'new-colleague', stage: 2, title: '새 동료의 첫 주', body: '새로 온 동료가 같은 업무를 두 번 묻습니다. 내 일도 밀려 있지만 누구에게 물어야 할지 모르는 눈치입니다.', choices: [
    c('guide', '짧은 안내표를 같이 만들기', { relationships: 3, knowledge: 1 }, '질문이 자주 나오는 순서부터 적습니다.', '동료가 안내표에 자신이 익힌 내용을 덧붙였습니다.', 'people'),
    c('time', '질문할 시간을 따로 잡기', { health: 1, relationships: 2 }, '급한 질문과 모아 둘 질문을 나눕니다.', '정해 둔 시간에 이야기하니 서로 일을 중단하는 횟수가 줄었습니다.', 'people'),
    c('connect', '업무 담당 동료에게 연결하기', { relationships: 1, knowledge: 2 }, '가장 잘 아는 사람에게 함께 묻습니다.', '동료가 다음에는 누구에게 확인할지 스스로 찾았습니다.', 'study')] },
  { id: 'research-correction', stage: 2, title: '제출 뒤 발견한 계산 오류', body: '공유한 자료에서 계산식 하나가 잘못된 것을 발견했습니다. 결론이 달라질지는 다시 확인해야 합니다.', choices: [
    c('correct', '오류를 알리고 분석 다시 하기', { knowledge: 3, health: -2 }, '확인된 오류와 아직 모르는 영향을 구분합니다.', '수정 결과를 공유하고 동료와 검토 단계를 하나 늘렸습니다.', 'research'),
    c('peer', '동료와 원자료부터 대조하기', { knowledge: 2, relationships: 2 }, '서로 다른 방식으로 결과를 검산합니다.', '교차 검산에서 다른 누락도 찾아 함께 정정했습니다.', 'research'),
    c('pause', '자료 사용을 잠시 멈춰 달라고 알리기', { health: 1, relationships: 1 }, '확인 전까지 잘못 쓰이지 않도록 안내합니다.', '확인이 끝난 자료를 다시 보내고 변경점을 남겼습니다.', 'people')] },
  { id: 'old-classmate', stage: 2, title: '다른 길로 간 동기의 연락', body: '연구소로 옮긴 동기가 작은 공동 작업을 제안합니다. 주말 몇 번이 필요하고 성과는 아직 알 수 없습니다.', choices: [
    c('trial', '작은 질문 하나부터 함께 하기', { knowledge: 3, health: -1 }, '범위와 끝낼 날짜를 먼저 정합니다.', '작업을 마치고 다음에는 무엇을 더 확인할지 함께 적었습니다.', 'research'),
    c('advice', '한 번 만나 의견만 나누기', { relationships: 3, knowledge: 1 }, '지금 가능한 도움의 범위를 전합니다.', '동기가 조언을 반영한 초안을 보내왔습니다.', 'people'),
    c('decline', '현재 일정을 설명하고 거절하기', { health: 2 }, '지금 맡은 일과 쉬는 시간을 지킵니다.', '동기와 일 대신 가끔 안부를 나누기로 했습니다.')] },
  { id: 'home-repair', stage: 2, title: '휴일에 잡힌 집 수리', body: '집 수리 일정이 쉬는 날과 겹쳤습니다. 확인할 것이 많아 원래 잡은 약속을 조정해야 합니다.', choices: [
    c('list', '확인할 목록을 만들고 시간 정하기', { knowledge: 1, health: 2 }, '필요한 일을 줄여 남은 휴일을 확보합니다.', '다음 점검에는 목록 덕분에 빠뜨린 부분 없이 마쳤습니다.'),
    c('help', '가까운 사람에게 시간 나눠 부탁하기', { relationships: 3 }, '부탁할 수 있는 범위를 먼저 묻습니다.', '도와준 사람의 일정에도 시간을 내기로 했습니다.', 'people'),
    c('move', '약속을 옮기고 오늘 마무리하기', { health: -1, happiness: 2 }, '수리를 마친 뒤 집에서 쉽니다.', '다음 휴일에는 옮겼던 약속을 지켰습니다.')] },
  { id: 'work-boundary', stage: 2, title: '퇴근 뒤에도 울리는 연락', body: '급하지 않은 업무 연락이 저녁마다 옵니다. 바로 답하던 것이 어느새 당연한 일이 되었습니다.', choices: [
    c('hours', '답할 시간과 급한 연락 기준 정하기', { health: 3, relationships: 1 }, '팀과 연락 기준을 함께 확인합니다.', '저녁 연락이 줄고 급한 요청을 구분하기 쉬워졌습니다.', 'people'),
    c('delegate', '담당 창구를 나누자고 제안하기', { relationships: 2, knowledge: 2 }, '누가 답할지 불분명한 일을 정리합니다.', '팀 회의에서 담당이 겹친 업무 몇 가지를 나눴습니다.', 'people'),
    c('today', '오늘 일만 마치고 알림 끄기', { health: 2, happiness: 1 }, '답을 마친 뒤 쉬는 시간을 확보합니다.', '다음 주에는 반복되는 연락을 모아 팀에 이야기했습니다.')] },
  { id: 'library-shift', stage: 3, title: '동네 도서관의 빈 시간', body: '도서관에서 주 한 번 책 정리를 도울 사람을 찾습니다. 새로 생긴 자유 시간을 정기 일정으로 채울지 고민됩니다.', choices: [
    c('regular', '한 달만 정기적으로 해보기', { relationships: 3, health: -1 }, '일단 한 달 뒤 다시 정하기로 합니다.', '함께 일한 이웃과 책 이야기를 나누며 다음 달 일정도 정했습니다.', 'people'),
    c('once', '이번 행사만 돕기', { happiness: 2, relationships: 1 }, '정기 약속 대신 하루를 보탭니다.', '행사에서 만난 이웃이 다음 행사를 알려왔습니다.', 'people'),
    c('read', '이용자로 책 빌려 읽기', { knowledge: 2, health: 1 }, '내 속도대로 읽을 책을 고릅니다.', '다 읽은 책에 짧은 메모를 남기고 다른 책을 빌렸습니다.', 'study')] },
  { id: 'retired-mentor', stage: 3, title: '후배가 부탁한 이야기', body: '후배가 진로 모임에서 일했던 경험을 들려 달라고 합니다. 잘된 일뿐 아니라 어려웠던 일도 떠오릅니다.', choices: [
    c('honest', '어려웠던 일까지 함께 준비하기', { relationships: 2, knowledge: 2 }, '누군가를 알아볼 수 있는 내용은 빼고 경험을 정리합니다.', '모임 뒤 후배가 자신의 고민을 담은 편지를 보냈습니다.', 'people'),
    c('small', '소수의 후배와 대화하기', { happiness: 2, relationships: 2 }, '강연 대신 질문을 듣는 자리를 제안합니다.', '후배의 질문 덕분에 익숙했던 일도 다시 돌아봤습니다.', 'people'),
    c('letter', '글로 짧게 전하기', { knowledge: 2, health: 1 }, '지금 말하고 싶은 내용만 적어 보냅니다.', '후배가 글을 읽고 자신에게 필요한 질문을 보내왔습니다.', 'study')] },
  { id: 'walking-route', stage: 3, title: '늘 걷던 길의 공사', body: '산책로 일부가 막혔습니다. 이웃은 조금 먼 새 길로 가자고 하고 오늘은 몸이 무겁습니다.', choices: [
    c('short', '가까운 길로 짧게 걷기', { health: 3 }, '오늘 컨디션에 맞춰 거리를 줄입니다.', '짧은 코스를 꾸준히 걸으며 무리 없이 산책을 이어갔습니다.'),
    c('new', '이웃과 새 길 천천히 가보기', { health: 1, happiness: 2, relationships: 1 }, '중간에 쉬어갈 곳을 정합니다.', '새 길에서 찾은 벤치가 이웃과 만나는 장소가 되었습니다.', 'people'),
    c('rest', '오늘은 집에서 쉬기', { health: 2, happiness: 1 }, '쉬고 내일의 몸 상태를 보기로 합니다.', '다음 날에는 가까운 길을 골라 다시 걸었습니다.')] },
  { id: 'archive-box', stage: 3, title: '정리하다 나온 오래된 상자', body: '책장 뒤에서 학생 때의 노트와 편지가 나왔습니다. 남길 것과 정리할 것을 고르다 한참 멈춰 섰습니다.', choices: [
    c('scan', '몇 장만 골라 기록하기', { knowledge: 2, happiness: 2 }, '기억하고 싶은 내용에 날짜를 적습니다.', '정리한 사진을 보낸 동기에게서 잊고 있던 이야기가 돌아왔습니다.', 'study'),
    c('call', '편지를 보낸 사람에게 연락하기', { relationships: 3, happiness: 1 }, '오랜만에 안부를 묻습니다.', '각자 기억하던 일을 이야기하며 다시 만날 날짜를 잡았습니다.', 'people'),
    c('clear', '필요한 것만 남기고 정리하기', { health: 2 }, '공간을 비우고 오늘 쓰는 물건을 놓습니다.', '정리된 책상에서 읽고 싶던 책을 다시 펼쳤습니다.')] },
  { id: 'community-class', stage: 3, title: '수업을 계속 들을까', body: '동네 수업에서 따라가기 어려운 부분이 생겼습니다. 옆자리 사람도 비슷한 표정으로 교재를 보고 있습니다.', choices: [
    c('together', '옆자리와 함께 복습하기', { knowledge: 2, relationships: 2 }, '서로 이해한 내용을 나눠 봅니다.', '둘이 함께 질문하니 다음 수업을 따라가기 수월했습니다.', 'people'),
    c('ask', '강사에게 느린 설명 부탁하기', { knowledge: 3 }, '막힌 부분을 정확히 물어봅니다.', '다른 수강생도 같은 부분이 어려웠다며 말을 걸어왔습니다.', 'study'),
    c('change', '부담이 적은 수업으로 바꾸기', { health: 2, happiness: 2 }, '즐길 수 있는 속도의 수업을 찾습니다.', '바꾼 수업에서 작은 과제 하나를 마쳤습니다.')] },
  { id: 'retirement-calendar', stage: 3, title: '약속으로 찬 달력', body: '모임과 부탁을 하나씩 받다 보니 이번 주 달력이 꽉 찼습니다. 아무 일정 없는 날도 필요합니다.', choices: [
    c('blank', '하루는 비워 두기', { health: 3, happiness: 1 }, '한 약속을 조정하고 쉬는 날을 만듭니다.', '비워 둔 날 덕분에 다음 모임을 편하게 다녀왔습니다.'),
    c('combine', '비슷한 모임을 함께 잡기', { relationships: 2, knowledge: 1 }, '상대의 뜻을 묻고 일정을 묶습니다.', '서로 처음 본 사람들이 다음 만남을 함께 제안했습니다.', 'people'),
    c('keep', '이번 주만 하고 다음부터 줄이기', { health: -2, happiness: 3 }, '잡은 약속은 지키되 새 부탁은 미룹니다.', '바쁜 주를 보낸 뒤 달력에 쉴 날부터 표시했습니다.')] },
  ...STORYLINE_STORIES,
];
LIFE_STORIES.push(...PEER_STORIES, ...SPECIALTY_CHAPTERS);
export const initialStories = (month = 0): LifeStories => ({ version: 1, narrativeVersion: 1, since: month, decisions: {} });
const definition = (s: GameState, id: string, legacy = false) => id.startsWith('peer-') ? peerStory(s, id) : id.startsWith('specialty-') ? specialtyChapter(s, id) : linkedStory(s, id, LIFE_STORIES, legacy) ?? LIFE_STORIES.find(x => x.id === id);
export function upgradeStoryPeople(s: GameState): void { if (s.stories && !s.pendingEvent) s.stories.peer ??= initialPeer(s); }
const keyOf = (id: string) => `story:${id}`;
export function storyEvent(s: GameState, key: string, legacy = false): Pick<GameEvent, 'title' | 'body' | 'choices'> | null {
  const [, id, follow] = key.split(':');
  const story = definition(s, id, legacy);
  if (!story || !/^story:[a-z-]+(?::follow)?$/.test(key)) return null;
  if (follow) {
    const d = s.stories?.decisions[id], selected = story.choices.find(x => x.id === d?.choice);
    if (!selected || !d || d.followed || elapsedMonths(s) < d.month + STORY_RULES.followupMonths) return null;
    return { title: `${story.title} · 그 뒤`, body: selected.followup, choices: [
      { id: 'keep', label: '이 경험을 다음에도 써보기', description: '배운 내용을 정리합니다.', effects: { knowledge: 1 } },
      { id: 'share', label: '함께한 사람에게 안부 전하기', description: '다시 연락합니다.', effects: { relationships: 1 } }] };
  }
  if (story.stage !== s.stageIndex || s.stories?.decisions[id] || (story.eligible && !story.eligible(s))) return null;
  return { title: story.title, body: story.body, choices: story.choices.map(({ id, label, description, effects }) => ({ id, label, description, effects })) };
}
export function requiredStory(s: GameState): string | null {
  const v = s.stories, m = elapsedMonths(s); if (!v) return null;
  const compact = compactPacing(s);
  if (Object.keys(v.decisions).filter(id => LIFE_STORIES.find(x => x.id === id)?.stage === s.stageIndex).length >= (compact ? pacingStoryLimit(s) : STORY_RULES.perStage[s.stageIndex])) return null;
  const start = [0, s.progress?.trainingStartMonth ?? 72, 144 + Math.max(0, (s.progress?.trainingStartMonth ?? 72) - 72), (s.aging?.retirementMonth ?? (564 + Math.max(0, (s.progress?.trainingStartMonth ?? 72) - 72)))][s.stageIndex];
  const last = Math.max(v.since, start, ...Object.entries(v.decisions).filter(([id]) => LIFE_STORIES.find(x => x.id === id)?.stage === s.stageIndex).map(([, d]) => d.month));
  if (m - last < STORY_RULES.spacing[s.stageIndex]) return null;
  const arc = STORYLINE_IDS[s.stageIndex];
  if (v.narrativeVersion === 1 && (!compact || pacingArc(s) === 'notebook') && !v.decisions[arc]) return keyOf(arc);
  const peer = PEER_IDS[s.stageIndex];
  if (v.peer && (!compact || pacingArc(s) === 'peer') && !v.decisions[peer]) return keyOf(peer);
  const chapterId = `specialty-${s.career?.specialty}`;
  if (v.peer && s.stageIndex === 2 && !v.decisions[chapterId] && specialtyChapter(s, chapterId)) return keyOf(chapterId);
  const pool = LIFE_STORIES.filter(x => !SPECIALTY_CHAPTERS.includes(x) && !PEER_STORIES.includes(x) && !STORYLINE_STORIES.includes(x) && x.stage === s.stageIndex && !v.decisions[x.id] && (!x.eligible || x.eligible(s)));
  const selected = opportunitySubset(s, pool, `story:${s.stageIndex}`, 1)[0];
  return selected ? keyOf(selected.id) : null;
}
export function advanceStories(s: GameState): void {
  const v = s.stories; if (!v) return;
  advancePeer(s);
  for (const [id, d] of Object.entries(v.decisions)) {
    if (d.followed || elapsedMonths(s) < d.month + STORY_RULES.followupMonths) continue;
    const story = definition(s, id); if (!story) continue;
    const choice = story.choices.find(x => x.id === d.choice); if (!choice) continue;
    d.followed = true;
    s.journal.push({ id: `auto:story:${id}:follow`, stage: STAGES[s.stageIndex].id, title: `${story.title} · 그 뒤`, detail: `${lifeAge(s)} · ${choice.followup}`, effects: {} });
  }
}
export function settleStory(s: GameState, key: string, id: string): boolean {
  const event = storyEvent(s, key); if (!event?.choices.some(x => x.id === id)) return false;
  const [, storyId, follow] = key.split(':'), v = s.stories ??= initialStories(elapsedMonths(s));
  if (follow) v.decisions[storyId].followed = true;
  else {
    const selected = definition(s, storyId)!.choices.find(x => x.id === id)!;
    v.decisions[storyId] = { choice: id, month: elapsedMonths(s), followed: false };
    if (PEER_IDS.includes(storyId as typeof PEER_IDS[number]) && Object.keys(v.decisions).filter(k => PEER_IDS.includes(k as typeof PEER_IDS[number])).length === 1) s.life!.contacts = Math.min(20, s.life!.contacts + 1);
    if (selected.experience) s.career!.experience[selected.experience] = Math.min(100, s.career!.experience[selected.experience] + STORY_RULES.experience);
  }
  return true;
}
export function validStories(v: LifeStories | undefined, month: number): boolean {
  if (v === undefined) return true;
  return !!v && v.version === 1 && validPeer(v.peer, month) && (v.narrativeVersion === undefined || v.narrativeVersion === 1) && Number.isSafeInteger(v.since) && v.since >= 0 && v.since <= month && !!v.decisions && typeof v.decisions === 'object' && !Array.isArray(v.decisions)
    && Object.entries(v.decisions).every(([id, d]) => !!d && (!id.startsWith('peer-') || !!v.peer) && LIFE_STORIES.some(x => x.id === id && x.choices.some(c => c.id === d.choice)) && Number.isSafeInteger(d.month) && d.month >= v.since && d.month <= month && typeof d.followed === 'boolean' && (!d.followed || d.month + STORY_RULES.followupMonths <= month));
}
export function validStoryContext(s: GameState): boolean {
  const v = s.stories; if (!v) return true;
  if (!s.life) return false;
  if (v.peer) {
    if (!validPeerIdentity(s, v.peer) || v.peer.since < v.since) return false;
    if (PEER_IDS.some(id => v.decisions[id] && v.decisions[id].month < v.peer!.since)) return false;
  }
  const offer = v.decisions['peer-offer'];
  if (offer?.choice === 'join' && v.decisions['peer-distance']?.choice !== 'team') return false;
  if (offer?.choice === 'visit' && v.decisions['peer-distance']?.choice === 'team') return false;
  for (const [id, d] of Object.entries(v.decisions)) if (id.startsWith('specialty-') && d.choice === 'practiced' && !specialtyChapter(s, id)?.choices.some(x => x.id === 'practiced')) return false;
  return true;
}
export function finishStories(s: GameState): void {
  const detail = storylineRecap(s, LIFE_STORIES);
  if (detail && !s.journal.some(x => x.id === 'auto:storyline:recap')) s.journal.push({ id: 'auto:storyline:recap', stage: 'retirement', title: '남긴 일과 내려놓은 일', detail: `${lifeAge(s)} · ${detail}`, effects: {} });
  if (s.stories?.peer && PEER_IDS.some(id => s.stories?.decisions[id]) && !s.journal.some(x => x.id === 'auto:peer:recap')) s.journal.push({ id: 'auto:peer:recap', stage: 'retirement', title: `${s.stories.peer.person.name}과 이어진 시간`, detail: `${lifeAge(s)} · 같은 조에서 만난 ${s.stories.peer.person.name}. ${peerRelationship(s)}로 지냈습니다. ${s.stories.decisions['peer-offer']?.choice === 'join' ? '함께 맡은 모임은 다른 사람에게 넘겼습니다.' : '서로 맡은 일은 달라도 연락을 이어갔습니다.'}`, effects: {} });
}
