import type { GameState, GameEvent, Stats } from './contracts';
import { MAJOR_EVENTS, type IncidentDefinition } from './major-event-catalog';
import { elapsedMonths, nextRandom, adjustStats, lifeAge } from './random-life';
import { INCIDENT_BALANCE, adverseIncident, incidentAmount, recoveryPlan } from './incident-balance';
import { SPECIALTIES } from './career';
import { isServing } from './identity';

export const INCIDENT_RULES = { version: 1, provisional: true, medicalMonthly: .012, lifeMonthly: .005,
  rareMonthly: .0005, medicalCooldown: 12, lifeCooldown: 24, filingChance: .5 } as const;
export interface MedicalProfile { specialty: string; role: 'resident' | 'employed' | 'clinic' | 'general'; label: string; tags: string[]; exposure: number; liability: number }
export interface IncidentCase { id: string; opened: number; due: number; phase: 'response' | 'negotiation' | 'hearing';
  profile: MedicalProfile | null; amount: number; preparation: number; safety: number; filed: boolean; balanceVersion?: 2 }
export interface IncidentImpact { id: string; start: number; until: number; cut: number; monthly: number; strain: number; knowledge: number; relationship?: number }
export interface MajorIncidents { version: 1; seed: number; since: number; lastMonth: number; seen: string[];
  nextMedical: number; nextLife: number; rareUsed: boolean; active: IncidentCase | null; impacts: IncidentImpact[];
  history: { id: string; opened: number; closed: number; filed: boolean; outcome: string }[] }
const profiles: Record<string, { tags: string[]; exposure: number; liability: number }> = {
  internal: { tags: ['outpatient'], exposure: 1, liability: 1 },
  surgery: { tags: ['surgical'], exposure: 1.2, liability: 1.3 },
  pediatrics: { tags: ['outpatient', 'pediatric'], exposure: 1.1, liability: 1.1 },
  obgyn: { tags: ['surgical', 'birth'], exposure: 1.35, liability: 1.6 },
  psychiatry: { tags: ['psychiatry'], exposure: .85, liability: 1.1 },
  orthopedics: { tags: ['surgical'], exposure: 1.2, liability: 1.3 },
  neurosurgery: { tags: ['surgical'], exposure: 1.35, liability: 1.6 },
  thoracic: { tags: ['surgical'], exposure: 1.3, liability: 1.5 },
  plastic: { tags: ['surgical', 'outpatient'], exposure: 1.15, liability: 1.2 },
  ophthalmology: { tags: ['surgical', 'outpatient'], exposure: 1.1, liability: 1.3 },
  ent: { tags: ['surgical', 'outpatient'], exposure: 1, liability: 1.1 },
  dermatology: { tags: ['outpatient'], exposure: .9, liability: .85 },
  urology: { tags: ['surgical', 'outpatient'], exposure: 1.1, liability: 1.2 },
  radiology: { tags: ['diagnostic', 'imaging'], exposure: .85, liability: 1.1 },
  radiation: { tags: ['radiation'], exposure: .85, liability: 1.25 },
  anesthesia: { tags: ['anesthesia'], exposure: 1.25, liability: 1.5 },
  neurology: { tags: ['outpatient'], exposure: 1, liability: 1.1 },
  rehabilitation: { tags: ['outpatient', 'rehab'], exposure: .8, liability: .9 },
  tuberculosis: { tags: ['outpatient', 'community'], exposure: .75, liability: .85 },
  laboratory: { tags: ['diagnostic', 'specimen'], exposure: .7, liability: 1 },
  pathology: { tags: ['diagnostic', 'specimen'], exposure: .75, liability: 1.2 },
  preventive: { tags: ['community'], exposure: .5, liability: .65 },
  family: { tags: ['outpatient'], exposure: .85, liability: .85 },
  occupational: { tags: ['community'], exposure: .6, liability: .8 },
  nuclear: { tags: ['imaging', 'radiation'], exposure: .75, liability: 1.1 },
  emergency: { tags: ['emergency'], exposure: 1.35, liability: 1.4 },
};
const stage = (s: GameState) => (['university', 'training', 'career', 'retirement'] as const)[s.stageIndex];
const money = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const definition = (id: string) => MAJOR_EVENTS.find(x => x.id === id)!;
export const initialIncidents = (seed: number, month = 0): MajorIncidents => ({ version: 1, seed: (seed ^ 0x3c6ef372) >>> 0,
  since: month, lastMonth: month, seen: [], nextMedical: month, nextLife: month, rareUsed: false, active: null, impacts: [], history: [] });
