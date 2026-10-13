import type { EventChoice, GameEvent, GameState, Stats } from './contracts';
import { SPECIALTY_PATHS, RESEARCH_DEPARTMENTS } from './specialty-paths';
import { elapsedMonths, lifeAge } from './random-life';
import { STAGES } from './fixtures/content';

export const JOURNEY_RULES = { version: 'specialty-journey-provisional-1', provisional: true, spacing: 4, fellowshipMonths: 18, promotionMonths: [24, 48, 60], reviewMonths: 6, maxReviews: 12, followupMonths: 3 };
export interface SpecialtyJourney { version: 1; since: number; decisions: Record<string, { choice: string; month: number; followed: boolean }> }
export const initialJourney = (since = 0): SpecialtyJourney => ({ version: 1, since, decisions: {} });
export function upgradeJourney(s: GameState) { s.journey ??= initialJourney(elapsedMonths(s)); }
const record = (s: GameState, key: string) => s.journey?.decisions[key];
const chosen = (s: GameState, key: string) => record(s, key)?.choice;
const topic = (s: GameState) => SPECIALTY_PATHS[s.career?.specialty ?? ''];
const workStart = (s: GameState) => 144 + Math.max(0, (s.progress?.trainingStartMonth ?? 72) - 72);
const start = (s: GameState) => Math.max(s.journey?.since ?? elapsedMonths(s), workStart(s));
const opt = (id: string, label: string, description: string, effects: Partial<Stats> = {}): EventChoice => ({ id, label, description, effects });
const done = (s: GameState, key: string) => !!record(s, key);
const hasExit = (s: GameState) => Object.entries(s.journey?.decisions ?? {}).some(([k, d]) => !k.startsWith('scene:') && ['exit', 'leave'].includes(d.choice));
export function journeyField(s: GameState) { return topic(s)?.fields.find(f => f.id === chosen(s, 'field')); }
const department = (s: GameState) => RESEARCH_DEPARTMENTS.find(f => f.id === chosen(s, 'department'));
const project = (s: GameState) => department(s)?.project ?? topic(s)?.project ?? '진료와 교육의 연결';
export const fellowshipComplete = (s: GameState) => Object.entries(s.journey?.decisions ?? {}).some(([k, d]) => k.startsWith('fellow-review:') && d.choice === 'qualify');
export function academicRank(s: GameState) {
  if (chosen(s, 'academic-entry') !== 'apply') return -1;
  return Object.entries(s.journey?.decisions ?? {}).filter(([k, d]) => k.startsWith('review:') && d.choice === 'promote').length;
}
export function academicTitle(s: GameState) {
  const rank = academicRank(s);
  if (rank < 0) return null;
  const title = [department(s) ? '연구교원' : '임상강사', '조교수', '부교수', '정교수'][rank];
  return hasExit(s) ? `${title} 경력 · 대학 밖으로 전환` : title;
}
export function academicCredits(s: GameState, rank: number) {
  const points = { research: 0, teaching: 0, clinical: 0 };
  for (const [key, d] of Object.entries(s.journey?.decisions ?? {})) {
    if (key === `academic:${rank}:research`) { if (d.choice === 'lead') { points.research += 2; points.clinical++; } if (d.choice === 'team') { points.research++; points.teaching++; } }
    if (key === `academic:${rank}:teaching`) { if (d.choice === 'lead') { points.teaching += 2; points.clinical++; } if (d.choice === 'team') { points.teaching++; points.research++; } }
    if (key === `academic:${rank}:clinical`) { if (d.choice === 'lead') { points.clinical += 2; points.teaching++; } if (d.choice === 'team') { points.clinical++; points.research++; } }
    if (key.startsWith(`review:${rank}:`) && d.choice in points) points[d.choice as keyof typeof points]++;
  }
  return points;
}
const fellowshipPoints = (s: GameState) => ['fellow-case', 'fellow-project'].reduce((n, k) => n + (chosen(s, k) === 'lead' ? 2 : chosen(s, k) === 'team' ? 1 : 0), 0)
  + Object.entries(s.journey?.decisions ?? {}).filter(([k, d]) => k.startsWith('fellow-review:') && d.choice === 'prepare').length * 2;
