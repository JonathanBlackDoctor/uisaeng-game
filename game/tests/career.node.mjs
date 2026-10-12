import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIALTIES, INSTITUTIONS, CAREER_RULES, initialCareer, validCareer,
  advanceCareerExperience, exploreSpecialty, careerPreparation, applySpecialty,
  choosePractice, careerScene,
} from '../src/career.ts';

const restore = value => JSON.parse(JSON.stringify(value));
const prepared = () => ({ ...initialCareer(), experience: { study: 80, research: 80, people: 80, clinical: 80 } });
const accepted = (id = 'internal') => applySpecialty(prepared(), id, 'snuh', 80, 0.5).state;

test('26 specialties match the supplied names and have distinct concrete content', () => {
  assert.deepEqual(SPECIALTIES.map(s => s.name), [
    '내과', '외과', '소아청소년과', '산부인과', '정신건강의학과', '정형외과',
    '신경외과', '심장혈관흉부외과', '성형외과', '안과', '이비인후과', '피부과',
    '비뇨의학과', '영상의학과', '방사선종양학과', '마취통증의학과', '신경과',
    '재활의학과', '결핵과', '진단검사의학과', '병리과', '예방의학과',
    '가정의학과', '직업환경의학과', '핵의학과', '응급의학과',
  ]);
  for (const key of ['id', 'summary', 'exploration', 'training', 'caseTitle', 'caseBody']) {
    assert.equal(new Set(SPECIALTIES.map(s => s[key])).size, 26, key);
    assert.ok(SPECIALTIES.every(s => typeof s[key] === 'string' && s[key].length > 0));
  }
  assert.ok(SPECIALTIES.every(s => ['clinical', 'surgical', 'diagnostic', 'community'].includes(s.track)));
  assert.equal(new Set(Object.values(CAREER_RULES.preparationWeights).map(w => JSON.stringify(w))).size, 26);
  for (const s of SPECIALTIES) {
    const weights = CAREER_RULES.preparationWeights[s.id];
    assert.equal(weights.length, 4);
    assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-12);
    assert.equal(s.evidence, undefined, 'no supplied public URL: no invented display evidence');
  }
});

test('fresh state and all paths survive JSON round trips', () => {
  const original = initialCareer();
  assert.equal(validCareer(original), true);
  assert.deepEqual(restore(original), original);
  original.experience.study = 20;
  assert.equal(initialCareer().experience.study, 0);
  const failure = applySpecialty(initialCareer(), 'surgery', 'asan', 0, 0).state;
  for (const state of [initialCareer(), failure, choosePractice(failure, 'untrained'),
    choosePractice(failure, 'research'), accepted(), choosePractice(accepted(), 'employed'),
    choosePractice(accepted(), 'clinic'), choosePractice(accepted(), 'research')]) {
    assert.equal(validCareer(restore(state)), true);
    assert.deepEqual(restore(state), state);
  }
});

test('month duplicate, reversed month, focus change and restored duplicate give no extra experience', () => {
  const start = initialCareer();
  const first = advanceCareerExperience(start, 0, 'study');
  assert.equal(first.experience.study, CAREER_RULES.monthlyGain);
  assert.equal(start.experience.study, 0);
  assert.strictEqual(advanceCareerExperience(first, 0, 'research'), first);
  const next = advanceCareerExperience(first, 2, 'clinical');
  assert.strictEqual(advanceCareerExperience(next, 1, 'people'), next);
  assert.deepEqual(advanceCareerExperience(restore(next), 2, 'clinical'), next);
  const gap = advanceCareerExperience(next, 100, 'research');
  assert.equal(gap.experience.research, CAREER_RULES.monthlyGain, 'no inferred offline months');
});

test('each university focus affects its own record; rest/work consume month without career rewards', () => {
  let state = initialCareer();
  for (const [i, focus] of ['study', 'research', 'clinical', 'people'].entries()) {
    state = advanceCareerExperience(state, i, focus);
    assert.equal(state.experience[focus], CAREER_RULES.monthlyGain);
  }
  for (const [i, focus] of ['rest', 'work'].entries()) {
    const next = advanceCareerExperience(state, i + 4, focus);
    assert.deepEqual(next.experience, state.experience);
    assert.equal(next.lastMonth, i + 4);
    state = next;
  }
  const capped = { ...state, experience: { ...state.experience, study: 99 } };
  assert.equal(advanceCareerExperience(capped, 6, 'study').experience.study, 100);
});

