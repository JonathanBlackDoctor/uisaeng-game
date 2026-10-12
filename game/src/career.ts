// Independent runtime-modules-1 module. All scenes and scoring are game assumptions.
export type Practice = 'undecided' | 'employed' | 'clinic' | 'research' | 'untrained';
export type Experience = { study: number; research: number; people: number; clinical: number };
export type Focus = keyof Experience | 'rest' | 'work';
export interface Preparation {
  study: number; research: number; people: number; clinical: number;
  exploration: number; interest: number; total: number;
}
export interface ApplicationRecord {
  specialty: string; institution: string; knowledge: number; roll: number;
  preparation: Preparation; score: number; threshold: number; accepted: boolean;
  ruleVersion: string;
}
export interface CareerState {
  experience: Experience;
  explored: string[];
  interest: string | null;
  specialty: string | null;
  institution: string | null;
  application: 'none' | 'accepted' | 'rejected' | 'untrained';
  attempts: number;
  practice: Practice;
  lastMonth: number;
  lastApplication?: ApplicationRecord;
}
export interface Specialty {
  id: string; name: string; summary: string; exploration: string; training: string;
  caseTitle: string; caseBody: string;
  track: 'clinical' | 'surgical' | 'diagnostic' | 'community';
  evidence?: { text: string; url: string; source: string; sha256: string };
}