function nextKey(s: GameState): string | null {
  const j = s.journey, m = elapsedMonths(s), c = s.career;
  if (!j || !c || s.stageIndex < 1 || s.stageIndex > 2 || s.status !== 'active') return null;
  const last = Math.max(j.since, ...Object.values(j.decisions).map(d => d.month));
  if (m < last + JOURNEY_RULES.spacing) return null;
  const p = topic(s), training = Math.max(j.since, s.progress?.trainingStartMonth ?? 72);
  if (p && c.application === 'accepted') {
    const indexes = s.stageIndex === 1 ? [0, 1] : c.practice === 'research' ? [] : [2, 3];
    for (const i of indexes) {
      const due = i < 2 ? training + [10, 32][i] : start(s) + [24, 96][i - 2];
      if (!done(s, `scene:${i}`) && m >= due) return `scene:${i}`;
    }
  }
  if (s.stageIndex !== 2 || hasExit(s) || c.practice === 'undecided') return null;
  if (!done(s, 'route') && m >= start(s) + 6 && (p && c.application === 'accepted' || c.practice === 'research')) return 'route';
  const route = chosen(s, 'route');
  if (!route || route === 'general') return null;
  if (route === 'research') {
    if (!done(s, 'department')) return 'department';
  } else {
    if (!done(s, 'field')) return 'field';
    const since = record(s, 'field')!.month;
    if (!done(s, 'fellow-case')) return m >= since + 4 ? 'fellow-case' : null;
    if (!done(s, 'fellow-project')) return m >= since + 10 ? 'fellow-project' : null;
    if (!fellowshipComplete(s)) {
      const reviews = Object.keys(j.decisions).filter(k => k.startsWith('fellow-review:')).length;
      const previous = record(s, `fellow-review:${reviews - 1}`)?.month ?? since + JOURNEY_RULES.fellowshipMonths - JOURNEY_RULES.reviewMonths;
      return reviews <= JOURNEY_RULES.maxReviews && m >= previous + JOURNEY_RULES.reviewMonths ? `fellow-review:${reviews}` : null;
    }
  }
  if (!done(s, 'academic-entry')) return 'academic-entry';
  if (chosen(s, 'academic-entry') !== 'apply') return null;
  const rank = academicRank(s);
  const since = rank === 0 ? record(s, 'academic-entry')!.month : Object.entries(j.decisions).find(([k, d]) => k.startsWith(`review:${rank - 1}:`) && d.choice === 'promote')![1].month;
  if (rank === 3) return !done(s, 'legacy') && m >= since + 24 ? 'legacy' : null;
  for (const [i, area] of ['research', 'teaching', 'clinical'].entries()) {
    if (!done(s, `academic:${rank}:${area}`)) return m >= since + (i + 1) * 6 ? `academic:${rank}:${area}` : null;
  }
  const attempts = Object.keys(j.decisions).filter(k => k.startsWith(`review:${rank}:`)).length;
  const previous = record(s, `review:${rank}:${attempts - 1}`)?.month ?? since;
  return attempts <= JOURNEY_RULES.maxReviews && m >= Math.max(since + JOURNEY_RULES.promotionMonths[rank], previous + JOURNEY_RULES.reviewMonths) ? `review:${rank}:${attempts}` : null;
}
export function requiredJourney(s: GameState) { const key = nextKey(s); return key ? `journey:${key}` : null; }

