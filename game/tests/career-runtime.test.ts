import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameState } from '../src/contracts';
import { createGame, reduceGame } from '../src/engine';
import { createCareerGame, CAREER_TIME, careerStageEnds, careerEvent } from '../src/career-runtime';
import { SPECIALTIES } from '../src/career';
import { specialtyOptions, explorationOptions, institutionOptions } from '../src/opportunities';
import { person } from '../src/random-life';
import { archives, loadGame, openGameDatabase, persistGame, validState } from '../src/storage';

// Slower 1x needs more simulation frames; let the worker report between full lives.
afterEach(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

const tick = (s: GameState, ms = 1000) => reduceGame(s, { type: 'tick', id: `t:${s.revision}`, elapsedMs: ms });
const choose = (s: GameState, choice: string) => reduceGame(s, { type: 'choose', id: `c:${s.revision}`, eventId: s.pendingEvent!.id, choiceId: choice });
function apply(s: GameState, preferred: string) {
  s = choose(s, s.pendingEvent!.choices.some(c => c.id === preferred) ? preferred : s.pendingEvent!.choices[0].id);
  s = choose(s, s.pendingEvent!.choices.some(c => c.id === 'snuh') ? 'snuh' : s.pendingEvent!.choices[0].id);
  return s.pendingEvent?.randomKey === 'depth-application' ? choose(s, 'submit') : s;
}
function choiceFor(s: GameState, specialty = 'internal', practice = 'employed'): string {
  const e = s.pendingEvent!;
  if (e.randomKey === 'funding') return e.choices.some(c => c.id === 'pay-due') ? 'pay-due' : 'loan';
  if (e.randomKey === 'club-required') return 'pass';
  if (e.randomKey === 'specialty-required') return e.choices.some(c => c.id === specialty) ? specialty : e.choices[0].id;
  if (e.randomKey === 'practice-required') return practice;
  if (e.randomKey === 'application-result') return s.career!.application === 'accepted' ? 'continue' : 'retry';
  if (e.randomKey === 'marriage-required') return s.family!.status === 'dating' ? 'stay' : 'single';
  if (e.randomKey === 'clinic-funding') return e.choices.some(c => c.id === 'open-clinic') ? 'open-clinic' : 'loan';
  if (e.randomKey?.startsWith('offer-')) return 'decline';
  return e.choices[0].id;
}
function play(seed = 42, specialty = 'internal', practice = 'employed', speed: 1 | 8 = 8) {
  if (specialty !== 'untrained') {
    seed = Array.from({ length: 500 }, (_, i) => seed + i).find(n => specialtyOptions(createCareerGame('probe', n)).some(x => x.id === specialty))!;
  }
  let s = reduceGame(createCareerGame(`career-${seed}`, seed), { type: 'control', id: 'start', paused: false, speed });
  const events: { key: string; stage: number }[] = [];
  for (let i = 0; i < 7000 && s.status !== 'completed'; i++) {
    if (s.pendingEvent) {
      events.push({ key: s.pendingEvent.randomKey!, stage: s.stageIndex });
      s = choose(s, choiceFor(s, specialty, practice));
    } else s = tick(s);
    const diagnostic = JSON.stringify({ i, event: s.pendingEvent?.randomKey, month: s.life!.elapsedMs / 1000, career: s.career, progress: s.progress });
    if (!validState(s)) throw new Error(`Invalid step: ${diagnostic}`);
  }
  expect(s.status).toBe('completed');
  // Use a real offered/accepted seed, never inject an unavailable option.
  if (specialty !== 'untrained' && s.career!.specialty !== specialty) {
    if (seed > 1000) throw new Error(`No accepted seed for ${specialty}`);
    return play(seed + 1, specialty, practice, speed);
  }
  return { s, events };
}
function until(s: GameState, done: (x: GameState) => boolean) {
  for (let i = 0; i < 7000; i++) {
    if (done(s)) return s;
    s = s.pendingEvent ? choose(s, choiceFor(s)) : tick(s);
    const diagnostic = `Invalid at ${s.life!.elapsedMs}: ${s.pendingEvent?.randomKey}`;
    if (!validState(s)) throw new Error(diagnostic);
  }
  throw new Error('Target state not reached');
}
describe('career preview connected runtime', () => {
  it.each(SPECIALTIES.map(x => [x.id, x.name]))('finishes the full %s path (%s) with its own clinical case', (id: string, _name: string) => {
    const { s, events } = play(42, id);
    expect(s.career!.specialty).toBe(id);
    expect(s.career!.application).toBe('accepted');
    expect(events.some(e => e.key === 'clinical-case')).toBe(true);
    expect(s.journal.some(e => e.title === SPECIALTIES.find(x => x.id === id)!.caseTitle)).toBe(true);
  });
  it('retries across graduation, keeps a full training period and separates marriage deferral', () => {
    let s = reduceGame(createCareerGame('retry', 42), { type: 'control', id: 'start', paused: false, speed: 8 });
    s = until(s, x => x.pendingEvent?.randomKey === 'specialty-required');
    s.stats.knowledge = 0; s.career!.experience = { study: 0, research: 0, people: 0, clinical: 0 };
    s = apply(s, 'internal');
    expect(s.career!.application).toBe('rejected');
    s = choose(s, 'retry'); expect(s.progress!.retryMonth).toBe(72);
    s = until(s, x => x.pendingEvent?.randomKey === 'specialty-required');
    expect(s.life!.elapsedMs).toBe(72_000);
    s = apply(s, 'surgery'); expect(s.career!.application).toBe('rejected');
    s = choose(s, 'retry');
    s = until(s, x => x.pendingEvent?.randomKey === 'specialty-required');
    expect(s.stageIndex).toBe(1); expect(s.life!.elapsedMs).toBe(78_000);
    s.stats.knowledge = 100;
    s = apply(s, 'internal'); expect(s.career!.application).toBe('accepted');
    expect(careerStageEnds(s)[1]).toBe(150); expect(validState(s)).toBe(true);
    s = until(s, x => x.pendingEvent?.randomKey === 'marriage-required');
    s = choose(s, 'later');
    expect(s.progress!.retryMonth).toBe(78); expect(s.progress!.marriageRetryMonth).toBe(126);
    s = until(s, x => x.pendingEvent?.randomKey === 'marriage-required');
    expect(s.life!.elapsedMs).toBe(126_000);
    s = choose(s, 'single');
    s = until(s, x => x.stageIndex === 2);
    expect(s.life!.elapsedMs).toBe(150_000);
    expect(s.journal.some(x => x.id === 'auto:stage:1')).toBe(true);
  });
  it('gives single and dating players suitable marriage choices and skips married players', () => {
    let s = reduceGame(createCareerGame('relations', 42), { type: 'control', id: 'start', paused: false, speed: 8 });
    s = until(s, x => x.life!.elapsedMs >= 89_000 && !x.pendingEvent);
    for (const status of ['single', 'dating', 'married'] as const) {
      let copy = structuredClone(s); copy.progress!.marriage = 'pending';
      copy.family = status === 'single' ? { status, meeting: null, children: 'none', care: 'none' } : { status, meeting: 'campus', partner: person(7, s.runId, 89).person, children: 'none', care: 'none' };
      copy = tick(copy, 125); expect(validState(copy)).toBe(true);
      if (status === 'married') expect(copy.pendingEvent?.randomKey).not.toBe('marriage-required');
      else expect(copy.pendingEvent!.choices.map(c => c.id)).toEqual(status === 'dating' ? ['marry', 'stay', 'later'] : ['open', 'single', 'later']);
    }
  });
  it('can leave repeated failed applications after the original training boundary for research', () => {
    let s = reduceGame(createCareerGame('late-research', 42), { type: 'control', id: 'start', paused: false, speed: 8 });
    for (let i=0;i<5000 && !(s.life!.elapsedMs >= 150_000 && s.pendingEvent?.randomKey === 'application-result');i++) {
      if (s.pendingEvent?.randomKey === 'institution-required') { s.stats.knowledge=0; s.career!.experience={study:0,research:0,people:0,clinical:0}; }
      s=s.pendingEvent?choose(s,choiceFor(s)):tick(s);
      expect(validState(s)).toBe(true);
    }
    expect(s.life!.elapsedMs).toBeGreaterThanOrEqual(150_000);
    expect(s.career!.application).toBe('rejected');
    s=choose(s,'research');
    s=until(s,x=>x.status==='completed');
    expect(s.career!.practice).toBe('research');
    expect(s.journal.some(e=>e.title==='환자를 떠나보낸 뒤')).toBe(false);
    expect(s.economy!.ledger.some(t=>t.label==='연구 수입')).toBe(true);
  });
  it('keeps historical pending event wording readable and rejects unrelated changes', () => {
    let s = reduceGame(createCareerGame('legacy-career', 42), { type: 'control', id: 'start', paused: false, speed: 8 });
    s = until(s,x=>x.stageIndex===2 && !x.pendingEvent);
    delete s.depth;
    s.life!.elapsedMs=216_000;
    s.pendingEvent=careerEvent(s,'patient-loss');
    s.pendingEvent!.body='진료팀의 노력에도 환자가 사망했습니다. 팀에서 경과를 돌아보고 유가족과의 대화를 준비합니다.';
    expect(validState(s)).toBe(true); expect(validState(choose(s,'support'))).toBe(true);
    s.pendingEvent!.body+=' changed'; expect(validState(s)).toBe(false);
  });
  it('includes the 26th specialty in a required rotation and records admission on the map', () => {
    const s=createCareerGame('rotation',42);
    expect(careerEvent(s,'rotation-5')!.choices.map(c=>c.id)).toEqual(['emergency']);
    expect(s.journal[0].detail).toMatch(/^20세 0개월 ·/);
  });
  it('keeps RNG, finances, family and automatic logs consistent at 1x and 8x', () => {
    const slow = play(42, 'internal', 'employed', 1), fast = play(42, 'internal', 'employed', 8);
    expect(slow.events).toEqual(fast.events);
    expect(slow.s.seed).toBe(fast.s.seed); expect(slow.s.stats).toEqual(fast.s.stats);
    expect(slow.s.career).toEqual(fast.s.career); expect(slow.s.family).toEqual(fast.s.family);
    const finances = (s: GameState) => ({ ...s.economy, ledger: s.economy!.ledger.map(({ id: _id, ...tx }) => tx) });
    expect(finances(slow.s)).toEqual(finances(fast.s));
    const auto = (s: GameState) => s.journal.filter(e => e.id.startsWith('auto:'));
    expect(auto(slow.s)).toEqual(auto(fast.s));
    expect(slow.s.portfolio).toEqual(fast.s.portfolio);
    expect(slow.s.lifestyle).toEqual(fast.s.lifestyle);
  }, 30000);
  it('records varied automatic life events without forcing specialty visits for every activity', () => {
    for (const focus of ['work', 'rest', 'clinical'] as const) {
      let s = createCareerGame(`notes-${focus}`, 42);
      s = reduceGame(s, { type: 'explore', id: 'explore', specialtyId: 'internal' });
      s = reduceGame(s, { type: 'career-focus', id: 'focus', focus });
      s = reduceGame(s, { type: 'control', id: 'start', paused: false, speed: 8 });
      s = until(s, x => x.life!.elapsedMs >= 20_000);
      const notes = s.journal.filter(e => e.id.startsWith('auto:campus:ambient:'));
      expect(notes.length).toBeGreaterThan(8);
      expect(new Set(notes.map(e => e.title)).size).toBeGreaterThan(5);
      if (focus !== 'clinical') expect(s.career!.explored).not.toContain('pediatrics');
      expect(s.career!.explored).not.toContain('preventive');
      expect(notes.some(e => Object.values(e.effects).some(n => n !== 0))).toBe(true);
    }
  });
  it('preserves the three earlier save versions and starts a separate version paused', () => {
    for (const version of ['fixture-v1', 'family-preview-v1', 'random-preview-v1', 'career-preview-v1'] as const) expect(validState(createGame('save', 2, version))).toBe(true);
    expect(createCareerGame('new', 4).life!.paused).toBe(true);
  });
  it('connects university, required specialty, hospital, training, employment and economic consequences', () => {
    const { s, events } = play();
    expect(events.filter(e => e.key === 'club-required')).toHaveLength(1);
    expect(events.some(e => e.key === 'specialty-required')).toBe(true);
    expect(events.some(e => e.key === 'institution-required')).toBe(true);
    expect(events.some(e => e.key === 'practice-required')).toBe(true);
    expect(events.filter(e => e.key === 'marriage-required')).toHaveLength(1);
    expect(s.career!.application).toBe('accepted'); expect(s.career!.practice).toBe('employed');
    expect(s.economy!.ledger.some(t => t.label === '수련 급여')).toBe(true);
    expect(s.economy!.ledger.some(t => t.label === '봉직 급여')).toBe(true);
    expect(s.progress!.activeMs.every(ms => ms > 0)).toBe(true);
    expect(s.journal.some(e => e.id.startsWith('auto:campus:'))).toBe(true);
    expect(Object.values(s.progress!.counts).every(n => n <= 2)).toBe(true);
  });
  it('supports untrained and clinic paths, with different income and actual opening cost', () => {
    const untrained = play(9, 'untrained', 'untrained');
    expect(untrained.s.career!.application).toBe('untrained');
    expect(untrained.events.some(e => e.key === 'institution-required')).toBe(false);
    expect(untrained.s.economy!.ledger.some(t => t.label === '수련 급여')).toBe(false);
    expect(untrained.s.economy!.ledger.some(t => t.label === '미수련 경로 수입')).toBe(true);
    const clinic = play(42, 'internal', 'clinic').s;
    expect(clinic.economy!.ledger.filter(t => t.kind === 'open-clinic')).toHaveLength(1);
    expect(clinic.economy!.ledger.some(t => t.label === '개원 매출')).toBe(true);
    expect(clinic.economy!.ledger.some(t => t.label === '개원 운영비')).toBe(true);
  }, 10000);
  it('lets an untrained graduate choose research once and connects its income and work to retirement', async () => {
    const { s, events } = play(9, 'untrained', 'research');
    expect(s.status).toBe('completed');
    expect(s.career!.application).toBe('untrained');
    expect(s.career!.practice).toBe('research');
    expect(events.filter(e => e.key === 'practice-required')).toHaveLength(1);
    expect(s.progress!.resolved).toContain('practice-required');
    expect(s.economy!.ledger.some(t => t.label === '연구 수입')).toBe(true);
    expect(s.economy!.ledger.some(t => t.label === '수련 급여')).toBe(false);
    expect(events.some(e => e.key === 'patient-loss' || e.key === 'dispute')).toBe(false);
    expect(validState(s)).toBe(true);
    const db = await openGameDatabase(`untrained-research-${Date.now()}`);
    try {
      await persistGame(db, s, null);
      expect((await loadGame(db))!.state.career!.practice).toBe('research');
      expect((await archives(db))[0].state.career!.practice).toBe('research');
    } finally { db.close(); }
  });
  it('does not repeat mandatory choices or advance paused/pending time and ignores duplicate responses', () => {
    let s = createCareerGame('pause', 9); expect(tick(s)).toBe(s);
    s = reduceGame(s, { type: 'control', id: 'start', paused: false, speed: 8 });
    while (!s.pendingEvent) s = tick(s);
    expect(s.pendingEvent!.randomKey).toBe('club-required'); expect(tick(s)).toBe(s);
    const a = { type: 'choose', id: 'once', eventId: s.pendingEvent!.id, choiceId: 'pass' } as const;
    const n = reduceGame(s, a); expect(reduceGame(n, a)).toBe(n); expect(n.progress!.club).toBe('declined');
  });
  it('offers a limited specialty set plus no training, and activity builds separate preparation', () => {
    let s = createCareerGame('experience', 42);
    s = reduceGame(s, { type: 'career-focus', id: 'research', focus: 'research' });
    s = reduceGame(s, { type: 'control', id: 'start', paused: false, speed: 8 });
    for (let i = 0; i < 1000 && s.pendingEvent?.randomKey !== 'specialty-required'; i++) s = s.pendingEvent ? choose(s, choiceFor(s)) : tick(s);
    expect(s.pendingEvent!.choices.map(c => c.id)).toEqual([...specialtyOptions(s).map(x => x.id), 'untrained']);
    expect(s.career!.experience.research).toBeGreaterThan(s.career!.experience.study);
  });
  it('persists pending choices, finance, experience and archive atomically without new RNG or offline income', async () => {
    const db = await openGameDatabase(`career-${crypto.randomUUID()}`);
    try {
      let s = reduceGame(createCareerGame('resume', 4), { type: 'control', id: 'start', paused: false, speed: 8 });
      while (!s.pendingEvent) s = tick(s);
      await persistGame(db, s, null); const copy = (await loadGame(db))!.state;
      expect(copy).toEqual(s); expect(choose(copy, 'pass')).toEqual(choose(s, 'pass'));
      const done = play().s; await persistGame(db, done, { runId: s.runId, revision: s.revision });
      expect((await archives(db))[0].state).toEqual(done);
    } finally { db.close(); }
  });
  it('rejects corrupted money, career, generated choice and active-time records', () => {
    const s = createCareerGame('bad', 7);
    for (const mutate of [(x: GameState) => { x.economy!.cash = -1; }, (x: GameState) => { x.career!.specialty = 'unknown'; }, (x: GameState) => { x.progress!.activeMs[0] = Infinity; }]) {
      const bad = structuredClone(s); mutate(bad); expect(validState(bad)).toBe(false);
    }
    expect(CAREER_TIME.monthMs[0]).toBeGreaterThan(CAREER_TIME.monthMs[2]);
  });
});