// No public source URL was supplied; omit display evidence rather than invent one.
export const SPECIALTIES: Specialty[] = [
  { id: 'internal', name: '내과', track: 'clinical', summary: '여러 장기의 질환을 함께 살핀다.', exploration: '회진에서 검사 결과와 복용 약을 함께 정리한다.', training: '입원 환자의 경과를 기록하고 다른 과와 협의한다.', caseTitle: '퇴원 전 약 목록', caseBody: '여러 약을 먹는 환자가 퇴원을 앞두고 있다. 담당 팀과 약 목록을 대조하고 설명할 내용을 정리한다.' },
  { id: 'surgery', name: '외과', track: 'surgical', summary: '수술과 수술 전후 관리를 맡는다.', exploration: '수술실 견학 뒤 수술 전 확인 과정을 적는다.', training: '지도 아래 수술 준비와 수술 후 회복 평가를 익힌다.', caseTitle: '수술 뒤 회진', caseBody: '수술을 마친 환자가 회복실에서 병동으로 왔다. 수술 팀과 경과 기록을 확인하고 보호자의 질문을 모은다.' },
  { id: 'pediatrics', name: '소아청소년과', track: 'clinical', summary: '아이의 질환과 성장 과정을 살핀다.', exploration: '외래에서 아이와 보호자의 말을 따로 들어본다.', training: '연령에 따른 진찰과 성장 기록 해석을 익힌다.', caseTitle: '진찰을 무서워하는 아이', caseBody: '아이가 진찰실 문 앞에서 울고 있다. 보호자에게 평소 모습을 묻고 아이에게 진찰 과정을 짧게 설명한다.' },
  { id: 'obgyn', name: '산부인과', track: 'surgical', summary: '여성 건강과 임신·출산을 다룬다.', exploration: '산전 외래에서 상담과 검사 설명을 관찰한다.', training: '분만과 부인과 진료에서 인계와 동의 절차를 익힌다.', caseTitle: '검사 설명을 기다리는 부부', caseBody: '산전 검사를 마친 부부가 결과 설명을 기다린다. 담당 팀과 자료를 확인하고 두 사람이 묻고 싶은 내용을 듣는다.' },
  { id: 'psychiatry', name: '정신건강의학과', track: 'clinical', summary: '정신 건강의 변화와 생활 맥락을 듣는다.', exploration: '면담 참관에서 질문 방식과 기록 원칙을 살핀다.', training: '면담·평가와 비밀 보호 원칙을 지도 아래 익힌다.', caseTitle: '말이 끊긴 면담', caseBody: '환자가 직장 이야기를 하다 말을 멈췄다. 잠시 기다린 뒤 더 이야기할지 묻고 면담 시간을 함께 확인한다.' },
  { id: 'orthopedics', name: '정형외과', track: 'surgical', summary: '뼈·관절과 움직임의 문제를 다룬다.', exploration: '골절 환자의 영상과 일상생활 기록을 비교한다.', training: '근골격계 진찰과 수술 전후 기능 평가를 익힌다.', caseTitle: '다시 계단을 오르려면', caseBody: '골절 수술 뒤 환자가 집의 계단을 걱정한다. 치료 팀과 기능 평가를 확인하고 퇴원 뒤 생활 여건을 기록한다.' },
  { id: 'neurosurgery', name: '신경외과', track: 'surgical', summary: '뇌·척추·신경의 수술과 관리를 맡는다.', exploration: '척추 회진에서 영상과 신경 진찰 기록을 맞춰본다.', training: '신경계 수술 준비와 수술 전후 변화를 관찰한다.', caseTitle: '야간 인계 기록', caseBody: '척추 수술 환자의 야간 인계를 앞두고 있다. 팀과 관찰 기록을 대조하고 다음 근무자가 확인할 내용을 정리한다.' },
  { id: 'thoracic', name: '심장혈관흉부외과', track: 'surgical', summary: '심장·혈관·흉부의 수술을 맡는다.', exploration: '심장 수술 회의에서 여러 팀의 역할을 살핀다.', training: '심장·흉부 수술과 중환자실 인계 과정을 익힌다.', caseTitle: '중환자실로 보내는 인계', caseBody: '심장 수술이 끝나고 중환자실 인계가 시작된다. 수술 팀과 기록을 정리하고 전달이 빠진 항목을 확인한다.' },
  { id: 'plastic', name: '성형외과', track: 'surgical', summary: '재건과 미용 수술에서 기능과 형태를 다룬다.', exploration: '재건 상담에서 환자가 바라는 기능과 형태를 듣는다.', training: '재건 계획과 수술 동의·경과 평가를 익힌다.', caseTitle: '손을 쓰는 직업', caseBody: '손 재건 상담을 받는 환자가 작업 도구를 가져왔다. 환자의 업무를 듣고 팀 회의에 전달할 목표를 정리한다.' },
  { id: 'ophthalmology', name: '안과', track: 'surgical', summary: '눈의 질환과 시력 변화를 살핀다.', exploration: '안과 외래에서 시력 검사와 영상 관찰을 견학한다.', training: '눈 진찰과 안과 수술의 기본 과정을 익힌다.', caseTitle: '읽기 어려워진 글씨', caseBody: '환자가 책의 작은 글씨를 읽기 어렵다고 말한다. 이전 검사와 생활 기록을 확인하고 상담 내용을 정리한다.' },
  { id: 'ent', name: '이비인후과', track: 'surgical', summary: '귀·코·목과 두경부 질환을 다룬다.', exploration: '청력 검사실과 두경부 외래를 함께 견학한다.', training: '귀·코·목 진찰과 두경부 수술 관리를 익힌다.', caseTitle: '회의에서 놓친 말', caseBody: '환자가 회의 중 말을 놓치는 일이 잦다고 한다. 청력 검사 기록과 업무 환경을 함께 살피고 질문을 정리한다.' },
  { id: 'dermatology', name: '피부과', track: 'clinical', summary: '피부의 변화와 질환을 살핀다.', exploration: '외래에서 피부 변화의 경과를 기록하는 법을 배운다.', training: '피부 진찰과 검사·경과 비교를 익힌다.', caseTitle: '사진으로 남긴 변화', caseBody: '환자가 피부 변화를 찍은 사진을 가져왔다. 촬영 시점과 생활 변화를 듣고 진료 기록과 비교한다.' },
  { id: 'urology', name: '비뇨의학과', track: 'surgical', summary: '비뇨생식기 질환의 진료와 수술을 맡는다.', exploration: '비뇨기 외래에서 민감한 질문을 묻는 방식을 살핀다.', training: '비뇨생식기 진찰과 수술 전후 상담을 익힌다.', caseTitle: '꺼내기 어려운 질문', caseBody: '환자가 배뇨 문제를 이야기하며 목소리를 낮춘다. 상담 공간을 확인하고 불편이 생긴 시점을 차분히 듣는다.' },
  { id: 'radiology', name: '영상의학과', track: 'diagnostic', summary: '의료영상을 판독하고 진료에 연결한다.', exploration: '판독실에서 이전 영상과 새 영상을 비교한다.', training: '영상 판독과 임상 팀에 결과를 전달하는 법을 익힌다.', caseTitle: '이전 영상과의 차이', caseBody: '의뢰받은 영상에 이전 검사와 다른 부분이 보인다. 판독 팀과 비교 기록을 검토하고 임상 팀의 질문을 확인한다.' },
  { id: 'radiation', name: '방사선종양학과', track: 'clinical', summary: '암 치료에서 방사선 치료를 다룬다.', exploration: '치료계획 회의에서 영상과 조사 범위를 살핀다.', training: '방사선 치료계획과 치료 중 경과 평가를 익힌다.', caseTitle: '치료 일정과 통근', caseBody: '환자가 치료 일정과 긴 통근 시간을 걱정한다. 치료 팀에 생활 여건을 전달하고 상담할 내용을 정리한다.' },
  { id: 'anesthesia', name: '마취통증의학과', track: 'clinical', summary: '마취·통증과 수술 중 환자 상태를 다룬다.', exploration: '마취 준비에서 모니터와 안전 확인 절차를 관찰한다.', training: '마취 관리와 통증 평가·팀 인계를 익힌다.', caseTitle: '마취 전 질문', caseBody: '수술을 앞둔 환자가 마취 경험을 이야기한다. 담당 팀과 문진 기록을 확인하고 환자의 질문을 전달한다.' },
  { id: 'neurology', name: '신경과', track: 'clinical', summary: '신경계 질환과 인지·운동 변화를 살핀다.', exploration: '신경 진찰에서 문진과 검사 기록의 연결을 살핀다.', training: '신경학적 평가와 장단기 경과 기록을 익힌다.', caseTitle: '가족이 적어 온 메모', caseBody: '가족이 환자의 기억 변화를 적은 메모를 가져왔다. 환자의 말도 듣고 변화가 시작된 시점을 함께 정리한다.' },
  { id: 'rehabilitation', name: '재활의학과', track: 'clinical', summary: '기능 회복과 일상 복귀를 팀과 함께 돕는다.', exploration: '재활 회의에서 환자와 치료사의 목표를 비교한다.', training: '기능 평가와 재활 팀의 계획 조정을 익힌다.', caseTitle: '버스로 출근하기', caseBody: '환자가 다시 버스를 타고 출근하고 싶다고 한다. 재활 팀과 현재 기능을 확인하고 일상 복귀 목표를 기록한다.' },
  { id: 'tuberculosis', name: '결핵과', track: 'community', summary: '결핵 진료와 지역 관리의 연결을 살핀다.', exploration: '결핵 관리 회의에서 진료와 보건 업무의 연결을 본다.', training: '결핵 진료 기록과 지역 관리 협의를 익힌다.', caseTitle: '빠진 방문 기록', caseBody: '추적 진료 기록에 빈 날짜가 있다. 담당 팀과 연락 내역을 확인하고 환자의 방문 여건을 듣는다.' },
  { id: 'laboratory', name: '진단검사의학과', track: 'diagnostic', summary: '검사의 정확도와 결과 해석을 맡는다.', exploration: '검사실에서 검체 접수와 정도관리 과정을 살핀다.', training: '검사 판독과 검체·품질 관리, 임상 자문을 익힌다.', caseTitle: '서로 다른 검사 결과', caseBody: '같은 환자의 검사 결과가 이전 기록과 크게 다르다. 검사 팀과 검체·장비 기록을 확인하고 의뢰 부서와 협의한다.' },
  { id: 'pathology', name: '병리과', track: 'diagnostic', summary: '조직·세포 표본을 판독해 진단에 연결한다.', exploration: '현미경 실습에서 표본과 임상 정보를 대조한다.', training: '조직·세포 판독과 진단 기록 작성을 익힌다.', caseTitle: '추가 정보가 필요한 표본', caseBody: '표본 판독에 임상 정보가 더 필요하다. 판독 팀과 관찰 내용을 정리하고 의뢰한 진료과에 질문을 보낸다.' },
  { id: 'preventive', name: '예방의학과', track: 'community', summary: '인구집단의 건강과 보건사업을 다룬다.', exploration: '지역 건강 조사에서 대상과 자료의 범위를 살핀다.', training: '질병예방 사업의 기획·평가와 자료 해석을 익힌다.', caseTitle: '참여가 적었던 조사', caseBody: '지역 건강 조사에 일부 동네의 응답이 적다. 조사 팀과 대상·누락 기록을 살피고 결과 해석의 한계를 적는다.' },
  { id: 'family', name: '가정의학과', track: 'community', summary: '지역의 흔한 건강문제를 지속해서 살핀다.', exploration: '일차진료에서 생활과 가족 이야기를 함께 듣는다.', training: '흔한 건강문제의 진료와 지속적인 상담을 익힌다.', caseTitle: '여러 걱정을 들고 온 환자', caseBody: '환자가 몸의 불편과 가족 돌봄 이야기를 함께 꺼낸다. 오늘 먼저 다룰 문제를 묻고 이전 방문 기록을 확인한다.' },
  { id: 'occupational', name: '직업환경의학과', track: 'community', summary: '일터·환경과 건강의 관계를 살핀다.', exploration: '작업장 조사에서 업무 과정과 노출 기록을 살핀다.', training: '직업·환경 문진과 건강장해 예방 평가를 익힌다.', caseTitle: '작업이 바뀐 뒤의 불편', caseBody: '근로자가 공정이 바뀐 뒤 불편이 생겼다고 한다. 업무 기록과 작업 환경을 확인하고 조사 팀의 질문을 모은다.' },
  { id: 'nuclear', name: '핵의학과', track: 'diagnostic', summary: '핵의학 검사와 치료로 진료에 참여한다.', exploration: '핵의학 검사실에서 영상과 검사 목적을 함께 살핀다.', training: '핵의학 영상 해석과 검사·치료 안전 관리를 익힌다.', caseTitle: '검사 목적을 묻는 의뢰', caseBody: '진료과에서 핵의학 검사 결과에 대한 자문을 요청했다. 검사 목적과 영상 기록을 대조하고 회의 자료를 정리한다.' },
  { id: 'emergency', name: '응급의학과', track: 'clinical', summary: '응급실에서 초기 평가와 진료 연결을 맡는다.', exploration: '응급실 견학에서 분류와 인계 흐름을 살핀다.', training: '응급 평가와 팀 협업·응급실 운영을 익힌다.', caseTitle: '동시에 들어온 환자들', caseBody: '응급실에 여러 환자가 도착했다. 담당 팀과 분류 기록을 확인하고 각 환자의 인계가 빠지지 않도록 정리한다.' },
];

