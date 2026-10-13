import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { GameState, TimeSpeed } from '../src/contracts';
import { reduceGame } from '../src/engine';
import { SPECIALTIES, type Practice } from '../src/career';
import { institutionOptions } from '../src/opportunities';
import { CLUBS } from '../src/campus';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { advanceDepth, DEPTH_RUNTIME, initialDepth, incidentDepth, requiredDepth, INSTITUTION_OPPORTUNITIES } from '../src/career-depth';
import { SPECIALTY_DEPTH } from '../src/specialty-depth';
import { economyAction } from '../src/economy';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';

const tick = (s: GameState, ms = 500) => reduceGame(s, { type: 'tick', id: `t:${s.revision}`, elapsedMs: ms });
const choose = (s: GameState, choiceId: string, id = `c:${s.revision}`) => reduceGame(s, {
  type: 'choose', id, eventId: s.pendingEvent!.id, choiceId,
});

// A saved, accepted trainee/doctor: keep the tests focused on the new decisions.
function atMonth(month: number, specialty = 'internal', practice: Practice = 'employed', seed = 42) {
  const s = createCareerGame('depth-test', seed);
  s.stageIndex = month < 150 ? 1 : 2;
  Object.assign(s.life!, { elapsedMs: month * 1000, paused: false, speed: 1 });
  Object.assign(s.career!, { specialty, institution: 'snuh', application: 'accepted', attempts: 1,
    practice: s.stageIndex === 1 ? 'undecided' : practice, lastMonth: month });
  Object.assign(s.economy!, { cash: 30_000_000, assets: 30_000_000, lastMonth: month });
  Object.assign(s.progress!, { club: 'declined', marriage: 'settled', trainingStartMonth: 72,
    resolved: ['clinical-case', 'practice-required'] });
  s.campus!.lastMonth = s.campus!.lastAmbient = month;
  s.depth = initialDepth();
  s.depth.decisions['depth-institution'] = { choice: 'evaluation', month: 73, followed: true };
  s.depth.institutionPath = 'evaluation';
  if (s.stageIndex === 2) {
    s.depth.decisions['depth-training'] = { choice: SPECIALTY_DEPTH[specialty].training.choices[0].id, month: 78, followed: true };
    s.depth.decisions['depth-work'] = { choice: SPECIALTY_DEPTH[specialty].work.choices[0].id, month: 156, followed: true };
    s.depth.decisions['depth-workload'] = { choice: 'balanced', month: 150, followed: true };
  }
  return s;
}

function pending(s: GameState, key: string) {
  s.pendingEvent = careerEvent(s, key);
  expect(s.pendingEvent, key).not.toBeNull();
  expect(validState(s), `invalid fixture: ${key}`).toBe(true);
  return s;
}

function automaticChoice(s: GameState) {
  const event = s.pendingEvent!;
  if (event.randomKey === 'funding') return event.choices.some(c => c.id === 'pay-due') ? 'pay-due' : 'loan';
  if (event.randomKey?.startsWith('offer-')) return 'decline';
  if (event.randomKey === 'marriage-required') return s.family!.status === 'dating' ? 'stay' : 'single';
  return event.choices[0].id;
}

function reach(s: GameState, done: (s: GameState) => boolean, ms = 500) {
  for (let i = 0; i < 1200; i++) {
    if (done(s)) return s;
    s = s.pendingEvent ? choose(s, automaticChoice(s)) : tick(s, ms);
    const diagnostic = `Invalid state at ${s.life!.elapsedMs}: ${s.pendingEvent?.randomKey}`;
    if (!validState(s)) throw new Error(diagnostic);
  }
  throw new Error('Target state not reached');
}

