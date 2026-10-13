import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CareerPanel from '../src/CareerPanel';
import { createCareerGame, careerEvent, CAREER_TIME } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { CLUBS } from '../src/campus';
import { SPECIALTIES, INSTITUTIONS } from '../src/career';
import { explorationOptions, specialtyOptions, institutionOptions } from '../src/opportunities';
import { LIFE_STORIES, initialStories, requiredStory, advanceStories, STORY_RULES } from '../src/life-stories';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';

const choose = (s: ReturnType<typeof createCareerGame>, id: string) => reduceGame(s, { type: 'choose', id: `c:${s.revision}`, eventId: s.pendingEvent!.id, choiceId: id });
function whole(seed: number, speed: 1 | 16 = 16) {
  let s = createCareerGame('pacing', seed); s.life!.paused = false; s.life!.speed = speed;
  const keys: string[] = [];
  for (let i = 0; i < 4000 && s.status !== 'completed'; i++) {
    if (!s.pendingEvent) s = reduceGame(s, { type: 'tick', id: `t:${s.revision}`, elapsedMs: 1000 });
    else {
      const e = s.pendingEvent; keys.push(e.randomKey!);
      const id = e.randomKey === 'funding' ? e.choices.some(x => x.id === 'education-plan') ? 'education-plan' : 'loan'
        : ['specialty-required', 'practice-required'].includes(e.randomKey!) ? 'untrained'
        : e.randomKey === 'marriage-required' ? 'single'
        : e.randomKey?.startsWith('offer-') ? 'decline' : e.choices[0].id;
      s = choose(s, id);
    }
    expect(validState(s), `${s.life!.elapsedMs}:${s.pendingEvent?.randomKey}`).toBe(true);
  }
  expect(s.status).toBe('completed'); return { s, keys };
}
describe('limited opportunities and shorter pacing', () => {
  it('offers small stable pools, varies seeds, and leaves every candidate reachable', () => {
    const clubs = new Set<string>(), specs = new Set<string>(), hospitals = new Set<string>();
    const pools = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const s = createCareerGame('pool', seed); s.progress!.selectedSpecialty = 'internal';
      const e = careerEvent(s, 'club-required')!;
      expect(e.choices).toHaveLength(4); expect(e.choices.at(-1)!.id).toBe('pass');
      e.choices.slice(0, -1).forEach(x => clubs.add(x.id));
      specialtyOptions(s).forEach(x => specs.add(x.id)); institutionOptions(s).forEach(x => hospitals.add(x.id));
      expect(specialtyOptions(s)).toHaveLength(6); expect(institutionOptions(s)).toHaveLength(3);
      expect(careerEvent(structuredClone(s), 'club-required')).toEqual(e);
      pools.add(e.choices.map(x => x.id).join(','));
    }
    expect(clubs.size).toBe(CLUBS.length); expect(specs.size).toBe(SPECIALTIES.length); expect(hospitals.size).toBe(INSTITUTIONS.length); expect(pools.size).toBeGreaterThan(5);
  });
  it('blocks direct unavailable exploration and choices; UI exposes only this semester', () => {
    let s = createCareerGame('guard', 42), offered = explorationOptions(s);
    const absent = SPECIALTIES.find(x => !offered.some(y => y.id === x.id))!.id;
    expect(reduceGame(s, { type: 'explore', id: 'bad', specialtyId: absent })).toBe(s);
    s = reduceGame(s, { type: 'explore', id: 'good', specialtyId: offered[0].id });
    expect(s.career!.interest).toBe(offered[0].id); expect(explorationOptions(s)).toEqual(offered);
    expect(specialtyOptions(s).some(x => x.id === offered[0].id)).toBe(true);
    const html = renderToStaticMarkup(<CareerPanel game={s} busy={false} act={() => {}}/>);
    const section = html.slice(html.indexOf('specialty-explorer'), html.indexOf('specialty-explorer') + 2200);
    expect(section).toContain(offered[0].name); expect(section).not.toContain(`<option value="${absent}"`);
    s.life!.elapsedMs = 6000; expect(explorationOptions(s)).not.toEqual(offered);
    s.life!.elapsedMs = 0; s.pendingEvent = careerEvent(s, 'club-required');
    const unavailable = CLUBS.find(x => !s.pendingEvent!.choices.some(y => y.id === x.id))!.id;
    expect(choose(s, unavailable)).toBe(s);
  });
  it.each(['club-required', 'campus-club-kind', 'specialty-required', 'institution-required'])('restores an already-open full %s list exactly', async (key: string) => {
    let s = createCareerGame('old-pending', 42); s.progress!.selectedSpecialty = 'internal'; delete s.stories;
    s.pendingEvent = careerEvent(s, key, true); expect(s.pendingEvent!.opportunityVersion).toBeUndefined(); expect(validState(s)).toBe(true);
    const db = await openGameDatabase(`legacy-pool:${key}`);
    try { await persistGame(db, s, null); s = (await loadGame(db))!.state; const id = s.pendingEvent!.choices[0].id; expect(choose(s, id)).not.toBe(s); } finally { db.close(); }
    s.pendingEvent!.body += 'changed'; expect(validState(s)).toBe(false);
  });
  it('keeps a new limited pending decision and seed unchanged through save/restore', async () => {
    const s = createCareerGame('new-pending', 8); s.pendingEvent = careerEvent(s, 'club-required');
    const db = await openGameDatabase('new-pool');
    try { await persistGame(db, s, null); expect((await loadGame(db))!.state).toEqual(s); } finally { db.close(); }
  });
  it('gives all authored actions distinct effects/experiences and automatic delayed results once', () => {
    expect(LIFE_STORIES.filter(x => x.title)).toHaveLength(24);
    for (const story of LIFE_STORIES.filter(x => x.title)) for (const action of story.choices) {
      const s = createCareerGame('authored', 8); s.stageIndex = story.stage; s.life!.elapsedMs = [20, 100, 200, 600][story.stage] * 1000;
      s.career!.application = 'accepted'; s.career!.practice = 'employed'; s.campus!.club = 'basketball'; s.stories = initialStories();
      s.pendingEvent = careerEvent(s, `story:${story.id}`); expect(s.pendingEvent).not.toBeNull();
      const after = choose(s, action.id); expect(after.stories!.decisions[story.id].choice).toBe(action.id);
      after.life!.elapsedMs += 3000; advanceStories(after); const count = after.journal.length; advanceStories(after);
      expect(after.journal.length).toBe(count); expect(after.journal.at(-1)!.detail).toContain(action.followup);
      expect(after.stories!.decisions[story.id].followed).toBe(true);
    }
  });
  it('cuts base active time, caps decisions/repeats, and preserves the 1x/16x world', () => {
    expect((72 * CAREER_TIME.monthMs[0] + 612 * CAREER_TIME.monthMs[1]) / 60000).toBe(12.3);
    const slow = whole(42, 1), fast = whole(42, 16);
    expect(slow.keys).toEqual(fast.keys); expect(slow.s.seed).toBe(fast.s.seed); expect(slow.s.stats).toEqual(fast.s.stats); expect(slow.s.stories).toEqual(fast.s.stories);
    expect(fast.keys.length).toBeLessThan(65);
    const abilities = fast.keys.filter(k => k.startsWith('ability-')); expect(new Set(abilities).size).toBe(abilities.length);
    expect(Object.values(fast.s.progress!.counts).every(n => n <= 1)).toBe(true);
    expect(fast.keys.some(k => k.endsWith(':follow'))).toBe(false);
    expect(Object.values(fast.s.stories!.decisions).every(d => d.followed)).toBe(true);
    expect(Object.keys(fast.s.stories!.decisions)).toHaveLength(STORY_RULES.perStage.reduce<number>((a, b) => a + b, 0));
    for (let stage = 0; stage < 4; stage++) expect(Object.keys(fast.s.stories!.decisions).filter(id => LIFE_STORIES.find(x => x.id === id)!.stage === stage).length).toBe(STORY_RULES.perStage[stage]);
  }, 15000);
  it('migrates old fractional time without rejecting or replaying monthly settlement', () => {
    const old = createCareerGame('old-clock', 7); delete old.progress!.clockVersion; delete old.stories;
    old.progress!.remainder = 19000; expect(validState(old)).toBe(true);
    old.life!.paused = false;
    const next = reduceGame(old, { type: 'tick', id: 'migrate', elapsedMs: 1 });
    expect(validState(next)).toBe(true); expect(next.progress!.clockVersion).toBe(2); expect(next.life!.elapsedMs).toBe(1); expect(next.progress!.remainder).toBe(700);
    expect(next.economy).toEqual(old.economy); expect(requiredStory(next)).toBeNull();
  });
});