export const INSTITUTIONS: { id: string; name: string; description: string }[] = [
  { id: 'snuh', name: '서울대학교병원', description: '이 기관에 수련을 지원한다.' },
  { id: 'asan', name: '서울아산병원', description: '이 기관에 수련을 지원한다.' },
  { id: 'samsung', name: '삼성서울병원', description: '이 기관에 수련을 지원한다.' },
  { id: 'severance', name: '세브란스병원', description: '이 기관에 수련을 지원한다.' },
  { id: 'seoul-st-mary', name: '서울성모병원', description: '이 기관에 수련을 지원한다.' },
];

// Mutable provisional settings; not real admission rates or qualifications.
export const CAREER_RULES = {
  version: 'career-money-provisional-1', provisional: true,
  monthlyGain: 4, experienceCap: 100, knowledgeWeight: 0.65,
  experienceWeight: 0.35, explorationBonus: 6, interestBonus: 4,
  rollSpread: 24, acceptanceThreshold: 55,
  // Order: study, research, people, clinical. Each specialty has its own profile.
  preparationWeights: {
    internal: [0.40, 0.15, 0.15, 0.30], surgery: [0.25, 0.10, 0.15, 0.50],
    pediatrics: [0.25, 0.10, 0.40, 0.25], obgyn: [0.30, 0.10, 0.25, 0.35],
    psychiatry: [0.20, 0.15, 0.50, 0.15], orthopedics: [0.20, 0.20, 0.10, 0.50],
    neurosurgery: [0.35, 0.15, 0.05, 0.45], thoracic: [0.30, 0.20, 0.05, 0.45],
    plastic: [0.20, 0.10, 0.30, 0.40], ophthalmology: [0.35, 0.10, 0.15, 0.40],
    ent: [0.25, 0.15, 0.20, 0.40], dermatology: [0.35, 0.20, 0.25, 0.20],
    urology: [0.25, 0.05, 0.30, 0.40], radiology: [0.45, 0.30, 0.05, 0.20],
    radiation: [0.35, 0.30, 0.20, 0.15], anesthesia: [0.40, 0.05, 0.10, 0.45],
    neurology: [0.40, 0.20, 0.10, 0.30], rehabilitation: [0.20, 0.15, 0.35, 0.30],
    tuberculosis: [0.30, 0.15, 0.35, 0.20], laboratory: [0.40, 0.40, 0.05, 0.15],
    pathology: [0.35, 0.45, 0.05, 0.15], preventive: [0.25, 0.50, 0.20, 0.05],
    family: [0.20, 0.05, 0.45, 0.30], occupational: [0.25, 0.35, 0.30, 0.10],
    nuclear: [0.40, 0.35, 0.10, 0.15], emergency: [0.30, 0.05, 0.20, 0.45],
  } as Record<string, number[]>,
};

