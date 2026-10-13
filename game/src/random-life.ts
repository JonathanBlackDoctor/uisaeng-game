import { STAT_LABELS, TIME_SPEEDS, type Activity, type GameAction, type GameEvent, type GameState, type LifeBackground, type MeetingRoute, type Person, type Stats } from './contracts';
import { STAGES } from './fixtures/content';
import { captureHighs } from './stat-highs';
import { initialFamily } from './family';
import { expandBackground, backgroundStatEffects, backgroundDescription, BACKGROUND_RULES } from './background';
import { designEvent } from './event-design';
import { calendarMonths } from './identity';

// Fictional preview distributions and balance. These are NOT population statistics,
// admission models, or approved production career requirements.
export const RANDOM_RULES = { monthMs: 1000, stageEnds: [72, 144, 564, 684], startAge: 20, cooldownMonths: 6 } as const;
export const nextRandom = (seed: number) => {
  const next = (seed + 0x6D2B79F5) >>> 0;
  let t = Math.imul(next ^ (next >>> 15), next | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { seed: next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
};
export function adjustStats(stats: Stats, effects: Partial<Stats>): Stats {
  return Object.fromEntries(Object.keys(STAT_LABELS).map(k => [k, Math.max(0, Math.min(100, stats[k as keyof Stats] + (effects[k as keyof Stats] ?? 0)))])) as Stats;
}
export function generateStart(seed: number, version: 1 | 2 | 3 = 3) {
  let cursor = seed >>> 0;
  const draw = () => { const r = nextRandom(cursor); cursor = r.seed; return r.value; };
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(draw() * items.length)];
  const background: LifeBackground = {
    region: pick(['수도권', '충청권', '호남권', '영남권', '강원권', '제주']),
    environment: '',
    finances: pick(['tight', 'steady', 'steady', 'comfortable'] as const),
    support: pick(['limited', 'steady', 'close'] as const),
    experience: pick(['도서관에서 보내던 방과 후', '운동으로 버틴 수험 생활', '친구들과 꾸리던 작은 모임', '가족을 도우며 쌓은 생활 경험']),
  };
  background.environment = pick(background.region === '제주' || background.region === '강원권'
    ? ['중소도시에서 성장', '농어촌에서 성장'] : ['대도시에서 성장', '중소도시에서 성장', '농어촌에서 성장']);
  // Medical-school entrants, rather than an unconditional sample of all births.
  // Family means and social support are separate; neither determines happiness.
  const jitter = (base: number) => base + Math.floor(draw() * 31) - 15;
  const stats = adjustStats({ health: jitter(65), happiness: jitter(55), knowledge: jitter(60), relationships: jitter(50) }, {
    health: background.experience.includes('운동') ? 5 : 0,
    knowledge: background.finances === 'comfortable' ? 3 : background.finances === 'tight' ? -3 : 0,
    relationships: background.support === 'close' ? 7 : background.support === 'limited' ? -5 : 0,
  });
  if (version === 1) return { seed: cursor, background, stats };
  const expanded = expandBackground(background, draw, version);
  const spread = version === 3 ? BACKGROUND_RULES.statSpread : 15;
  const variedValue = (base: number) => base + Math.floor(draw() * (spread * 2 + 1)) - spread;
  const varied = { health: variedValue(60), happiness: variedValue(50), knowledge: variedValue(52), relationships: variedValue(45) };
  return { seed: cursor, background: expanded, stats: adjustStats(varied, backgroundStatEffects(expanded)) };
}
export const backgroundSummary = (b: LifeBackground) => backgroundDescription(b) ?? `${b.region} · ${b.environment} · ${ { tight: '빠듯한 가정 형편', steady: '보통의 가정 형편', comfortable: '여유 있는 가정 형편' }[b.finances]} · ${ { limited: '가족의 지원이 제한적', steady: '필요할 때 기대는 가족', close: '가족과 가까운 유대' }[b.support]} · ${b.experience}`;
export const elapsedMonths = (s: GameState) => Math.floor((s.life?.elapsedMs ?? 0) / RANDOM_RULES.monthMs);
// Saves created before startAge was stored began at 19.
export const lifeStartAge = (s: GameState) => s.life?.startAge ?? 19;
export const lifeAge = (s: GameState) => `${lifeStartAge(s) + Math.floor(calendarMonths(s) / 12)}세 ${calendarMonths(s) % 12}개월`;
export function createRandomGame(runId: string, seed: number): GameState {
  const start = generateStart(seed);
  return {
    runId, seed: start.seed, revision: 0, stageIndex: 0, stats: start.stats, family: initialFamily(),
    rulesVersion: 'random-preview-v1', contentVersion: 'random-preview-v1', status: 'active', pendingEvent: null,
    life: { initialSeed: seed >>> 0, background: start.background, startAge: RANDOM_RULES.startAge, elapsedMs: 0, focus: { main: 'study', supporting: 'rest' }, paused: true, speed: 1, seen: {}, flags: [], contacts: 0 },
    journal: [{ id: 'background', stage: 'university', title: '의대 입학, 내가 지나온 시간', detail: backgroundSummary(start.background), effects: {} }], processedActionIds: [],
  };
}

type Definition = { key: string; weight: (s: GameState) => number; eligible: (s: GameState) => boolean };
const stageIs = (s: GameState, ...stages: number[]) => stages.includes(s.stageIndex);
const social = (s: GameState) => 1 + (s.life!.focus.main === 'connect' ? 3 : s.life!.focus.supporting === 'connect' ? 1 : 0) + s.life!.contacts / 5;
const single = (s: GameState) => s.family!.status === 'single' && !s.family!.partner;
const has = (s: GameState, flag: string) => s.life!.flags.includes(flag);
export const RANDOM_EVENTS: Definition[] = [
  { key: 'offer-gwating', weight: social, eligible: s => stageIs(s, 0) && single(s) },
  { key: 'offer-blind-date', weight: s => social(s) + (has(s, 'asked-introduction') ? 5 : 0), eligible: s => stageIs(s, 0, 1, 2) && single(s) },
  { key: 'offer-campus', weight: s => social(s) + (has(s, 'club') ? 5 : 0), eligible: s => stageIs(s, 0) && has(s, 'club') && single(s) },
  { key: 'club', weight: social, eligible: s => stageIs(s, 0) && !has(s, 'club') },
  { key: 'friend', weight: social, eligible: s => stageIs(s, 0, 1, 2, 3) },
  { key: 'ask-introduction', weight: social, eligible: s => stageIs(s, 0, 1, 2) && single(s) && s.life!.contacts > 0 && !has(s, 'asked-introduction') },
  { key: 'research', weight: s => 1 + (s.life!.focus.main === 'study' ? 4 : 0), eligible: s => stageIs(s, 0, 1, 2) && !has(s, 'research') },
  { key: 'research-followup', weight: () => 3, eligible: s => stageIs(s, 0, 1, 2) && has(s, 'research') },
  { key: 'study-cost', weight: () => 2, eligible: s => stageIs(s, 0, 1) && s.life!.background.finances === 'tight' && !has(s, 'scholarship') },
  { key: 'mentor', weight: s => 1 + s.life!.contacts / 4, eligible: s => stageIs(s, 1, 2) },
  { key: 'rest', weight: s => 1 + (100 - s.stats.health) / 20, eligible: () => true },
  { key: 'home', weight: s => s.life!.background.support === 'close' ? 3 : 2, eligible: () => true },
  { key: 'friend-request', weight: s => 1 + s.life!.contacts / 3, eligible: s => s.life!.contacts > 0 },
  { key: 'acquaintance', weight: () => 4, eligible: s => s.family!.status === 'single' && !!s.family!.partner },
  { key: 'cc-life', weight: () => 3, eligible: s => stageIs(s, 0) && s.family!.status === 'dating' && s.family!.meeting === 'campus' },
  { key: 'relationship', weight: () => 3, eligible: s => s.family!.status !== 'single' },
  { key: 'marriage', weight: () => 2, eligible: s => stageIs(s, 1, 2) && s.family!.status === 'dating' && !has(s, 'unmarried') },
  { key: 'parenthood', weight: () => 2, eligible: s => stageIs(s, 1, 2) && s.family!.status !== 'single' && s.family!.children === 'none' && !has(s, 'childfree') },
  { key: 'care', weight: () => 4, eligible: s => s.family!.children === 'young' || s.family!.children === 'school' },
  { key: 'child-growth', weight: () => 3, eligible: s => s.family!.children === 'school' || s.family!.children === 'adult' },
  { key: 'relocation', weight: () => 2, eligible: s => stageIs(s, 2) && s.family!.status !== 'single' },
  { key: 'retirement-hobby', weight: social, eligible: s => stageIs(s, 3) },
];
const ROUTES: Record<string, MeetingRoute> = { 'offer-gwating': 'gwating', 'offer-blind-date': 'blind-date', 'offer-campus': 'campus' };
const names = ['지우', '서우', '하람', '도윤', '수현', '윤서', '민재', '유진'];
export function person(seed: number, runId: string, month: number): { seed: number; person: Person } {
  const a = nextRandom(seed); const b = nextRandom(a.seed); const c = nextRandom(b.seed);
  return { seed: c.seed, person: { id: `${runId}:person:${month}`, name: names[Math.floor(a.value * names.length)], temperament: ['차분히 듣는 편', '호기심이 많은 편', '활동적인 편', '신중하게 가까워지는 편'][Math.floor(b.value * 4)], occupation: ['다른 학교 학생', '같은 학교 학생', '다른 분야에서 일하는 사람'][Math.floor(c.value * 3)] } };
}
const c = (id: string, label: string, effects: Partial<Stats> = {}, description = '선택 이후의 상황은 삶의 기록에 남습니다.') => ({ id, label, description, effects });
export function randomEvent(s: GameState, key: string, invited?: Person, legacyChoices = false): GameEvent | null {
  const name = s.family?.partner?.name ?? '';
  let title: string; let body: string; let choices: GameEvent['choices'];
  if (key in ROUTES) {
    if (!invited) return null;
    const stories: Record<string, [string, string]> = {
      'offer-gwating': ['과팅에 빈자리가 생겼다', '동기가 이번 주말 다른 학교 학생들과의 과팅에 함께 가자고 합니다. 다음 주 공부 계획도 마음에 걸립니다.'],
      'offer-blind-date': ['친구가 소개해 주고 싶은 사람이 있다', '친구에게서 소개팅 제안이 왔습니다. 상대도 소개를 받아볼 의향이 있다고 합니다.'],
      'offer-campus': ['동아리 뒤, 둘만의 산책 제안', '동아리에서 자주 마주치던 사람이 활동이 끝난 뒤 함께 산책하자고 합니다.'],
    };
    [title, body] = stories[key];
    choices = [c('accept', '시간을 내어 만나본다', { knowledge: -1 }, '만남이 우정이나 연애로 이어질지는 아직 알 수 없습니다.'), c('brief', '잠깐 만나며 천천히 알아간다', {}, '짧은 만남 뒤 서로의 반응을 기다립니다.'), c('decline', '이번에는 정중히 거절한다', { health: 1 })];
  } else {
    const stories: Record<string, [string, string, GameEvent['choices']]> = {
      club: ['동아리 모집 안내', '강의가 끝난 뒤 동아리 신입 모집 안내를 받았습니다. 정기 모임에는 시간이 필요합니다.', [c('join', '관심 있는 동아리에 가입한다', { relationships: 2, knowledge: -1 }), c('pass', '지금의 생활에 집중한다', { knowledge: 1 })]],
      friend: ['친구가 건넨 주말 초대', '친구들이 함께 식사하고 걷자고 합니다. 최근에는 서로의 안부를 충분히 듣지 못했습니다.', [c('join', '친구들과 시간을 보낸다', { happiness: 2, relationships: 2 }), c('pass', '오늘은 쉬고 다음을 기약한다', { health: 2 })]],
      'ask-introduction': ['친구와 나눈 연애 이야기', '친구가 주변에 좋은 사람이 있으면 소개해 줘도 괜찮겠냐고 묻습니다.', [c('ask', '소개를 부탁해 둔다', {}), c('pass', '지금은 소개를 받지 않는다', {})]],
      research: ['작은 연구에 참여할 기회', '선배가 함께 자료를 정리할 사람을 찾고 있습니다. 처음 해보는 일이지만 배워볼 기회입니다.', [c('join', '시간을 조율해 참여한다', { knowledge: 2, health: -1 }), c('pass', '현재 맡은 일에 집중한다', { health: 1 })]],
      'research-followup': ['연구에서 만난 뜻밖의 문제', '참여 중인 연구에서 예상과 다른 결과가 나왔습니다. 함께 일하는 사람들과 다음 방향을 고민합니다.', [c('review', '함께 검토하며 다시 배운다', { knowledge: 3, relationships: 1 }), c('rest', '일정을 조율하고 쉬어간다', { health: 2, knowledge: 1 })]],
      'study-cost': ['배움에 필요한 비용', '학습 자료와 생활에 쓸 비용이 빠듯합니다. 이용 가능한 지원과 시간을 어떻게 마련할지 고민합니다.', [c('scholarship', '지원 제도를 알아보고 신청한다', { knowledge: -1, health: 1 }, '지원 여부는 아직 정해지지 않았습니다.'), c('share', '동기와 자료를 나누고 함께 공부한다', { knowledge: 1, relationships: 2 }), c('work', '짧은 일을 맡아 필요한 비용을 마련한다', { health: -2, knowledge: -1, happiness: 1 })]],
      mentor: ['선배가 전해 준 새로운 기회', '알고 지내던 선배가 다른 팀의 배움 자리를 알려줍니다. 지금 일정을 조정해야 참석할 수 있습니다.', [c('join', '일정을 조율하고 참여한다', { knowledge: 3, relationships: 1 }), c('pass', '지금의 일과 휴식을 지킨다', { health: 2 })]],
      rest: ['몸이 보내는 작은 신호', '평소보다 피곤한 날이 이어집니다. 일상과 휴식을 돌아볼 시간이 필요해 보입니다.', [c('rest', '일정을 줄이고 휴식을 챙긴다', { health: 4 }), c('adjust', '주변에 도움을 구하고 일정을 나눈다', { health: 2, relationships: 1 })]],
      home: ['고향에서 온 연락', '고향에서 안부를 묻는 연락이 왔습니다. 한동안 서로의 생활을 자세히 듣지 못했습니다.', [c('call', '시간을 내어 이야기를 듣는다', { relationships: 2, happiness: 1 }), c('later', '짧게 안부를 전하고 다음 약속을 잡는다', { relationships: 1, health: 1 })]],
      'friend-request': ['친구의 조심스러운 부탁', '알고 지내던 친구가 개인적인 고민을 이야기하고 싶다고 합니다. 나의 일정도 빠듯합니다.', [c('listen', '가능한 시간을 정해 듣는다', { relationships: 3, health: -1 }), c('boundaries', '지금 도울 수 있는 범위를 솔직히 말한다', { relationships: 1, health: 1 })]],
      acquaintance: [`${name}, 조금 더 알아가고 싶은 사람`, `${name}와 연락을 이어온 뒤 다시 만날 기회가 생겼습니다. ${s.family?.partner?.temperament ?? ''}. 두 사람의 마음이 같을지는 대화해 봐야 합니다.`, [c('date', '서로 어떤 마음인지 이야기한다', { relationships: 1 }, '상대의 의사에 따라 연인이 되거나 좋은 인연으로 남습니다.'), c('friends', '친구로 지내고 싶다고 말한다', { relationships: 1 }), c('leave', '더 만나는 것은 어렵다고 전한다', {})]],
      'cc-life': ['CC, 함께 있는 시간과 각자의 시간', `${name}와 같은 캠퍼스에서 자주 마주칩니다. 두 사람의 관계를 어디까지 알릴지 함께 이야기합니다.`, [c('open', '둘이 합의한 친구들에게 알린다', { relationships: 2 }), c('private', '당분간 둘만 알고 지낸다', { happiness: 2 })]],
      relationship: ['엇갈린 일정, 서로의 마음', `${name}와 잡았던 약속이 일 때문에 어긋났습니다. 상대의 생활과 내 생활을 함께 살펴봅니다.`, [c('talk', '마음을 듣고 지킬 수 있는 약속을 잡는다', { relationships: 3, knowledge: -1 }), c('space', '각자의 휴식 시간을 갖기로 한다', { health: 2 }), ...(s.family?.status === 'dating' ? [c('breakup', '대화 끝에 관계를 마무리한다', {})] : [])]],
      marriage: ['둘이 그리는 다음 생활', `${name}와 앞으로 살 곳과 서로의 진로를 이야기합니다. 함께 결혼 여부를 결정할 시간이 왔습니다.`, [c('marry', '서로 동의하고 결혼을 준비한다', { relationships: 2 }), c('stay', '결혼하지 않고 연인으로 함께한다', { relationships: 1 }), c('later', '결정을 미루고 더 이야기한다', {})]],
      parenthood: ['우리의 자녀 계획', `${name}와 아이를 키우고 싶은지 이야기합니다. 이 시험판은 두 사람의 합의와 준비 이후 과정을 한 장면으로 묶습니다.`, [c('child', '함께 준비해 아이를 맞이한다', {}), c('childfree', '자녀 없이 함께하는 삶을 선택한다', {}), c('later', '지금은 결정을 미룬다', {})]],
      care: ['오늘의 돌봄을 나누다', '일과 돌봄의 일정이 겹칩니다. 이용 가능한 지원과 함께 보낼 시간을 조율합니다.', [c('share', '가족이 일정을 조율해 함께 돌본다', { relationships: 2, knowledge: -1 }), c('support', '외부 돌봄 지원도 함께 활용한다', { health: 2, relationships: 1 })]],
      'child-growth': ['자라는 아이, 달라지는 대화', '아이가 자신의 생활과 고민을 이야기합니다. 예전과는 다른 방식으로 곁에 있어 줄 시간이 필요합니다.', [c('listen', '충분히 듣고 선택을 응원한다', { relationships: 3 }), c('ritual', '꾸준히 이야기할 시간을 정한다', { relationships: 2, happiness: 1 })]],
      relocation: ['상대에게 찾아온 다른 지역의 기회', `${name}에게 다른 지역에서 일할 기회가 생겼습니다. 두 사람의 진로와 일상을 함께 놓고 의논합니다.`, [c('move', '함께 이동할 방법을 찾는다', { relationships: 2, knowledge: 1 }), c('apart', '각자의 진로를 지키며 만날 시간을 정한다', { relationships: 2, health: 1 })]],
      'retirement-hobby': ['동네에서 시작되는 새로운 모임', '관심 있던 배움 모임의 빈자리가 생겼습니다. 은퇴 이후에도 새로운 인연과 배움이 찾아옵니다.', [c('join', '새로운 사람들과 배워본다', { knowledge: 2, relationships: 2 }), c('self', '익숙한 취미를 즐긴다', { happiness: 2, health: 1 })]],
      milestone: [ ['대학 생활의 다음 장', '수련을 마치고 다음 길로', '은퇴, 새로운 일상의 시작', '지나온 삶을 돌아보다'][s.stageIndex], '시간이 흘러 삶의 다음 장에 도착했습니다. 이 시험판의 진급은 실제 시험·수련 자격 판정을 대신하지 않습니다.', [c('continue', s.stageIndex === 3 ? '나의 삶을 회고에 남긴다' : '다음 장으로 이어간다', {})] ],
    };
    const story = stories[key]; if (!story) return null;
    [title, body, choices] = story;
  }
  return designEvent(s, { id: `${s.runId}:${key}:${elapsedMonths(s)}`, stage: STAGES[s.stageIndex].id, title, body, choices, provenance: 'random-preview', randomKey: key, ...(invited ? { person: invited } : {}) }, legacyChoices);
}

export function eligibleEvents(s: GameState) {
  const month = elapsedMonths(s);
  return RANDOM_EVENTS.filter(d => d.eligible(s) && (s.life!.seen[d.key] === undefined || month - s.life!.seen[d.key] >= RANDOM_RULES.cooldownMonths));
}
function commit(s: GameState, action: GameAction): GameState {
  return { ...s, revision: s.revision + 1, processedActionIds: [...s.processedActionIds, action.id] };
}
function record(s: GameState, id: string, title: string, detail: string, effects: Partial<Stats> = {}): GameState {
  return { ...s, stats: adjustStats(s.stats, effects), journal: [...s.journal, { id, stage: STAGES[s.stageIndex].id, title, detail: `${lifeAge(s)} · ${detail}`, effects }] };
}
export function reduceRandomGame(state: GameState, action: GameAction): GameState {
  if (['lifestyle','diet','money-plan','investment-risk','savings-buffer','money-transfer'].includes(action.type)) return state;
  if (action.type === 'school-funding' || action.type === 'workload') return state;
  if (action.type === 'next-choice' || action.type === 'career-focus' || action.type === 'explore' || action.type === 'finance') return state;
  if (!state.life || !state.family || state.status === 'completed' || state.processedActionIds.includes(action.id)) return state;
  if (action.type === 'control') {
    if ((action.paused !== undefined && typeof action.paused !== 'boolean') || (action.speed !== undefined && !TIME_SPEEDS.includes(action.speed))) return state;
    return commit({ ...state, life: { ...state.life, ...(action.paused !== undefined ? { paused: action.paused } : {}), ...(action.speed !== undefined ? { speed: action.speed } : {}) } }, action);
  }
  if (action.type === 'activity') {
    if (state.pendingEvent || action.main === action.supporting || !['study', 'connect', 'rest'].includes(action.main) || !['study', 'connect', 'rest'].includes(action.supporting)) return state;
    return commit(record({ ...state, life: { ...state.life, focus: { main: action.main, supporting: action.supporting } } }, action.id, '생활의 초점을 바꾸다', `주활동: ${action.main === 'study' ? '배움' : action.main === 'connect' ? '사람들' : '돌봄과 휴식'} · 보조활동: ${action.supporting === 'study' ? '배움' : action.supporting === 'connect' ? '사람들' : '돌봄과 휴식'}`), action);
  }
  if (action.type === 'tick') {
    if (state.life.paused || state.pendingEvent || !Number.isInteger(action.elapsedMs) || action.elapsedMs <= 0 || action.elapsedMs > 1000) return state;
    let s = structuredClone(state);
    const target = s.life!.elapsedMs + action.elapsedMs * s.life!.speed;
    while ((elapsedMonths(s) + 1) * RANDOM_RULES.monthMs <= target) {
      captureHighs(s);
      s.life!.elapsedMs = (elapsedMonths(s) + 1) * RANDOM_RULES.monthMs;
      const month = elapsedMonths(s);
      // Focus acts over simulated months, independent of frame rate or speed.
      if (month % 3 === 0) {
        const effects: Record<Activity, Partial<Stats>> = { study: { knowledge: 1, health: -1 }, connect: { relationships: 1, happiness: 1 }, rest: { health: 1, happiness: 1 } };
        s.stats = adjustStats(s.stats, effects[s.life!.focus.main]);
        if (month % 6 === 0) s.stats = adjustStats(s.stats, effects[s.life!.focus.supporting]);
      }
      if (s.life!.childBornMonth !== undefined) {
        const age = month - s.life!.childBornMonth;
        s.family!.children = age >= 216 ? 'adult' : age >= 72 ? 'school' : 'young';
      }
      captureHighs(s);
      if (month >= RANDOM_RULES.stageEnds[s.stageIndex]) {
        const milestone = randomEvent(s, 'milestone')!;
        s = record(s, `auto:stage:${s.stageIndex}`, milestone.title, milestone.body);
        if (s.stageIndex === 3) { s.status = 'completed'; s.life!.paused = true; break; }
        s.stageIndex++;
        continue;
      }
      const chance = nextRandom(s.seed); s.seed = chance.seed;
      if (chance.value >= 0.16) continue; // Quiet months are a real outcome.
      const candidates = eligibleEvents(s);
      if (!candidates.length) continue;
      const draw = nextRandom(s.seed); s.seed = draw.seed;
      let threshold = draw.value * candidates.reduce((n, d) => n + d.weight(s), 0);
      const selected = candidates.find(d => (threshold -= d.weight(s)) < 0) ?? candidates[candidates.length - 1];
      if (selected.key === 'study-cost') {
        s.life!.seen[selected.key] = month;
        const support = nextRandom(s.seed); s.seed = support.seed;
        const accepted = support.value < 0.45 + s.stats.knowledge / 400;
        if (accepted) s.life!.flags.push('scholarship');
        s = record(s, `auto:study-support:${month}`, '학습 지원 결과', accepted
          ? '이용 가능한 지원을 신청해 학습 비용의 부담이 줄었습니다.'
          : '이용 가능한 지원을 신청했지만 이번에는 지원받지 못했습니다.');
        continue;
      }
      let invited: Person | undefined;
      if (selected.key in ROUTES) {
        const p = person(s.seed, s.runId, month); s.seed = p.seed; invited = p.person;
        if (selected.key === 'offer-campus') invited.occupation = '같은 학교 학생';
        if (selected.key === 'offer-gwating') invited.occupation = '다른 학교 학생';
        if (selected.key === 'offer-blind-date' && s.stageIndex > 0) invited.occupation = '다른 분야에서 일하는 사람';
      }
      s.life!.seen[selected.key] = month;
      s.pendingEvent = randomEvent(s, selected.key, invited);
      break;
    }
    if (!s.pendingEvent && s.status === 'active') s.life!.elapsedMs = target;
    return commit(s, action);
  }
  const event = state.pendingEvent;
  if (action.type !== 'choose' || !event || event.id !== action.eventId) return state;
  const choice = event.choices.find(c => c.id === action.choiceId);
  if (!choice) return state;
  let s = structuredClone(state); s.pendingEvent = null;
  const key = event.randomKey!; const id = choice.id;
  const flags = (flag: string) => { if (!s.life!.flags.includes(flag)) s.life!.flags.push(flag); };
  let detail = choice.label;
  if (key in ROUTES && id !== 'decline') {
    const draw = nextRandom(s.seed); s.seed = draw.seed;
    const probability = 0.3 + s.stats.relationships / 250 + (id === 'accept' ? 0.1 : 0);
    s.life!.contacts = Math.min(20, s.life!.contacts + 1);
    s.life!.flags = s.life!.flags.filter(f => f !== 'asked-introduction');
    if (draw.value < probability) {
      s.family = { ...s.family!, meeting: ROUTES[key], partner: event.person };
      detail += `。${event.person!.name}와 연락을 이어가기로 했습니다. 아직 연애를 시작한 것은 아닙니다.`;
    } else detail += '。즐거운 만남으로 남았습니다. 서로 더 만나지는 않기로 했습니다.';
  } else if (key === 'acquaintance') {
    const draw = nextRandom(s.seed); s.seed = draw.seed;
    if (id === 'date' && draw.value < 0.35 + s.stats.relationships / 250) {
      s.family!.status = 'dating'; detail += `。${s.family!.partner!.name}도 같은 마음이라 연인이 되었습니다.`;
    } else {
      detail += id === 'date' ? '。상대는 연애보다 좋은 인연으로 남기를 원했습니다.' : '。서로의 뜻을 존중하며 각자의 생활을 이어갑니다.';
      s.family = { ...s.family!, meeting: null, partner: undefined }; s.life!.contacts = Math.min(20, s.life!.contacts + 1);
    }
  } else if (key === 'relationship' && id === 'breakup') {
    s.family = { ...s.family!, status: 'single', meeting: null, partner: undefined };
    s.life!.flags = s.life!.flags.filter(f => f !== 'unmarried');
  } else if (key === 'club' && id === 'join') { flags('club'); s.life!.contacts = Math.min(20, s.life!.contacts + 2); }
  else if (key === 'friend' && id === 'join') s.life!.contacts = Math.min(20, s.life!.contacts + 1);
  else if (key === 'ask-introduction' && id === 'ask') flags('asked-introduction');
  else if (key === 'research' && id === 'join') flags('research');
  else if (key === 'study-cost' && id === 'scholarship') {
    const draw = nextRandom(s.seed); s.seed = draw.seed;
    if (draw.value < 0.45 + s.stats.knowledge / 400) { flags('scholarship'); detail += ' 지원을 받아 당분간 학습 비용의 부담이 줄었습니다.'; }
    else detail += ' 이번에는 지원을 받지 못했습니다. 다음 기회와 다른 방법을 찾아봅니다.';
  }
  else if (key === 'marriage' && id === 'marry') s.family!.status = 'married';
  else if (key === 'marriage' && id === 'stay') flags('unmarried');
  else if (key === 'parenthood' && id === 'child') { s.family!.children = 'young'; s.family!.care = 'shared'; s.life!.childBornMonth = calendarMonths(s); }
  else if (key === 'parenthood' && id === 'childfree') flags('childfree');
  else if (key === 'care') s.family!.care = id === 'support' ? 'support' : 'shared';
  s = record(s, action.id, event.title, detail.replaceAll('。', ' '), choice.effects);
  if (key === 'milestone') {
    if (s.stageIndex === 3) { s.status = 'completed'; s.life!.paused = true; }
    else s.stageIndex++;
  }
  return commit(s, action);
}

// Validate the persisted random schema and reconstruct pending event content.
// Reading a save never draws RNG or regenerates an invitation.
export function validRandomState(s: GameState, stageEnds: readonly number[] = RANDOM_RULES.stageEnds): boolean {
  const life = s.life; const f = s.family;
  const uint = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
  if (s.rulesVersion !== 'random-preview-v1' || s.contentVersion !== 'random-preview-v1' || !life || !f
    || !uint(s.seed) || !uint(life.initialSeed) || !Number.isInteger(s.stageIndex) || s.stageIndex < 0 || s.stageIndex > 3
    || !Number.isInteger(life.elapsedMs) || life.elapsedMs < 0 || life.elapsedMs > stageEnds[s.stageIndex] * RANDOM_RULES.monthMs
    || (s.stageIndex > 0 && life.elapsedMs < stageEnds[s.stageIndex - 1] * RANDOM_RULES.monthMs)
    || typeof life.paused !== 'boolean' || !TIME_SPEEDS.includes(life.speed)
    || (life.startAge !== undefined && life.startAge !== 19 && life.startAge !== 20)
    || !life.focus || !['study', 'connect', 'rest'].includes(life.focus.main) || !['study', 'connect', 'rest'].includes(life.focus.supporting) || life.focus.main === life.focus.supporting
    || !Number.isInteger(life.contacts) || life.contacts < 0 || life.contacts > 20
    || !Array.isArray(life.flags) || new Set(life.flags).size !== life.flags.length || !life.flags.every(flag => ['club', 'asked-introduction', 'research', 'unmarried', 'childfree', 'scholarship'].includes(flag))
    || !life.background || (life.background.profile !== undefined && ![2, 3].includes(life.background.profile?.version))
    || JSON.stringify(life.background) !== JSON.stringify(generateStart(life.initialSeed, life.background.profile?.version ?? 1).background)
    || !life.seen || typeof life.seen !== 'object' || Array.isArray(life.seen)
    || !Object.entries(life.seen).every(([key, month]) => RANDOM_EVENTS.some(e => e.key === key) && Number.isInteger(month) && month > 0 && month <= elapsedMonths(s))
    || !['single', 'dating', 'married'].includes(f.status) || ![null, 'gwating', 'blind-date', 'campus'].includes(f.meeting)
    || !['none', 'young', 'school', 'adult'].includes(f.children) || !['none', 'shared', 'support'].includes(f.care)) return false;
  const validPerson = (p: Person | undefined) => !!p && typeof p.id === 'string' && p.id.startsWith(`${s.runId}:person:`)
    && /^\d+$/.test(p.id.slice(`${s.runId}:person:`.length)) && Number(p.id.slice(`${s.runId}:person:`.length)) > 0
    && Number(p.id.slice(`${s.runId}:person:`.length)) <= elapsedMonths(s)
    && names.includes(p.name) && ['차분히 듣는 편', '호기심이 많은 편', '활동적인 편', '신중하게 가까워지는 편'].includes(p.temperament)
    && ['다른 학교 학생', '같은 학교 학생', '다른 분야에서 일하는 사람'].includes(p.occupation);
  if ((f.meeting !== null) !== !!f.partner || (f.status !== 'single' && !f.partner) || (f.partner && !validPerson(f.partner))) return false;
  if (life.childBornMonth === undefined) {
    if (f.children !== 'none' || f.care !== 'none') return false;
  } else {
    const age = calendarMonths(s) - life.childBornMonth;
    if (!Number.isInteger(life.childBornMonth) || life.childBornMonth < 72 || age < 0 || f.care === 'none'
      || f.children !== (age >= 216 ? 'adult' : age >= 72 ? 'school' : 'young')) return false;
  }
  const atEnd = life.elapsedMs === stageEnds[s.stageIndex] * RANDOM_RULES.monthMs;
  if (s.status === 'completed') return atEnd && s.stageIndex === 3 && s.pendingEvent === null && life.paused;
  const e = s.pendingEvent;
  if (!e) return !atEnd;
  if (e.provenance !== 'random-preview' || e.familyScene !== undefined || !e.randomKey) return false;
  if (e.randomKey === 'milestone') { if (!atEnd || e.person) return false; }
  else {
    const def = RANDOM_EVENTS.find(d => d.key === e.randomKey);
    if (atEnd || !def || !def.eligible(s) || life.seen[e.randomKey] !== elapsedMonths(s)
      || life.elapsedMs % RANDOM_RULES.monthMs !== 0) return false;
    if (e.randomKey in ROUTES) {
      if (!validPerson(e.person) || e.person!.id !== `${s.runId}:person:${elapsedMonths(s)}`
        || (e.randomKey === 'offer-campus' && e.person!.occupation !== '같은 학교 학생')
        || (e.randomKey === 'offer-gwating' && e.person!.occupation !== '다른 학교 학생')
        || (e.randomKey === 'offer-blind-date' && s.stageIndex > 0 && e.person!.occupation !== '다른 분야에서 일하는 사람')) return false;
    } else if (e.person) return false;
  }
  if (e.choiceVersion !== undefined && e.choiceVersion !== 1) return false;
  const canonical = randomEvent(s, e.randomKey, e.person, e.choiceVersion === undefined);
  return canonical !== null && JSON.stringify(e) === JSON.stringify(canonical);
}
