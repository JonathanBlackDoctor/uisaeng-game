import type { GameState, GameEvent, Stats } from './contracts';
import { SPECIALTIES } from './career';
import { campusClub } from './campus';
import { SPECIALTY_DEPTH, DEPTH_RULES } from './specialty-depth';
import { elapsedMonths, adjustStats, lifeAge } from './random-life';

// Fictional opportunities, never admission advantages or hospital wage/risk rankings.
export interface CareerDepth {
  version: 1;
  since: number;
  skill: number;
  safety: number;
  workload: 'balanced' | 'extended' | 'learning';
  institutionPath: string | null;
  pendingInstitution?: string;
  mentorSpecialty: string | null;
  decisions: Record<string, { choice: string; month: number; followed: boolean }>;
  lastIncident: number;
  lastMonth: number;
}
export const DEPTH_RUNTIME = { version: 'career-depth-provisional-1', provisional: true, followUpMonths: 3,
  extendedSalary: 600_000, extendedRevenue: 900_000, extendedCost: 300_000, learningCost: 120_000,
  // Deck draw rates for fictional stories, not an individual's medical risk.
  incidentDraw: 0.18, incidentCooldown: 36 };
export const initialDepth = (month = 0): CareerDepth => ({ version: 1, since: month, skill: 0, safety: 0,
  workload: 'balanced', institutionPath: null, mentorSpecialty: null, decisions: {}, lastIncident: month, lastMonth: month });
const month = (s: GameState) => elapsedMonths(s);
const option = (id: string, label: string, description = '', effects: Partial<Stats> = {}) => ({ id, label, description, effects });
const money = (n: number) => `${Math.abs(n).toLocaleString('ko-KR')}원`;
const subject = (s: GameState) => SPECIALTIES.find(x => x.id === s.career?.specialty);
const incidentSubject = (s: GameState) => subject(s) ?? (s.career?.practice === 'untrained' ? { ...SPECIALTIES.find(x => x.id === 'family')!, name: '일반진료' } : undefined);
function note(s: GameState, id: string, title: string, body: string, effects: Partial<Stats> = {}) {
  if (s.journal.some(x => x.id === id)) return;
  s.stats = adjustStats(s.stats, effects);
  s.journal.push({ id, stage: ['university', 'training', 'career', 'retirement'][s.stageIndex] as GameEvent['stage'], title, detail: `${lifeAge(s)} · ${body}`, effects });
}
export function upgradeDepth(s: GameState) { s.depth ??= initialDepth(month(s)); }
export function requiredDepth(s: GameState): string | null {
  const d = s.depth, c = s.career;
  if (!d || !c || s.stageIndex === 0 || s.stageIndex === 3) return null;
  const start = Math.max(72, s.progress!.trainingStartMonth ?? 72, d.since), m = month(s);
  if (c.application === 'accepted' && s.stageIndex === 1) {
    if (m >= start + 1 && !d.decisions['depth-institution']) return 'depth-institution';
    if (m >= start + 6 && !d.decisions['depth-training']) return 'depth-training';
    const club = campusClub(s);
    if (club && s.campus?.project === 'finished' && s.campus.mentorMeetings > 0 && m >= start + 9 && !d.decisions['depth-mentor']) return 'depth-mentor';
  }
  if (s.stageIndex === 2 && c.practice !== 'undecided') {
    if (!d.decisions['depth-workload']) return 'depth-workload';
    if (subject(s) && c.practice !== 'research' && m >= Math.max(150, d.since) + 6 && !d.decisions['depth-work']) return 'depth-work';
  }
  return null;
}