const experienceKeys = ['study', 'research', 'people', 'clinical'] as const;
const practices: Practice[] = ['undecided', 'employed', 'clinic', 'research', 'untrained'];
const isSpecialty = (id: unknown): id is string => typeof id === 'string' && SPECIALTIES.some(s => s.id === id);
const isInstitution = (id: unknown): id is string => typeof id === 'string' && INSTITUTIONS.some(i => i.id === id);
const counter = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

// Reject cycles, sparse arrays, non-finite numbers and values lost by JSON serialization.
function jsonSafe(v: unknown, ancestors = new Set<object>()): boolean {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v !== 'object' || ancestors.has(v)) return false;
  if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) return false;
  if (Object.getOwnPropertySymbols(v).length) return false;
  ancestors.add(v);
  const values = Array.isArray(v) ? Array.from(v) : Object.values(v);
  const valid = values.every(item => jsonSafe(item, ancestors));
  ancestors.delete(v);
  return valid;
}

export function validCareer(value: unknown): value is CareerState {
  try {
    if (!object(value) || !jsonSafe(value) || !object(value.experience)) return false;
    if (!experienceKeys.every(k => counter((value.experience as Record<string, unknown>)[k]))) return false;
    if (!Array.isArray(value.explored) || !value.explored.every(isSpecialty) || new Set(value.explored).size !== value.explored.length) return false;
    if (value.interest !== null && (!isSpecialty(value.interest) || !value.explored.includes(value.interest))) return false;
    if (value.specialty !== null && !isSpecialty(value.specialty)) return false;
    if (value.institution !== null && !isInstitution(value.institution)) return false;
    if (!['none', 'accepted', 'rejected', 'untrained'].includes(value.application as string)) return false;
    if (!practices.includes(value.practice as Practice) || !counter(value.attempts) || !Number.isSafeInteger(value.lastMonth) || (value.lastMonth as number) < -1) return false;
    if (value.application === 'accepted' || value.application === 'rejected') {
      if (!isSpecialty(value.specialty) || !isInstitution(value.institution) || value.attempts < 1) return false;
    } else if (value.specialty !== null || value.institution !== null) return false;
    if ((value.practice === 'employed' || value.practice === 'clinic') && value.application !== 'accepted') return false;
    if (value.practice === 'untrained' && value.application !== 'untrained') return false;
    if (value.application === 'accepted' && value.practice === 'untrained') return false;
    if (value.lastApplication !== undefined) {
      const a = value.lastApplication;
      if (!object(a) || !isSpecialty(a.specialty) || !isInstitution(a.institution) || !finite(a.knowledge) || a.knowledge < 0 || a.knowledge > 100 || !finite(a.roll) || a.roll < 0 || a.roll >= 1) return false;
      if (!object(a.preparation) || ![...experienceKeys, 'exploration', 'interest', 'total'].every(k => finite((a.preparation as Record<string, unknown>)[k]) && ((a.preparation as Record<string, number>)[k] >= 0))) return false;
      if (!finite(a.score) || !finite(a.threshold) || typeof a.accepted !== 'boolean' || typeof a.ruleVersion !== 'string' || value.attempts < 1) return false;
      const p = a.preparation as Record<string, number>;
      const sum = experienceKeys.reduce((total, key) => total + p[key], 0) + p.exploration + p.interest;
      if (!Number.isFinite(sum) || Math.abs(p.total - sum) > 1e-9 || a.accepted !== (a.score >= a.threshold)) return false;
      if ((value.application === 'accepted' || value.application === 'rejected') && (a.specialty !== value.specialty || a.institution !== value.institution || a.accepted !== (value.application === 'accepted'))) return false;
    }
    return true;
  } catch { return false; }
}

