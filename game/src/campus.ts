import type { GameState, GameEvent, Stats, EventChoice, CareerProgress } from './contracts';
import { type Experience, SPECIALTIES } from './career';
import { adjustStats, elapsedMonths, lifeAge, nextRandom } from './random-life';
import { STAGES } from './fixtures/content';

// Fictional campus stories and adjustable game effects, never real admissions data.
export const CAMPUS_RULES = { version: 'campus-stories-provisional-2', provisional: true, monthlyChance: 0.72, maxQuietMonths: 2, cooldown: 10, repeatLimit: 2, experienceGain: 3 };
export interface CampusState {
  version: 1; club: string | null; mentorMeetings: number; project: 'none' | 'accepted' | 'finished' | 'declined';
  projectDue: number; invitation: boolean; lastAmbient: number; lastMonth: number;
  seen: Record<string, { month: number; count: number }>; milestones: string[];
  automaticFunding: boolean;
}
type Club = { id: string; name: string; detail: string; mentor: string; specialty: string; experience: keyof Experience; project: string; invitation: string; outcome: string; notes: [string, string, Partial<Stats>][] };
export const CLUBS: Club[] = [
  { id: 'basketball', name: '농구부', detail: '주말 경기와 체력 훈련. 운동을 좋아하는 선배들과 만납니다.', mentor: '정형외과에 관심 있는 선배 지훈', specialty: 'orthopedics', experience: 'clinical', project: '교내 리그', invitation: '지훈 선배가 교내 리그 운영을 같이 맡자고 합니다. 연습과 시험 일정이 겹칩니다.', outcome: '리그를 마쳤습니다. 지훈 선배와 부상 뒤 복귀 과정을 이야기하고 정형외과를 새로 알아봤습니다.', notes: [['접전 끝의 한 골', '막판 패스가 득점으로 이어졌습니다. 지훈 선배와 손바닥을 마주쳤습니다.', { health: 2, happiness: 2 }], ['벤치에서 본 경기', '발목이 불편해 오늘은 기록을 맡았습니다. 지훈 선배와 회복 중인 선수의 일상을 이야기했습니다.', { health: -1, knowledge: 1 }], ['새벽 체육관', '시험이 끝난 동기들과 슛 연습을 했습니다. 낯설던 팀원과도 말이 트였습니다.', { relationships: 2 }]] },
  { id: 'band', name: '밴드부', detail: '합주와 공연 준비. 무대 밖에서도 함께 시간을 보냅니다.', mentor: '이비인후과에 관심 있는 선배 서연', specialty: 'ent', experience: 'people', project: '축제 공연', invitation: '서연 선배가 축제 무대에 같이 서자고 합니다. 합주 시간을 정하려면 다른 약속을 줄여야 합니다.', outcome: '축제 공연을 끝냈습니다. 서연 선배와 소리와 청력에 관해 이야기하며 이비인후과를 알아봤습니다.', notes: [['박자가 맞은 날', '몇 번을 틀리던 합주가 끝까지 이어졌습니다. 서연 선배가 녹음 파일을 보내줬습니다.', { happiness: 3, relationships: 1 }], ['공연장 예약 취소', '예약이 취소돼 연습실에서 작은 공연을 열었습니다. 생각보다 많은 친구가 왔습니다.', { happiness: 1, relationships: 2 }], ['합주 뒤 편의점', '서연 선배와 컵라면을 먹으며 시험 이야기를 했습니다. 다음 주에는 연습 시간을 줄이기로 했습니다.', { health: 1, relationships: 1 }]] },
  { id: 'volunteer', name: '지역 봉사 동아리', detail: '마을 방문과 생활 지원. 같은 주민을 여러 번 만납니다.', mentor: '가정의학과에 관심 있는 선배 민서', specialty: 'family', experience: 'people', project: '마을 방문 기록', invitation: '민서 선배가 다음 방문팀을 함께 꾸리자고 합니다. 주민들과 약속한 날짜를 계속 지켜야 합니다.', outcome: '주민들의 요청을 다음 방문팀에 넘겼습니다. 민서 선배와 생활 환경을 함께 보는 가정의학과를 알아봤습니다.', notes: [['기억해 준 이름', '지난번 만난 주민이 먼저 이름을 불렀습니다. 민서 선배와 오래 이야기를 듣고 돌아왔습니다.', { happiness: 2, relationships: 2 }], ['버스가 끊긴 저녁', '방문이 늦어져 돌아올 버스를 놓쳤습니다. 동기들과 다음 방문 동선을 다시 짰습니다.', { health: -1, relationships: 1 }], ['다시 읽은 메모', '민서 선배와 방문 메모를 읽다 놓친 부탁을 찾았습니다. 다음 팀에 꼭 전하기로 했습니다.', { knowledge: 2 }]] },
  { id: 'research', name: '연구 동아리', detail: '작은 연구 질문부터 자료 정리와 발표까지 해봅니다.', mentor: '예방의학과에 관심 있는 선배 도윤', specialty: 'preventive', experience: 'research', project: '학생 연구 발표', invitation: '도윤 선배가 학생 발표회에 자료를 같이 내자고 합니다. 주말마다 분석을 다시 확인해야 합니다.', outcome: '학생 발표회에서 질문을 받았습니다. 도윤 선배와 자료의 한계를 정리하며 예방의학과를 알아봤습니다.', notes: [['예상과 다른 그래프', '결과가 예상과 달랐습니다. 도윤 선배와 자료 누락부터 다시 살폈습니다.', { knowledge: 2, happiness: -1 }], ['밤늦은 초록 수정', '제출 전날 문장을 줄이고 또 줄였습니다. 동기와 마지막 표를 확인했습니다.', { knowledge: 2, health: -1 }], ['처음 받은 질문', '모임에서 발표하다 모르는 질문을 받았습니다. 도윤 선배가 함께 찾아보자고 했습니다.', { knowledge: 1, relationships: 1 }]] },
  { id: 'photo', name: '사진 동아리', detail: '출사와 전시. 서로 찍은 사진을 보며 이야기를 나눕니다.', mentor: '영상의학과에 관심 있는 선배 유진', specialty: 'radiology', experience: 'study', project: '작은 사진전', invitation: '유진 선배가 교내 사진전을 같이 열자고 합니다. 사진을 고르고 전시 설명도 직접 써야 합니다.', outcome: '사진전을 마쳤습니다. 유진 선배와 작은 차이를 읽는 이야기를 나누다 영상의학과를 알아봤습니다.', notes: [['비 오는 날의 출사', '출사를 취소하려다 처마 밑에서 사진을 찍었습니다. 유진 선배가 다른 구도를 보여줬습니다.', { happiness: 2, knowledge: 1 }], ['같은 장소, 다른 사진', '동기들의 사진을 펼쳐 놓았습니다. 같은 길에서 서로 다른 장면을 보고 있었습니다.', { relationships: 2 }], ['초점이 나간 사진', '마음에 들던 사진의 초점이 나갔습니다. 유진 선배와 실패한 사진도 함께 골라봤습니다.', { knowledge: 1, happiness: -1 }]] },
  { id: 'climbing', name: '등산 동아리', detail: '근교 산행과 길 찾기. 체력과 서로의 속도를 살핍니다.', mentor: '응급의학과에 관심 있는 선배 수현', specialty: 'emergency', experience: 'clinical', project: '신입 부원 산행', invitation: '수현 선배가 신입 부원 산행을 함께 준비하자고 합니다. 경로와 날씨, 참가자들의 체력을 확인해야 합니다.', outcome: '모두 함께 하산했습니다. 수현 선배와 예상 밖 상황에 대비하는 이야기를 나누며 응급의학과를 알아봤습니다.', notes: [['정상 대신 하산', '비가 굵어져 수현 선배와 하산을 정했습니다. 아쉬웠지만 내려와 먹은 국수가 맛있었습니다.', { health: 1, relationships: 1 }], ['뒤처진 동기와', '속도를 낮춰 동기와 함께 걸었습니다. 수현 선배도 뒤로 와서 말을 걸었습니다.', { health: 1, relationships: 2 }], ['처음 오른 능선', '숨이 차 몇 번이나 쉬었습니다. 능선에서 다음 산행 약속을 잡았습니다.', { health: 2, happiness: 2 }]] },
];
export const initialCampus = (): CampusState => ({ version: 1, club: null, mentorMeetings: 0, project: 'none', projectDue: 0, invitation: false, lastAmbient: 0, lastMonth: 0, seen: {}, milestones: [], automaticFunding: false });
export const campusClub = (s: GameState) => CLUBS.find(c => c.id === s.campus?.club);
const option = (id: string, label: string, description: string, effects: Partial<Stats> = {}): EventChoice => ({ id, label, description, effects });
const gain = (s: GameState, key: keyof Experience, n = CAMPUS_RULES.experienceGain) => { s.career!.experience[key] = Math.min(100, s.career!.experience[key] + n); };
const learn = (s: GameState, id: string) => { if (!s.career!.explored.includes(id)) s.career!.explored.push(id); };
function note(s: GameState, id: string, title: string, detail: string, effects: Partial<Stats> = {}) {
  if (s.journal.some(j => j.id === id)) return;
  s.stats = adjustStats(s.stats, effects);
  s.journal.push({ id, stage: STAGES[s.stageIndex].id, title, detail: `${lifeAge(s)} · ${detail}`, effects });
}
export function campusChoice(s: GameState, key: string): Pick<GameEvent, 'title' | 'body' | 'choices'> | null {
  const club = campusClub(s);
  if (key === 'club-required' || key === 'campus-club-kind') return { title: '어떤 동아리를 할까', body: '점심시간, 동아리 부스를 돌아봅니다. 정기적으로 함께할 사람과 활동을 골라봅니다.', choices: [...CLUBS.map(c => option(c.id, c.name, c.detail, { relationships: 2 })), option('pass', '동아리 없이 지내기', '친구·취미·수업에서 다른 경험을 쌓습니다.')] };
  if (key === 'campus-invitation' && club) return { title: club.project, body: club.invitation, choices: [option('lead', '함께 맡아보기', '세 달간 준비 · 활동 경험과 선배와의 후속 기회', { health: -2, relationships: 2 }), option('help', '한 번만 도와주기', '시간을 조금 내고 남은 일정은 지킵니다.', { relationships: 1 }), option('decline', '이번에는 빠지기', '지금 하고 있는 일에 집중합니다.', { health: 1 })] };
  if (key === 'campus-next-step' && club) return { title: `${club.mentor.split(' 선배 ')[1]} 선배의 연락`, body: `${club.project} 때 함께한 선배가 연락했습니다. 다음에는 전공 이야기를 더 나누거나 동아리 후배들을 함께 챙길 수 있습니다.`, choices: [option('specialty', `${SPECIALTIES.find(x => x.id === club.specialty)!.name} 더 알아보기`, '관심 전공을 바꾸고 관련 경험을 쌓습니다.', { knowledge: 2 }), option('mentor', '후배와 활동 이어가기', '선배와의 인연을 이어가며 모임 경험을 쌓습니다.', { relationships: 3 }), option('own', '내 일정 먼저 챙기기', '쉬는 시간을 확보합니다.', { health: 2 })] };
  const milestones: Record<string, Pick<GameEvent, 'title' | 'body' | 'choices'>> = {
    'campus-team': { title: '조별 과제의 빈자리', body: '발표를 일주일 앞두고 동기가 가족 일로 빠졌습니다. 남은 팀원들과 역할을 다시 나눠야 합니다.', choices: [option('study', '발표를 맡고 자료를 줄이기', '학업 경험 · 준비하느라 잠이 줄어듭니다.', { knowledge: 2, health: -1 }), option('people', '팀원들과 분량 다시 나누기', '모임 경험 · 함께 해결합니다.', { relationships: 2 }), option('research', '자료 검증을 맡기', '연구 경험 · 근거를 다시 확인합니다.', { knowledge: 1 })] },
    'campus-summer': { title: '여름을 어떻게 보낼까', body: '긴 방학이 생겼습니다. 한 가지를 골라 몇 주간 시간을 써보려 합니다.', choices: [option('research', '작은 연구에 참여하기', '연구 경험 · 낯선 질문을 다뤄봅니다.', { knowledge: 2 }), option('people', '친구와 여행 계획하기', '모임 경험 · 함께 시간을 보냅니다.', { happiness: 3, relationships: 1 }), option('work', '아르바이트 일정 늘리기', '주 활동을 아르바이트로 바꿉니다. 월 수입 발생', { health: -1 }), option('rest', '운동과 휴식 챙기기', '주 활동을 휴식으로 바꿉니다.', { health: 3 })] },
    'campus-practice': { title: '실습 뒤 남은 질문', body: '실습이 끝났는데도 한 장면이 자꾸 떠오릅니다. 동기들은 각자 다른 대목을 기억하고 있습니다.', choices: [option('clinical', '담당 선배에게 질문하기', '임상 경험 · 다음 실습에서 확인할 내용을 정합니다.', { knowledge: 2 }), option('research', '관련 자료를 찾아보기', '연구 경험 · 질문을 작은 주제로 좁힙니다.', { knowledge: 2 }), option('people', '동기들과 이야기 나누기', '모임 경험 · 서로 다르게 본 점을 듣습니다.', { relationships: 2 })] },
    'campus-final': { title: '졸업 전 마지막 학기', body: '지원 준비와 남은 활동이 겹칩니다. 어디에 시간을 더 쓸지 정합니다.', choices: [option('study', '시험 준비에 집중하기', '주 활동을 공부로 바꿉니다.', { knowledge: 2 }), option('clinical', '관심 분야 실습 정리하기', '주 활동을 임상 실습으로 바꿉니다.', { knowledge: 1 }), option('people', '친구들과 마지막 행사 준비하기', '주 활동을 모임으로 바꿉니다.', { happiness: 2, relationships: 2 })] },
  };
  return milestones[key] ?? null;
}
export function requiredCampus(s: GameState): string | null {
  if (s.stageIndex !== 0 || !s.campus) return null;
  const c = s.campus, m = elapsedMonths(s);
  if (s.progress!.club === 'joined' && !c.club) return 'campus-club-kind';
  if (c.invitation && c.project === 'none') return 'campus-invitation';
  if (c.project === 'finished' && m >= c.projectDue + 6 && !c.milestones.includes('campus-next-step')) return 'campus-next-step';
  for (const [key, at] of [['campus-team', 12], ['campus-summer', 24], ['campus-practice', 42], ['campus-final', 60]] as const) {
    if (m >= at && !c.milestones.includes(key)) return key;
  }
  return null;
}
export function settleCampusChoice(s: GameState, key: string, id: string): void {
  const c = s.campus ??= initialCampus(), club = campusClub(s);
  if (key === 'club-required' || key === 'campus-club-kind') {
    c.club = CLUBS.find(x => x.id === id)?.id ?? null;
    s.progress!.club = id === 'pass' ? 'declined' : 'joined';
    if (c.club) {
      if (!s.life!.flags.includes('club')) s.life!.flags.push('club');
      s.life!.contacts = Math.min(20, s.life!.contacts + 2);
      note(s, `auto:club:meet:${c.club}`, '새로 만난 선배', `${campusClub(s)!.mentor}와 연락처를 나눴습니다.`);
    }
    return;
  }
  if (!c.milestones.includes(key)) c.milestones.push(key);
  if (key === 'campus-invitation') {
    c.invitation = false; c.project = id === 'lead' ? 'accepted' : 'declined'; c.projectDue = elapsedMonths(s) + 3;
    if (club && id !== 'decline') { gain(s, club.experience, id === 'lead' ? 6 : 2); c.mentorMeetings++; }
  } else if (key === 'campus-next-step' && club) {
    if (id === 'specialty') { learn(s, club.specialty); s.career!.interest = club.specialty; gain(s, club.experience, 8); }
    if (id === 'mentor') { gain(s, 'people', 8); c.mentorMeetings += 2; }
  } else {
    if (['study', 'research', 'people', 'clinical'].includes(id)) gain(s, id as keyof Experience, 6);
    if (key === 'campus-final' || (key === 'campus-summer' && ['work', 'rest'].includes(id))) s.progress!.focus = id as CareerProgress['focus'];
  }
}
type Ambient = { id: string; title: string; body: string; effects: Partial<Stats>; experience?: keyof Experience; focus?: string; specialty?: string; club?: boolean };
const COMMON: Ambient[] = [
  { id: 'notes', title: '옆자리의 필기', body: '놓친 부분을 옆자리 동기가 보여줬습니다. 다음 수업은 같이 듣기로 했습니다.', effects: { knowledge: 1, relationships: 1 }, experience: 'study' },
  { id: 'rain', title: '갑자기 쏟아진 비', body: '우산 하나를 나눠 쓰고 학생회관까지 뛰었습니다. 젖은 신발을 보며 한참 웃었습니다.', effects: { happiness: 2, relationships: 1 } },
  { id: 'quiz', title: '생각보다 어려운 쪽지시험', body: '외웠던 문제와 달랐습니다. 틀린 부분을 동기와 다시 풀어봤습니다.', effects: { knowledge: 2, happiness: -1 }, experience: 'study', focus: 'study' },
  { id: 'meal', title: '길어진 점심시간', body: '식당에서 만난 동기들과 다음 학기 이야기를 했습니다. 몰랐던 수업 정보를 들었습니다.', effects: { relationships: 2 }, experience: 'people' },
  { id: 'sleep', title: '알람을 못 들은 아침', body: '무리한 일정 끝에 늦잠을 잤습니다. 오늘 약속 하나를 줄이고 쉬었습니다.', effects: { health: 2, knowledge: -1 } },
  { id: 'library', title: '도서관에서 만난 선배', body: '같은 책을 찾던 선배와 공부 방법을 비교했습니다. 막혔던 단원에 실마리가 생겼습니다.', effects: { knowledge: 2 }, experience: 'study', focus: 'study' },
  { id: 'lab-error', title: '번호가 뒤바뀐 자료', body: '연구 자료의 번호가 섞인 것을 발견했습니다. 팀과 대조하며 정리 방식을 바꿨습니다.', effects: { knowledge: 2, health: -1 }, experience: 'research', focus: 'research' },
  { id: 'seminar', title: '빈자리가 생긴 세미나', body: '취소된 자리에 참석했습니다. 질병을 개인 너머에서 보는 질문이 흥미로웠습니다. 예방의학과 탐색 기록이 생겼습니다.', effects: { knowledge: 1 }, experience: 'research', specialty: 'preventive', focus: 'research' },
  { id: 'child', title: '아이의 눈높이', body: '실습에서 선배가 아이 눈높이에 맞춰 앉는 모습을 봤습니다. 소아청소년과 탐색 기록에 남겼습니다.', effects: { knowledge: 1, happiness: 1 }, experience: 'clinical', specialty: 'pediatrics', focus: 'clinical' },
  { id: 'handover', title: '인계 때 빠진 질문', body: '실습 일지에 적은 질문을 선배가 읽고 설명해 줬습니다. 내일은 기록을 다르게 해보기로 했습니다.', effects: { knowledge: 2 }, experience: 'clinical', focus: 'clinical' },
  { id: 'shift', title: '동료의 근무 교환', body: '시험 주간 근무를 동료가 바꿔줬습니다. 다음번에는 내가 도와주기로 했습니다.', effects: { health: 1, relationships: 2 }, experience: 'people', focus: 'work' },
  { id: 'tutor', title: '설명하다 알게 된 것', body: '아르바이트에서 질문을 받고 설명을 바꿔봤습니다. 아는 것과 설명하는 것은 달랐습니다.', effects: { knowledge: 1, relationships: 1 }, experience: 'people', focus: 'work' },
  { id: 'walk', title: '평소와 다른 길', body: '산책하다 처음 보는 작은 공원을 찾았습니다. 다음에는 친구를 데려오기로 했습니다.', effects: { health: 2, happiness: 1 }, focus: 'rest' },
  { id: 'recipe', title: '같이 만든 저녁', body: '친구와 장을 보고 저녁을 만들었습니다. 설거지 순서를 두고 장난을 쳤습니다.', effects: { happiness: 2, relationships: 1 }, experience: 'people' },
  { id: 'friend-exam', title: '말수가 줄어든 친구', body: '시험을 망쳤다는 친구와 잠시 걸었습니다. 조언보다 들어주는 시간이 길었습니다.', effects: { relationships: 2, happiness: -1 }, experience: 'people' },
  { id: 'poster', title: '복도에서 멈춘 발걸음', body: '사진 전시 앞에서 처음 보는 학생과 이야기를 나눴습니다. 다음 전시 소식을 받기로 했습니다.', effects: { happiness: 2, relationships: 1 } },
  { id: 'anatomy', title: '서로 바꿔 본 실습 노트', body: '같은 실습을 보고도 기록이 달랐습니다. 빠뜨린 내용을 서로 채웠습니다.', effects: { knowledge: 2, relationships: 1 }, experience: 'clinical' },
  { id: 'presentation', title: '발표 순서가 바뀌었다', body: '갑자기 먼저 발표하게 됐습니다. 떨렸지만 질문까지 마치고 내려왔습니다.', effects: { knowledge: 1, happiness: 1 }, experience: 'study' },
  { id: 'cancel', title: '취소된 약속', body: '오래 기다린 모임이 취소됐습니다. 비워 둔 저녁에 밀린 잠을 잤습니다.', effects: { happiness: -1, health: 2 } },
  { id: 'alumni', title: '먼저 졸업한 선배의 전화', body: '졸업한 선배가 요즘 생활을 들려줬습니다. 진로 계획에서 궁금한 점이 하나 더 생겼습니다.', effects: { relationships: 1 }, experience: 'people' },
  { id: 'room-change', title: '바뀐 강의실', body: '옛 강의실 앞에서 만난 동기와 새 건물을 찾았습니다. 쉬는 시간에 서로 시간표를 보내줬습니다.', effects: { relationships: 1, knowledge: 1 } },
  { id: 'group-chat', title: '단체방의 잘못된 공지', body: '과제 마감일이 잘못 올라왔습니다. 원래 공지를 찾아 동기들에게 알렸습니다.', effects: { knowledge: 1, relationships: 1 }, experience: 'study' },
  { id: 'lost-card', title: '주인을 찾은 학생증', body: '식당에 떨어진 학생증을 돌려줬습니다. 같은 수업을 듣는 학생이었습니다.', effects: { relationships: 2 } },
  { id: 'late-bus', title: '늦어진 통학 버스', body: '버스가 늦어져 정류장에서 퀴즈를 내며 기다렸습니다. 틀린 답 하나가 오래 기억에 남았습니다.', effects: { knowledge: 1, health: -1 } },
  { id: 'empty-room', title: '빈 강의실의 공부 모임', body: '도서관에 자리가 없어 빈 강의실에 모였습니다. 화이트보드에 서로 모르는 내용을 적었습니다.', effects: { knowledge: 2, relationships: 1 }, experience: 'study' },
  { id: 'secondhand', title: '중고 책에 남은 메모', body: '빌린 책 여백에 선배의 질문이 남아 있었습니다. 같은 부분에서 막혀 선배에게 물어봤습니다.', effects: { knowledge: 2 }, experience: 'study' },
  { id: 'new-seat', title: '오늘은 다른 옆자리', body: '평소와 다른 자리에 앉았습니다. 처음 말해 본 동기와 다음 과제를 함께 하기로 했습니다.', effects: { relationships: 2 }, experience: 'people' },
  { id: 'lunch-box', title: '서로 바꾼 도시락 반찬', body: '도시락을 가져온 친구와 점심을 먹었습니다. 오후 수업 전까지 집 이야기를 나눴습니다.', effects: { happiness: 2, relationships: 1 } },
  { id: 'cold', title: '감기로 비운 하루', body: '하루 쉬는 동안 동기가 수업 자료를 보내줬습니다. 다음 주 일정에서 늦은 약속을 뺐습니다.', effects: { health: -1, relationships: 1 } },
  { id: 'repair', title: '고장 난 발표 파일', body: '발표 파일이 열리지 않았습니다. 팀원이 보관한 사본으로 복구하고 다음부터 함께 백업하기로 했습니다.', effects: { knowledge: 1, relationships: 1 }, experience: 'research' },
  { id: 'peer-question', title: '쉽게 답할 수 없던 질문', body: '동기가 왜 그런지 물었는데 대답이 막혔습니다. 수업 뒤 함께 설명을 찾아 읽었습니다.', effects: { knowledge: 2 }, experience: 'study' },
  { id: 'sports-day', title: '체육대회 계주', body: '급하게 빈 주자를 대신했습니다. 결승선 뒤에서 동기들과 숨을 고르며 웃었습니다.', effects: { health: 1, happiness: 2 } },
  { id: 'garden', title: '학생회관 앞 새 벤치', body: '수업 사이에 친구와 새 벤치에 앉았습니다. 다음 주 시험 이야기 없이 잠깐 쉬었습니다.', effects: { health: 1, happiness: 1 } },
  { id: 'birthday', title: '수업 끝나고 작은 케이크', body: '생일인 동기를 위해 케이크를 나눴습니다. 바빠서 놓쳤던 안부도 물었습니다.', effects: { relationships: 2, happiness: 1 } },
  { id: 'elective', title: '뜻밖에 재미있는 교양 수업', body: '빈 시간에 신청한 수업에서 새로운 주제를 만났습니다. 과제가 끝나도 관련 책을 더 읽었습니다.', effects: { knowledge: 2, happiness: 1 }, experience: 'study' },
  { id: 'missed-message', title: '뒤늦게 본 메시지', body: '친구가 보낸 연락을 늦게 봤습니다. 전화를 걸어 사정을 듣고 다음에 만날 날짜를 잡았습니다.', effects: { relationships: 1, happiness: -1 } },
  { id: 'work-rush', title: '갑자기 몰린 손님', body: '아르바이트 동료와 역할을 나누니 줄이 줄었습니다. 마감 뒤 서로 수고했다고 인사했습니다.', effects: { health: -1, relationships: 2 }, experience: 'people', focus: 'work' },
  { id: 'rest-run', title: '처음 끝까지 달린 코스', body: '늘 걷던 구간까지 천천히 달렸습니다. 오늘 기록을 친구에게 보내고 다음 주 약속을 잡았습니다.', effects: { health: 2, happiness: 1 }, focus: 'rest' },
  { id: 'research-source', title: '인용문 뒤의 원문', body: '인용된 문장이 원문과 조금 달랐습니다. 팀원과 출처를 대조하고 발표 자료를 고쳤습니다.', effects: { knowledge: 2 }, experience: 'research', focus: 'research' },
  { id: 'clinical-wait', title: '대기실에서 남은 질문', body: '실습 뒤 기다리는 시간이 환자에게 어떻게 느껴질지 동기와 이야기했습니다. 다음 실습 일지에 질문을 남겼습니다.', effects: { knowledge: 1, relationships: 1 }, experience: 'clinical', focus: 'clinical' },
];
const LATER: Ambient[] = [
  { id: 'coworker', title: '동료가 건넨 메모', body: '업무에서 놓치기 쉬운 부분을 동료가 메모로 남겼습니다. 나도 다음 사람에게 설명을 덧붙였습니다.', effects: { knowledge: 1, relationships: 1 } },
  { id: 'old-friend', title: '오랜 친구의 연락', body: '한동안 연락하지 못한 친구와 통화했습니다. 다음 쉬는 날에 보기로 했습니다.', effects: { happiness: 2, relationships: 1 } },
  { id: 'tired', title: '유난히 긴 하루', body: '해야 할 일이 겹쳐 식사가 늦었습니다. 다음 주 일정에서 쉬는 시간을 먼저 비웠습니다.', effects: { health: -1, happiness: -1 } },
  { id: 'quiet', title: '예정보다 일찍 끝난 날', body: '일을 일찍 마쳐 집까지 천천히 걸었습니다. 오랫동안 미뤄 둔 음악을 들었습니다.', effects: { health: 1, happiness: 2 } },
  { id: 'new-method', title: '익숙한 일을 새롭게', body: '다른 사람의 정리 방식을 보고 내 기록도 바꿔봤습니다. 다음번에는 조금 수월했습니다.', effects: { knowledge: 2 } },
  { id: 'family-call', title: '짧은 안부 전화', body: '가족과 전화를 하다 생각보다 오래 이야기했습니다. 서로의 다음 일정을 확인했습니다.', effects: { relationships: 1, happiness: 1 } },
  { id: 'later-rain', title: '비 때문에 바뀐 주말', body: '야외 약속 대신 친구 집에 모였습니다. 같이 요리하다 다음 휴가 이야기가 길어졌습니다.', effects: { happiness: 2, relationships: 1 } },
  { id: 'later-meal', title: '오랜만에 함께한 식사', body: '일정이 맞지 않던 동료와 식사를 했습니다. 요즘 막히는 일을 서로 들어줬습니다.', effects: { relationships: 2 } },
  { id: 'later-book', title: '빌려준 책이 돌아왔다', body: '친구가 책갈피에 짧은 메모를 끼워 돌려줬습니다. 주말에 읽어 볼 책을 하나 더 추천받았습니다.', effects: { knowledge: 1, happiness: 1 } },
  { id: 'later-schedule', title: '겹쳐 버린 약속', body: '달력에 약속 두 개가 겹쳤습니다. 미리 연락해 시간을 옮기고 함께 쓰는 일정을 정리했습니다.', effects: { knowledge: 1, happiness: -1 } },
  { id: 'later-walk', title: '저녁 산책 동행', body: '집 앞에서 만난 이웃과 한 바퀴 걸었습니다. 다음번에는 조금 더 긴 길을 가기로 했습니다.', effects: { health: 1, relationships: 1 } },
  { id: 'later-photo', title: '오래된 단체 사진', body: '휴대폰에서 대학 때 사진을 찾았습니다. 단체방에 올리자 한동안 뜸했던 친구들도 답했습니다.', effects: { happiness: 2, relationships: 1 } },
  { id: 'later-break', title: '쉬는 시간의 짧은 낮잠', body: '잠깐 눈을 붙였더니 오후가 조금 나아졌습니다. 오늘은 늦은 약속을 줄였습니다.', effects: { health: 2 } },
  { id: 'later-error', title: '함께 찾은 작은 오류', body: '동료와 기록을 다시 읽다 잘못 적힌 부분을 찾았습니다. 같은 실수를 막을 확인 순서를 남겼습니다.', effects: { knowledge: 2, relationships: 1 } },
  { id: 'later-move', title: '친구의 이사', body: '쉬는 날 친구의 짐을 옮겼습니다. 새 동네에서 저녁을 먹으며 다음 만남을 정했습니다.', effects: { health: -1, relationships: 2 } },
  { id: 'later-class', title: '처음 가 본 저녁 수업', body: '관심만 두던 수업에 가봤습니다. 처음이라 서툴렀지만 다음 수업도 예약했습니다.', effects: { happiness: 2, knowledge: 1 } },
  { id: 'later-fix', title: '미뤄 둔 수리', body: '계속 불편하던 물건을 고쳤습니다. 남은 오후에는 집을 정리하고 일찍 쉬었습니다.', effects: { health: 1, happiness: 1 } },
  { id: 'later-thanks', title: '뒤늦게 전한 고마움', body: '전에 도움받았던 동료에게 연락했습니다. 그날 서로 몰랐던 사정을 듣게 됐습니다.', effects: { relationships: 2, happiness: 1 } },
];
export function advanceCampus(s: GameState): void {
  const c = s.campus ??= initialCampus(), m = elapsedMonths(s), club = campusClub(s);
  if (m <= c.lastMonth) return;
  c.lastMonth = m;
  if (s.stageIndex === 0 && club && c.project === 'accepted' && m >= c.projectDue) {
    c.project = 'finished'; c.mentorMeetings += 2; learn(s, club.specialty); gain(s, club.experience, 8);
    note(s, `auto:campus:project:${club.id}`, club.project + ' 마무리', club.outcome, { happiness: 2, relationships: 2 });
  }
  const spacing = s.stageIndex === 0 ? 1 : 6;
  if (m % spacing) return;
  const draw = nextRandom(s.seed); s.seed = draw.seed;
  if (draw.value > CAMPUS_RULES.monthlyChance && m - c.lastAmbient < CAMPUS_RULES.maxQuietMonths * spacing) return;
  const pool = s.stageIndex === 0 ? [...COMMON] : [...LATER];
  if (s.stageIndex === 0 && club) club.notes.forEach(([title, body, effects], i) => pool.push({ id: `${club.id}-${i}`, title, body, effects, experience: club.experience, club: true }));
  const eligible = pool.filter(e => (!e.focus || e.focus === s.progress!.focus) && (!c.seen[e.id] || m - c.seen[e.id].month >= CAMPUS_RULES.cooldown * spacing));
  // Prefer unseen/less-used stories, then start another cycle. Everyday life must
  // not run out after a fixed number of appearances, including in old saves.
  const fresh = eligible.filter(e => (c.seen[e.id]?.count ?? 0) < CAMPUS_RULES.repeatLimit);
  const cycle = fresh.length ? fresh : eligible;
  // The club's own life remains present even when study is the main activity.
  const weighted = cycle.flatMap(e => Array.from({ length: e.club ? 4 : e.focus === s.progress!.focus ? 3 : e.focus ? 0 : 1 }, () => e));
  if (!weighted.length) return;
  const pick = nextRandom(s.seed); s.seed = pick.seed;
  const e = weighted[Math.floor(pick.value * weighted.length)];
  c.seen[e.id] = { month: m, count: (c.seen[e.id]?.count ?? 0) + 1 }; c.lastAmbient = m;
  if (e.experience) gain(s, e.experience);
  if (e.specialty) learn(s, e.specialty);
  if (e.club) { c.mentorMeetings++; if (c.mentorMeetings >= 2 && c.project === 'none' && m < 56) c.invitation = true; }
  note(s, `auto:campus:ambient:${m}`, e.title, e.body, e.effects);
}
export function validCampus(value: CampusState | undefined, month: number): boolean {
  if (value === undefined) return true; // Older saves are upgraded on their next action.
  if (!value || value.version !== 1 || (value.club !== null && !CLUBS.some(c => c.id === value.club)) || typeof value.automaticFunding !== 'boolean' || typeof value.invitation !== 'boolean') return false;
  if (![value.lastMonth, value.lastAmbient, value.mentorMeetings, value.projectDue].every(n => Number.isSafeInteger(n) && n >= 0) || value.lastMonth > month || value.lastAmbient > month || value.projectDue > month + 3) return false;
  if (!['none', 'accepted', 'finished', 'declined'].includes(value.project) || (!value.club && (value.project !== 'none' || value.invitation))) return false;
  const keys = ['campus-team', 'campus-summer', 'campus-practice', 'campus-final', 'campus-invitation', 'campus-next-step'];
  if (!Array.isArray(value.milestones) || new Set(value.milestones).size !== value.milestones.length || value.milestones.some(k => !keys.includes(k))) return false;
  const ids = [...COMMON, ...LATER].map(e => e.id).concat(CLUBS.flatMap(c => c.notes.map((_, i) => `${c.id}-${i}`)));
  if (!value.seen || typeof value.seen !== 'object' || Array.isArray(value.seen)) return false;
  return Object.entries(value.seen).every(([id, e]) => ids.includes(id) && e && Number.isSafeInteger(e.month) && e.month > 0 && e.month <= month && Number.isSafeInteger(e.count) && e.count > 0);
}