// Each hospital's confirmed, historical program facts are supplied separately.
export interface InstitutionOpportunity { id: string; summary: string; url: string; fact: string; sha256: string; specialties?: string[]; paths: { id: string; label: string; body: string; skill: number; safety: number }[] }
export const INSTITUTION_OPPORTUNITIES: Record<string, InstitutionOpportunity> = {
  snuh: { id: 'snuh', summary: '근무평가 안내를 읽고 지도전문의와 학습 계획을 이야기합니다.', url: 'https://dept.snuh.org/dept/RTO/content.do?menuId=003012', fact: '서울대학교병원 안내는 의학 지식·근무자세·임상능력 등을 연 2회 평가한다고 설명합니다.', sha256: '20a81bc12874f18242c260a347df7d4a8daa6037550a75e9fb676da6946aa59b', paths: [
    { id: 'evaluation', label: '지난 기록에서 보완할 점 찾기', body: '숙련 +3 · 안전관리 +4 · 기록 검토', skill: 3, safety: 4 },
    { id: 'abstract', label: '학회 초록 주제 의논하기', body: '숙련 +5 · 안전관리 +1 · 연구 질문 정리', skill: 5, safety: 1 }] },
  asan: { id: 'asan', summary: '시뮬레이션 교육 안내를 읽었습니다. 필수 일정 외에 어떤 연습을 할지 지도전문의와 상의합니다.', url: 'https://heart.amc.seoul.kr/asan/depts/sim/K/content.do?menuId=4902', fact: '서울아산병원 시뮬레이션센터는 전공의 필수 과정과 희망자 심화 과정을 구분해 안내합니다.', sha256: 'ddfb8741c32516e3770a6379fe74c35c573ce1d8f49ac6f533aa6632b0ff96e1', paths: [
    { id: 'simulation', label: '모형 실습에서 인계 연습하기', body: '숙련 +3 · 안전관리 +5 · 동료와 역할 연습', skill: 3, safety: 5 },
    { id: 'debrief', label: '연습 뒤 기록 함께 읽기', body: '숙련 +4 · 안전관리 +3 · 다시 확인할 일 정리', skill: 4, safety: 3 }] },
  samsung: { id: 'samsung', summary: '2020년 S-Track 교육자료를 봤습니다. 지도전문의에게 지금 가능한 진료·연구·소통 교육을 물어봅니다.', url: 'https://www.samsunghospital.com/smc_upload/editor/files/strack_program_info2020.pdf', fact: '삼성서울병원 2020년 S-Track 자료는 진료·연구·리더십 교육을 소개하며, 현행 운영은 확인되지 않았습니다.', sha256: '1ae645918482b03faea427002c29f834eb35f14f7da49299aba2881ee50e69d0', paths: [
    { id: 'clinical-track', label: '진료 기록 검토 모임 의논하기', body: '숙련 +3 · 안전관리 +4 · 현재 일정부터 확인', skill: 3, safety: 4 },
    { id: 'research-track', label: '연구설계 모임 의논하기', body: '숙련 +5 · 안전관리 +1 · 현재 참여 조건 확인', skill: 5, safety: 1 },
    { id: 'communication-track', label: '동료와 소통 연습하기', body: '숙련 +2 · 안전관리 +5 · 전달 누락 살피기', skill: 2, safety: 5 }] },
  severance: { id: 'severance', summary: '맞춤형 수련체계 계획을 읽고 지도전문의에게 면담 일정을 물어봅니다.', url: 'https://sev.severance.healthcare/sev/news/press/report.do?articleNo=130465&mode=view', fact: '세브란스병원은 2026년 인턴과 7개 전문과목 대상 맞춤형 평가·면담 계획을 발표했습니다.', sha256: 'ffa813bc82693d2ec89cdfe6151963cdd7e9fefb92327b3c1a541e6ac73a3453', specialties: ['surgery', 'obgyn', 'pediatrics', 'emergency', 'thoracic', 'neurology', 'neurosurgery'], paths: [
    { id: 'milestone', label: '현장 기록으로 보완 계획 세우기', body: '숙련 +4 · 안전관리 +3 · 다음 면담 준비', skill: 4, safety: 3 },
    { id: 'career-talk', label: '근무 고민과 진로 이야기하기', body: '숙련 +2 · 안전관리 +5 · 다음 일정 함께 조정', skill: 2, safety: 5 }] },
  'seoul-st-mary': { id: 'seoul-st-mary', summary: '의학교육지원실의 술기 공간과 문헌검색 지원 안내를 봤습니다. 동료와 배울 내용을 정합니다.', url: 'https://www.cmcseoul.or.kr/page/board/news/549408', fact: '서울성모병원은 2026년 전공의 전용 술기교육실과 문헌검색 상담 등 학습 지원을 소개했습니다.', sha256: '5a69514533f927061392785dbfefa7c8f16a7f9abc5037c559ac89efa330d0c4', paths: [
    { id: 'skills-room', label: '동료와 모형 술기 연습하기', body: '숙련 +4 · 안전관리 +4 · 연습 순서 정리', skill: 4, safety: 4 },
    { id: 'literature', label: '문헌검색 상담 준비하기', body: '숙련 +5 · 안전관리 +2 · 진료 질문 정리', skill: 5, safety: 2 }] },
};
export const institutionOpportunity = (s: GameState) => {
  const info = INSTITUTION_OPPORTUNITIES[s.career?.institution ?? ''];
  return info && (!info.specialties || info.specialties.includes(s.career?.specialty ?? '')) ? info : undefined;
};