function requireState(state: CareerState): void {
  if (!validCareer(state)) throw new TypeError('잘못된 진로 상태입니다.');
}
function requireSpecialty(id: string): Specialty {
  const specialty = SPECIALTIES.find(s => s.id === id);
  if (!specialty) throw new RangeError('전공을 확인해 주세요.');
  return specialty;
}

export function initialCareer(): CareerState {
  return { experience: { study: 0, research: 0, people: 0, clinical: 0 }, explored: [], interest: null,
    specialty: null, institution: null, application: 'none', attempts: 0, practice: 'undecided', lastMonth: -1 };
}

export function advanceCareerExperience(state: CareerState, month: number, focus: Focus): CareerState {
  requireState(state);
  if (!counter(month)) throw new RangeError('월은 0 이상의 정수여야 합니다.');
  if (![...experienceKeys, 'rest', 'work'].includes(focus)) throw new RangeError('활동을 확인해 주세요.');
  if (month <= state.lastMonth) return state;
  const experience = { ...state.experience };
  if (focus !== 'rest' && focus !== 'work') {
    experience[focus] = Math.max(experience[focus], Math.min(CAREER_RULES.experienceCap, experience[focus] + CAREER_RULES.monthlyGain));
  }
  // A gap is one reported month, never offline progress or inferred activity.
  return { ...state, experience, lastMonth: month };
}