export function journeyEvent(s: GameState, fullKey: string): Pick<GameEvent, 'title' | 'body' | 'choices'> | null {
  if (!fullKey.startsWith('journey:')) return null;
  const key = fullKey.slice(8);
  if (nextKey(s) !== key || done(s, key)) return null;
  const p = topic(s), field = journeyField(s);
  const exit = opt('exit', '지금의 진료로 돌아간다', '추가 수련을 멈추고 봉직 진료를 이어갑니다.', { health: 2, happiness: 1 });
  if (key.startsWith('scene:')) {
    const index = Number(key.split(':')[1]), scene = p.scenes[index], previous = record(s, `scene:${index - 1}`);
    const previousScene = p.scenes[index - 1];
    const memory = previous && previousScene ? ` 앞서 ‘${previousScene.title}’에서 ${previous.choice === 'lead' || previous.choice === 'reuse' ? previousScene.choices[1] : previous.choice === 'team' ? previousScene.choices[3] : '맡을 범위를 줄여 쉬는 시간을 지켰다.'}` : '';
    return { title: scene.title, body: scene.body + memory, choices: [
      opt('lead', scene.choices[0], scene.choices[1], { knowledge: 3, health: -2 }),
      opt('team', scene.choices[2], scene.choices[3], { relationships: 3, knowledge: 1 }),
      ...(previous && previous.choice !== 'rest' ? [opt('reuse', previous.choice === 'team' ? '함께했던 팀에 다시 의논한다' : '앞서 배운 방법을 조정해 쓴다', `‘${previousScene.title}’에서 배운 방식을 그대로 반복하지 않고 이번 질문에 맞게 바꿨다.`, { knowledge: 2, relationships: 1, health: 1 })] : []),
      opt('rest', '담당 범위를 정하고 쉰다', '지금 맡을 부분과 이어받을 사람을 정하고 휴식 시간을 확보했다.', { health: 3, happiness: 1 })] };
  }
  if (key === 'route') return { title: '전문의 이후의 길', body: p ? `${p.theme}. 지금의 일을 깊게 이어갈지, 더 좁은 분야를 배울지 정합니다.` : '진료 밖에서 풀고 싶은 질문이 생겼습니다. 연구할 교실과 교육 진로를 살펴봅니다.', choices: [
    ...(p && s.career?.application === 'accepted' ? [opt('fellowship', '분과·세부 수련에 들어간다', '전임의로 돌아가 한 분야를 더 배웁니다. 이후 교수 진로도 선택할 수 있습니다. 개원 중이면 병원 근무로 옮깁니다.', { knowledge: 2, health: -1 })] : []),
    opt('research', '기초·연구 교실로 간다', '연구자로 일하며 연구교원과 교수 임용을 준비할 수 있습니다.', { knowledge: 2 }),
    opt('general', '현재 진료와 일을 이어간다', '추가 수련 없이 현재 경력을 쌓습니다.', { happiness: 2 })] };
  if (key === 'field') return { title: '더 배울 분야', body: '전임의 수련에서 오래 붙잡을 질문을 고릅니다.', choices: p.fields.map(f => opt(f.id, f.name, `${f.problem}. 이 문제를 수련 사례와 연구로 이어갑니다.`)) };
  if (key === 'department') return { title: '연구할 교실', body: '하나의 질문을 실험과 교육으로 이어갈 교실을 고릅니다.', choices: RESEARCH_DEPARTMENTS.map(f => opt(f.id, f.name, f.project)) };
  if (key === 'fellow-case') return { title: `${field!.name} 전임의의 첫 사례`, body: `${field!.problem}. 지도전문의가 이 사례를 어디까지 맡을지 묻습니다.`, choices: [
    opt('lead', '경과를 맡아 발표한다', `${field!.name} 사례를 직접 추적해 발표했습니다. 수련 성과 2건을 남겼지만 휴식이 줄었습니다.`, { knowledge: 4, health: -3 }),
    opt('team', '동료와 역할을 나눈다', '확인할 질문과 연락을 나눠 맡아 공동 사례 1건을 남겼습니다.', { knowledge: 2, relationships: 3 }), exit] };
  if (key === 'fellow-project') return { title: `${field!.name}에서 남은 질문`, body: `${field!.problem}. 첫 사례에서 ${chosen(s, 'fellow-case') === 'lead' ? '직접 경과를 발표한 뒤' : '동료와 질문을 나눈 뒤'}, 같은 어려움을 겪는 사람이 더 있는지 묻고 싶어졌습니다.`, choices: [
    opt('lead', '작은 연구로 검토한다', '자료 사용 동의와 범위를 확인하고 분석을 마쳤습니다. 수련 성과 2건을 추가했습니다.', { knowledge: 4, health: -2 }),
    opt('team', '공동 증례 토론을 연다', '동료와 다른 사례를 비교했습니다. 수련 성과 1건과 함께 배울 동료가 남았습니다.', { relationships: 3, knowledge: 2 }), exit] };
  if (key.startsWith('fellow-review:')) {
    const points = fellowshipPoints(s), attempt = Number(key.split(':')[1]);
    return { title: `${field!.name} 수련 심사`, body: `사례 발표와 공동 작업 ${points}건을 정리했습니다. ${points >= 3 ? '심사에 필요한 경험을 갖췄습니다.' : '수료 심사에는 성과 3건이 필요합니다. 부족한 경험을 보완할 수 있습니다.'}`, choices: [
      ...(points >= 3 ? [opt('qualify', '수료 심사를 마친다', `${field!.name} 분과·세부 수련을 마쳤습니다. 해당 분야를 맡아 일하고 교수 진로를 검토할 수 있습니다.`, { knowledge: 2, happiness: 3 })] : []),
      ...(attempt < JOURNEY_RULES.maxReviews ? [opt('prepare', '부족한 사례를 더 준비한다', '지도전문의와 두 사례를 더 검토했습니다. 6개월 뒤 다시 심사합니다.', { knowledge: 2, health: -1 })] : []), exit] };
  }
  if (key === 'academic-entry') return { title: '대학에 남을지 정하는 날', body: `${project(s)}에 관한 일을 이어가자는 제안을 받았습니다. 연구뿐 아니라 학생 교육과 팀 운영도 맡게 됩니다.`, choices: [
    opt('apply', department(s) ? '연구교원으로 임용을 준비한다' : '임상강사로 임용을 준비한다', `${department(s) ? '연구교원' : '임상강사'}로 일을 시작했습니다. 조교수 심사에 필요한 연구·교육·팀 기여를 쌓습니다.`, { knowledge: 2, health: -1 }),
    opt('decline', '지금의 전문 분야에서 일한다', '대학 임용 대신 지금의 일을 이어갑니다.', { happiness: 2, health: 1 })] };
  if (key.startsWith('academic:')) {
    const [, r, area] = key.split(':'), rank = Number(r);
    const situations: Record<string, string[]> = {
      research: [`${project(s)}를 첫 논문으로 묶으려는데 빠진 자료가 발견됐습니다. 공동연구자는 제출 날짜를 지키자고 합니다.`, `${project(s)} 공동연구가 다른 기관으로 넓어졌습니다. 자료 정의와 기여자 역할이 달라 조율이 필요합니다.`, `${project(s)} 연구팀에 새 과제가 제안됐습니다. 실적은 늘겠지만 후배의 독립 주제가 묻힐 수 있습니다.`],
      teaching: [`학생이 ${project(s)}를 사례 수업에서 다루고 싶다고 합니다. 실제 사람의 이야기를 어디까지 사용할지 정해야 합니다.`, `전공의가 ${project(s)} 발표에서 어려웠던 부분을 말하지 못합니다. 평가를 맡은 내가 수업도 진행하고 있습니다.`, `후배 교수가 ${project(s)} 수업을 새로 맡습니다. 내 자료를 그대로 쓰면 편하지만 자신만의 질문을 만들 시간도 필요합니다.`],
      clinical: [`${project(s)} 작업이 늘면서 팀의 일과 교육 시간이 겹칩니다. 구성원마다 부담이 다릅니다.`, `${project(s)} 사업의 자리를 더 늘리자는 제안이 왔습니다. 현장 인력은 그대로입니다.`, `${project(s)}를 다음 책임자에게 넘길 때가 됐습니다. 누가 남은 일과 지원을 맡을지 정해야 합니다.`],
    };
    const labels: Record<string, [string, string, string, string]> = {
      research: ['자료를 보완해 책임 저자로 마친다', '마감을 조정하고 자료를 다시 확인했습니다. 연구 2 · 팀 기여 1.', '동료와 분석을 나눠 마친다', '작업 범위와 기여를 합의했습니다. 연구 1 · 교육 1.'],
      teaching: ['수업을 직접 설계하고 피드백한다', '학생의 질문을 받아 자료와 평가를 고쳤습니다. 교육 2 · 팀 기여 1.', '동료와 공동 수업을 연다', '서로의 설명을 비교하고 자료를 다듬었습니다. 교육 1 · 연구 1.'],
      clinical: ['팀의 일정과 역할을 조정한다', '팀이 유지할 수 있는 규모와 시간을 정했습니다. 팀 기여 2 · 교육 1.', '공동 운영안을 만든다', '동료와 자원을 나누고 결과를 평가했습니다. 팀 기여 1 · 연구 1.'],
    };
    const row = labels[area];
    return { title: `${academicTitle(s)}의 ${area === 'research' ? '연구' : area === 'teaching' ? '교육' : '팀 운영'}`, body: situations[area][rank], choices: [
      opt('lead', row[0], row[1], { knowledge: 3, health: -2 }), opt('team', row[2], row[3], { knowledge: 1, relationships: 3 }),
      opt('rest', '이번 일은 줄이고 회복한다', '성과를 추가하지 않고 회복 시간을 가졌습니다. 필요한 경험은 다음 심사 전에 보완할 수 있습니다.', { health: 4, happiness: 1 }),
      opt('leave', '대학 밖의 일로 옮긴다', '교수 승진 준비를 멈추고 쌓은 경험을 다른 현장에서 이어갑니다.', { health: 2, happiness: 2 })] };
  }
  if (key.startsWith('review:')) {
    const [, r, a] = key.split(':'), rank = Number(r), attempt = Number(a), points = academicCredits(s, rank);
    const ready = Object.values(points).every(x => x >= 2), target = ['조교수', '부교수', '정교수'][rank];
    return { title: `${target} ${rank ? '승진' : '임용'} 심사`, body: `이번 단계의 연구 ${points.research} · 교육 ${points.teaching} · 팀 기여 ${points.clinical}. 각각 2건이 필요합니다. ${ready ? '심사 자료를 제출할 준비가 됐습니다.' : '부족한 항목을 보완하고 6개월 뒤 다시 심사할 수 있습니다.'}`, choices: [
      ...(ready ? [opt('promote', `${target} 심사를 마친다`, `${target}${rank ? '로 승진' : '로 임용'}됐습니다. 다음 단계에서는 새로운 연구·교육·팀 경험을 쌓습니다.`, { happiness: 3, knowledge: 2 })] : []),
      ...(attempt < JOURNEY_RULES.maxReviews ? (['research', 'teaching', 'clinical'] as const).filter(k => points[k] < 2).map(k => opt(k, { research: '연구 자료를 보완한다', teaching: '수업과 지도를 더 맡는다', clinical: '팀 개선 작업을 맡는다' }[k], '해당 경험 1건을 추가했습니다. 6개월 뒤 다시 심사합니다.', { knowledge: 1, health: -1 })) : []),
      opt('leave', '승진 대신 다른 일을 택한다', '지금까지의 교원 경력을 남기고 대학 밖의 일로 전환했습니다.', { health: 2, happiness: 2 })] };
  }
  if (key === 'legacy') return { title: '다음 사람에게 넘길 일', body: `${project(s)}에서 시작한 일이 커졌습니다. 정교수로서 앞으로 남길 일의 무게를 정합니다.`, choices: [
    opt('lab', '후배의 독립 연구를 지원한다', '내 실적보다 후배가 자신의 질문과 연구팀을 갖도록 지원했습니다.', { knowledge: 2, relationships: 3 }),
    opt('school', '학생과 전공의 교육을 맡는다', '강의와 현장 지도를 후배 교수들과 나눠 오래 이어갈 수 있게 했습니다.', { relationships: 4, happiness: 2 }),
    opt('community', '지역과 협력하는 일을 맡는다', '대학에 쌓인 경험을 지역의 진료·연구·교육과 연결했습니다.', { relationships: 3, happiness: 3 })] };
  return null;
}