export function depthEvent(s: GameState, key: string): Pick<GameEvent, 'title' | 'body' | 'choices'> | null {
  const d = s.depth, x = subject(s), c = s.career!;
  if (!d) return null;
  if (key === 'depth-application' && d.pendingInstitution) {
    const snuh = d.pendingInstitution === 'snuh';
    return { title: '지원 서류 확인', body: snuh ? '서울대병원 2026년 공고에는 온라인 접수와 방문 접수가 모두 필요했습니다. 준비한 서류와 접수 방법을 다시 살핍니다. 실제 지원에는 해당 연도 공고를 확인해야 합니다.' : '서울아산병원 2026년 공고에는 채용 사이트 지원서와 교육수련팀 방문 접수 안내가 있습니다. 서류와 방문 시간을 다시 살핍니다. 실제 지원에는 해당 연도 공고를 확인해야 합니다.', choices: [
      option('submit', snuh ? '온라인·방문 서류 확인하고 지원하기' : '지원서·방문 시간 확인하고 지원하기'), option('revise', '다른 병원도 살펴보기')] };
  }
  if (key === 'depth-institution') {
    const info = institutionOpportunity(s);
    return { title: '수련 일정 고르기', body: info ? `${info.summary} 이번 수련에서는 어떤 기회를 먼저 활용할지 정합니다.` : '수련 첫 달, 지도전문의와 목표와 근무 뒤 시간을 이야기합니다.',
      choices: info ? info.paths.map(p => option(p.id, p.label, p.body)) : [option('feedback', '지도전문의와 기록 검토하기', '숙련과 안전관리 경험'), option('peer', '동료와 정기 공부 모임 만들기', '숙련과 관계 경험'), option('rest', '퇴근 뒤 쉴 시간 확보하기', '건강과 생활 우선')] };
  }
  if ((key === 'depth-training' || key === 'depth-work') && x) {
    const episode = key === 'depth-training' ? SPECIALTY_DEPTH[x.id]?.training : SPECIALTY_DEPTH[x.id]?.work;
    if (!episode) return null;
    const unavailable = episode.choices.filter(ch => (ch.cash ?? 0) < -s.economy!.cash);
    return { title: episode.title, body: episode.body + (unavailable.length ? ` 현금 ${money(s.economy!.cash)}. 비용이 드는 선택은 잔액이 있을 때 할 수 있습니다.` : ''),
      choices: episode.choices.filter(ch => (ch.cash ?? 0) >= -s.economy!.cash).map(ch => option(ch.id, ch.label, `${ch.result}${ch.cash ? ` · ${money(ch.cash)} ${ch.cash < 0 ? '지출' : '수입'}` : ''}`, ch.effects)) };
  }
  if (key === 'depth-mentor') {
    const club = campusClub(s); if (!club) return null;
    const mentor = club.mentor.split(' 선배 ')[1];
    const same = c.specialty === club.specialty;
    return { title: `${mentor} 선배와 다시 만나다`, body: `${club.project}를 함께 마친 ${mentor} 선배가 연락했습니다. ${same ? '같은 분야에서 겪은 일을 정리해 작은 발표를 같이 해보자고 합니다.' : '서로 다른 전공에서 볼 수 있는 문제를 함께 이야기해보자고 합니다.'}`,
      choices: [option('collaborate', same ? '수련 기록으로 발표 준비하기' : '함께 사례 토론 준비하기', '세 달 뒤 발표 · 숙련과 안전관리 경험', { health: -1, relationships: 2 }), option('friends', '일 이야기 없이 밥 먹기', '오래된 인연을 이어갑니다.', { happiness: 2, relationships: 2 }), option('later', '다음에 보기로 하기', '지금 일정과 휴식부터 챙깁니다.', { health: 1 })] };
  }
  if (key === 'depth-workload') return { title: '일과 생활의 간격', body: c.practice === 'research' ? '연구 일정과 생활비를 함께 살핍니다. 수입과 시간을 어떻게 나눌지 정합니다.' : '앞으로 맡을 업무량을 정합니다. 일정은 진로와 돈에서 다시 바꿀 수 있습니다.', choices: [
    option('balanced', '기본 일정으로 일하기', '기본 수입 · 생활 시간 확보'),
    ...(c.practice === 'research' ? [] : [option('extended', '추가 업무 맡기', `월 수입 +${money(c.practice === 'clinic' ? DEPTH_RUNTIME.extendedRevenue : DEPTH_RUNTIME.extendedSalary)}${c.practice === 'clinic' ? ` · 운영비 +${money(DEPTH_RUNTIME.extendedCost)}` : ''} · 석 달마다 건강 -2 · 안전 점검 시간 감소`)]),
    option('learning', '유료 교육과 동료 검토 이어가기', `월 ${money(DEPTH_RUNTIME.learningCost)} 지출 · 숙련과 안전관리 · 석 달마다 건강 +1`)] };
  const incidentContext = incidentSubject(s);
  if (key.startsWith('depth-incident:') && incidentContext) {
    const kind = key.split(':')[1];
    const critical = kind === 'loss';
    return { title: critical ? '진료 뒤 남은 마음' : `${incidentContext.name} 기록을 다시 살피다`, body: critical ? `${incidentContext.name}에서 함께 돌보던 환자가 사망했습니다. 동료들과 경과를 되짚고 가족에게 설명할 시간을 마련합니다.` : `${SPECIALTY_DEPTH[incidentContext.id].work.title} 이후 설명과 기록에 대한 질문이 들어왔습니다. 업무를 멈추고 당시 과정을 확인할 시간이 필요합니다.`, choices: [
      option('team', '동료와 기록 검토하고 일정 줄이기', '다음 달부터 기본 일정 · 안전관리 경험', { happiness: critical ? -3 : -2, health: 1, relationships: 2 }),
      option('support', '지원 담당자와 함께 설명 준비하기', '동료의 도움을 받으며 기록 정리', { happiness: critical ? -4 : -3, knowledge: 2 }),
      ...(d.safety >= 8 && d.skill >= 6 ? [option('prepared', '쌓아 둔 점검 기록으로 설명 준비하기', '이전에 정리한 기록 활용 · 다음 달부터 기본 일정', { happiness: critical ? -2 : -1, knowledge: 2, relationships: 1 })] : []),
    ] };
  }
  return null;
}
function cash(s: GameState, id: string, label: string, amount: number) {
  const e = s.economy!;
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(e.cash + amount) || !Number.isSafeInteger(e.assets + amount) || e.cash + amount < 0 || e.ledger.some(t => t.id === id)) return false;
  e.cash += amount; e.assets += amount;
  if (amount > 0) e.income += amount; else e.expenses -= amount;
  e.ledger.push({ id, month: month(s), label, cashDelta: amount, debtDelta: 0 }); return true;
}
export function settleDepth(s: GameState, key: string, id: string, actionId: string): boolean {
  upgradeDepth(s); const d = s.depth!, x = subject(s);
  if (d.decisions[key]) return false;
  if ((key === 'depth-training' || key === 'depth-work') && x) {
    const episode = key === 'depth-training' ? SPECIALTY_DEPTH[x.id].training : SPECIALTY_DEPTH[x.id].work;
    const chosen = episode.choices.find(ch => ch.id === id); if (!chosen) return false;
    if (chosen.cash && !cash(s, `${actionId}:depth-money`, episode.title, chosen.cash)) return false;
    d.skill = Math.min(100, d.skill + chosen.skill); d.safety = Math.min(100, Math.max(0, d.safety + chosen.safety));
  } else if (key === 'depth-institution') {
    d.institutionPath = id;
    const path = institutionOpportunity(s)?.paths.find(p => p.id === id);
    d.skill += path?.skill ?? (id === 'rest' ? 0 : 3); d.safety += path?.safety ?? (id === 'feedback' ? 4 : 1);
  } else if (key === 'depth-mentor') {
    if (id === 'collaborate') { d.mentorSpecialty = campusClub(s)!.specialty; d.skill += 4; d.safety += 3; }
  } else if (key === 'depth-workload') {
    if (!['balanced', 'extended', 'learning'].includes(id)) return false;
    d.workload = id as CareerDepth['workload'];
  } else if (key.startsWith('depth-incident:')) {
    d.lastIncident = month(s); d.safety = Math.min(100, d.safety + 4);
    if (id === 'team' || id === 'prepared') d.workload = 'balanced';
  } else return false;
  d.skill = Math.min(100, d.skill); d.safety = Math.min(100, d.safety);
  d.decisions[key] = { choice: id, month: month(s), followed: false }; return true;
}
export function advanceDepth(s: GameState) {
  const d = s.depth; if (!d) return;
  const m = month(s), x = subject(s);
  if (m <= d.lastMonth) return;
  d.lastMonth = m;
  for (const [key, decision] of Object.entries(d.decisions)) {
    if (decision.followed || m < decision.month + DEPTH_RUNTIME.followUpMonths) continue;
    decision.followed = true;
    let follow = '';
    if (x && (key === 'depth-training' || key === 'depth-work')) {
      const ep = key === 'depth-training' ? SPECIALTY_DEPTH[x.id].training : SPECIALTY_DEPTH[x.id].work;
      follow = ep.choices.find(ch => ch.id === decision.choice)?.followUp ?? '';
    }
    if (key === 'depth-mentor' && decision.choice === 'collaborate') { follow = `${campusClub(s)?.mentor}와 준비한 발표를 마쳤습니다. 함께한 활동과 수련 기록을 다음 동료에게 넘겼습니다.`; s.career!.experience.research = Math.min(100, s.career!.experience.research + 4); }
    if (key === 'depth-institution') {
      const path = institutionOpportunity(s)?.paths.find(p => p.id === decision.choice);
      follow = path ? `${path.label} 일정을 마쳤습니다. 배운 내용을 다음 수련 기록에 반영했습니다.` : '정해 둔 수련 일정으로 동료와 다시 만났습니다. 지난 기록과 다음 목표를 함께 확인했습니다.';
      const area = ['abstract', 'research-track', 'literature'].includes(decision.choice) ? 'research' : ['career-talk', 'communication-track', 'peer'].includes(decision.choice) ? 'people' : 'clinical';
      s.career!.experience[area] = Math.min(100, s.career!.experience[area] + 4);
    }
    if (follow) note(s, `depth-follow:${key}`, '몇 달 뒤', follow, { knowledge: 1 });
  }
  if (s.stageIndex !== 2 || !d.decisions['depth-workload']) return;
  if (d.workload === 'extended' && s.career!.practice !== 'research') {
    const clinic = s.career!.practice === 'clinic' && s.economy!.ledger.some(t => t.kind === 'open-clinic');
    if (s.career!.practice !== 'clinic' || clinic) {
      cash(s, `depth-month:${m}:income`, clinic ? '추가 진료 매출' : '추가 업무 수입', clinic ? DEPTH_RUNTIME.extendedRevenue : DEPTH_RUNTIME.extendedSalary);
      if (clinic) cash(s, `depth-month:${m}:operating`, '추가 진료 운영비', -DEPTH_RUNTIME.extendedCost);
    }
    if (m % 3 === 0) { d.safety = Math.max(0, d.safety - 1); note(s, `depth-load:${m}`, '빽빽해진 일정', '추가 업무 뒤 기록을 확인할 시간이 줄었습니다.', { health: -2, happiness: -1 }); }
  }
  if (d.workload === 'learning') {
    if (s.economy!.cash >= DEPTH_RUNTIME.learningCost) { cash(s, `depth-month:${m}:learning`, '선택한 동료 교육', -DEPTH_RUNTIME.learningCost); d.skill = Math.min(100, d.skill + 1); d.safety = Math.min(100, d.safety + 1); }
    else { d.workload = 'balanced'; note(s, `depth-learning-stop:${m}`, '교육 일정 조정', '교육비가 부족해 유료 교육을 멈췄습니다. 무료 기록 검토로 이어갑니다.'); }
    if (m % 3 === 0) s.stats = adjustStats(s.stats, { health: 1 });
  }
}
// Stable, specialty-keyed fictional story draws preserve speed/save consistency.
export function incidentDepth(s: GameState): string | null {
  const d = s.depth, c = s.career, x = incidentSubject(s), m = month(s);
  if (!d || !c || !x || s.stageIndex !== 2 || c.practice === 'research' || c.practice === 'undecided' || m % 12 !== 0 || m - d.lastIncident < DEPTH_RUNTIME.incidentCooldown) return null;
  let hash = (s.life!.initialSeed ^ m) >>> 0;
  for (const char of `${x.id}:${DEPTH_RULES.version}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const draw = hash / 4294967296;
  if (draw >= DEPTH_RUNTIME.incidentDraw) return null;
  // Clinical/surgical contexts include patient loss; diagnostic/community focus on review.
  const kind = ['surgical', 'clinical'].includes(x.track) && ((hash >>> 16) & 1) === 0 ? 'loss' : 'review';
  return `depth-incident:${kind}:${m}`;
}
export function validDepth(v: unknown, currentMonth: number): boolean {
  if (v === undefined) return true;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const d = v as CareerDepth;
  return d.version === 1 && Number.isSafeInteger(d.since) && d.since >= 0 && d.since <= currentMonth
    && [d.skill, d.safety].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 100)
    && ['balanced', 'extended', 'learning'].includes(d.workload)
    && (d.institutionPath === null || ['feedback', 'peer', 'rest', ...Object.values(INSTITUTION_OPPORTUNITIES).flatMap(i => i.paths.map(p => p.id))].includes(d.institutionPath))
    && (d.pendingInstitution === undefined || ['snuh', 'asan'].includes(d.pendingInstitution))
    && (d.mentorSpecialty === null || SPECIALTIES.some(x => x.id === d.mentorSpecialty))
    && Number.isSafeInteger(d.lastIncident) && d.lastIncident >= 0 && d.lastIncident <= currentMonth
    && Number.isSafeInteger(d.lastMonth) && d.lastMonth >= d.since && d.lastMonth <= currentMonth
    && !!d.decisions && typeof d.decisions === 'object' && !Array.isArray(d.decisions)
    && Object.entries(d.decisions).every(([k, x]) => {
      if (!x || typeof x.choice !== 'string' || !Number.isSafeInteger(x.month) || x.month < 0 || x.month > currentMonth || typeof x.followed !== 'boolean') return false;
      if (k === 'depth-training' || k === 'depth-work') return Object.values(SPECIALTY_DEPTH).some(p => (k === 'depth-training' ? p.training : p.work).choices.some(c => c.id === x.choice));
      if (k === 'depth-institution') return ['feedback', 'peer', 'rest', ...Object.values(INSTITUTION_OPPORTUNITIES).flatMap(i => i.paths.map(p => p.id))].includes(x.choice);
      if (k === 'depth-mentor') return ['collaborate', 'friends', 'later'].includes(x.choice);
      if (k === 'depth-workload') return ['balanced', 'extended', 'learning'].includes(x.choice);
      if (/^depth-incident:(loss|review):\d+$/.test(k)) return ['team', 'support', 'prepared'].includes(x.choice) && Number(k.split(':')[2]) === x.month;
      return false;
    });
}