export function upgradeIncidents(s: GameState) { s.incidents ??= initialIncidents(s.life!.initialSeed, elapsedMonths(s)); }
export function medicalProfile(s: GameState): MedicalProfile | null {
  const c = s.career;
  if (!c || s.status !== 'active' || s.stageIndex === 0 || s.stageIndex === 3 || isServing(s) || c.practice === 'research') return null;
  const resident = s.stageIndex === 1 && c.application === 'accepted';
  if (!resident && (c.practice === 'undecided' || c.practice === 'clinic' && !s.economy?.ledger.some(t => t.kind === 'open-clinic'))) return null;
  const role = resident ? 'resident' : c.practice === 'clinic' ? 'clinic' : c.practice === 'untrained' ? 'general' : 'employed';
  const specialty = c.specialty ?? 'general';
  const p = profiles[specialty] ?? { tags: ['outpatient'], exposure: .85, liability: .85 };
  const workload = s.depth?.workload === 'extended' ? 1.2 : s.depth?.workload === 'learning' ? .85 : 1;
  return { specialty, role, label: `${SPECIALTIES.find(x => x.id === specialty)?.name ?? '일반 진료'} · ${{ resident: '수련의', clinic: '개원의', general: '일반의', employed: '봉직의' }[role]}`,
    tags: [...p.tags, ...(role === 'clinic' ? ['clinic'] : [])],
    exposure: p.exposure * (resident ? .65 : role === 'clinic' ? 1.15 : 1) * workload,
    liability: p.liability * (resident ? .25 : role === 'clinic' ? 1.3 : .55) };
}
export function eligibleIncidents(s: GameState, pool: IncidentDefinition['pool']) {
  const profile = medicalProfile(s);
  return MAJOR_EVENTS.filter(d => d.pool === pool && !s.incidents?.seen.includes(d.id)
    && (pool !== 'medical' || profile && d.tags!.some(t => t === 'all' || profile.tags.includes(t)))
    && (d.requirement === 'any' || d.requirement === 'investments' && (s.portfolio?.investments ?? 0) > 0
      || d.requirement === 'savings' && (s.portfolio?.savings ?? 0) > 0 || d.requirement === 'debt' && (s.economy?.debt ?? 0) > 0
      || d.requirement === 'working' && s.stageIndex > 0 && s.stageIndex < 3 && (s.economy?.income ?? 0) > 0
      || d.requirement === 'employee' && s.stageIndex === 2 && ['employed', 'untrained', 'research'].includes(s.career?.practice ?? '') && (s.economy?.income ?? 0) > 0
      || d.requirement === 'clinic' && s.stageIndex === 2 && s.career?.practice === 'clinic' && s.economy?.ledger.some(t => t.kind === 'open-clinic')));
}
function draw(s: GameState) { const r = nextRandom(s.incidents!.seed); s.incidents!.seed = r.seed; return r.value; }
function note(s: GameState, id: string, title: string, detail: string, effects: Partial<Stats> = {}) {
  if (s.journal.some(x => x.id === id)) return;
  const before = s.stats; s.stats = adjustStats(s.stats, effects);
  const actual: Partial<Stats> = {};
  for (const k of Object.keys(before) as (keyof Stats)[]) if (before[k] !== s.stats[k]) actual[k] = s.stats[k] - before[k];
  s.journal.push({ id, stage: stage(s), title, detail: `${lifeAge(s)} · ${detail}`, effects: actual });
}
// Insufficient cash becomes an explicitly recorded installment liability, never silently disappears.
function cash(s: GameState, id: string, label: string, amount: number) {
  const e = s.economy!;
  amount = Math.round(amount);
  if (e.ledger.some(t => t.id === id)) return;
  const paid = amount < 0 ? Math.min(e.cash, -amount) : 0;
  const cashDelta = amount < 0 ? -paid : amount, debtDelta = amount < 0 ? -amount - paid : 0;
  e.cash += cashDelta; e.assets += cashDelta; e.debt += debtDelta;
  e.ledger.push({ id, month: elapsedMonths(s), label, cashDelta, debtDelta, assetsDelta: cashDelta, dueDelta: 0, kind: 'monthly' });
}
function impact(s: GameState, d: IncidentDefinition, months: number, cut: number, monthly: number, strain = 1, knowledge = 0, relationship = 0) {
  const m = elapsedMonths(s);
  s.incidents!.impacts.push({ id: d.id, start: m, until: m + months, cut, monthly, strain, knowledge, ...(relationship ? { relationship } : {}) });
}
export function openIncident(s: GameState, id: string): boolean {
  upgradeIncidents(s);
  const d = MAJOR_EVENTS.find(x => x.id === id), r = s.incidents!, m = elapsedMonths(s);
  if (!d || r.active || !eligibleIncidents(s, d.pool).includes(d) || d.pool === 'medical' && m < r.nextMedical
    || d.pool !== 'medical' && m < r.nextLife || d.pool === 'rare' && r.rareUsed) return false;
  const profile = d.pool === 'medical' ? medicalProfile(s) : null;
  r.seen.push(id); if (d.pool === 'rare') r.rareUsed = true;
  r.active = { id, opened: m, due: m, phase: 'response', profile, amount: incidentAmount(d, profile?.liability ?? 1, 2), preparation: 0, safety: s.depth?.safety ?? 50, filed: false, balanceVersion: 2 };
  if (d.pool !== 'medical') r.nextLife = m + INCIDENT_RULES.lifeCooldown;
  return true;
}
function close(s: GameState, outcome: string) {
  const r = s.incidents!, a = r.active!, m = elapsedMonths(s);
  r.history.push({ id: a.id, opened: a.opened, closed: m, filed: a.filed, outcome });
  if (a.profile) r.nextMedical = m + INCIDENT_RULES.medicalCooldown;
  r.active = null;
}
export function requiredIncident(s: GameState): string | null {
  const a = s.incidents?.active;
  return a && a.phase !== 'hearing' && elapsedMonths(s) >= a.due ? `incident:${a.id}:${a.phase}` : null;
}
function impactDetail(months: number, cut: number, monthly: number, strain: number, relationship: number) {
  return `${months}개월간 수입 ${Math.round(cut * 100)}% 감소${monthly ? ` · 추가 생활비 월 ${money(monthly)}` : ''}.`
    + (strain > 0 ? ` 석 달마다 건강·행복 각각 −${strain}${relationship ? `, 관계 −${relationship}` : ''}. 피로가 쌓입니다.` : '');
}
function strengthenedEvent(a: IncidentCase, d: IncidentDefinition): Pick<GameEvent, 'title' | 'body' | 'choices'> {
  const ch = (id: string, label: string, description: string) => ({ id, label, description, effects: {} });
  if (a.phase === 'negotiation') return { title: `${d.title} · 소송 대응`,
    body: `${a.profile!.label} 당시의 사건으로 소송이 제기됐습니다. 합의안을 검토하거나 자료와 의견을 제출해 다툴 수 있습니다. 청구가 제기됐다는 사실만으로 과실이 확정되지는 않습니다.`,
    choices: [ch('settle', '제시된 조건으로 합의하기', `합의 비용 ${money(a.amount * .45)}. ${impactDetail(36, .25, Math.round(a.amount / 240), 2, 1)} 부족한 현금은 부채로 남습니다.`),
      ch('contest', '자료를 제출하고 다투기', `대응 비용 ${money(a.amount * .12)}. ${impactDetail(12, .25, Math.round(a.amount / 300), 3, 1)} 12개월 뒤 기각되거나 배상금 ${money(a.amount)}과 60개월의 부담이 남습니다.`)] };
  if (d.pool === 'medical') return { title: d.title,
    body: `${a.profile!.label}. ${d.body} 아직 책임과 배상 여부가 정해진 것은 아닙니다.`,
    choices: [ch('supported', d.choices[0], `검토 비용 ${money(a.amount * .08)}. ${impactDetail(3, .1, 0, 2, 1)} 3개월 뒤 진행 상황을 확인합니다.`),
      ch('prepare', d.choices[1], `검토 비용 ${money(a.amount * .025)}. ${impactDetail(12, .35, 0, 3, 2)} 3개월 뒤 진행 상황을 확인합니다.`)] };
  // Beneficial opportunities retain their existing costs and rewards.
  if (!adverseIncident(d)) throw new Error('Expected an adverse incident');
  const special = d.mode === 'asset-loss', loss = Math.round(INCIDENT_BALANCE.assetLoss * 100);
  return { title: d.title, body: d.body, choices: [false, true].map(second => {
    const p = recoveryPlan(d, second, 2), monthly = special ? 0 : Math.round(a.amount / (second ? 90 : 150));
    const cost = special ? `${d.requirement === 'savings' ? '예금' : '투자 자산'} ${loss}% 손실.`
      + (!second ? d.requirement === 'savings' ? ' 대응 비용 300만원.' : ' 남은 투자 자산의 절반을 매도합니다.' : '')
      : `초기 비용 ${money(a.amount * (second ? .55 : 1))}.`;
    return ch(second ? 'second' : 'first', d.choices[second ? 1 : 0], `${cost} ${impactDetail(p.months, p.cut, monthly, p.strain, p.relationship)} 부족분은 부채로 남습니다.`);
  }) };
}
export function incidentEvent(s: GameState, key: string): Pick<GameEvent, 'title' | 'body' | 'choices'> | null {
  const a = s.incidents?.active;
  if (!a || key !== requiredIncident(s)) return null;
  const d = definition(a.id);
  if (a.balanceVersion === 2 && adverseIncident(d)) return strengthenedEvent(a, d);
  const ch = (id: string, label: string, description: string) => ({ id, label, description, effects: {} });
  if (a.phase === 'negotiation') return { title: `${d.title} · 소송 대응`,
    body: `${a.profile!.label} 당시의 사건으로 소송이 제기됐습니다. 합의안을 검토하거나 자료와 의견을 제출해 다툴 수 있습니다. 청구가 제기됐다는 사실만으로 과실이 확정되지는 않습니다.`,
    choices: [ch('settle', '제시된 조건으로 합의하기', `합의 비용 ${money(a.amount * .45)}. 종결 뒤에도 18개월간 수입·생활에 영향이 남습니다. 부족한 현금은 부채로 남습니다.`),
      ch('contest', '자료를 제출하고 다투기', `대응 비용 ${money(a.amount * .12)}. 약 12개월 뒤 결과를 받습니다. 기각되거나 큰 배상 부담이 남을 수 있습니다.`)] };
  if (d.pool === 'medical') return { title: d.title, body: `${a.profile!.label}. ${d.body} 아직 책임과 배상 여부가 정해진 것은 아닙니다.`,
    choices: [ch('supported', d.choices[0], `검토 비용 ${money(a.amount * .08)}. 기록 검토에 도움을 받고 약 3개월 뒤 진행 상황을 확인합니다.`),
      ch('prepare', d.choices[1], `검토 비용 ${money(a.amount * .025)}. 6개월간 수입 20% 감소와 피로를 감수하고 대응 시간을 확보합니다.`)] };
  const gain = d.mode === 'gain' || d.mode === 'asset-gain';
  const special = d.mode.startsWith('asset-');
  const secondDescription = special ? (d.requirement === 'savings' ? '예금의 55% 손실을 반영합니다. 직접 대응하며 생활 부담이 더 오래 이어집니다.' : '투자 자산의 55% 손실을 반영하고 보유합니다. 이후 가격은 계속 변하며 생활 부담이 더 오래 이어집니다.')
    : `초기 비용 ${money(a.amount * .55)}. 약 ${Math.round(d.months * 1.5)}개월간 더 큰 수입 감소와 생활 부담을 감수합니다. 부족분은 부채로 남습니다.`;
  return { title: d.title, body: d.body,
    choices: [ch('first', d.choices[0], gain ? (special ? '평가이익 반영 뒤 절반을 매도해 현금으로 확보합니다.' : `${money(d.amount)}을 받아 예금으로 보관합니다.`)
      : d.id === 'retraining' ? `${money(a.amount)} 투자 · 24개월간 수입 20% 감소. 이후 지식과 업무 숙련이 늘어납니다.`
      : `${special ? d.requirement === 'savings' ? '예금 55% 손실 · 대응 비용 1,000,000원.' : '투자 자산 55% 손실 뒤 잔여 자산의 절반을 매도합니다.' : `초기 비용 ${money(a.amount)}.`} ${d.months}개월간 생활비·수입·회복에 영향이 남습니다. 부족분은 부채로 남습니다.`),
    ch('second', d.choices[1], gain ? (special ? '평가이익을 반영하고 투자 자산을 유지합니다. 이후 가격은 계속 변합니다.' : '받은 돈의 35%를 생활 개선에 쓰고 나머지는 현금으로 남깁니다.')
      : d.id === 'retraining' ? '비용과 수입 감소 없이 현재 생활을 이어갑니다.'
      : secondDescription)] };
}
export function settleIncident(s: GameState, key: string, choice: string): boolean {
  const scene = incidentEvent(s, key); if (!scene?.choices.some(x => x.id === choice)) return false;
  const a = s.incidents!.active!, d = definition(a.id), m = elapsedMonths(s), prefix = `incident:${a.id}:${m}`;
  const stronger = a.balanceVersion === 2 && adverseIncident(d);
  const beforeNet = s.economy!.assets - s.economy!.debt, beforeDebt = s.economy!.debt;
  if (a.phase === 'negotiation') {
    if (choice === 'contest') { cash(s, `${prefix}:defense`, '소송 대응 비용', -a.amount * .12); a.phase = 'hearing'; a.due = m + 12;
      impact(s, d, 12, stronger ? .25 : .1, Math.round(a.amount / (stronger ? 300 : 600)), stronger ? 3 : 1, 0, stronger ? 1 : 0);
      note(s, `${prefix}:trial`, d.title, stronger ? `소송 대응 비용 ${money(a.amount * .12)}. ${impactDetail(12, .25, Math.round(a.amount / 300), 3, 1)} 결과는 12개월 뒤 확인합니다.` : '자료를 제출하고 다투기로 했습니다. 결과가 나올 때까지 대응 비용과 업무 부담이 이어집니다.');
    } else { cash(s, `${prefix}:settle`, '분쟁 합의 비용', -a.amount * .45); impact(s, d, stronger ? 36 : 18, stronger ? .25 : .1, Math.round(a.amount / (stronger ? 240 : 500)), stronger ? 2 : 1, 0, stronger ? 1 : 0);
      note(s, `${prefix}:settled`, d.title, stronger ? `합의금 ${money(a.amount * .45)}. ${impactDetail(36, .25, Math.round(a.amount / 240), 2, 1)}` : `합의로 사건을 마쳤습니다. ${money(a.amount * .45)}의 부담과 18개월의 생활 조정이 남았습니다.`, stronger ? { health: -5, happiness: -12, relationships: -4 } : { happiness: -5 }); close(s, '합의'); }
    return true;
  }
  if (d.pool === 'medical') {
    cash(s, `${prefix}:review`, '의료 분쟁 기록 검토', -a.amount * (choice === 'supported' ? .08 : .025));
    a.preparation = choice === 'supported' ? .18 : .12; a.phase = 'hearing'; a.due = m + 3;
    if (stronger) impact(s, d, choice === 'prepare' ? 12 : 3, choice === 'prepare' ? .35 : .1, 0, choice === 'prepare' ? 3 : 2, 0, choice === 'prepare' ? 2 : 1);
    else if (choice === 'prepare') impact(s, d, 6, .2, 0, 2);
    note(s, `${prefix}:response`, d.title, stronger ? `검토 비용 ${money(a.amount * (choice === 'supported' ? .08 : .025))}. ${impactDetail(choice === 'prepare' ? 12 : 3, choice === 'prepare' ? .35 : .1, 0, choice === 'prepare' ? 3 : 2, choice === 'prepare' ? 2 : 1)} 3개월 뒤 진행 상황을 확인합니다.` : '배상 요구에 대한 검토를 시작했습니다. 약 3개월 뒤 진행 상황을 확인합니다.', stronger ? { health: -5, happiness: -12, relationships: -3 } : { happiness: -4 });
    return true;
  }
  if (d.id === 'retraining' && choice === 'second') { close(s, '교육 참여 보류'); return true; }
  if (d.mode === 'gain') {
    cash(s, `${prefix}:gain`, d.title, d.amount);
    if (choice === 'first') { s.economy!.cash -= d.amount; s.portfolio!.savings += d.amount;
      s.economy!.ledger.push({ id: `${prefix}:save`, month: m, label: '받은 자금 예금 보관', cashDelta: -d.amount, assetsDelta: 0, debtDelta: 0, kind: 'monthly' });
    } else { cash(s, `${prefix}:improve`, '생활 환경 개선', -d.amount * .35); impact(s, d, d.months, 0, 0, -2); }
  } else if (d.mode === 'asset-loss' || d.mode === 'asset-gain') {
    const p = s.portfolio!, field = d.requirement === 'savings' ? 'savings' : 'investments';
    const delta = Math.round(p[field] * (d.mode === 'asset-gain' ? 1.5 : stronger ? -INCIDENT_BALANCE.assetLoss : -.55));
    p[field] += delta; s.economy!.assets += delta;
    s.economy!.ledger.push({ id: `${prefix}:asset`, month: m, label: d.title, cashDelta: 0, assetsDelta: delta, debtDelta: 0, kind: 'monthly' });
    if (choice === 'first' && field === 'investments') { const sold = Math.floor(p.investments / 2); p.investments -= sold; s.economy!.cash += sold;
      s.economy!.ledger.push({ id: `${prefix}:sell`, month: m, label: '사건 이후 일부 매도', cashDelta: sold, assetsDelta: 0, debtDelta: 0, kind: 'monthly' }); }
    if (d.mode === 'asset-loss') {
      if (d.requirement === 'savings' && choice === 'first') cash(s, `${prefix}:support`, '피해 대응 지원 비용', stronger ? -3_000_000 : -1_000_000);
      const p = recoveryPlan(d, choice === 'second', a.balanceVersion);
      impact(s, d, p.months, stronger ? p.cut : d.cut, 0, stronger ? p.strain : 1, 0, p.relationship);
    }
  } else {
    const second = choice === 'second';
    cash(s, `${prefix}:recovery`, d.title, -a.amount * (second ? .55 : 1));
    const p = recoveryPlan(d, second, a.balanceVersion);
    impact(s, d, p.months, p.cut, Math.round(a.amount / (second ? 90 : 150)), p.strain, d.id === 'retraining' ? 1 : 0, p.relationship);
    if (d.id === 'retraining') { s.career!.experience.research = Math.min(100, s.career!.experience.research + 15); }
  }
  const p = s.incidents!.impacts.at(-1), loss = beforeNet - (s.economy!.assets - s.economy!.debt), newDebt = s.economy!.debt - beforeDebt;
  const outcome = stronger ? `손실 ${money(loss)}${newDebt > 0 ? ` · 새 부채 ${money(newDebt)}` : ''}. ${p && p.id === d.id ? impactDetail(p.until - p.start, p.cut, p.monthly, p.strain, p.relationship ?? 0) : ''}`
    : d.mode.includes('gain') ? '늘어난 자산과 생활 변화가 이후에도 이어집니다.' : '자산 변화와 생활 조정을 기록했습니다. 진행 중인 영향에서 남은 기간을 확인할 수 있습니다.';
  note(s, `${prefix}:life`, d.title, `${scene.choices.find(x => x.id === choice)!.label}. ${outcome}`,
    stronger ? { happiness: -INCIDENT_BALANCE.initialHappinessLoss, health: -(['illness', 'accident', 'chronic-pain', 'hearing', 'vision'].includes(d.id) ? INCIDENT_BALANCE.initialMedicalHealthLoss : INCIDENT_BALANCE.initialHealthLoss), relationships: -INCIDENT_BALANCE.initialRelationshipLoss }
      : { happiness: d.mode.includes('gain') ? 10 : -8, health: d.mode.includes('gain') ? 2 : -5 });
  close(s, choice === 'first' ? d.choices[0] : d.choices[1]); return true;
}
export function advanceIncidents(s: GameState) {
  upgradeIncidents(s); const r = s.incidents!, m = elapsedMonths(s);
  if (m <= r.lastMonth) return; r.lastMonth = m;
  const baseIncome = s.economy!.income;
  let remainingIncome = baseIncome;
  for (const i of r.impacts) {
    if (m > i.until || m <= i.start) continue;
    const gap = Math.min(remainingIncome, Math.round(baseIncome * i.cut)), cost = gap + i.monthly;
    remainingIncome -= gap;
    if (cost) { cash(s, `impact:${i.id}:${i.start}:${m}`, `${definition(i.id).title} · 수입 공백과 생활 비용`, -cost); s.economy!.income -= gap; s.economy!.expenses += i.monthly; }
    if (s.dynamics && i.strain > 0) s.dynamics.fatigue = Math.min(24, s.dynamics.fatigue + i.strain);
    if (m % 3 === 0) note(s, `impact:${i.id}:${i.start}:${m}:health`, definition(i.id).title,
      `${i.until - m}개월의 생활 조정이 남았습니다.${gap || i.monthly ? ` 이번 달 수입 공백 ${money(gap)} · 추가 생활비 ${money(i.monthly)}.` : ''}${i.strain > 0 ? ' 피로와 생활 부담이 이어졌습니다.' : ''}`, { health: -i.strain, happiness: -i.strain, knowledge: i.knowledge, ...(i.relationship ? { relationships: -i.relationship } : {}) });
    if (m === i.until) note(s, `impact:${i.id}:${i.start}:end`, '생활 조정 기간 종료', `${definition(i.id).title}의 정기적인 수입·생활 조정을 마쳤습니다. 남은 부채와 자산 변화는 유지됩니다.`);
  }
  const a = r.active;
  if (a?.phase === 'hearing' && m >= a.due) {
    const d = definition(a.id);
    const stronger = a.balanceVersion === 2;
    if (!a.filed) {
      // Filing is a separate uncertainty from responsibility and judgment.
      if (draw(s) < INCIDENT_RULES.filingChance) { a.filed = true; a.phase = 'negotiation';
        note(s, `incident:${a.id}:filed`, d.title, '협의로 끝나지 않아 소송이 제기됐습니다. 대응 방향을 정해야 합니다.');
      } else { const cost = a.amount * .12; cash(s, `incident:${a.id}:early`, '분쟁 조정 비용', -cost); impact(s, d, stronger ? 12 : 6, stronger ? .12 : .05, 0, stronger ? 2 : 1, 0, stronger ? 1 : 0);
        note(s, `incident:${a.id}:closed`, d.title, `소송으로 이어지기 전에 분쟁을 정리했습니다. 정리 비용 ${money(cost)}이 들었습니다.${stronger ? ` ${impactDetail(12, .12, 0, 2, 1)}` : ''}`); close(s, '소송 전 종결'); }
    } else {
      const safety = a.safety / 500;
      const lost = draw(s) > .38 + a.preparation + safety;
      const cut = a.profile!.role === 'clinic' ? stronger ? .6 : .3 : stronger ? .3 : .12;
      if (lost) { cash(s, `incident:${a.id}:judgment`, '소송 종결 배상 부담', -a.amount); impact(s, d, stronger ? 60 : 36, cut, Math.round(a.amount / (stronger ? 180 : 360)), stronger ? 3 : 1, 0, stronger ? 2 : 0); }
      note(s, `incident:${a.id}:judgment-result`, d.title, lost ? stronger ? `배상금 ${money(a.amount)}. ${impactDetail(60, cut, Math.round(a.amount / 180), 3, 2)} 부족분은 부채로 남았습니다.` : `배상 부담 ${money(a.amount)}이 남았습니다. 36개월간 업무와 생활을 조정합니다.` : '배상 청구가 받아들여지지 않았습니다. 이미 쓴 대응 비용과 시간은 돌아오지 않습니다.', lost && stronger ? { health: -12, happiness: -25, relationships: -8 } : { happiness: lost ? -12 : 5 });
      close(s, lost ? '배상 부담' : '배상 청구 기각');
    }
  }
  if (r.active || s.status !== 'active' || isServing(s)) return;
  const profile = medicalProfile(s);
  const attempts: [IncidentDefinition['pool'], number, boolean][] = [
    ['medical', INCIDENT_RULES.medicalMonthly * (profile?.exposure ?? 0), m >= r.nextMedical],
    ['rare', INCIDENT_RULES.rareMonthly, !r.rareUsed && m >= r.nextLife],
    ['life', INCIDENT_RULES.lifeMonthly, m >= r.nextLife],
  ];
  for (const [pool, probability, ready] of attempts) {
    if (!ready || probability <= 0) continue;
    const candidates = eligibleIncidents(s, pool); if (!candidates.length) continue;
    if (draw(s) >= probability) continue;
    // Specialty-specific scenes get more weight; adding scenes does not raise the pool's rate.
    const weights = candidates.map(d => pool === 'medical' && d.tags!.some(t => !['all', 'outpatient', 'clinic'].includes(t) && profile!.tags.includes(t)) ? 3 : 1);
    let cursor = draw(s) * weights.reduce((a, b) => a + b, 0), selected = candidates[0];
    for (let i = 0; i < candidates.length; i++) { cursor -= weights[i]; if (cursor < 0) { selected = candidates[i]; break; } }
    openIncident(s, selected.id); break;
  }
}
export function incidentSummary(s: GameState): string[] {
  const r = s.incidents; if (!r) return [];
  const m = elapsedMonths(s), result: string[] = [];
  if (r.active) result.push(`${definition(r.active.id).title} · ${s.status === 'completed' ? '회고 시점에 미종결' : r.active.filed ? '소송 진행 중' : '대응 중'}`);
  for (const i of r.impacts.filter(x => x.until > m)) result.push(`${definition(i.id).title} · ${i.until - m}개월 남음${i.cut ? ` · 수입 ${Math.round(i.cut * 100)}% 상당 공백` : ''}${i.monthly ? ` · 월 ${money(i.monthly)}` : ''}${i.strain > 0 ? ` · 석 달마다 건강·행복 −${i.strain}` : ''}${i.relationship ? ` · 관계 −${i.relationship}` : ''}`);
  return result;
}
export function validIncidents(s: GameState): boolean {
  const r = s.incidents; if (r === undefined) return true;
  const m = elapsedMonths(s), integer = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
  const known = (id: unknown) => typeof id === 'string' && MAJOR_EVENTS.some(d => d.id === id);
  if (!r || r.version !== 1 || !integer(r.seed) || r.seed > 0xffffffff || !integer(r.since) || !integer(r.lastMonth) || r.since > r.lastMonth || r.lastMonth > m
    || !integer(r.nextMedical) || !integer(r.nextLife) || typeof r.rareUsed !== 'boolean' || !Array.isArray(r.seen) || r.seen.length > 50
    || !r.seen.every(known) || new Set(r.seen).size !== r.seen.length || !Array.isArray(r.impacts) || !Array.isArray(r.history)) return false;
  if (r.impacts.length > 150 || !r.impacts.every(i => i && known(i.id) && r.seen.includes(i.id) && integer(i.start) && i.start <= m && integer(i.until) && i.until > i.start && i.until - i.start <= 108
    && Number.isFinite(i.cut) && i.cut >= 0 && i.cut <= .95 && integer(i.monthly) && Number.isSafeInteger(i.strain) && i.strain >= -2 && i.strain <= 3 && integer(i.knowledge) && i.knowledge <= 1
    && (i.relationship === undefined || integer(i.relationship) && i.relationship <= 2))) return false;
  if (!r.history.every(h => h && known(h.id) && r.seen.includes(h.id) && integer(h.opened) && h.opened >= r.since && integer(h.closed) && h.closed >= h.opened && h.closed <= m && typeof h.filed === 'boolean' && typeof h.outcome === 'string')
    || new Set(r.history.map(h => h.id)).size !== r.history.length) return false;
  const a = r.active;
  if (a !== null) {
    if (!a || !known(a.id) || !r.seen.includes(a.id) || r.history.some(h => h.id === a.id) || !integer(a.opened) || a.opened < r.since || a.opened > m
      || !integer(a.due) || a.due < a.opened || a.due > m + 12 || !['response', 'negotiation', 'hearing'].includes(a.phase) || !integer(a.amount)
      || ![0, .12, .18].includes(a.preparation) || !integer(a.safety) || a.safety > 100 || typeof a.filed !== 'boolean' || a.balanceVersion !== undefined && a.balanceVersion !== 2) return false;
    if (definition(a.id).pool === 'medical') {
      const p = a.profile;
      if (!p || !['resident', 'employed', 'clinic', 'general'].includes(p.role) || !(p.specialty === 'general' || SPECIALTIES.some(x => x.id === p.specialty))
        || typeof p.label !== 'string' || !Array.isArray(p.tags) || !p.tags.every(t => typeof t === 'string') || !Number.isFinite(p.exposure) || p.exposure <= 0 || p.exposure > 3
        || !Number.isFinite(p.liability) || p.liability <= 0 || p.liability > 3 || a.amount !== incidentAmount(definition(a.id), p.liability, a.balanceVersion)
        || a.phase === 'negotiation' && !a.filed || a.phase === 'response' && (a.filed || a.preparation !== 0)) return false;
    } else if (a.profile !== null || a.phase !== 'response' || a.amount !== incidentAmount(definition(a.id), 1, a.balanceVersion) || a.filed) return false;
  }
  return r.seen.length === r.history.length + Number(a !== null) && r.rareUsed === r.seen.some(id => definition(id).pool === 'rare')
    && r.seen.filter(id => definition(id).pool === 'rare').length <= 1;
}