export function exploreSpecialty(state: CareerState, id: string): CareerState {
  requireState(state); requireSpecialty(id);
  return { ...state, explored: state.explored.includes(id) ? [...state.explored] : [...state.explored, id], interest: id };
}

export function careerPreparation(state: CareerState, id: string): Preparation {
  requireState(state); requireSpecialty(id);
  const weights = CAREER_RULES.preparationWeights[id];
  const parts = experienceKeys.map((k, i) => Math.min(state.experience[k], CAREER_RULES.experienceCap) * weights[i] * CAREER_RULES.experienceWeight);
  const exploration = state.explored.includes(id) ? CAREER_RULES.explorationBonus : 0;
  const interest = state.interest === id ? CAREER_RULES.interestBonus : 0;
  return { study: parts[0], research: parts[1], people: parts[2], clinical: parts[3], exploration, interest,
    total: parts.reduce((sum, part) => sum + part, 0) + exploration + interest };
}

export function applySpecialty(state: CareerState, id: string, institutionId: string, knowledge: number, roll: number): { state: CareerState; accepted: boolean; detail: string } {
  requireState(state); requireSpecialty(id);
  if (!isInstitution(institutionId)) throw new RangeError('지원 기관을 확인해 주세요.');
  if (!finite(knowledge) || knowledge < 0 || knowledge > 100) throw new RangeError('지식은 0부터 100까지여야 합니다.');
  if (!finite(roll) || roll < 0 || roll >= 1) throw new RangeError('추첨값은 0 이상 1 미만이어야 합니다.');
  if (state.application === 'accepted') return { state, accepted: true, detail: '이미 합격한 수련 경로가 있습니다.' };
  if (state.attempts === Number.MAX_SAFE_INTEGER) throw new RangeError('지원 기록이 한도를 넘었습니다.');
  const preparation = careerPreparation(state, id);
  const score = knowledge * CAREER_RULES.knowledgeWeight + preparation.total + (roll - 0.5) * CAREER_RULES.rollSpread;
  const threshold = CAREER_RULES.acceptanceThreshold;
  const accepted = score >= threshold;
  const lastApplication: ApplicationRecord = { specialty: id, institution: institutionId, knowledge, roll, preparation, score, threshold, accepted, ruleVersion: CAREER_RULES.version };
  const next: CareerState = { ...state, specialty: id, institution: institutionId, application: accepted ? 'accepted' : 'rejected', attempts: state.attempts + 1,
    practice: 'undecided', lastApplication };
  const preparationNote = state.explored.includes(id) ? '탐색과 대학 경험이 준비에 반영됐습니다.' : '견학 없이 지원했습니다. 대학 경험은 준비에 반영됐습니다.';
  return { state: next, accepted, detail: `${accepted ? '합격했습니다.' : '이번에는 합격하지 못했습니다. 재지원하거나 수련 없이 진료·연구를 선택할 수 있습니다.'} ${preparationNote}` };
}

