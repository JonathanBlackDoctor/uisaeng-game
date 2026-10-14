import type { GameState } from './contracts';
import type { Specialty } from './career';

export const PROFESSION_IDS = ['medicine', 'dentistry', 'korean-medicine', 'nursing'] as const;
export type ProfessionId = typeof PROFESSION_IDS[number];
export type AddedProfession = Exclude<ProfessionId, 'medicine'>;
export const PROFESSIONS = {
  medicine: { label: '의대', school: '의과대학', job: '의사', studyMonths: 72, trainingMonths: 72, salary: 6_000_000, tuition: 4_000_000 },
  dentistry: { label: '치대', school: '치과대학', job: '치과의사', studyMonths: 72, trainingMonths: 48, salary: 5_800_000, tuition: 4_200_000 },
  'korean-medicine': { label: '한의대', school: '한의과대학', job: '한의사', studyMonths: 72, trainingMonths: 48, salary: 4_800_000, tuition: 4_000_000 },
  nursing: { label: '간호대', school: '간호대학', job: '간호사', studyMonths: 48, trainingMonths: 12, salary: 3_400_000, tuition: 3_000_000 },
} as const;
// Money, selection, adaptation time and performance thresholds are game settings.
export const PROFESSION_RULES = { version: 'professions-provisional-1', provisional: true, licenseKnowledge: 35, examRetryMonths: 3, followupMonths: 3, storySpacing: 12 } as const;
export const professionOf = (s: Pick<GameState, 'profession'>): ProfessionId => s.profession ?? 'medicine';
export const isAddedProfession = (s: Pick<GameState, 'profession'>) => professionOf(s) !== 'medicine';
export const validProfession = (p: unknown): p is ProfessionId => typeof p === 'string' && (PROFESSION_IDS as readonly string[]).includes(p);
export const professionDefinition = (s: Pick<GameState, 'profession'>) => PROFESSIONS[professionOf(s)];

