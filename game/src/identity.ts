import type { EventChoice, GameState, Stats } from './contracts';
import { STAGES } from './fixtures/content';
import { elapsedMonths, lifeAge } from './random-life';

export type Gender = 'male' | 'female';
export type ServiceRoute = 'army' | 'doctor' | 'public-health';
export interface IdentityState {
  version: 1;
  gender: Gender;
  service: {
    status: 'pending' | 'deferred' | 'not-required' | 'exempt' | 'prior-service' | 'serving' | 'completed';
    timing?: 'graduation' | 'after-training';
    route?: ServiceRoute;
    elapsedMs: number;
    startedMonth?: number;
  };
  resolved: string[];
}
// Separate career and service clocks preserve full study/training durations and old saves.
// Money, placement, education-month rounding and event effects are game assumptions.
export const SERVICE_RULES = {
  version: 'identity-service-provisional-v1', provisional: true, monthMs: 500,
  army: { months: 18, education: 0, income: 1_200_000, expenses: 250_000, encounters: 0 },
  doctor: { months: 36, education: 2, income: 3_000_000, expenses: 700_000, encounters: 120 },
  'public-health': { months: 36, education: 1, income: 3_000_000, expenses: 900_000, encounters: 180 },
} as const;
export const GENDER_LABELS = { male: '남자', female: '여자' };
export const SERVICE_LABELS = { army: '현역병', doctor: '군의관', 'public-health': '공중보건의' };
export function initialIdentity(seed: number, gender: Gender = (seed >>> 0) % 2 === 0 ? 'male' : 'female'): IdentityState {
  return { version: 1, gender, service: { status: gender === 'male' ? 'pending' : 'not-required', elapsedMs: 0 }, resolved: [] };
}
export const isServing = (s: GameState) => s.identity?.service.status === 'serving';
export const serviceMonths = (s: GameState) => Math.floor((s.identity?.service.elapsedMs ?? 0) / SERVICE_RULES.monthMs);
export const serviceDuration = (route: ServiceRoute) => SERVICE_RULES[route].months + SERVICE_RULES[route].education;
export const calendarMonths = (s: GameState) => elapsedMonths(s) + serviceMonths(s);
export function serviceSummary(s: GameState): string {
  const x = s.identity?.service;
  if (!x) return '';
  if (x.status === 'serving') return `${SERVICE_LABELS[x.route!]} · ${serviceMonths(s)}/${serviceDuration(x.route!)}개월`;
  if (x.status === 'completed') return `${SERVICE_LABELS[x.route!]} 복무 마침`;
  return { pending: '병역 미이행', deferred: x.timing === 'graduation' ? '졸업 후 의료인 복무 예정' : x.timing === 'after-training' ? '수련 후 의료인 복무 예정' : '군의관·공보의 경로 예정', 'not-required': '병역 의무 없음', exempt: '병역 면제', 'prior-service': '입학 전 복무 마침' }[x.status];
}
// Draft-only setup; it never rerolls the background, abilities, seed or opportunities.
export function configureIdentity(s: GameState, gender: Gender, status?: 'pending' | 'exempt' | 'prior-service'): GameState {
  if (!s.life || elapsedMonths(s) !== 0 || s.revision !== 0 || !s.life.paused || s.pendingEvent || !['male', 'female'].includes(gender)) return s;
  const next = structuredClone(s);
  next.identity = initialIdentity(s.life.initialSeed, gender);
  if (gender === 'male' && status && ['pending', 'exempt', 'prior-service'].includes(status)) next.identity.service.status = status;
  return next;
}
const choice = (id: string, label: string, description: string, effects: Partial<Stats> = {}): EventChoice => ({ id, label, description, effects });
const seen = (s: GameState, key: string) => s.identity!.resolved.includes(key);
function note(s: GameState, id: string, title: string, detail: string) {
  s.journal.push({ id: `identity:${id}`, stage: STAGES[s.stageIndex].id, title, detail: `${lifeAge(s)} · ${detail}`, effects: {} });
}
export function requiredIdentity(s: GameState, trainingEnd: number): string | null {
  if (!s.identity) return null;
  const x = s.identity.service, m = elapsedMonths(s);
  if (x.status === 'serving') {
    if (serviceMonths(s) >= 3 && !seen(s, 'service:daily')) return 'service:daily';
    if (serviceMonths(s) >= Math.floor(serviceDuration(x.route!) / 2) && !seen(s, 'service:contact')) return 'service:contact';
    return null;
  }
  if (x.status === 'pending' && m >= 12) return 'service:plan';
  if (x.status === 'deferred' && !x.timing && m >= 60) return 'service:timing';
  if (x.status === 'deferred' && m >= 72 && (x.timing === 'graduation' || s.career!.application !== 'accepted' || m >= trainingEnd)) return 'service:placement';
  if (s.identity.gender === 'female' && x.status === 'not-required' && !seen(s, 'service:volunteer') && m >= 72 && (s.career!.application !== 'accepted' || m >= trainingEnd)) return 'service:volunteer';
  if (m >= 24 && !seen(s, 'identity:campus')) return 'identity:campus';
  if (s.stageIndex >= 1 && m >= 96 && !seen(s, 'identity:work')) return 'identity:work';
  if (s.family!.children !== 'none' && !seen(s, 'identity:care')) return 'identity:care';
  return null;
}
export const waitingForGraduationService = (s: GameState) => s.identity?.service.status === 'deferred' && s.identity.service.timing === 'graduation';
// A stable fictional assignment, never a real-world personal probability.
export const medicalPlacement = (s: GameState): ServiceRoute => ((Math.imul(s.life!.initialSeed ^ 0x51a7, 2654435761) >>> 0) % 2) ? 'doctor' : 'public-health';
export function identityEvent(s: GameState, key: string): { title: string; body: string; choices: EventChoice[] } | null {
  if (!s.identity) return null;
  const x = s.identity.service, female = s.identity.gender === 'female';
  if (key === 'service:plan' && x.status === 'pending') return {
    title: '병역과 학업 계획', body: '재학 중 입대할지, 의사가 된 뒤 의료인으로 복무할지 정합니다. 복무하는 동안 학업과 수련은 잠시 멈춥니다.', choices: [
      choice('army', '휴학하고 현역병으로 복무', '18개월 뒤 복학합니다. 의사가 된 뒤 병역 때문에 진로를 멈추지 않습니다.'),
      choice('medical', '군의관·공보의 경로로 복무', '학업을 이어갑니다. 졸업 직후 또는 수련 후 의료인 복무를 시작합니다.'),
    ],
  };
  if (key === 'service:timing' && x.status === 'deferred' && !x.timing) return {
    title: '의료인 복무 시기', body: '졸업 이후의 일정을 정리합니다. 먼저 병역을 마칠지, 수련에 지원한 뒤 복무할지 고릅니다.', choices: [
      choice('graduation', '졸업 후 먼저 복무', '복무를 마친 뒤 전공과 수련에 지원합니다.'),
      choice('after-training', '수련 후 복무', '수련에 합격하면 수련을 마친 뒤 복무합니다. 수련하지 않으면 졸업 후 복무합니다.'),
    ],
  };
  if (key === 'service:placement' && x.status === 'deferred') {
    const route = medicalPlacement(s), r = SERVICE_RULES[route];
    return { title: `${SERVICE_LABELS[route]} 배치`, body: `${route === 'doctor' ? '군 의료기관에서 장병을 진료하게 됐습니다.' : '지역 보건기관에서 주민을 진료하게 됐습니다.'} 교육 ${r.education}개월과 복무 ${r.months}개월을 앞두고 짐을 챙깁니다.`, choices: [
      choice('study', '진료 자료부터 챙기기', '개인 정리 시간을 써서 현장 진료를 준비합니다.', { knowledge: 2, health: -1 }),
      choice('people', '가까운 사람들과 일정 맞추기', '복습 대신 가족·친구와 만날 날을 정합니다.', { relationships: 2 }),
    ] };
  }
  if (key === 'service:volunteer' && female && x.status === 'not-required') return {
    title: '군 의료기관에서 온 모집 안내', body: '의료인 모집 안내를 봤습니다. 지원해 군에서 일할지, 준비하던 진로를 이어갈지 생각합니다.', choices: [
      choice('civilian', '준비하던 진로 이어가기', '현재 진로에서 다음 일을 준비합니다.'),
      choice('volunteer', '군의관으로 지원하기', '선발되면 교육 2개월과 복무 36개월 뒤 돌아옵니다.'),
    ],
  };
  if (key === 'service:daily' && isServing(s)) return {
    title: x.route === 'army' ? '부대에서 보내는 저녁' : x.route === 'doctor' ? '부대 진료실의 하루' : '보건지소에서 보내는 하루',
    body: x.route === 'army' ? '일과가 끝났습니다. 동기가 운동하자고 부릅니다. 복학 준비용으로 가져온 책도 책상에 놓여 있습니다.' : '오늘 진료를 마쳤습니다. 동료는 함께 사례를 검토하자고 하고, 밀린 잠도 마음에 걸립니다.', choices: [
      choice('study', x.route === 'army' ? '가져온 책 읽기' : '동료와 사례 검토하기', '쉬는 시간을 줄여 공부합니다.', { knowledge: 3, health: -1 }),
      choice('rest', x.route === 'army' ? '동기와 가볍게 운동하기' : '오늘은 푹 쉬기', '추가 공부 대신 몸을 돌봅니다.', { health: 2, happiness: 1 }),
    ],
  };
  if (key === 'service:contact' && isServing(s)) return {
    title: '휴가를 앞두고', body: '다음 휴가에 친구들을 만나기로 했습니다. 복귀 뒤 시작할 공부를 준비하려면 혼자 쓸 시간도 필요합니다.', choices: [
      choice('meet', '친구들과 약속 잡기', '복학·복귀 준비 시간을 줄이고 서로의 근황을 듣습니다.', { relationships: 3, happiness: 1 }),
      choice('prepare', '다음 과정을 미리 준비하기', '친구들에게 연락한 뒤 남은 휴가는 공부에 씁니다.', { knowledge: 3, happiness: -1 }),
    ],
  };
  if (key === 'identity:campus') return female ? {
    title: '실습 전날의 컨디션', body: '이번 달에는 생리통 때문에 잠을 설쳤습니다. 조별 발표 준비가 남아 있어 동기와 일정을 이야기합니다.', choices: [
      choice('adjust', '발표 순서 조정 부탁하기', '준비 시간을 줄이고 회복할 시간을 확보합니다.', { health: 2, knowledge: -1 }),
      choice('share', '자료 정리를 나눠 맡기', '동기와 준비하되 내 몫을 줄여 일찍 마칩니다.', { relationships: 2, knowledge: 1 }),
    ],
  } : {
    title: '혼자 맡게 된 뒷정리', body: '동아리 행사가 끝나자 선배가 “남학생이니까 무거운 건 네가 옮겨 줘”라고 합니다. 오늘 복습할 내용도 남아 있습니다.', choices: [
      choice('divide', '모두 같이 나누자고 말하기', '함께 할 일을 정하고 남는 시간에 복습합니다.', { relationships: 2, knowledge: 1 }),
      choice('finish', '이번에는 마무리하고 쉬기', '뒷정리에 시간을 쓰고 복습은 내일로 미룹니다.', { happiness: 2, knowledge: -1 }),
    ],
  };
  if (key === 'identity:work') return {
    title: female ? '담당 의사 소개' : '괜찮다는 말 다음에',
    body: female ? '환자에게 자신을 소개했는데, 환자는 옆의 남자 동료에게 다시 담당 의사가 누구인지 묻습니다. 동료가 나를 바라봅니다.' : '바쁜 근무가 이어졌습니다. 동료가 힘들지 않냐고 묻자 “남자가 이 정도는 버텨야지”라는 말이 먼저 나옵니다. 사실 쉬고 싶었습니다.', choices: [
      choice('talk', female ? '내가 담당임을 다시 설명하기' : '동료에게 솔직하게 이야기하기', '잠깐 시간을 내어 상황을 설명하고 대화를 이어갑니다.', { relationships: 2, happiness: 1 }),
      choice('team', female ? '팀 소개 방식을 함께 바꾸기' : '팀과 근무 분담을 조정하기', '회의 시간을 써서 팀의 일하는 방식을 조정합니다.', { knowledge: 2, health: -1 }),
    ],
  };
  if (key === 'identity:care' && s.family!.children !== 'none') return {
    title: '아이와 일 사이의 시간', body: female ? '아이를 맞이한 뒤 주변에서 내 근무를 줄일 것인지 먼저 묻습니다. 파트너와 각자 원하는 일정부터 꺼내 놓습니다.' : '아이가 아픈 날, 주변에서는 파트너가 돌볼 거라고 생각합니다. 내 근무도 조정할 수 있을지 일정을 펼칩니다.', choices: [
      choice('share', '번갈아 돌볼 일정 만들기', '개인 공부 시간을 줄이고 돌봄을 나눕니다.', { relationships: 3, knowledge: -1 }),
      choice('support', '도움을 받아 함께 쉬기', '개인 약속을 줄이고 가까운 사람에게 돌봄 지원을 부탁합니다.', { health: 2, relationships: 1 }),
    ],
  };
  return null;
}
function startService(s: GameState, route: ServiceRoute) {
  Object.assign(s.identity!.service, { route, status: 'serving', startedMonth: elapsedMonths(s) });
  note(s, 'start', `${SERVICE_LABELS[route]} 복무 시작`, `${s.identity!.gender === 'female' ? '지원한 모집에 선발됐습니다. ' : ''}${serviceDuration(route)}개월 뒤 ${s.stageIndex === 0 && elapsedMonths(s) < 72 ? '학교' : '준비하던 진로'}로 돌아옵니다.`);
}
export function settleIdentity(s: GameState, key: string, id: string): boolean {
  const event = identityEvent(s, key);
  if (!event?.choices.some(c => c.id === id) || seen(s, key)) return false;
  const x = s.identity!.service;
  s.identity!.resolved.push(key);
  if (key === 'service:plan') { if (id === 'army') startService(s, 'army'); else x.status = 'deferred'; }
  if (key === 'service:timing') x.timing = id as 'graduation' | 'after-training';
  if (key === 'service:placement') startService(s, medicalPlacement(s));
  if (key === 'service:volunteer' && id === 'volunteer') startService(s, 'doctor');
  return true;
}
export function advanceService(s: GameState, elapsedMs: number) {
  const x = s.identity!.service, route = x.route!, r = SERVICE_RULES[route];
  const before = serviceMonths(s), end = serviceDuration(route);
  // Stop at each decision boundary even at 16x; do not consume time after a choice.
  const stop = !seen(s, 'service:daily') ? 3 : !seen(s, 'service:contact') ? Math.floor(end / 2) : end;
  x.elapsedMs = Math.min(stop * SERVICE_RULES.monthMs, x.elapsedMs + elapsedMs * s.life!.speed);
  const targetMs = x.elapsedMs, after = serviceMonths(s);
  const e = s.economy!;
  for (let month = before + 1; month <= after; month++) {
    x.elapsedMs = month * SERVICE_RULES.monthMs;
    const income = r.income, expenses = r.expenses;
    const delta = income - expenses;
    e.cash += delta; e.assets += delta; e.income = income; e.expenses = expenses;
    e.ledger.push({ id: `service:${month}:income`, month: elapsedMonths(s), label: `${SERVICE_LABELS[route]} ${month}개월 급여`, cashDelta: income, debtDelta: 0, kind: 'monthly' });
    e.ledger.push({ id: `service:${month}:living`, month: elapsedMonths(s), label: `복무 ${month}개월 생활비`, cashDelta: -expenses, debtDelta: 0, kind: 'monthly' });
    if (s.encounters && month > r.education) s.encounters.total += r.encounters;
    if (s.life!.childBornMonth !== undefined) {
      const age = calendarMonths(s) - s.life!.childBornMonth;
      s.family!.children = age >= 216 ? 'adult' : age >= 72 ? 'school' : 'young';
    }
    if (month % 6 === 0) note(s, `month:${month}`, `${SERVICE_LABELS[route]} ${month}개월`, `월 급여 ${(income / 10000).toLocaleString('ko-KR')}만 원 · 생활비 ${(expenses / 10000).toLocaleString('ko-KR')}만 원`);
  }
  x.elapsedMs = targetMs;
  if (serviceMonths(s) === end) {
    x.status = 'completed';
    note(s, 'complete', route === 'public-health' ? '공중보건의 복무 만료' : '전역', s.stageIndex === 0 && elapsedMonths(s) < 72 ? '복학해 멈췄던 학업을 이어갑니다.' : '복무를 마치고 준비하던 진로를 이어갑니다.');
  }
}
export function validIdentity(s: GameState): boolean {
  const i = s.identity;
  if (i === undefined) return true; // Existing saves retain their original rules.
  if (!i || i.version !== 1 || !['male', 'female'].includes(i.gender) || !i.service || !Array.isArray(i.resolved)) return false;
  const x = i.service, keys = ['service:plan', 'service:timing', 'service:placement', 'service:volunteer', 'service:daily', 'service:contact', 'identity:campus', 'identity:work', 'identity:care'];
  if (i.resolved.some(k => !keys.includes(k)) || new Set(i.resolved).size !== i.resolved.length || !Number.isSafeInteger(x.elapsedMs) || x.elapsedMs < 0) return false;
  if (!['pending', 'deferred', 'not-required', 'exempt', 'prior-service', 'serving', 'completed'].includes(x.status) || (x.timing !== undefined && !['graduation', 'after-training'].includes(x.timing))) return false;
  if (i.gender === 'female' && !['not-required', 'serving', 'completed'].includes(x.status)) return false;
  if (i.gender === 'male' && x.status === 'not-required') return false;
  if (x.status === 'serving' || x.status === 'completed') {
    if (!x.route || !Object.hasOwn(SERVICE_LABELS, x.route) || !Number.isSafeInteger(x.startedMonth) || x.startedMonth! < 12 || x.startedMonth! > elapsedMonths(s)) return false;
    if (i.gender === 'female' && (x.route !== 'doctor' || !seen(s, 'service:volunteer'))) return false;
    if (i.gender === 'male' && (!seen(s, 'service:plan') || (x.route !== 'army' && (!seen(s, 'service:placement') || !x.timing)))) return false;
    if (x.route !== 'army' && x.startedMonth! < 72) return false;
    const total = serviceDuration(x.route) * SERVICE_RULES.monthMs;
    if (x.status === 'completed' ? x.elapsedMs !== total : x.elapsedMs >= total || x.startedMonth !== elapsedMonths(s)) return false;
    if (serviceMonths(s) > 3 && !seen(s, 'service:daily')) return false;
    if (serviceMonths(s) > Math.floor(serviceDuration(x.route) / 2) && !seen(s, 'service:contact')) return false;
  } else if (x.route !== undefined || x.startedMonth !== undefined || x.elapsedMs !== 0) return false;
  if (x.status === 'deferred' && !seen(s, 'service:plan')) return false;
  if (x.timing !== undefined && !seen(s, 'service:timing')) return false;
  if (s.status === 'completed' && ['pending', 'deferred', 'serving'].includes(x.status)) return false;
  return true;
}
