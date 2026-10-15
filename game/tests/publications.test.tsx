import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { accruePublications, initialPublications, publicationRate, validPublications } from '../src/publications';
import { validState, openGameDatabase, persistGame, loadGame } from '../src/storage';
import { resultShareData } from '../src/result-share';
import LifeGoals from '../src/LifeGoals';
import type { GameState } from '../src/contracts';

function researcher() {
  const s = createCareerGame('papers', 42); s.progress!.focus = 'research'; s.life!.paused = false;
  s.abilities!.values.research = 50; return s;
}
function advance(s: GameState, ms: number, activities: string[] = []) {
  accruePublications(s, ms, activities); s.life!.elapsedMs += ms; expect(validPublications(s)).toBe(true);
}
describe('published papers as a lifetime record', () => {
  it('counts only finished papers and carries actual partial-month research across breaks', () => {
    const s = researcher(); advance(s, 11999);
    expect(s.publications!.papers).toHaveLength(0);
    expect(resultShareData(s).text).toContain('발표한 논문 0편');
    s.progress!.focus = 'rest'; const before = s.publications!.effortUnits;
    advance(s, 3000); expect(s.publications!.effortUnits).toBe(before);
    s.progress!.focus = 'research'; advance(s, 1);
    expect(s.publications!.papers).toHaveLength(1); expect(s.publications!.current).toBeNull();
    advance(s, 1000); expect(s.publications!.current).not.toBeNull();
    const restored = JSON.parse(JSON.stringify(s)); advance(s, 11000); advance(restored, 11000);
    expect(restored.publications).toEqual(s.publications); expect(s.publications!.papers).toHaveLength(2);
    expect(s.journal.filter(e => e.title === '논문 발표')).toHaveLength(2);
    expect(resultShareData(s).text).toContain('발표한 논문 2편');
  });
  it('rewards skill, actual research time, a research job and active academic work', () => {
    const s = researcher(); expect(publicationRate(s, [])).toBe(1000);
    s.abilities!.values.research = 100; expect(publicationRate(s, [])).toBe(1500);
    s.stageIndex = 2; s.career!.practice = 'research'; expect(publicationRate(s, ['research'])).toBe(3000);
    s.journey!.decisions['academic-entry'] = { choice:'apply',month:150,followed:true };
    s.journey!.decisions['review:0:0'] = { choice:'promote',month:174,followed:true };
    expect(publicationRate(s, ['research'])).toBe(3750);
    s.journey!.decisions['academic:1:research'] = { choice:'leave',month:180,followed:true };
    expect(publicationRate(s, ['research'])).toBe(3000);
    s.stageIndex = 3; expect(publicationRate(s, ['research'])).toBe(2250);
    s.progress!.focus = 'rest'; expect(publicationRate(s, [])).toBe(0);
  });
  it('never rewards duplicate time, pauses, pending decisions or old untracked history', () => {
    const s = researcher(); accruePublications(s, 500, []); const once = structuredClone(s.publications);
    accruePublications(s, 500, []); expect(s.publications).toEqual(once); s.life!.elapsedMs += 500;
    s.life!.paused = true; accruePublications(s, 1000, []); expect(s.publications).toEqual(once);
    s.life!.paused = false; delete s.publications; s.life!.elapsedMs = 50000;
    advance(s, 1000); expect(s.publications!.sinceMs).toBe(50000); expect(s.publications!.effortUnits).toBe(1000000);
    s.status = 'completed'; const complete = structuredClone(s.publications);
    accruePublications(s, 1000, []); expect(s.publications).toEqual(complete);
  });
  it('rejects inflated totals, duplicated papers, invalid timelines and malformed current projects', () => {
    const s = researcher(); advance(s, 25000);
    for (const mutate of [
      (x: GameState) => { x.publications!.effortUnits = Infinity; },
      (x: GameState) => { x.publications!.effortUnits *= 20; },
      (x: GameState) => { x.publications!.papers[1].id = 'paper:1'; },
      (x: GameState) => { x.publications!.papers[0].publishedMonth = 9999; },
      (x: GameState) => { x.publications!.current = null; },
      (x: GameState) => { x.publications!.lastMs++; },
    ]) { const bad = structuredClone(s); mutate(bad); expect(validPublications(bad)).toBe(false); }
  });
  it('keeps old saves and student history without converting them into papers', async () => {
    const s = createCareerGame('old-papers', 42); delete s.publications;
    expect(validState(s)).toBe(true); const old = structuredClone(s);
    expect(renderToStaticMarkup(<LifeGoals game={s}/>)).toContain('집계 전');
    expect(resultShareData(s).text).toContain('발표한 논문 집계 전');
    expect(resultShareData(s).text).not.toContain('길러낸 제자');
    const db = await openGameDatabase('publication-old'); await persistGame(db, s, null);
    expect((await loadGame(db))!.state).toEqual(old); db.close();
  });
  it('preserves the same research progression at 1x/16x and restores pending choices', async () => {
    function play(speed: 1 | 16) {
      let s = researcher(); s.life!.speed = speed;
      for (let i = 0; i < 1000 && s.life!.elapsedMs < 6000; i++) {
        if (s.pendingEvent) s = reduceGame(s, { type:'choose',id:`c:${s.revision}`,eventId:s.pendingEvent.id,choiceId:s.pendingEvent.choices[0].id });
        else s = reduceGame(s, { type:'tick',id:`t:${s.revision}`,elapsedMs:1000 });
        expect(validState(s)).toBe(true);
      }
      return s;
    }
    const slow = play(1), fast = play(16); expect(slow.publications).toEqual(fast.publications);
    const before = structuredClone(slow.publications);
    expect(slow.pendingEvent).not.toBeNull(); expect(reduceGame(slow, { type:'tick',id:'pending',elapsedMs:1000 }).publications).toEqual(before);
    const db = await openGameDatabase('publication-pending'); await persistGame(db, slow, null);
    expect((await loadGame(db))!.state.publications).toEqual(before); db.close();
  });
});