test('26 preparations differ and reveal the contribution of all four experiences', () => {
  const only = key => ({ ...initialCareer(), experience: { study: 0, research: 0, people: 0, clinical: 0, [key]: 80 } });
  assert.ok(careerPreparation(only('research'), 'preventive').total > careerPreparation(only('research'), 'surgery').total);
  assert.ok(careerPreparation(only('people'), 'psychiatry').total > careerPreparation(only('people'), 'radiology').total);
  assert.ok(careerPreparation(only('clinical'), 'surgery').total > careerPreparation(only('clinical'), 'preventive').total);
  assert.ok(careerPreparation(only('study'), 'radiology').total > careerPreparation(only('study'), 'family').total);
  for (const s of SPECIALTIES) {
    const p = careerPreparation(prepared(), s.id);
    assert.ok(p.study > 0 && p.research > 0 && p.people > 0 && p.clinical > 0);
    assert.equal(p.total, p.study + p.research + p.people + p.clinical + p.exploration + p.interest);
  }
});

test('exploration is idempotent, changes interest, and does not grant fake experience', () => {
  const start = initialCareer();
  const one = exploreSpecialty(start, 'internal');
  assert.deepEqual(one.explored, ['internal']);
  assert.equal(one.interest, 'internal');
  assert.deepEqual(one.experience, start.experience);
  const repeat = exploreSpecialty(one, 'internal');
  assert.deepEqual(repeat, one);
  const two = exploreSpecialty(repeat, 'surgery');
  assert.equal(two.interest, 'surgery');
  assert.equal(careerPreparation(two, 'internal').interest, 0);
  assert.equal(careerPreparation(two, 'internal').exploration, CAREER_RULES.explorationBonus);
  assert.equal(careerPreparation(two, 'surgery').interest, CAREER_RULES.interestBonus);
  assert.deepEqual(start.explored, []);
});

test('experience, exploration, knowledge and roll each change selection at the same boundary', () => {
  const attempt = (state, knowledge = 70, roll = 0.5) => applySpecialty(state, 'internal', 'snuh', knowledge, roll);
  assert.equal(attempt(initialCareer()).accepted, false);
  assert.equal(attempt(prepared()).accepted, true);
  assert.equal(attempt(exploreSpecialty(initialCareer(), 'internal')).accepted, true);
  assert.equal(attempt(initialCareer(), 90).accepted, true);
  assert.equal(attempt(initialCareer(), 70, 0.99).accepted, true);
  const result = attempt(prepared());
  const a = result.state.lastApplication;
  assert.equal(a.score, a.knowledge * CAREER_RULES.knowledgeWeight + a.preparation.total);
  assert.equal(a.threshold, CAREER_RULES.acceptanceThreshold);
  assert.equal(a.ruleVersion, 'career-money-provisional-1');
  assert.equal(a.accepted, true);
});

test('unexplored application is permitted and explains preparation', () => {
  const result = applySpecialty(prepared(), 'surgery', 'asan', 80, 0.5);
  assert.equal(result.accepted, true);
  assert.match(result.detail, /견학 없이/);
  assert.deepEqual(result.state.explored, []);
  assert.equal(result.state.interest, null);
  assert.equal(result.state.lastApplication.preparation.exploration, 0);
});

test('threshold equality accepts and changing provisional settings changes only future results', () => {
  const saved = CAREER_RULES.acceptanceThreshold;
  try {
    CAREER_RULES.acceptanceThreshold = 65;
    const result = applySpecialty(initialCareer(), 'internal', 'snuh', 100, 0.5);
    assert.equal(result.accepted, true);
    CAREER_RULES.acceptanceThreshold = 66;
    assert.equal(applySpecialty(initialCareer(), 'internal', 'snuh', 100, 0.5).accepted, false);
    assert.equal(validCareer(restore(result.state)), true);
    assert.equal(result.state.lastApplication.threshold, 65);
  } finally { CAREER_RULES.acceptanceThreshold = saved; }
});

test('all institutions use equal provisional selection settings', () => {
  assert.equal(new Set(INSTITUTIONS.map(i => i.id)).size, INSTITUTIONS.length);
  const results = INSTITUTIONS.map(i => applySpecialty(prepared(), 'internal', i.id, 70, 0.5));
  assert.ok(results.every(r => r.accepted === results[0].accepted && r.state.lastApplication.score === results[0].state.lastApplication.score));
});

