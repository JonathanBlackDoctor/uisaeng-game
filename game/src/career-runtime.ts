import { TIME_SPEEDS, type CareerProgress, type GameAction, type GameEvent, type GameState, type Stats } from './contracts';
import { advanceCareerExperience, applySpecialty, careerPreparation, careerScene, careerAdverseScene, choosePractice, exploreSpecialty, initialCareer, INSTITUTIONS, SPECIALTIES, validCareer } from './career';
import { economyAction, ECONOMY_RULES, initialEconomy, settleEconomyMonth, validEconomy, fundEducationDue } from './economy';
import { initialCampus, campusChoice, settleCampusChoice, requiredCampus, advanceCampus, validCampus } from './campus';
import { adjustStats, createRandomGame, elapsedMonths, eligibleEvents, lifeAge, nextRandom, person, randomEvent, RANDOM_RULES, reduceRandomGame, validRandomState } from './random-life';
import { STAGES } from './fixtures/content';

// Provisional active time, excluding reading decisions, manual pause and hidden tabs.
// University has 72*20s; other stages together have 612s. Actual play is measured separately.
export const CAREER_TIME = { monthMs: [20_000, 1_000, 1_000, 1_000], maxRandomPerKind: 2, randomSpacing: 4 };
export const CAREER_FOCUS: Record<CareerProgress['focus'], { label: string; detail: string; effects: Partial<Stats> }> = {
  study: { label: '공부', detail: '수업과 시험을 준비합니다.', effects: { knowledge: 1, health: -1 } },
  research: { label: '연구', detail: '자료를 정리하고 연구 회의에 참여합니다.', effects: { knowledge: 1, relationships: 1 } },
  clinical: { label: '임상 실습', detail: '지도 아래 진료 현장을 배우고 실습 일지를 씁니다.', effects: { knowledge: 1, health: -1 } },
  people: { label: '동아리·친구', detail: '모임에 참여하고 선배와 이야기합니다.', effects: { relationships: 1, happiness: 1 } },
  rest: { label: '휴식', detail: '잠과 운동 시간을 챙깁니다.', effects: { health: 2, happiness: 1 } },
  work: { label: '아르바이트', detail: '생활비를 벌며 공부 시간을 조정합니다.', effects: { health: -1, knowledge: -1 } },
};
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const spec = (s: GameState) => SPECIALTIES.find(p => p.id === (s.progress?.selectedSpecialty ?? s.career?.specialty ?? s.career?.interest));
const stage = (s: GameState) => STAGES[s.stageIndex].id;
export function careerStageEnds(s: GameState): number[] {
  const delay = Math.max(0, (s.progress?.trainingStartMonth ?? 72) - 72);
  return RANDOM_RULES.stageEnds.map((m, i) => m + (i > 0 ? delay : 0));
}
const has = (s: GameState, key: string) => s.progress!.resolved.includes(key);
const resolved = (s: GameState, key: string) => { if (!has(s, key)) s.progress!.resolved.push(key); };
const ch = (id: string, label: string, description = '', effects: Partial<Stats> = {}) => ({ id, label, description, effects });
function log(s: GameState, id: string, title: string, detail: string, effects: Partial<Stats> = {}) {
  if (s.journal.some(e => e.id === id)) return;
  s.stats = adjustStats(s.stats, effects);
  s.journal.push({ id, stage: stage(s), title, detail: `${lifeAge(s)} · ${detail}`, effects });
}
function finish(s: GameState, action: GameAction) {
  s.revision++; s.processedActionIds.push(action.id); return s;
}
function upgradeCampus(s: GameState) {
  if (s.campus) return;
  s.campus = initialCampus();
  s.campus.lastMonth = s.campus.lastAmbient = elapsedMonths(s);
  for (const [key, at] of [['campus-team', 12], ['campus-summer', 24], ['campus-practice', 42], ['campus-final', 60]] as const) {
    if (elapsedMonths(s) > at) s.campus.milestones.push(key);
  }
}
export function createCareerGame(runId: string, seed: number): GameState {
  const s = createRandomGame(runId, seed);
  s.rulesVersion = s.contentVersion = 'career-preview-v1';
  s.career = initialCareer(); s.economy = initialEconomy(s.life!.background.finances);
  s.campus = initialCampus();
  s.progress = { version: 1, focus: 'study', club: 'pending', marriage: 'pending', resolved: [], counts: {}, activeMs: [0, 0, 0, 0], remainder: 0, retryMonth: 0, result: '' };
  s.journal[0].title = '의대 입학';
  s.journal[0].detail = `${lifeAge(s)} · ${s.journal[0].detail}`;
  return s;
}
export function careerEvent(s: GameState, key: string): GameEvent | null {
  const p = s.progress!, c = s.career!, e = s.economy!, subject = spec(s);
  let title: string, body: string, choices: GameEvent['choices'];
  const campus = (s.campus || key.startsWith('campus-')) ? campusChoice(s, key) : null;
  if (campus) {
    ({ title, body, choices } = campus);
  } else if (key === 'funding') {
    title = '이번 달 납부할 돈'; body = `미납 ${won(e.due)} · 현금 ${won(e.cash)} · 부채 ${won(e.debt)}. 돈을 마련한 뒤 납부해야 다음 달로 넘어갑니다.`;
    choices = [...(s.campus && s.stageIndex === 0 ? [ch('education-plan', '재학 중 부족액은 대출로 충당하기', '이번 미납부터 졸업까지 학비·생활비 부족액만 자동 대출·납부. 부채가 늘며 수입·지출에서 언제든 중단할 수 있습니다.')] : []), ch('loan', '대출받고 납부하기', `현금·부채 +${won(ECONOMY_RULES.loanAmount)}`),
      ...(!e.ledger.some(t => t.kind === 'grant') ? [ch('grant', '생활 지원 신청하기', `한 번 받을 수 있는 지원 ${won(ECONOMY_RULES.grantAmount)}`)] : []),
      ...(!e.ledger.some(t => t.kind === 'work' && t.month === elapsedMonths(s)) ? [ch('work', '단기 일로 마련하기', `${won(ECONOMY_RULES.workAmount)} · 건강 -2 · 이번 달 한 번`)] : []),
      ...(e.cash >= e.due ? [ch('pay-due', '미납액 납부하기', `${won(e.due)} 지출`)] : [])];
  } else if (key === 'club-required') {
    title = '동아리 가입'; body = '신입 부원을 모집합니다. 정기 모임에 참여할지 정합니다.';
    choices = [ch('join', '가입하기', '선배·동기를 만날 기회', { relationships: 2 }), ch('pass', '가입하지 않기', '수업과 다른 활동에 시간을 씁니다.')];
  } else if (key === 'scholarship-required') {
    title = '장학금 신청'; body = '장학금 신청 기간입니다. 학업 기록을 내고 심사를 받을 수 있습니다.';
    choices = [ch('apply', '신청하기', '선발되면 재학 중 매달 지원'), ch('pass', '이번에는 신청하지 않기')];
  } else if (key.startsWith('rotation-')) {
    const i = Number(key.slice(9)); const choicesSpecs = SPECIALTIES.slice(i * 5, i * 5 + 5);
    title = '진료과 알아보기'; body = '견학할 진료과를 고릅니다. 보고 들은 내용은 진로 기록에 남습니다.';
    choices = choicesSpecs.map(x => ch(x.id, x.name, x.exploration));
  } else if (key === 'specialty-required') {
    title = '전공과 수련 결정'; body = '대학에서 쌓은 경험을 바탕으로 지원할 과를 정합니다. 수련하지 않는 길도 선택할 수 있습니다.';
    choices = [...SPECIALTIES.map(x => ch(x.id, x.name, `${x.summary} · 준비 ${Math.round(careerPreparation(c, x.id).total)}`)), ch('untrained', '수련하지 않기', '일반진료·연구 경로를 선택합니다.')];
  } else if (key === 'institution-required') {
    title = `${subject?.name ?? '전공'} 지원`; body = `${subject?.training ?? ''} 지원할 병원을 고릅니다. 선발 결과는 지원 뒤 확인합니다.`;
    choices = INSTITUTIONS.map(x => ch(x.id, x.name, x.description));
  } else if (key === 'application-result') {
    title = c.application === 'accepted' ? '수련 지원 결과' : '지원 결과와 다음 준비'; body = p.result;
    choices = c.application === 'accepted' ? [ch('continue', '수련 준비하기')] : [ch('retry', '다른 과도 살펴보고 재지원'), ch('untrained', '수련 없이 진료하기'), ch('research', '연구 경로로 가기')];
  } else if (key === 'marriage-required') {
    title = '앞으로의 관계';
    if (s.family!.status === 'dating') {
      body = `${s.family!.partner!.name}와 결혼과 각자의 진로를 이야기합니다.`;
      choices = [ch('marry', '함께 결혼 준비하기', '', { relationships: 2 }), ch('stay', '결혼하지 않고 만나기'), ch('later', '나중에 다시 이야기하기')];
    } else {
      body = '진로를 준비하며 앞으로 결혼을 원하는지 생각해 봅니다. 지금 상대를 정하는 선택은 아닙니다.';
      choices = [ch('open', '좋은 만남이 있으면 생각하기'), ch('single', '결혼하지 않는 삶을 생각하기'), ch('later', '나중에 다시 생각하기')];
    }
  } else if (key === 'practice-required') {
    title = '앞으로의 일'; body = c.application === 'accepted' ? `${subject?.name} 수련을 마쳤습니다. 어떤 일로 이어갈지 정합니다.` : '수련하지 않는 경로에서 앞으로의 일을 정합니다.';
    choices = [...(c.application === 'accepted' ? [ch('employed', '봉직의로 일하기', `월 급여 ${won(ECONOMY_RULES.employedSalary)}`), ch('clinic', '개원 준비하기', `초기비용 ${won(ECONOMY_RULES.clinicOpeningCost)} · 월 매출과 운영비 별도`)] : [ch('untrained', '일반진료로 일하기', `월 수입 ${won(ECONOMY_RULES.untrainedIncome)}`)]), ch('research', '연구하기', `월 수입 ${won(ECONOMY_RULES.researchIncome)}`)];
  } else if (key === 'clinic-funding') {
    title = '개원 비용 마련'; body = `초기비용 ${won(ECONOMY_RULES.clinicOpeningCost)} · 현금 ${won(e.cash)} · 부채 ${won(e.debt)}. 대출은 직접 선택한 경우에만 생깁니다.`;
    choices = [...(e.cash >= ECONOMY_RULES.clinicOpeningCost ? [ch('open-clinic', '개원하기')] : [ch('loan', '개원 자금 대출받기', `현금·부채 +${won(ECONOMY_RULES.loanAmount)}`)]), ch('employed', '봉직의로 시작하기'), ch('research', '연구 경로 선택하기')];
  } else if (key === 'clinical-case') {
    const scene = careerScene(c); title = scene.title; body = scene.body;
    choices = [ch('team', '동료와 함께 검토하기', '', { knowledge: 2, relationships: 1 }), ch('review', '기록을 정리해 확인하기', '', { knowledge: 3, health: -1 })];
  } else if (key === 'patient-loss') {
    title = '환자를 떠나보낸 뒤'; body = careerAdverseScene(c, 'patient-loss');
    choices = [ch('support', '동료와 이야기하고 일정 조정하기', '', { happiness: -3, health: 1, relationships: 2 }), ch('review', '경과를 검토하고 설명 준비하기', '', { happiness: -4, knowledge: 2 })];
  } else if (key === 'dispute') {
    title = '진료 과정에 대한 이의'; body = careerAdverseScene(c, 'dispute');
    choices = [ch('support', '지원 부서와 기록 검토하기', '', { happiness: -3, relationships: 1 }), ch('explain', '동료와 함께 설명 준비하기', '', { happiness: -4, health: -1, knowledge: 2 })];
  } else if (key === 'stage-end') {
    title = ['졸업 이후', c.application === 'accepted' ? '수련 이후' : '일과 생활', '은퇴 준비', '회고'][s.stageIndex];
    body = s.stageIndex === 3 ? '대학에서 시작한 선택과 이후의 일·생활을 기록으로 돌아봅니다.' : '지금까지의 진로와 생활을 이어갑니다.';
    choices = [ch('continue', s.stageIndex === 3 ? '회고 남기기' : '계속하기')];
  } else return null;
  return { id: `${s.runId}:career:${key}:${elapsedMonths(s)}:${s.revision}`, stage: stage(s), title, body, choices, provenance: 'career-preview', randomKey: key };
}
function pending(s: GameState, key: string) { s.pendingEvent = careerEvent(s, key); }
function required(s: GameState): string | null {
  const m = elapsedMonths(s), c = s.career!, p = s.progress!;
  if (s.economy!.due > 0) return 'funding';
  if (s.stageIndex === 0) {
    if (p.club === 'pending' && m >= 1) return 'club-required';
    if (m >= 6 && !has(s, 'scholarship-required')) return 'scholarship-required';
    const campus = requiredCampus(s); if (campus) return campus;
    if (m >= 66 && c.application === 'none' && !p.selectedSpecialty) return 'specialty-required';
    if (m >= 66 && c.application === 'none' && p.selectedSpecialty) return 'institution-required';
  }
  if (c.application === 'rejected' && c.practice !== 'research' && !p.result && m >= p.retryMonth) return 'specialty-required';
  if (p.result) return 'application-result';
  if (s.stageIndex > 0 && s.stageIndex < 3 && c.application === 'untrained' && c.practice === 'untrained' && !has(s, 'practice-required')) return 'practice-required';
  if (m >= 90 && s.family!.status !== 'married' && p.marriage !== 'settled' && (p.marriage === 'pending' || m >= (p.marriageRetryMonth ?? p.retryMonth))) return 'marriage-required';
  if (s.stageIndex >= 2 && c.practice === 'undecided') return 'practice-required';
  if (s.stageIndex === 2 && c.practice === 'clinic' && !s.economy!.ledger.some(t => t.kind === 'open-clinic')) return 'clinic-funding';
  if (s.stageIndex === 2 && m >= 156 && !has(s, 'clinical-case')) return 'clinical-case';
  if (s.stageIndex === 2 && c.practice !== 'research' && m >= 216 && !has(s, 'patient-loss')) return 'patient-loss';
  if (s.stageIndex === 2 && c.practice !== 'research' && m >= 300 && !has(s, 'dispute')) return 'dispute';
  if (m >= careerStageEnds(s)[s.stageIndex]) {
    if (s.stageIndex === 1 && c.application === 'rejected' && c.practice === 'undecided') return 'specialty-required';
    if (s.stageIndex === 0 && !['accepted', 'untrained'].includes(c.application) && c.practice !== 'research' && !(c.application === 'rejected' && p.retryMonth > m)) return 'specialty-required';
    return 'stage-end';
  }
  return null;
}
function advanceMonth(s: GameState) {
  const m = elapsedMonths(s), p = s.progress!;
  s.career = advanceCareerExperience(s.career!, m, p.focus);
  s.economy = settleEconomyMonth(s.economy!, m, { stage: s.stageIndex === 1 && s.career.application !== 'accepted' ? 'career' : stage(s), practice: s.career.practice, working: p.focus === 'work', scholarship: s.life!.flags.includes('scholarship'), automaticEducationLoan: s.campus?.automaticFunding });
  if (m % 3 === 0) s.stats = adjustStats(s.stats, CAREER_FOCUS[p.focus].effects);
  if (s.life!.childBornMonth !== undefined) { const age = m - s.life!.childBornMonth; s.family!.children = age >= 216 ? 'adult' : age >= 72 ? 'school' : 'young'; }
  advanceCampus(s);
  if (s.stageIndex > 0 && [84, 108, 132, 168, 192, 240, 360, 480].includes(m)) {
    const scene = careerScene(s.career!);
    const notes = ['동료와 업무 분담과 인계 순서를 정했습니다.', '지난 기록에서 다시 확인할 내용을 골랐습니다.', '후배와 함께 질문을 모아 회의를 준비했습니다.', scene.body, '일정이 겹쳐 동료와 근무 시간을 조정했습니다.', '업무 기록을 돌아보고 쉴 시간을 정했습니다.', '오랫동안 함께한 동료와 업무 방식을 다시 살폈습니다.', '다음 담당자에게 남길 기록과 계획을 정리했습니다.'];
    log(s, `auto:career:${m}`, scene.title, notes[[84, 108, 132, 168, 192, 240, 360, 480].indexOf(m)]);
  }
  if (m % 6 === 0) log(s, `auto:money:${m}`, '이번 달 수입과 지출', `수입 ${won(s.economy.income)} · 지출 ${won(s.economy.expenses)} · 현금 ${won(s.economy.cash)} · 부채 ${won(s.economy.debt)}`);
}
function chooseCareer(s: GameState, action: Extract<GameAction, { type: 'choose' }>) {
  const e = s.pendingEvent!, key = e.randomKey!, id = action.choiceId, choice = e.choices.find(c => c.id === id)!;
  s.pendingEvent = null;
  upgradeCampus(s);
  if (key === 'funding' && id === 'education-plan' && s.stageIndex === 0) {
    s.campus!.automaticFunding = true;
    s.economy = fundEducationDue(s.economy!, action.id + ':fund', elapsedMonths(s));
  } else if (key.startsWith('campus-') || (key === 'club-required' && id !== 'join')) {
    settleCampusChoice(s, key, id);
  } else if (key === 'funding' || key === 'clinic-funding') {
    if (id === 'employed' || id === 'research') s.career = choosePractice(s.career!, id);
    else {
      const change = economyAction(s.economy!, action.id, id as 'loan' | 'grant' | 'work' | 'pay-due' | 'open-clinic', elapsedMonths(s));
      if (!change.ok) return null;
      s.economy = change.state;
      if (id === 'work') s.stats = adjustStats(s.stats, { health: -2, knowledge: -1 });
      if (s.economy.due > 0 && s.economy.cash >= s.economy.due) s.economy = economyAction(s.economy, `${action.id}:pay`, 'pay-due', elapsedMonths(s)).state;
    }
  } else if (key === 'club-required') {
    s.progress!.club = id === 'join' ? 'joined' : 'declined';
    if (id === 'join') { s.life!.flags.push('club'); s.life!.contacts = Math.min(20, s.life!.contacts + 2); }
  } else if (key === 'scholarship-required') {
    resolved(s, key);
    if (id === 'apply') {
      const draw = nextRandom(s.seed); s.seed = draw.seed;
      const accepted = draw.value < 0.45 + s.stats.knowledge / 400;
      if (accepted && !s.life!.flags.includes('scholarship')) s.life!.flags.push('scholarship');
      log(s, `${action.id}:result`, '장학금 결과', accepted ? '장학생으로 선발됐습니다. 다음 달부터 재학 중 매달 지원을 받습니다.' : '이번에는 선발되지 않았습니다.');
    }
  } else if (key.startsWith('rotation-')) { s.career = exploreSpecialty(s.career!, id); resolved(s, key); }
  else if (key === 'specialty-required') {
    if (id === 'untrained') { s.career = choosePractice(s.career!, 'untrained'); delete s.progress!.selectedSpecialty; }
    else { s.progress!.selectedSpecialty = id; pending(s, 'institution-required'); }
  } else if (key === 'institution-required') {
    const draw = nextRandom(s.seed); s.seed = draw.seed;
    const result = applySpecialty(s.career!, s.progress!.selectedSpecialty!, id, s.stats.knowledge, draw.value);
    s.career = result.state; s.progress!.result = result.detail;
    if (result.accepted) s.progress!.trainingStartMonth = Math.max(72, elapsedMonths(s));
    pending(s, 'application-result');
  } else if (key === 'application-result') {
    s.progress!.result = '';
    if (id === 'retry') {
      s.progress!.retryMonth = elapsedMonths(s) + 6;
      s.progress!.trainingStartMonth = Math.max(72, s.progress!.retryMonth);
      delete s.progress!.selectedSpecialty;
    }
    else if (id === 'untrained' || id === 'research') s.career = choosePractice(s.career!, id);
  } else if (key === 'marriage-required') {
    if (id === 'marry') s.family!.status = 'married';
    s.progress!.marriage = id === 'later' ? 'later' : 'settled';
    if (id === 'later') s.progress!.marriageRetryMonth = elapsedMonths(s) + 36;
    if (id === 'single' || id === 'stay') { if (!s.life!.flags.includes('unmarried')) s.life!.flags.push('unmarried'); }
  } else if (key === 'practice-required') {
    s.career = choosePractice(s.career!, id as 'employed' | 'clinic' | 'research' | 'untrained');
    resolved(s, key);
  }
  else if (key === 'stage-end') {
    if (s.stageIndex === 0) s.campus!.automaticFunding = false;
    if (s.stageIndex === 3) { s.status = 'completed'; s.life!.paused = true; }
    else s.stageIndex++;
  } else resolved(s, key);
  log(s, action.id, e.title, choice.label, choice.effects);
  return s;
}
export function reduceCareerGame(state: GameState, action: GameAction): GameState {
  if (action.type === 'next-choice') return state;
  if (state.status === 'completed' || state.processedActionIds.includes(action.id) || !state.progress || !state.career || !state.economy || !state.life) return state;
  if (action.type === 'control') {
    if (state.pendingEvent || (action.paused !== undefined && typeof action.paused !== 'boolean') || (action.speed !== undefined && !TIME_SPEEDS.includes(action.speed))) return state;
    const s = structuredClone(state); Object.assign(s.life!, { ...(action.paused !== undefined ? { paused: action.paused } : {}), ...(action.speed !== undefined ? { speed: action.speed } : {}) }); return finish(s, action);
  }
  if (action.type === 'school-funding') {
    if (state.stageIndex !== 0 || state.pendingEvent || typeof action.automatic !== 'boolean' || !!state.campus?.automaticFunding === action.automatic) return state;
    const s = structuredClone(state); upgradeCampus(s); s.campus!.automaticFunding = action.automatic;
    log(s, action.id, '학비·생활비 계획', action.automatic ? '졸업까지 학비·생활비 부족액만 대출로 충당합니다. 부채가 늘며 언제든 중단할 수 있습니다.' : '자동 대출을 중단했습니다. 부족할 때 직접 마련합니다.');
    return finish(s, action);
  }
  if (action.type === 'career-focus' || action.type === 'explore') {
    if (state.pendingEvent) return state;
    const s = structuredClone(state);
    if (action.type === 'career-focus') {
      if (!(action.focus in CAREER_FOCUS) || action.focus === state.progress.focus) return state;
      s.progress!.focus = action.focus;
      const main = action.focus === 'people' ? 'connect' : action.focus === 'rest' || action.focus === 'work' ? 'rest' : 'study';
      s.life!.focus = { main, supporting: main === 'rest' ? 'study' : 'rest' };
      log(s, action.id, '활동 변경', CAREER_FOCUS[action.focus].label);
    } else {
      if (state.stageIndex !== 0 || !SPECIALTIES.some(p => p.id === action.specialtyId)) return state;
      s.career = exploreSpecialty(s.career!, action.specialtyId); const x = SPECIALTIES.find(p => p.id === action.specialtyId)!;
      log(s, action.id, `${x.name} 탐색`, x.exploration);
    }
    return finish(s, action);
  }
  if (action.type === 'activity') return state;
  if (action.type === 'finance') {
    if (state.pendingEvent || action.kind !== 'repay') return state;
    const change = economyAction(state.economy, action.id, 'repay', elapsedMonths(state));
    if (!change.ok) return state;
    const s = structuredClone(state); s.economy = change.state;
    log(s, action.id, '대출 상환', `${won(state.economy.cash - change.state.cash)} 상환 · 남은 부채 ${won(change.state.debt)}`);
    return finish(s, action);
  }
  if (action.type === 'choose') {
    if (!state.pendingEvent || action.eventId !== state.pendingEvent.id || !state.pendingEvent.choices.some(c => c.id === action.choiceId)) return state;
    if (state.pendingEvent.provenance === 'career-preview') {
      const s = chooseCareer(structuredClone(state), action); if (!s) return state;
      if (!s.pendingEvent && s.status === 'active') { const key = required(s); if (key) pending(s, key); }
      return finish(s, action);
    }
    const s = reduceRandomGame(state, action);
    if (s === state) return state;
    if (state.pendingEvent.randomKey === 'marriage' && action.choiceId !== 'later') s.progress!.marriage = 'settled';
    if (state.pendingEvent.randomKey === 'marriage' && action.choiceId === 'later') {
      s.progress!.marriage = 'later'; s.progress!.marriageRetryMonth = elapsedMonths(s) + 36;
    }
    return s;
  }
  if (state.life.paused || state.pendingEvent || !Number.isInteger(action.elapsedMs) || action.elapsedMs <= 0 || action.elapsedMs > 1000) return state;
  const s = structuredClone(state);
  upgradeCampus(s);
  const keyNow = required(s); if (keyNow) { pending(s, keyNow); return finish(s, action); }
  let remaining = action.elapsedMs * s.life!.speed;
  while (remaining > 0 && !s.pendingEvent && s.status === 'active') {
    const duration = CAREER_TIME.monthMs[s.stageIndex];
    const simulated = s.life!.elapsedMs % RANDOM_RULES.monthMs;
    const need = ((1000 - simulated) * duration - s.progress!.remainder) / 1000;
    const used = Math.min(remaining, need);
    s.progress!.activeMs[s.stageIndex] += used / s.life!.speed;
    const numerator = used * 1000 + s.progress!.remainder;
    const progress = Math.floor(numerator / duration);
    s.progress!.remainder = numerator % duration;
    s.life!.elapsedMs += progress; remaining -= used;
    if (s.life!.elapsedMs % 1000 !== 0 || progress === 0) break;
    advanceMonth(s);
    const key = required(s); if (key) { pending(s, key); break; }
    const m = elapsedMonths(s);
    const chance = nextRandom(s.seed); s.seed = chance.seed;
    if (m % CAREER_TIME.randomSpacing !== 0 || chance.value >= 0.28) continue;
    const candidates = eligibleEvents(s).filter(d => !['club', 'mentor', 'research', 'research-followup', 'study-cost'].includes(d.key) && (s.progress!.counts[d.key] ?? 0) < CAREER_TIME.maxRandomPerKind && !(d.key === 'marriage' && s.progress!.marriage === 'settled'));
    if (!candidates.length) continue;
    const draw = nextRandom(s.seed); s.seed = draw.seed;
    const d = candidates[Math.floor(draw.value * candidates.length)];
    if (d.key.startsWith('offer-')) {
      const invited = person(s.seed, s.runId, m); s.seed = invited.seed;
      invited.person.occupation = d.key === 'offer-campus' ? '같은 학교 학생' : d.key === 'offer-gwating' || s.stageIndex === 0 ? '다른 학교 학생' : '다른 분야에서 일하는 사람';
      s.life!.seen[d.key] = m; s.pendingEvent = randomEvent(s, d.key, invited.person);
    } else { s.life!.seen[d.key] = m; s.pendingEvent = randomEvent(s, d.key); }
    if (s.pendingEvent) { const k = s.pendingEvent.randomKey!; s.progress!.counts[k] = (s.progress!.counts[k] ?? 0) + 1; }
  }
  return finish(s, action);
}
export function validCareerGame(s: GameState): boolean {
  const p = s.progress;
  if (!s.life || !validCampus(s.campus, elapsedMonths(s))) return false;
  if (s.rulesVersion !== 'career-preview-v1' || s.contentVersion !== 'career-preview-v1' || !p || p.version !== 1 || !validCareer(s.career) || !validEconomy(s.economy)
    || !(p.focus in CAREER_FOCUS) || !['pending', 'joined', 'declined'].includes(p.club) || !['pending', 'later', 'settled'].includes(p.marriage)
    || !Array.isArray(p.resolved) || p.resolved.some(x => typeof x !== 'string') || new Set(p.resolved).size !== p.resolved.length
    || !p.counts || typeof p.counts !== 'object' || Array.isArray(p.counts) || Object.values(p.counts).some(n => !Number.isInteger(n) || n < 0 || n > 2)
    || !Array.isArray(p.activeMs) || p.activeMs.length !== 4 || p.activeMs.some(n => !Number.isFinite(n) || n < 0)
    || !Number.isInteger(p.remainder) || p.remainder < 0 || p.remainder >= CAREER_TIME.monthMs[s.stageIndex]
    || !Number.isInteger(p.retryMonth) || p.retryMonth < 0 || typeof p.result !== 'string' || (p.selectedSpecialty !== undefined && !SPECIALTIES.some(x => x.id === p.selectedSpecialty)) || !s.life) return false;
  if ((p.marriageRetryMonth !== undefined && (!Number.isSafeInteger(p.marriageRetryMonth) || p.marriageRetryMonth < 0 || p.marriageRetryMonth > elapsedMonths(s) + 36))
    || (p.trainingStartMonth !== undefined && (!Number.isSafeInteger(p.trainingStartMonth) || p.trainingStartMonth < 72 || p.trainingStartMonth > Math.max(72, elapsedMonths(s) + 6)))) return false;
  const base: GameState = { ...s, rulesVersion: 'random-preview-v1', contentVersion: 'random-preview-v1' };
  if (base.pendingEvent?.provenance === 'career-preview') base.pendingEvent = null;
  const ends = careerStageEnds(s);
  const atEnd = s.life.elapsedMs === ends[s.stageIndex] * 1000;
  if (atEnd && s.status === 'active') base.pendingEvent = randomEvent(base, 'milestone');
  if (!validRandomState(base, ends)) return false;
  if (!s.pendingEvent || s.pendingEvent.provenance !== 'career-preview') return true;
  const canonical = careerEvent(s, s.pendingEvent.randomKey!);
  // Event identity is fixed before revision increments and persists across restore.
  if (!canonical || !s.pendingEvent.id.startsWith(`${s.runId}:career:${s.pendingEvent.randomKey}:${elapsedMonths(s)}:`)) return false;
  const matches = (event: GameEvent) => JSON.stringify({ ...event, id: s.pendingEvent!.id }) === JSON.stringify(s.pendingEvent);
  if (matches(canonical)) return true;
  // Exact legacy snapshots remain readable while subsequent events use the new content.
  if (s.campus && ['funding', 'club-required'].includes(canonical.randomKey!)) {
    const legacy = careerEvent({ ...s, campus: undefined }, canonical.randomKey!);
    if (legacy && matches(legacy)) return true;
  }
  // Preserve already-pending events from the first career preview build.
  if (canonical.randomKey === 'patient-loss') return matches({ ...canonical, body: '진료팀의 노력에도 환자가 사망했습니다. 팀에서 경과를 돌아보고 유가족과의 대화를 준비합니다.' });
  if (canonical.randomKey === 'dispute') return matches({ ...canonical, body: '환자 가족이 진료 과정에 이의를 제기했습니다. 기록을 확인하고 기관의 상담·법률 지원을 요청할 수 있습니다.' });
  if (canonical.randomKey === 'stage-end' && s.stageIndex === 1) return matches({ ...canonical, title: '수련 이후' });
  return false;
}