export function choosePractice(state: CareerState, path: Practice): CareerState {
  requireState(state);
  if (!practices.includes(path)) throw new RangeError('경력 경로를 확인해 주세요.');
  if ((path === 'employed' || path === 'clinic') && state.application !== 'accepted') throw new RangeError('수련 경로를 먼저 선택해 주세요.');
  if (path === 'untrained') return { ...state, specialty: null, institution: null, application: 'untrained', practice: path };
  return { ...state, practice: path };
}

// HQ may use this extra helper to show distinct follow-up contexts without engine imports.
export function careerScene(state: CareerState): { title: string; body: string } {
  requireState(state);
  if (state.practice === 'untrained') return { title: '일반진료의 하루', body: '수련 없이 진료하는 경로를 골랐다. 오늘의 업무 범위와 협의할 동료를 확인한다.' };
  if (state.practice === 'research') {
    const subject = state.specialty ? requireSpecialty(state.specialty).name : '의료';
    return { title: `${subject} 연구 회의`, body: `${subject} 연구 자료를 검토한다. 동료와 자료의 누락과 해석의 한계를 정리한다.` };
  }
  if (state.application !== 'accepted' || !state.specialty) return { title: '진로 준비', body: '전공을 탐색하거나 다시 지원할 준비를 한다.' };
  const s = requireSpecialty(state.specialty);
  const institution = INSTITUTIONS.find(i => i.id === state.institution)!;
  if (state.practice === 'undecided') return { title: `${s.name} 수련`, body: `${institution.name}에서 수련을 시작한다. ${s.training}` };
  if (state.practice === 'clinic') return { title: s.caseTitle, body: `${s.caseBody} 진료 뒤 직원과 예약·운영 일정을 확인한다.` };
  return { title: s.caseTitle, body: `${s.caseBody} 근무를 마치기 전에 동료에게 인계한다.` };
}

// Fictional follow-up contexts, not specialty-specific incidence or medical advice.
export function careerAdverseScene(state: CareerState, kind: 'patient-loss' | 'dispute'): string {
  requireState(state);
  const track = state.specialty ? requireSpecialty(state.specialty).track : 'clinical';
  if (kind === 'patient-loss') return {
    surgical: '수술 후 경과를 함께 살피던 환자가 사망했습니다. 팀에서 수술 전후 기록을 돌아보고 유가족과의 대화를 준비합니다.',
    clinical: '치료 경과를 살피던 환자가 사망했습니다. 팀에서 그동안의 기록을 돌아보고 유가족과의 대화를 준비합니다.',
    diagnostic: '검사·판독에 참여했던 환자의 사망 소식을 들었습니다. 담당 진료팀과 결과 전달 과정을 돌아보고 함께 설명할 내용을 정리합니다.',
    community: '지역 건강 업무에서 살피던 사망 사례를 동료들과 검토합니다. 자료의 빈 곳과 유가족의 이야기를 확인하며 마음을 추스릅니다.',
  }[track];
  return {
    surgical: '환자 가족이 수술 전 설명과 수술 후 경과에 이의를 제기했습니다. 팀과 동의·경과 기록을 확인하고 상담 지원을 요청합니다.',
    clinical: '환자 가족이 진료 과정에 이의를 제기했습니다. 기록을 확인하고 기관의 상담·법률 지원을 요청할 수 있습니다.',
    diagnostic: '환자 가족이 검사 결과와 전달 과정에 이의를 제기했습니다. 의뢰한 진료팀과 판독·전달 기록을 확인하고 함께 설명을 준비합니다.',
    community: '지역 건강 업무의 대상자가 기록과 설명에 이의를 제기했습니다. 동료와 자료의 범위·동의·전달 과정을 확인하고 상담 지원을 요청합니다.',
  }[track];
}