test('failure retains experience and supports retry into a different specialty/institution', () => {
  const state = exploreSpecialty(initialCareer(), 'surgery');
  const failed = applySpecialty(state, 'surgery', 'asan', 0, 0);
  assert.equal(failed.accepted, false);
  assert.equal(failed.state.application, 'rejected');
  assert.equal(failed.state.attempts, 1);
  assert.match(failed.detail, /재지원/);
  const retry = applySpecialty(restore(failed.state), 'family', 'severance', 100, 0.99);
  assert.equal(retry.accepted, true);
  assert.equal(retry.state.attempts, 2);
  assert.equal(retry.state.specialty, 'family');
  assert.equal(retry.state.institution, 'severance');
  assert.deepEqual(retry.state.experience, state.experience);
  assert.deepEqual(retry.state.explored, state.explored);
});

test('untrained is an explicit alternative and preserves reapplication', () => {
  const state = choosePractice(exploreSpecialty(initialCareer(), 'internal'), 'untrained');
  assert.equal(state.application, 'untrained');
  assert.equal(state.practice, 'untrained');
  assert.equal(state.specialty, null);
  assert.equal(state.institution, null);
  assert.equal(validCareer(state), true);
  assert.match(careerScene(state).title, /일반진료/);
  const research = choosePractice(state, 'research');
  assert.equal(research.application, 'untrained');
  assert.equal(validCareer(research), true);
  assert.match(careerScene(research).title, /연구/);
  const retry = applySpecialty(research, 'internal', 'snuh', 100, 0.99);
  assert.equal(retry.accepted, true);
  assert.equal(retry.state.practice, 'undecided');
});

test('employed/clinic require acceptance; research remains available before or after failure', () => {
  const rejected = applySpecialty(initialCareer(), 'surgery', 'snuh', 0, 0).state;
  for (const state of [initialCareer(), rejected, choosePractice(initialCareer(), 'untrained')]) {
    assert.throws(() => choosePractice(state, 'employed'), RangeError);
    assert.throws(() => choosePractice(state, 'clinic'), RangeError);
    assert.equal(validCareer(choosePractice(state, 'research')), true);
  }
  const state = accepted();
  for (const path of ['undecided', 'employed', 'clinic', 'research']) {
    const next = choosePractice(state, path);
    assert.equal(next.specialty, 'internal');
    assert.equal(next.institution, 'snuh');
    assert.equal(next.practice, path);
    assert.equal(validCareer(next), true);
  }
  const abandoned = choosePractice(state, 'untrained');
  assert.equal(abandoned.specialty, null);
  assert.equal(abandoned.attempts, 1);
  assert.equal(validCareer(abandoned), true);
});

test('accepted application cannot accidentally reroll or replace a selected training path', () => {
  const state = accepted();
  const result = applySpecialty(state, 'surgery', 'asan', 0, 0);
  assert.strictEqual(result.state, state);
  assert.equal(result.accepted, true);
  assert.equal(result.state.attempts, 1);
});

test('all specialties have training, employed, clinic and research follow-up scenes', () => {
  const employedScenes = [];
  for (const s of SPECIALTIES) {
    const state = accepted(s.id);
    const training = careerScene(state);
    assert.match(training.body, /서울대학교병원/);
    assert.ok(training.body.includes(s.training));
    const employed = careerScene(choosePractice(state, 'employed'));
    const clinic = careerScene(choosePractice(state, 'clinic'));
    const research = careerScene(choosePractice(state, 'research'));
    assert.ok(employed.body.includes(s.caseBody));
    assert.ok(clinic.body.includes(s.caseBody));
    assert.notEqual(employed.body, clinic.body);
    assert.ok(research.body.includes(s.name));
    employedScenes.push(employed.body);
  }
  assert.equal(new Set(employedScenes).size, 26);
});