export function settleJourney(s: GameState, key: string, choiceId: string) {
  const event = journeyEvent(s, key), choice = event?.choices.find(c => c.id === choiceId);
  if (!choice) return false;
  const id = key.slice(8);
  s.journey!.decisions[id] = { choice: choiceId, month: elapsedMonths(s), followed: false };
  if (id === 'route' && choiceId === 'research') s.career!.practice = 'research';
  if (id === 'route' && choiceId === 'fellowship') s.career!.practice = 'employed';
  if (choiceId === 'exit' || choiceId === 'leave') s.career!.practice = department(s) ? 'research' : 'employed';
  if (id.startsWith('scene:') && s.depth) { s.depth.skill = Math.min(100, s.depth.skill + (choiceId === 'lead' ? 4 : choiceId === 'rest' ? 0 : 2)); s.depth.safety = Math.min(100, s.depth.safety + (choiceId === 'team' || choiceId === 'reuse' ? 3 : 1)); }
  if (id === 'fellow-project' || id.includes(':research')) s.career!.experience.research = Math.min(100, s.career!.experience.research + (choiceId === 'rest' || choiceId === 'leave' ? 0 : 4));
  return true;
}
export function advanceJourney(s: GameState) {
  for (const [key, d] of Object.entries(s.journey?.decisions ?? {})) {
    if (d.followed || elapsedMonths(s) < d.month + JOURNEY_RULES.followupMonths) continue;
    d.followed = true;
    if (!key.startsWith('scene:')) continue;
    const scene = topic(s)?.scenes[Number(key.split(':')[1])]; if (!scene) continue;
    const detail = d.choice === 'lead' ? `‘${scene.title}’에서 직접 맡았던 경험이 다음 사례를 보는 순서를 바꿨습니다. ${scene.choices[1]}` : d.choice === 'team' ? `‘${scene.title}’을 함께 맡았던 동료와 다시 이야기했습니다. ${scene.choices[3]}` : d.choice === 'reuse' ? `‘${scene.title}’에서 이전 경험을 바꿔 썼던 부분을 후배와 비교했습니다.` : `‘${scene.title}’에서 정해 둔 담당 범위 덕분에 쉬고 돌아와 다음 일을 이어갔습니다.`;
    const id = `auto:journey:${key}:follow`;
    if (!s.journal.some(e => e.id === id)) s.journal.push({ id, stage: STAGES[s.stageIndex].id, title: `${scene.title} · 그 뒤`, detail: `${lifeAge(s)} · ${detail}`, effects: {} });
  }
}
export function journeySummary(s: GameState) {
  const field = journeyField(s), dept = department(s), title = academicTitle(s);
  const route = chosen(s, 'route');
  return { theme: topic(s)?.theme, field: field?.name ?? dept?.name,
    qualification: field ? fellowshipComplete(s) ? s.career?.specialty === 'internal' ? '분과전문의' : '세부 수련 완료' : hasExit(s) ? '분과·세부 수련 중단' : '전임의 수련 중' : dept ? '연구 교실' : null,
    title, route: route === 'general' ? '현재 분야에서 경력 쌓기' : route === 'research' ? '연구·교육 진로' : route === 'fellowship' ? '분과·세부 수련 진로' : null,
    rank: academicRank(s), pursuingAcademic: academicRank(s) >= 0 && !hasExit(s), completedScenes: Object.keys(s.journey?.decisions ?? {}).filter(k => k.startsWith('scene:')).length };
}
export function finishJourney(s: GameState) {
  if (!s.journey || !Object.keys(s.journey.decisions).length || s.journal.some(x => x.id === 'auto:journey:recap')) return;
  const x = journeySummary(s);
  const legacy = chosen(s, 'legacy');
  s.journal.push({ id: 'auto:journey:recap', stage: 'retirement', title: '이어 온 전문 분야', detail: [x.theme, x.field, x.qualification, x.title, legacy ? { lab: '후배의 독립 연구를 지원했습니다.', school: '학생과 전공의 교육을 이어갔습니다.', community: '지역과의 협력을 이어갔습니다.' }[legacy] : null].filter(Boolean).join(' · '), effects: {} });
}

