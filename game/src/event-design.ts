import type { GameEvent, GameState, Stats } from './contracts';

// Adjustable game balance, not real-world eligibility or costs.
export const EVENT_DESIGN = { version: 1, provisional: true } as const;

/** Apply the current design only to newly opened events. Unversioned saves
 * reconstruct the original templates, including their original effects. */
export function designEvent(_s: GameState, event: GameEvent, legacy = false): GameEvent {
  if (legacy) return event;
  const e = { ...event, choiceVersion: EVENT_DESIGN.version, choices: event.choices.map(c => ({ ...c, effects: { ...c.effects } })) };
  const key = e.randomKey;
  if (key === 'funding') e.choices = e.choices.filter(c => !['grant', 'pay-due'].includes(c.id));
  const change = (id: string, effects: Partial<Stats>, description?: string, label?: string) => {
    const c = e.choices.find(c => c.id === id);
    if (c) { c.effects = effects; if (description) c.description = description; if (label) c.label = label; }
  };
  if (key === 'club-required' || key === 'campus-club-kind') {
    e.body = '정기 모임에 나가려면 혼자 공부하던 시간을 줄여야 합니다. 동아리를 할지, 수업과 휴식에 시간을 쓸지 정합니다.';
    for (const c of e.choices) if (c.id !== 'pass') {
      c.effects = { relationships: 2, knowledge: -1 };
    }
    change('pass', { knowledge: 1, health: 1 }, '모임 대신 복습과 휴식 시간을 확보합니다.', '수업과 휴식에 시간 쓰기');
  }
  // These are preferences about one's life, not bonuses for marrying or dating.
  if (key === 'marriage' || key === 'marriage-required' || key === 'acquaintance') {
    for (const c of e.choices) c.effects = {};
  }
  if (key === 'depth-institution' && e.choices.some(c => c.id === 'feedback')) {
    change('feedback', { knowledge: 2, health: -1 }, '근무 뒤 기록을 검토합니다. 숙련·안전관리 경험이 늘고 쉴 시간이 줄어듭니다.');
    change('peer', { relationships: 3 }, '혼자 복습할 시간에 동료들과 공부합니다. 숙련과 관계를 쌓습니다.');
    change('rest', { health: 3, happiness: 1 }, '추가 학습 대신 잠과 생활 시간을 확보합니다.');
  }
  if (key === 'story:weekend-swap') {
    e.body = '동료가 주말 근무 교환을 부탁합니다. 내게도 오래전 잡은 약속이 있습니다. 전체 일정을 다시 짜려면 오늘 저녁을 써야 합니다.';
    change('half', { relationships: 2, happiness: 1, health: -1 }, '약속을 조금 줄여 가능한 시간만 맡습니다. 남은 약속은 지킵니다.');
    change('schedule', { relationships: 3, knowledge: 1, health: -2 }, '오늘 저녁을 써서 팀 전체 교환표를 만듭니다. 개인 약속을 옮길 수 있는지 확인합니다.');
  }
  if (key === 'story:quiet-patient') {
    change('write', { knowledge: 3, health: -1 }, '진료 뒤 시간을 써서 안내문을 직접 정리합니다. 집에서 확인할 내용과 연락할 곳을 함께 씁니다.');
  }
  if (key?.startsWith('ability-')) {
    const rest = key === 'ability-recovery';
    change('attempt', {}, rest ? '가볍게 움직이며 회복 습관을 연습합니다. 완전히 쉬는 것보다 회복량은 적습니다.' : '직접 해결하며 실력을 더 쌓습니다. 도움을 받는 것보다 부담과 실패 가능성이 큽니다.');
    change('supported', {}, rest ? '일정을 줄이고 충분히 쉽니다. 연습량은 적고 회복에 집중합니다.' : '도움을 받아 부담과 실패 가능성을 줄입니다. 직접 연습하는 양은 적습니다.');
    change('advanced', {}, rest ? '일정 조정과 회복을 함께 연습합니다. 충분히 쉬는 것보다는 회복량이 적습니다.' : '익힌 방법으로 공동 작업을 준비합니다. 직접 해결보다 연습량은 적고 협업 경험을 함께 쌓습니다.');
    if (key === 'ability-technique') change('advanced', {}, '익힌 순서로 동료와 함께 진행합니다. 혼자 반복하는 것보다 연습량은 적고 부담을 나눕니다.', '준비한 순서를 동료와 맞추고 진행하기');
  }
  return e;
}

export function abilityApproach(id: string) {
  return id === 'supported' ? { chance: 0.15, practice: 0.65, health: 0, recovery: 4 }
    : id === 'advanced' ? { chance: 0.1, practice: 1.2, health: -1, recovery: 3 }
    : { chance: 0, practice: 1.8, health: -2, recovery: 2 };
}