describe('hospital application and education routes', () => {
  it.each(['snuh', 'asan'])('%s confirms documents before applying and can revise without consuming an attempt', (institution: string) => {
    const seed = Array.from({ length: 100 }, (_, i) => i + 1).find(n => { const x = atMonth(66, 'internal', 'employed', n); x.career!.attempts = 0; x.progress!.selectedSpecialty = 'internal'; return institutionOptions(x).some(y => y.id === institution); })!;
    const before = atMonth(66, 'internal', 'employed', seed);
    before.stageIndex = 0;
    before.career!.application = 'none';
    before.career!.specialty = null;
    before.career!.institution = null;
    before.career!.attempts = 0;
    before.depth = initialDepth(66);
    before.progress!.selectedSpecialty = 'internal';
    pending(before, 'institution-required');
    const confirmation = choose(before, institution);
    expect(confirmation.pendingEvent!.randomKey).toBe('depth-application');
    expect(confirmation.pendingEvent!.sourceNote?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(confirmation.career!.attempts).toBe(0);
    const revised = choose(confirmation, 'revise');
    expect(revised.pendingEvent!.randomKey).toBe('institution-required');
    expect(revised.depth!.pendingInstitution).toBeUndefined();
    expect(revised.career!.attempts).toBe(0);
    expect(revised.seed).toBe(before.seed);
    const submitted = choose(choose(revised, institution), 'submit');
    expect(submitted.pendingEvent!.randomKey).toBe('application-result');
    expect(submitted.career!.institution).toBe(institution);
    expect(submitted.career!.attempts).toBe(1);
    expect(submitted.depth!.pendingInstitution).toBeUndefined();
    expect(validState(submitted)).toBe(true);
    expect(choose(submitted, 'submit')).toBe(submitted);
  });

  it.each(Object.entries(INSTITUTION_OPPORTUNITIES))('%s applies each education path and its delayed experience exactly once', (institution: string, info: (typeof INSTITUTION_OPPORTUNITIES)[string]) => {
    for (const path of info.paths) {
      const before = atMonth(73, info.specialties?.[0] ?? 'internal');
      before.career!.institution = institution;
      delete before.depth!.decisions['depth-institution'];
      before.depth!.institutionPath = null;
      pending(before, 'depth-institution');
      expect(before.pendingEvent!.sourceNote).toEqual({ text: info.fact, url: info.url, sha256: info.sha256 });
      const after = choose(before, path.id);
      expect(after.depth!.skill).toBe(path.skill);
      expect(after.depth!.safety).toBe(path.safety);
      expect(after.economy!.cash).toBe(before.economy!.cash);
      after.life!.elapsedMs = 76_000;
      const experience = { ...after.career!.experience };
      advanceDepth(after);
      const area = ['abstract', 'research-track', 'literature'].includes(path.id) ? 'research' : ['career-talk', 'communication-track'].includes(path.id) ? 'people' : 'clinical';
      expect(after.career!.experience[area]).toBe(experience[area] + 4);
      expect(after.journal.filter(j => j.id === 'depth-follow:depth-institution')).toHaveLength(1);
      const completed = structuredClone(after);
      advanceDepth(after);
      expect(after).toEqual(completed);
      expect(validState(after)).toBe(true);
    }
  });

  it('limits the Severance plan to its seven specialties and labels Samsung evidence as historical', () => {
    const s = atMonth(73, 'orthopedics');
    s.career!.institution = 'severance';
    delete s.depth!.decisions['depth-institution'];
    pending(s, 'depth-institution');
    expect(s.pendingEvent!.sourceNote).toBeUndefined();
    expect(s.pendingEvent!.choices.map(c => c.id)).toEqual(['feedback', 'peer', 'rest']);
    s.career!.institution = 'samsung';
    pending(s, 'depth-institution');
    expect(s.pendingEvent!.sourceNote!.text).toContain('2020');
    expect(s.pendingEvent!.sourceNote!.text).toContain('현행 운영은 확인되지');
  });
});

describe('specialty decisions and their delayed consequences', () => {
  it.each(SPECIALTIES.map(s => [s.id, s.name]))('%s (%s) connects every training and work choice to money, skills and follow-up', (specialty: string) => {
    for (const [key, stageMonth, episode] of [
      ['depth-training', 78, SPECIALTY_DEPTH[specialty].training],
      ['depth-work', 156, SPECIALTY_DEPTH[specialty].work],
    ] as const) {
      expect(episode.choices.length).toBeGreaterThanOrEqual(2);
      for (const choice of episode.choices) {
        const before = atMonth(stageMonth, specialty);
        delete before.depth!.decisions[key];
        pending(before, key);
        expect(before.pendingEvent!.title).toBe(episode.title);
        expect(before.pendingEvent!.choices.some(c => c.id === choice.id)).toBe(true);
        const after = choose(before, choice.id, 'depth-choice');
        expect(after.depth!.skill).toBe(before.depth!.skill + choice.skill);
        expect(after.depth!.safety).toBe(Math.max(0, before.depth!.safety + choice.safety));
        expect(after.economy!.cash - before.economy!.cash).toBe(choice.cash ?? 0);
        const transactions = after.economy!.ledger.filter(t => !before.economy!.ledger.some(old => old.id === t.id));
        expect(transactions.map(t => t.cashDelta)).toEqual(choice.cash ? [choice.cash] : []);
        expect(after.depth!.decisions[key]).toEqual({ choice: choice.id, month: stageMonth, followed: false });
        expect(after.journal.some(j => j.title === episode.title)).toBe(true);
        expect(reduceGame(after, { type: 'choose', id: 'depth-choice', eventId: before.pendingEvent!.id, choiceId: choice.id })).toBe(after);
        expect(reduceGame(after, { type: 'choose', id: 'repeat-choice', eventId: before.pendingEvent!.id, choiceId: choice.id })).toBe(after);
        let later = reach(after, s => s.life!.elapsedMs === (stageMonth + 2) * 1000);
        expect(later.journal.some(j => j.id === `depth-follow:${key}`)).toBe(false);
        later = reach(later, s => s.life!.elapsedMs === (stageMonth + 3) * 1000);
        expect(later.depth!.decisions[key].followed).toBe(true);
        expect(later.journal.filter(j => j.id === `depth-follow:${key}`)).toHaveLength(1);
        expect(later.journal.find(j => j.id === `depth-follow:${key}`)!.detail).toContain(choice.followUp);
        later = reach(later, s => s.life!.elapsedMs === (stageMonth + 4) * 1000);
        expect(later.journal.filter(j => j.id === `depth-follow:${key}`)).toHaveLength(1);
      }
    }
  });

  it.each(SPECIALTIES.map(s => [s.id]))('%s keeps free alternatives and refuses unaffordable paid choices without effects', (specialty: string) => {
    for (const [key, month, episode] of [
      ['depth-training', 78, SPECIALTY_DEPTH[specialty].training],
      ['depth-work', 156, SPECIALTY_DEPTH[specialty].work],
    ] as const) {
      const s = atMonth(month, specialty);
      delete s.depth!.decisions[key];
      s.economy!.cash = s.economy!.assets = 0;
      pending(s, key);
      const paid = episode.choices.filter(c => (c.cash ?? 0) < 0);
      expect(paid.length).toBeGreaterThan(0);
      for (const choice of paid) {
        expect(s.pendingEvent!.choices.some(c => c.id === choice.id)).toBe(false);
        expect(choose(s, choice.id)).toBe(s);
      }
      const free = episode.choices.find(c => (c.cash ?? 0) === 0)!;
      expect(free).toBeDefined();
      expect(s.pendingEvent!.choices.some(c => c.id === free.id)).toBe(true);
      const next = choose(s, free.id);
      expect(next).not.toBe(s);
      expect(next.economy!.cash).toBe(0);
      expect(next.economy!.ledger).toEqual(s.economy!.ledger);
      expect(validState(next)).toBe(true);
    }
  });
});

describe('workload has actual monthly financial and health effects', () => {
  function schedule(s: GameState, workload: 'balanced' | 'extended' | 'learning') {
    return reduceGame(s, { type: 'workload', id: `schedule:${workload}`, workload });
  }

  it.each(['employed', 'clinic'] as const)('%s posts additional income and clinic operating costs once per month', (practice: 'employed' | 'clinic') => {
    let base = atMonth(160, 'internal', practice);
    if (practice === 'clinic') base.economy = economyAction(base.economy!, 'open', 'open-clinic', 160).state;
    const balanced = reach(base, s => s.life!.elapsedMs === 163_000);
    const extended = reach(schedule(base, 'extended'), s => s.life!.elapsedMs === 163_000);
    const learning = reach(schedule(base, 'learning'), s => s.life!.elapsedMs === 163_000);
    const income = practice === 'clinic' ? DEPTH_RUNTIME.extendedRevenue : DEPTH_RUNTIME.extendedSalary;
    const cost = practice === 'clinic' ? DEPTH_RUNTIME.extendedCost : 0;
    expect(extended.economy!.cash - balanced.economy!.cash).toBe(3 * (income - cost));
    expect(extended.economy!.income - balanced.economy!.income).toBe(income);
    expect(extended.economy!.expenses - balanced.economy!.expenses).toBe(cost);
    expect(extended.economy!.ledger.filter(t => t.id.startsWith('depth-month:') && t.cashDelta > 0)).toHaveLength(3);
    expect(extended.economy!.ledger.filter(t => t.label === '추가 진료 운영비')).toHaveLength(practice === 'clinic' ? 3 : 0);
    // The workload costs exactly two health; subsequent condition-based recovery may soften the net gap.
    expect(extended.journal.find(j => j.id === 'depth-load:162')?.effects.health).toBe(-2);
    expect(extended.stats.health).toBeLessThan(balanced.stats.health);
    expect(learning.economy!.cash - balanced.economy!.cash).toBe(-3 * DEPTH_RUNTIME.learningCost);
    expect(learning.economy!.expenses - balanced.economy!.expenses).toBe(DEPTH_RUNTIME.learningCost);
    expect(learning.stats.health - balanced.stats.health).toBe(1);
    expect(learning.depth!.skill - balanced.depth!.skill).toBe(3);
    expect(learning.depth!.safety - balanced.depth!.safety).toBe(3);
    const switched = schedule(extended, 'balanced');
    const next = reach(switched, s => s.life!.elapsedMs === 164_000);
    expect(next.economy!.ledger.some(t => t.id === 'depth-month:164:income')).toBe(false);
    expect(validState(next)).toBe(true);
  });

  it('stops paid education when cash is short, preserving cash and skills', () => {
    const s = schedule(atMonth(161), 'learning');
    s.economy!.cash = s.economy!.assets = DEPTH_RUNTIME.learningCost - 1;
    const before = structuredClone(s);
    // Exercise the monthly education settlement after other commitments used the cash.
    advanceDepth(s);
    expect(s.depth!.workload).toBe('balanced');
    expect(s.economy).toEqual(before.economy);
    expect(s.depth!.skill).toBe(before.depth!.skill);
    expect(s.depth!.safety).toBe(before.depth!.safety);
    expect(s.journal.filter(j => j.id === 'depth-learning-stop:161')).toHaveLength(1);
    advanceDepth(s);
    expect(s.journal.filter(j => j.id === 'depth-learning-stop:161')).toHaveLength(1);
  });

  it('does not offer or apply extended clinical work to a research career', () => {
    const s = atMonth(160, 'internal', 'research');
    delete s.depth!.decisions['depth-workload'];
    pending(s, 'depth-workload');
    expect(s.pendingEvent!.choices.map(c => c.id)).toEqual(['balanced', 'learning']);
    expect(choose(s, 'extended')).toBe(s);
    const next = choose(s, 'balanced');
    expect(schedule(next, 'extended')).toBe(next);
  });
});

describe('incident draws and time controls', () => {
  it('uses reproducible seed and specialty dependent incident months without changing state during the draw', () => {
    const histories = new Set<string>();
    for (const seed of [1, 7, 42, 91]) {
      for (const specialty of ['internal', 'surgery', 'radiology', 'preventive']) {
        const s = atMonth(160, specialty, 'employed', seed);
        const events: string[] = [];
        for (let month = 168; month <= 444; month += 12) {
          s.life!.elapsedMs = month * 1000;
          const before = structuredClone(s);
          const key = incidentDepth(s);
          expect(incidentDepth(s)).toBe(key);
          expect(s).toEqual(before);
          if (key) events.push(key);
        }
        histories.add(events.join('|'));
      }
    }
    expect(histories.size).toBeGreaterThan(4);
  });

  it('freezes the clock, money, RNG and safety while paused or reading an incident', () => {
    let incidentState: GameState | undefined;
    for (let seed = 1; seed <= 50 && !incidentState; seed++) {
      for (let month = 168; month <= 444; month += 12) {
        const s = atMonth(month, 'internal', 'employed', seed);
        if (incidentDepth(s)) { incidentState = atMonth(month - 1, 'internal', 'employed', seed); break; }
      }
    }
    expect(incidentState).toBeDefined();
    const paused = structuredClone(incidentState!); paused.life!.paused = true;
    expect(tick(paused)).toBe(paused);
    const waiting = tick(incidentState!);
    expect(waiting.pendingEvent!.randomKey).toMatch(/^depth-incident:/);
    expect(tick(waiting)).toBe(waiting);
    const response = choose(waiting, 'team');
    expect(response.depth!.safety).toBe(waiting.depth!.safety + 4);
    expect(response.depth!.lastIncident).toBe(response.life!.elapsedMs / 1000);
    expect(response.depth!.workload).toBe('balanced');
    expect(incidentDepth(response)).toBeNull();
  });

  it('uses accumulated skill and safety to unlock a less distressing incident response', () => {
    const inexperienced = pending(atMonth(168), 'depth-incident:review:168');
    expect(inexperienced.pendingEvent!.choices.some(c => c.id === 'prepared')).toBe(false);
    expect(choose(inexperienced, 'prepared')).toBe(inexperienced);
    const experienced = atMonth(168);
    experienced.depth!.skill = 6; experienced.depth!.safety = 8;
    experienced.depth!.workload = 'extended'; experienced.stats.happiness = 50;
    pending(experienced, 'depth-incident:review:168');
    expect(experienced.pendingEvent!.choices.some(c => c.id === 'prepared')).toBe(true);
    const supported = choose(experienced, 'team');
    const prepared = choose(experienced, 'prepared');
    expect(prepared.stats.happiness).toBeGreaterThan(supported.stats.happiness);
    expect(prepared.depth!.workload).toBe('balanced');
    expect(prepared.depth!.safety).toBe(12);
    const next = reach(prepared, s => s.life!.elapsedMs === 169_000);
    expect(next.economy!.ledger.some(t => t.id === 'depth-month:169:income')).toBe(false);
    expect(validState(next)).toBe(true);
  });

  it('preserves decisions, outcomes, finances and RNG at 1x and 16x through retirement', () => {
    function finish(speed: TimeSpeed) {
      let s = atMonth(160, 'surgery', 'employed', 91);
      s.depth!.workload = 'learning';
      s.depth!.decisions['depth-workload'].choice = 'learning';
      s.life!.speed = speed;
      const events: string[] = [];
      s = reach(s, next => {
        if (next.pendingEvent) events.push(`${next.life!.elapsedMs}:${next.pendingEvent.randomKey}`);
        return next.status === 'completed';
      });
      return { s, events };
    }
    const slow = finish(1), fast = finish(16);
    expect(slow.events).toEqual(fast.events);
    expect(slow.s.depth).toEqual(fast.s.depth);
    expect(slow.s.seed).toBe(fast.s.seed);
    expect(slow.s.stats).toEqual(fast.s.stats);
    expect(slow.s.career).toEqual(fast.s.career);
    const money = (s: GameState) => ({ ...s.economy, ledger: s.economy!.ledger.map(({ id: _id, ...tx }) => tx) });
    expect(money(slow.s)).toEqual(money(fast.s));
    expect(slow.s.journal.filter(j => j.id.startsWith('depth-follow:'))).toEqual(fast.s.journal.filter(j => j.id.startsWith('depth-follow:')));
  });
});

describe('club mentors and saved games', () => {
  it.each(CLUBS.map(c => [c.id, c.specialty]))('%s mentor follows a finished joint project, then records a presentation and research experience', (clubId: string, specialty: string) => {
    const s = atMonth(81, specialty);
    s.campus!.club = clubId;
    s.campus!.project = 'finished'; s.campus!.projectDue = 24; s.campus!.mentorMeetings = 3;
    s.depth!.decisions['depth-training'] = { choice: SPECIALTY_DEPTH[specialty].training.choices[0].id, month: 78, followed: true };
    const noMeeting = structuredClone(s); noMeeting.campus!.mentorMeetings = 0;
    expect(requiredDepth(noMeeting)).toBeNull();
    const unfinished = structuredClone(s); unfinished.campus!.project = 'declined';
    expect(requiredDepth(unfinished)).toBeNull();
    const unrelated = structuredClone(s); unrelated.campus!.club = null; unrelated.campus!.project = 'none';
    expect(requiredDepth(unrelated)).toBeNull();
    expect(requiredDepth(s)).toBe('depth-mentor');
    pending(s, 'depth-mentor');
    expect(s.pendingEvent!.body).toContain(CLUBS.find(c => c.id === clubId)!.project);
    const after = choose(s, 'collaborate');
    expect(after.depth!.mentorSpecialty).toBe(specialty);
    expect(after.depth!.skill).toBe(4); expect(after.depth!.safety).toBe(3);
    let later = reach(after, x => x.life!.elapsedMs === 83_000);
    const baseline = structuredClone(later);
    baseline.depth!.decisions['depth-mentor'].followed = true;
    expect(later.journal.some(j => j.id === 'depth-follow:depth-mentor')).toBe(false);
    later = reach(later, x => x.life!.elapsedMs === 84_000);
    const withoutPresentation = reach(baseline, x => x.life!.elapsedMs === 84_000);
    expect(later.career!.experience.research - withoutPresentation.career!.experience.research).toBe(4);
    expect(later.journal.find(j => j.id === 'depth-follow:depth-mentor')!.detail).toContain('발표를 마쳤습니다');
    expect(later.journal.find(j => j.id === 'depth-follow:depth-mentor')!.detail).toContain(CLUBS.find(c => c.id === clubId)!.mentor);
  });

  it('restores an old pending patient-loss save without offline effects and upgrades only after choosing', async () => {
    const s = atMonth(216);
    delete s.depth;
    pending(s, 'patient-loss');
    const db = await openGameDatabase(`depth-legacy-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      const restored = (await loadGame(db))!.state;
      expect(restored).toEqual(s);
      expect(restored.depth).toBeUndefined();
      expect(tick(restored)).toBe(restored);
      const after = choose(restored, 'support');
      expect(after.depth!.since).toBe(216);
      expect(after.depth!.skill).toBe(0); expect(after.depth!.safety).toBe(0);
      expect(after.economy).toEqual(restored.economy);
      expect(validState(after)).toBe(true);
    } finally { db.close(); }
  });

  it('upgrades an active legacy career without retroactive training decisions or income', () => {
    const s = atMonth(160);
    delete s.depth;
    expect(validState(s)).toBe(true);
    const upgraded = tick(s);
    expect(upgraded.depth!.since).toBe(160);
    expect(upgraded.depth!.decisions).toEqual({});
    expect(upgraded.pendingEvent!.randomKey).toBe('depth-workload');
    expect(upgraded.life!.elapsedMs).toBe(s.life!.elapsedMs);
    expect(upgraded.economy).toEqual(s.economy);
    expect(upgraded.stats).toEqual(s.stats);
    expect(validState(upgraded)).toBe(true);
  });

  it('saves a paid specialty choice while pending and resumes its exact effects once', async () => {
    const s = atMonth(78);
    pending(s, 'depth-training');
    const paid = SPECIALTY_DEPTH.internal.training.choices.find(c => (c.cash ?? 0) < 0)!;
    const db = await openGameDatabase(`depth-pending-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      const restored = (await loadGame(db))!.state;
      expect(restored).toEqual(s);
      const after = choose(restored, paid.id, 'saved-choice');
      expect(after).toEqual(choose(s, paid.id, 'saved-choice'));
      await persistGame(db, after, { runId: s.runId, revision: s.revision });
      const saved = (await loadGame(db))!.state;
      expect(reduceGame(saved, { type: 'choose', id: 'saved-choice', eventId: s.pendingEvent!.id, choiceId: paid.id })).toBe(saved);
      expect(saved.economy!.cash).toBe(s.economy!.cash + paid.cash!);
    } finally { db.close(); }
  });

  it('rejects malformed depth values instead of loading damaged skills, schedules or history', () => {
    const valid = atMonth(160);
    expect(validState(valid)).toBe(true);
    const mutations: ((s: GameState) => void)[] = [
      s => { s.depth!.version = 2 as 1; },
      s => { s.depth!.skill = -1; },
      s => { s.depth!.safety = 101; },
      s => { s.depth!.skill = NaN; },
      s => { s.depth!.safety = 1.5; },
      s => { s.depth!.since = 161; },
      s => { s.depth!.lastIncident = 161; },
      s => { s.depth!.workload = 'unknown' as 'balanced'; },
      s => { s.depth!.mentorSpecialty = 'unknown'; },
      s => { s.depth!.institutionPath = 5 as unknown as string; },
      s => { s.depth!.decisions = [] as unknown as NonNullable<GameState['depth']>['decisions']; },
      s => { s.depth!.decisions['other'] = { choice: 'x', month: 160, followed: false }; },
      s => { s.depth!.institutionPath = 'not-a-path'; },
      s => { s.depth!.decisions['depth-unknown'] = { choice: 'x', month: 160, followed: false }; },
      s => { s.depth!.decisions['depth-training'].choice = 'not-a-choice'; },
      s => { s.depth!.decisions['depth-training'].month = 161; },
      s => { s.depth!.decisions['depth-training'].followed = 'yes' as unknown as boolean; },
    ];
    for (const mutate of mutations) {
      const bad = structuredClone(valid); mutate(bad);
      expect(validState(bad)).toBe(false);
    }
  });
});
