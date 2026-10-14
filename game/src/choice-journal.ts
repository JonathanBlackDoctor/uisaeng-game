import { STAT_LABELS, type GameAction, type GameState, type Stats } from './contracts';
import { eventParagraphs, readableText } from './event-copy';
import { formatWon } from './money-format';
import { INCIDENT_BALANCE } from './incident-balance';

const withoutAge = (text: string) => text.replace(/^\d+세(?:\s*\d+개월)?\s*·\s*/, '');
const focusNames = { study: '공부', research: '연구', clinical: '임상 실습', people: '동아리·친구', rest: '휴식', work: '아르바이트' };

/** Add presentation metadata after settlement, without changing effects or old records.
 * Probabilistic choices use the actual recorded result, never their preview text. */
export function describeChoice(before: GameState, after: GameState, action: GameAction) {
  if (action.type !== 'choose' || before === after || !before.pendingEvent) return;
  const event = before.pendingEvent;
  const choice = event.choices.find(c => c.id === action.choiceId);
  const entry = after.journal.find(e => e.id === action.id);
  if (!choice || !entry) return;
  const key = event.randomKey ?? '';
  const ownDetail = withoutAge(entry.detail);
  const added = after.journal.slice(before.journal.length);
  const impact = added.find(e => e.id === `${action.id}:impact`);
  const result = added.find(e => e.id === `${action.id}:abilities` || e.id === `${action.id}:result`)
    ?? impact
    ?? added.find(e => e.id !== action.id && (e.id.startsWith('incident:') || e.title === event.title));
  let detail = '';
  if (result) {
    detail = withoutAge(result.detail) + (impact && impact !== result ? ` ${impact.detail}` : '');
    if (detail.startsWith(choice.label)) detail = detail.slice(choice.label.length).replace(/^[\s.·—]+/, '');
  }
  else if (ownDetail !== choice.label && ownDetail !== '') {
    // Some older random events already include the selected action and its outcome.
    detail = ownDetail.startsWith(choice.label) ? ownDetail.slice(choice.label.length).replace(/^[\s.·—]+/, '') : ownDetail;
  } else if (key === 'funding' || key === 'clinic-funding') {
    const cash = after.economy!.cash - before.economy!.cash;
    const debt = after.economy!.debt - before.economy!.debt;
    const changes = [cash ? `현금 ${cash > 0 ? '+' : '−'}${formatWon(Math.abs(cash))}` : '', debt ? `부채 ${debt > 0 ? '+' : '−'}${formatWon(Math.abs(debt))}` : '',
      after.economy!.due > 0 ? `남은 미납 ${formatWon(after.economy!.due)}` : before.economy!.due > 0 ? '미납액 납부 완료' : ''].filter(Boolean);
    detail = changes.join(' · ');
    if (choice.id === 'education-plan') detail += '. 졸업까지 부족액 자동 대출을 켰습니다.';
  } else if (key === 'club-required' || key === 'campus-club-kind') {
    detail = after.progress?.club === 'joined' ? '동아리에 가입했습니다. 정기 모임에 참여합니다.' : '동아리에 가입하지 않고 공부와 휴식 시간을 남겼습니다.';
  } else if (key === 'specialty-required') {
    detail = after.progress?.selectedSpecialty ? '지원할 전공을 정했습니다. 다음은 병원 선택입니다.' : '수련 없이 일하는 진로를 택했습니다.';
  } else if (key === 'institution-required' || key === 'depth-application') {
    detail = after.progress?.result || (after.depth?.pendingInstitution ? '병원을 골랐습니다. 접수 서류를 확인하면 지원합니다.' : after.career?.application === 'accepted' ? '지원한 병원에 합격했습니다. 수련을 준비합니다.' : '지원할 병원을 다시 고르기로 했습니다.');
  } else if (key === 'application-result' && choice.id === 'retry') {
    detail = '6개월 뒤 다시 지원하기로 했습니다.';
  } else if (key === 'campus-invitation') {
    detail = after.campus?.project === 'accepted' ? '3개월간 활동을 맡았습니다. 마치면 선배와 후속 활동을 할 수 있습니다.' : choice.id === 'help' ? '한 번만 돕고 원래 일정을 지켰습니다.' : '참여하지 않고 지금 하던 일에 집중했습니다.';
  } else if (before.progress?.focus !== after.progress?.focus && after.progress) {
    detail = `주 활동을 ${focusNames[after.progress.focus]}${after.progress.focus === 'rest' || after.progress.focus === 'clinical' ? '으로' : '로'} 바꿨습니다.`;
  } else if (key === 'marriage-required' && choice.id === 'later') {
    detail = '3년 뒤 결혼 생각을 다시 정하기로 했습니다.';
  } else if (before.family?.status !== after.family?.status) {
    detail = after.family?.status === 'married' ? '결혼해 함께 생활하기 시작했습니다.' : after.family?.status === 'dating' ? '서로의 뜻을 확인하고 연애를 시작했습니다.' : '관계를 정리하고 각자의 생활로 돌아갔습니다.';
  } else if (key === 'depth-workload') {
    detail = after.depth?.workload === 'extended' ? '추가 업무를 맡았습니다. 수입과 피로가 함께 늘어납니다.' : after.depth?.workload === 'learning' ? '유료 교육을 시작했습니다. 매달 교육비를 내고 숙련을 쌓습니다.' : '기본 업무량으로 생활과 휴식 시간을 확보했습니다.';
  }
  // If only an action is known, record its stated plan as a plan, not a success.
  if (!detail && choice.description && choice.description !== choice.label) detail = choice.description;
  const effects = Object.fromEntries((Object.keys(STAT_LABELS) as (keyof Stats)[]).map(key => [key, after.stats[key] - before.stats[key]]).filter(([, value]) => value !== 0));
  entry.choice = { label: readableText(choice.label), detail: readableText(detail), context: eventParagraphs(readableText(event.body)).situation, effects, ...(result ? { resultId: result.id } : {}) };
  const net = (s: GameState) => s.economy ? s.economy.assets - s.economy.debt - s.economy.due : 0;
  const financialChange = Math.abs(net(after) - net(before));
  // Transfers and loans do not count as losses. Detect large actual wealth changes from any choice.
  if (key.startsWith('incident:') || result?.importance === 'major' || financialChange >= INCIDENT_BALANCE.majorWealthChange
    || financialChange >= INCIDENT_BALANCE.minimumRelativeWealthChange && financialChange >= Math.max(0, net(before)) * INCIDENT_BALANCE.majorRelativeWealthChange) entry.importance = 'major';
}