const dental = [
  ['oral-surgery','구강악안면외과','surgical','턱 수술 전 협진','수술 일정과 교합 기록을 놓고 여러 과의 의견을 모읍니다.'],
  ['prosthodontics','치과보철과','clinical','새 보철물의 불편','환자가 식사할 때 걸리는 부분을 설명합니다. 제작 기록과 적응 과정을 살핍니다.'],
  ['orthodontics','치과교정과','clinical','오래 이어지는 치료','교정 장치 관리가 어려운 학생과 보호자가 방문했습니다. 학교생활과 내원 일정을 함께 확인합니다.'],
  ['pediatric','소아치과','clinical','치과 의자 앞에서','아이가 진료실 문 앞에서 멈춥니다. 보호자와 아이가 걱정하는 것을 따로 들어 봅니다.'],
  ['periodontics','치주과','surgical','다시 확인한 관리 기록','잇몸 관리 기록에 빈칸이 많습니다. 환자가 집에서 어려웠던 일을 듣습니다.'],
  ['conservative','치과보존과','clinical','남길 수 있는 치아','환자가 치아를 보존할 수 있는지 묻습니다. 검사 자료와 설명할 대안을 정리합니다.'],
  ['oral-medicine','구강내과','clinical','말하기 어려운 통증','환자가 턱 통증 때문에 식사를 피하고 있습니다. 경과와 생활 기록을 확인합니다.'],
  ['imaging','영상치의학과','diagnostic','이전 촬영과 비교','의뢰 영상에 관찰이 필요한 부분이 있습니다. 이전 영상과 의뢰 내용을 대조합니다.'],
  ['pathology','구강병리과','diagnostic','검체와 의뢰서','검체 위치와 의뢰서 설명이 다릅니다. 의뢰한 팀에 확인을 요청합니다.'],
  ['preventive','예방치과','community','학교 구강보건 사업','학교별 참여율이 다릅니다. 누락된 학급과 안내 방식을 검토합니다.'],
  ['integrated','통합치의학과','clinical','여러 치료의 순서','여러 치료가 필요한 환자가 비용과 방문 횟수를 걱정합니다. 우선순위를 함께 정리합니다.'],
] as const;
const korean = [
  ['internal','한방내과','clinical','복용 중인 약 목록','환자가 다른 기관에서 받은 약 목록을 가져왔습니다. 현재 복용 내역과 경과를 확인합니다.'],
  ['gynecology','한방부인과','clinical','진료 기록의 빈 기간','환자가 그동안의 증상 변화를 적어 왔습니다. 기록이 없는 기간을 함께 돌아봅니다.'],
  ['pediatric','한방소아과','clinical','아이와 보호자의 설명','아이와 보호자가 서로 다른 불편을 이야기합니다. 각각의 말을 듣고 기록합니다.'],
  ['neuropsychiatry','한방신경정신과','clinical','잠을 이루지 못한 날들','환자가 수면 일지를 가져왔습니다. 일상과 상담 중 확인할 내용을 정리합니다.'],
  ['dermatology','한방안·이비인후·피부과','clinical','달라진 증상 사진','환자가 날짜별 사진을 보여 줍니다. 변화 시점과 다른 진료 내역을 살핍니다.'],
  ['rehabilitation','한방재활의학과','clinical','직장으로 돌아가기','환자가 오래 서서 일해야 합니다. 일상 기능과 업무 환경을 팀과 검토합니다.'],
  ['acupuncture','침구과','clinical','시술 전 확인','이전 시술 뒤 불편했던 경험을 듣습니다. 동의와 안전 확인 항목을 다시 살핍니다.'],
  ['sasang','사상체질과','clinical','다른 기관의 기록','환자가 기존 상담 기록을 가져왔습니다. 현재 상태와 과거 판단을 구분해 검토합니다.'],
] as const;
const nursing = [
  ['anesthesia','마취·회복실','clinical','회복실로 넘어오는 환자','마취 후 회복 상태와 인계 내용을 확인합니다. 담당 팀과 관찰할 변화를 정리합니다.'],
  ['infection','감염관리','community','여러 병동의 보고','감염 관련 보고가 여러 부서에서 들어왔습니다. 정의와 집계 범위를 맞춥니다.'],
  ['geriatric','노인간호','clinical','일상 기능의 변화','돌봄 대상자의 식사와 이동 방식이 달라졌습니다. 이전 기록과 가족의 관찰을 모읍니다.'],
  ['hospice','호스피스','clinical','가족이 머무는 시간','가족이 환자 곁에 머물 시간을 상의합니다. 환자의 의사와 돌봄 일정을 확인합니다.'],
  ['oncology','종양간호','clinical','치료 사이의 생활','환자가 치료 일정 사이에 겪는 불편을 이야기합니다. 증상 기록과 연락 방법을 점검합니다.'],
  ['home','가정간호','community','집에서 필요한 돌봄','가정 방문을 앞두고 필요한 물품과 환경을 확인합니다. 가족과 방문 계획을 정합니다.'],
  ['public-health','보건간호','community','지역 예방사업','보건사업 대상자의 참여가 줄었습니다. 대상 기준과 지역 접근성을 살핍니다.'],
  ['ward','일반병동','clinical','교대 직전의 변화','환자 상태가 인계 직전에 달라졌습니다. 새 관찰 내용과 우선 전달할 내용을 정리합니다.'],
  ['icu','중환자실','clinical','알람과 관찰 기록','여러 알람이 겹칩니다. 담당 팀과 우선 확인할 환자와 기록을 나눕니다.'],
  ['emergency','응급실','clinical','대기 중인 보호자','환자들이 몰리고 보호자의 질문이 이어집니다. 팀과 안내·관찰 역할을 정합니다.'],
  ['operating','수술실','surgical','수술 전 물품 확인','준비 목록과 실제 물품 수가 맞지 않습니다. 시작 전에 팀과 함께 대조합니다.'],
  ['pediatric','아동·신생아','clinical','보호자에게 알려 줄 것','퇴원을 앞둔 보호자가 집에서의 돌봄을 걱정합니다. 설명 후 이해한 내용을 확인합니다.'],
  ['mental','정신건강','clinical','대화가 멈춘 순간','평소와 달리 환자가 대답을 멈춥니다. 공간을 정리하고 담당 팀과 관찰 내용을 나눕니다.'],
  ['outpatient','외래·지역사회','community','방문을 놓친 사람','예약한 주민이 오지 않았습니다. 연락 가능한 방법과 방문 여건을 확인합니다.'],
  ['industrial','산업보건','community','교대근무자의 상담','야간 근무자가 상담 시간을 잡기 어렵다고 합니다. 현장 일정과 상담 방식을 조정합니다.'],
  ['education','간호교육','community','신규 간호사의 질문','신규 간호사가 같은 항목에서 자주 멈춥니다. 설명 방식과 실습 시간을 조정합니다.'],
  ['management','간호관리','community','다음 달 근무표','휴가 신청과 교육 일정이 겹칩니다. 인력과 휴식 시간을 함께 살핍니다.'],
  ['research','간호연구','diagnostic','설문에 빠진 응답','퇴원 환자 설문에 빈 항목이 많습니다. 자료 수집 절차와 해석의 한계를 확인합니다.'],
  ['insurance','보험심사','diagnostic','기록과 청구의 차이','제공한 서비스 기록과 청구 항목이 다릅니다. 관련 부서에 자료 확인을 요청합니다.'],
] as const;
const groups = { dentistry: dental, 'korean-medicine': korean, nursing };
export const PROFESSION_SPECIALTIES: (Specialty & { profession: AddedProfession })[] = Object.entries(groups).flatMap(([profession, rows]) => rows.map(([id,name,track,title,body]) => ({
  id: `${profession}:${id}`, profession: profession as AddedProfession, name, track,
  summary: body, exploration: `${name} 현장을 방문해 담당자에게 업무와 교육 과정을 묻습니다.`,
  training: `${name}에서 지도자와 함께 기록·실무·팀 협업을 익힙니다.`, caseTitle: title, caseBody: body,
})));
export const NURSING_CERTIFICATES = ['보건','마취','가정','정신','감염관리','산업','응급','노인','중환자','호스피스','종양','임상','아동'] as const;
export const PROFESSION_INSTITUTIONS = [
  { id: 'profession-university', name: '대학 부속기관', description: '교육·연구와 현장 업무를 함께 경험합니다.' },
  { id: 'profession-regional', name: '지역 의료기관', description: '지역의 환자와 팀을 지속해서 만납니다.' },
  { id: 'profession-community', name: '지역·전문 기관', description: '지원 분야의 실무와 지역 협력을 경험합니다.' },
];
export function practiceLabel(s: GameState) {
  const p = professionOf(s), c = s.career;
  if (!c) return '진로 탐색';
  if (p === 'nursing') return ({ undecided: '취업 준비', employed: '간호 실무', clinic: '간호 실무', research: '간호연구', untrained: '간호 실무' })[c.practice];
  return ({ undecided: '수련 준비', employed: '봉직', clinic: p === 'dentistry' ? '치과 개원' : p === 'korean-medicine' ? '한의원 개원' : '개원', research: '연구', untrained: '일반진료' })[c.practice];
}