test('invalid scalar, IDs and focus inputs are rejected without mutation', () => {
  const state = initialCareer();
  const before = restore(state);
  for (const month of [-1, 1.5, NaN, Infinity, '2', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => advanceCareerExperience(state, month, 'study'), RangeError);
  assert.throws(() => advanceCareerExperience(state, 0, 'unknown'), RangeError);
  const progressed = advanceCareerExperience(state, 0, 'study');
  assert.throws(() => advanceCareerExperience(progressed, 0, 'unknown'), RangeError);
  for (const id of ['unknown', '', null, '__proto__']) {
    assert.throws(() => exploreSpecialty(state, id), RangeError);
    assert.throws(() => careerPreparation(state, id), RangeError);
    assert.throws(() => applySpecialty(state, id, 'snuh', 50, 0.5), RangeError);
  }
  assert.throws(() => applySpecialty(state, 'internal', 'unknown', 50, 0.5), RangeError);
  for (const k of [-1, 101, NaN, Infinity, '50', null]) assert.throws(() => applySpecialty(state, 'internal', 'snuh', k, 0.5), RangeError);
  for (const roll of [-0.1, 1, NaN, Infinity, '0.5', null]) assert.throws(() => applySpecialty(state, 'internal', 'snuh', 50, roll), RangeError);
  assert.throws(() => choosePractice(state, 'unknown'), RangeError);
  assert.throws(() => applySpecialty({ ...state, attempts: Number.MAX_SAFE_INTEGER }, 'internal', 'snuh', 50, 0.5), RangeError);
  assert.deepEqual(state, before);
});

test('validator rejects corrupt saves, impossible paths and non-JSON data', () => {
  const state = initialCareer();
  const bad = [null, [], {}, { ...state, experience: { ...state.experience, study: -1 } },
    { ...state, experience: { ...state.experience, research: Infinity } },
    { ...state, experience: { ...state.experience, people: 1.5 } },
    { ...state, explored: ['unknown'] }, { ...state, explored: ['internal', 'internal'] },
    { ...state, interest: 'internal' }, { ...state, specialty: 'internal' },
    { ...state, institution: 'unknown' }, { ...state, application: 'accepted' },
    { ...state, practice: 'clinic' }, { ...state, practice: 'untrained' },
    { ...state, attempts: -1 }, { ...state, attempts: 1.5 }, { ...state, lastMonth: -2 },
    { ...state, lastMonth: 0.5 }, { ...state, lastMonth: Number.MAX_SAFE_INTEGER + 1 },
    { ...state, extra: undefined }, { ...state, extra: new Date() },
    { ...state, extra: 1n }, { ...state, extra: () => 1 }, { ...state, extra: Array(2) },
    { ...state, lastApplication: {} }];
  const cycle = { ...state }; cycle.extra = cycle; bad.push(cycle);
  const a = accepted();
  bad.push({ ...a, attempts: 0 });
  bad.push({ ...a, lastApplication: { ...a.lastApplication, roll: 1 } });
  bad.push({ ...a, lastApplication: { ...a.lastApplication, accepted: false } });
  bad.push({ ...a, lastApplication: { ...a.lastApplication, score: a.lastApplication.threshold - 1 } });
  bad.push({ ...a, lastApplication: { ...a.lastApplication, preparation: { ...a.lastApplication.preparation, total: 999 } } });
  bad.push({ ...a, lastApplication: { ...a.lastApplication, preparation: { ...a.lastApplication.preparation, study: -1 } } });
  for (const value of bad) assert.equal(validCareer(value), false);
  assert.equal(validCareer({ ...state, extra: { notes: ['저장 가능', null, 1] } }), true);
  for (const call of [() => advanceCareerExperience({}, 0, 'study'), () => exploreSpecialty({}, 'internal'),
    () => applySpecialty({}, 'internal', 'snuh', 50, 0.5), () => choosePractice({}, 'research'),
    () => careerPreparation({}, 'internal'), () => careerScene({})]) assert.throws(call, TypeError);
});

test('required-field-only contract saves remain valid without an optional application record', () => {
  const state = accepted();
  delete state.lastApplication;
  assert.equal(validCareer(state), true);
  assert.equal(validCareer(restore(state)), true);
});

test('complete study -> exploration -> failure -> retry -> training -> career -> restore journey', () => {
  let state = initialCareer();
  state = advanceCareerExperience(state, 0, 'study');
  state = advanceCareerExperience(state, 1, 'people');
  state = exploreSpecialty(state, 'pediatrics');
  state = applySpecialty(state, 'pediatrics', 'samsung', 10, 0).state;
  assert.equal(state.application, 'rejected');
  state = advanceCareerExperience(restore(state), 2, 'clinical');
  state = applySpecialty(state, 'pediatrics', 'samsung', 90, 0.9).state;
  assert.equal(state.application, 'accepted');
  assert.match(careerScene(state).title, /수련/);
  state = choosePractice(state, 'employed');
  assert.match(careerScene(state).body, /보호자/);
  state = choosePractice(state, 'clinic');
  assert.match(careerScene(state).body, /운영/);
  state = restore(state);
  assert.equal(validCareer(state), true);
  assert.equal(state.attempts, 2);
  assert.equal(state.institution, 'samsung');
  assert.strictEqual(advanceCareerExperience(state, 2, 'clinical'), state);
});
