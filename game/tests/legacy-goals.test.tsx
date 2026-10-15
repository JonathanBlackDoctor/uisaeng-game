import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { accrueLegacy, initialLegacy, validLegacy, familyTimeLabel, trainedStudents, currentStudent } from '../src/legacy-goals';
import { lifestyleSchedule, validLifestyle } from '../src/lifestyle';
import { openGameDatabase, persistGame, loadGame, validState } from '../src/storage';
import { resultShareData } from '../src/result-share';
import LifeGoals from '../src/LifeGoals';
import MentoringRecord from '../src/MentoringRecord';
import LifestylePanel from '../src/LifestylePanel';
import PlayOverview from '../src/PlayOverview';
import type { GameState } from '../src/contracts';

function working() {
  const s = createCareerGame('legacy-test', 42);
  s.stageIndex = 2; s.career!.practice = 'employed'; s.life!.elapsedMs = 144000; s.life!.paused = false;
  s.legacy = initialLegacy(s.life!.elapsedMs);
  return s;
}
function advance(s: GameState, ms: number, active: string[]) {
  accrueLegacy(s, ms, active); s.life!.elapsedMs += ms;
  expect(validLegacy(s)).toBe(true);
}
describe('family time and students', () => {
  it('keeps family time identical at 1x and 16x and restores a pending choice unchanged', async () => {
    function play(speed: 1 | 16) {
      let s = createCareerGame('legacy-speed', 23);
      s = reduceGame(s, { type: 'lifestyle', id: 'family', key: 'family', enabled: true });
      s = reduceGame(s, { type: 'control', id: 'start', paused: false, speed });
      for (let i = 0; i < 1000 && s.life!.elapsedMs < 6000; i++) {
        s = s.pendingEvent ? reduceGame(s, { type: 'choose', id: `c:${s.revision}`, eventId: s.pendingEvent.id, choiceId: s.pendingEvent.choices[0].id })
          : reduceGame(s, { type: 'tick', id: `t:${s.revision}`, elapsedMs: 1000 });
      }
      expect(s.life!.elapsedMs).toBe(6000); expect(validState(s)).toBe(true); return s;
    }
    const slow = play(1), fast = play(16); expect(slow.legacy).toEqual(fast.legacy);
    expect(familyTimeLabel(slow)).toBe('144시간'); expect(slow.pendingEvent).not.toBeNull();
    expect(reduceGame(slow, { type: 'tick', id: 'pending-tick', elapsedMs: 1000 })).toBe(slow);
    const db = await openGameDatabase('legacy-pending'); await persistGame(db, slow, null);
    expect((await loadGame(db))!.state).toEqual(slow); db.close();
  });
  it('counts actual family activity time, including partial months, without requiring marriage', () => {
    const s = working(); expect(s.family!.status).toBe('single');
    advance(s, 500, ['family']); expect(familyTimeLabel(s)).toContain('12시간');
    advance(s, 500, []); expect(s.legacy!.familyTimeUnits).toBe(12000);
    advance(s, 250, ['family']); expect(familyTimeLabel(s)).toContain('18시간');
    const before = structuredClone(s.legacy);
    s.life!.paused = true; accrueLegacy(s, 1000, ['family']); expect(s.legacy).toEqual(before);
    s.life!.paused = false; s.status = 'completed'; accrueLegacy(s, 1000, ['family']); expect(s.legacy).toEqual(before);
  });
  it('rejects duplicate accrual and never fills gaps with the current activity', () => {
    const s = working();
    accrueLegacy(s, 500, ['family']); const once = structuredClone(s.legacy);
    accrueLegacy(s, 500, ['family']); expect(s.legacy).toEqual(once);
    s.life!.elapsedMs += 5000;
    advance(s, 500, ['family']); expect(s.legacy!.familyTimeUnits).toBe(24000);
  });
  it('keeps the same named student across breaks, counts completion once, and records their work', () => {
    const s = working();
    advance(s, 12000, ['mentoring']); const student = structuredClone(currentStudent(s)!);
    expect(trainedStudents(s)).toHaveLength(0);
    advance(s, 6000, []); expect(currentStudent(s)).toEqual(student);
    advance(s, 11999, ['mentoring']); expect(trainedStudents(s)).toHaveLength(0);
    advance(s, 1, ['mentoring']); expect(trainedStudents(s)).toHaveLength(1);
    expect(trainedStudents(s)[0].name).toBe(student.name);
    expect(s.journal.filter(e => e.id === 'legacy:student:1:complete')).toHaveLength(1);
    advance(s, 1000, ['mentoring']); expect(currentStudent(s)!.id).toBe('student:2');
    const restored = JSON.parse(JSON.stringify(s));
    advance(s, 2000, ['mentoring']); advance(restored, 2000, ['mentoring']);
    expect(restored.legacy).toEqual(s.legacy); expect(restored.journal).toEqual(s.journal);
    expect(renderToStaticMarkup(<MentoringRecord game={s}/>)).toContain('진료 계획과 인계 과정 마침');
  });
  it('provides research mentoring and lets a retired doctor continue the same student', () => {
    const s = working(); s.career!.practice = 'research';
    advance(s, 1000, ['mentoring']); s.stageIndex = 3;
    advance(s, 23000, ['mentoring']);
    expect(trainedStudents(s)).toHaveLength(1);
    expect(renderToStaticMarkup(<MentoringRecord game={s}/>)).toContain('독립 연구 과제 마침');
  });
  it('uses the shared time budget and blocks mentoring before career or before opening a clinic', () => {
    let s = createCareerGame('availability', 42);
    expect(reduceGame(s, { type: 'lifestyle', id: 'early', key: 'mentoring', enabled: true })).toBe(s);
    s = working(); s.depth!.workload = 'extended';
    s = reduceGame(s, { type: 'lifestyle', id: 'family', key: 'family', enabled: true });
    expect(reduceGame(s, { type: 'lifestyle', id: 'too-busy', key: 'mentoring', enabled: true })).toBe(s);
    s.depth!.workload = 'balanced';
    s = reduceGame(s, { type: 'lifestyle', id: 'mentor', key: 'mentoring', enabled: true });
    expect(lifestyleSchedule(s).active).toEqual(['family', 'mentoring']);
    s.depth!.workload = 'extended'; expect(lifestyleSchedule(s).suspended).toContain('mentoring');
    s.career!.practice = 'clinic'; s.lifestyle!.enabled.mentoring = false;
    expect(reduceGame(s, { type: 'lifestyle', id: 'unopened', key: 'mentoring', enabled: true })).toBe(s);
  });
  it('accepts old switches and pending choices, restores them unchanged, and starts tracking only new time', async () => {
    let s = createCareerGame('old-legacy', 42); delete s.legacy;
    for (const key of ['family', 'mentoring'] as const) {
      delete (s.lifestyle!.enabled as Partial<NonNullable<GameState['lifestyle']>['enabled']>)[key];
      delete (s.lifestyle!.accrued as Partial<NonNullable<GameState['lifestyle']>['accrued']>)[key];
    }
    expect(validState(s)).toBe(true);
    expect(renderToStaticMarkup(<LifeGoals game={s}/>)).toContain('집계 전');
    expect(renderToStaticMarkup(<LifestylePanel game={s} busy={false} act={() => {}}/>)).toContain('가족과 시간 보내기');
    const db = await openGameDatabase('legacy-old'); await persistGame(db, s, null);
    expect((await loadGame(db))!.state).toEqual(s); db.close();
    s = reduceGame(s, { type: 'lifestyle', id: 'new-family', key: 'family', enabled: true });
    expect(validLifestyle(s.lifestyle, 0)).toBe(true);
    s.life!.elapsedMs = 12500; s.life!.paused = false;
    advance(s, 500, ['family']);
    expect(s.legacy!.sinceMs).toBe(12500); expect(familyTimeLabel(s)).toBe('12시간 (집계 시작 이후)');
  });
  it('rejects malformed time, fabricated students, incomplete switches and duplicate student identities', () => {
    const s = working(); advance(s, 25000, ['family', 'mentoring']);
    for (const mutate of [
      (x: GameState) => { x.legacy!.familyTimeUnits = -1; },
      (x: GameState) => { x.legacy!.familyTimeUnits = Infinity; },
      (x: GameState) => { x.legacy!.familyTimeUnits *= 2; },
      (x: GameState) => { x.legacy!.lastMs = x.life!.elapsedMs + 1; },
      (x: GameState) => { x.legacy!.students[0].completedMonth = 145; },
      (x: GameState) => { x.legacy!.students[1].id = 'student:1'; },
      (x: GameState) => { x.legacy!.students[1].mentoredMs = 24000; },
    ]) { const bad = structuredClone(s); mutate(bad); expect(validLegacy(bad)).toBe(false); }
    const bad = createCareerGame('bad-switch', 42);
    delete (bad.lifestyle!.accrued as Partial<NonNullable<GameState['lifestyle']>['accrued']>).family;
    expect(validState(bad)).toBe(false);
  });
  it('shows both records in the overview and keeps the public share concise', () => {
    const s = working(); advance(s, 1000, ['family', 'mentoring']);
    const html = renderToStaticMarkup(<PlayOverview game={s} busy={false} onAbilities={() => {}}>시간</PlayOverview>);
    expect(html).toContain('가족과 보낸 시간'); expect(html).toContain('발표한 논문'); expect(html).not.toContain('길러낸 제자');
    expect(resultShareData(s).text).not.toMatch(/가족과 보낸 시간|발표한 논문|길러낸 제자/);
    expect(familyTimeLabel(s)).toBe('24시간 (집계 시작 이후)');
    s.status = 'completed'; expect(renderToStaticMarkup(<MentoringRecord game={s}/>)).toContain('지도 미완료');
  });
  it('preserves both records over a full life, choices, duplicate ticks and archive restoration', async () => {
    let s = createCareerGame('legacy-life', 42);
    s = reduceGame(s, { type: 'lifestyle', id: 'family', key: 'family', enabled: true });
    s = reduceGame(s, { type: 'control', id: 'start', paused: false, speed: 16 });
    for (let i = 0; i < 8000 && s.status !== 'completed'; i++) {
      const before = structuredClone(s.legacy), e = s.pendingEvent;
      if (e) {
        const preferences = e.randomKey === 'funding' ? ['education-plan', 'pay-due', 'loan']
          : e.randomKey === 'specialty-required' ? ['untrained']
          : e.randomKey === 'practice-required' ? ['untrained', 'employed'] : ['balanced', 'continue', 'pass', 'decline'];
        const choice = preferences.find(id => e.choices.some(c => c.id === id)) ?? e.choices[0].id;
        s = reduceGame(s, { type: 'choose', id: `c:${i}`, eventId: e.id, choiceId: choice });
        expect(s.legacy).toEqual(before);
      } else {
        if (s.stageIndex >= 2 && !s.lifestyle!.enabled.mentoring) s = reduceGame(s, { type: 'lifestyle', id: `mentor:${i}`, key: 'mentoring', enabled: true });
        const action = { type: 'tick' as const, id: `t:${i}`, elapsedMs: 1000 };
        s = reduceGame(s, action); expect(reduceGame(s, action)).toEqual(s);
      }
      expect(validState(s), `invalid at ${s.life!.elapsedMs}: ${s.pendingEvent?.randomKey}`).toBe(true);
    }
    expect(s.status).toBe('completed'); expect(s.legacy!.familyTimeUnits).toBeGreaterThan(24000);
    expect(trainedStudents(s).length).toBeGreaterThan(0);
    const db = await openGameDatabase('legacy-completed'); await persistGame(db, s, null);
    expect((await loadGame(db))!.state.legacy).toEqual(s.legacy); db.close();
  });
});