// Replay the compact decisions through the same gates used in play. This rejects forged
// qualifications, skipped promotions, wrong-specialty fields and future/duplicate rewards.
export function validJourney(s: GameState): boolean {
  const v = s.journey; if (v === undefined) return true;
  const month = elapsedMonths(s);
  if (!v || v.version !== 1 || !Number.isSafeInteger(v.since) || v.since < 0 || v.since > month || !v.decisions || typeof v.decisions !== 'object' || Array.isArray(v.decisions)) return false;
  const entries = Object.entries(v.decisions);
  if (entries.length > 75) return false;
  let last = v.since;
  const copy = { ...s, status: 'active' as const, career: { ...s.career! }, life: { ...s.life! }, journey: initialJourney(v.since) };
  for (const [key, d] of entries) {
    if (!d || typeof d.choice !== 'string' || !Number.isSafeInteger(d.month) || d.month < last || d.month > month || typeof d.followed !== 'boolean' || d.followed && d.month + JOURNEY_RULES.followupMonths > month) return false;
    copy.life.elapsedMs = d.month * 1000;
    // Training decisions can remain open on the exact stage boundary.
    copy.stageIndex = key === 'scene:0' || key === 'scene:1' ? 1 : 2;
    if (copy.stageIndex === 1 && d.month > workStart(s) || copy.stageIndex === 2 && d.month < workStart(s)) return false;
    // A player's original practice can change at route selection; reconstruct it here.
    copy.career.practice = chosen(copy, 'route') === 'research' || key === 'route' && (d.choice === 'research' || s.career!.practice === 'research') ? 'research' : 'employed';
    const event = journeyEvent(copy, `journey:${key}`);
    if (!event?.choices.some(c => c.id === d.choice)) return false;
    copy.journey.decisions[key] = { ...d };
    last = d.month;
  }
  return true;
}
