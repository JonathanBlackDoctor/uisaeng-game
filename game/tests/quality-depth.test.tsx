import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { initialStories, upgradeStoryPeople, advanceStories, requiredStory, settleStory, finishStories, STORY_RULES } from '../src/life-stories';
import { peerStory, PEER_IDS, peerOccupation } from '../src/relationships';
import { SPECIALTIES } from '../src/career';
import { SPECIALTY_DEPTH } from '../src/specialty-depth';
import { specialtyChapter } from '../src/specialty-chapters';
import { reduceGame } from '../src/engine';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import { choiceResult } from '../src/choice-feedback';
import ChoiceFeedback from '../src/ChoiceFeedback';

function fixture(seed = 42) { const s = createCareerGame('quality', seed); s.stories = initialStories(); upgradeStoryPeople(s); return s; }
function at(s: ReturnType<typeof fixture>, stage: number) { s.stageIndex = stage; s.life!.elapsedMs = [36, 108, 312, 624][stage] * 1000; return s; }
function choose(s: ReturnType<typeof fixture>, id: string) { return reduceGame(s, { type: 'choose', id: `choose:${s.revision}`, eventId: s.pendingEvent!.id, choiceId: id }); }
describe('choices, people and specialty consequences', () => {
  it.each(['team', 'meet', 'later'])('the earlier %s decision actually changes a later opportunity', async (earlier: string) => {
    let s = fixture(); const who = s.stories!.peer!.person.name;
    at(s, 0); s.pendingEvent = careerEvent(s, 'story:peer-seat'); s = choose(s, 'share');
    at(s, 1); s.pendingEvent = careerEvent(s, 'story:peer-distance'); s = choose(s, earlier);
    at(s, 2); s.pendingEvent = careerEvent(s, 'story:peer-offer');
    expect(s.pendingEvent!.body).toContain(who);
    expect(s.pendingEvent!.choices.some(x => x.id === 'join')).toBe(earlier === 'team');
    expect(s.pendingEvent!.choices.some(x => x.id === 'visit')).toBe(earlier !== 'team');
    expect(validState(s)).toBe(true);
    const db = await openGameDatabase(`quality-${earlier}`);
    try { await persistGame(db, s, null); expect((await loadGame(db))!.state).toEqual(s); }
    finally { db.close(); }
    const absent = earlier === 'team' ? 'visit' : 'join'; expect(choose(s, absent)).toBe(s);
    const result = choose(s, earlier === 'team' ? 'join' : 'visit'); expect(validState(result)).toBe(true);
    const before = result.journal.length; result.life!.elapsedMs += 3000; advanceStories(result);
    expect(result.journal.length).toBeGreaterThan(before);
    const done = structuredClone(result); advanceStories(result); expect(result).toEqual(done);
    at(result, 3); result.pendingEvent = careerEvent(result, 'story:peer-retirement'); s = choose(result, 'letter');
    finishStories(s); expect(s.journal.find(x => x.id === 'auto:peer:recap')!.detail).toContain(who);
  });
  it('people have stable identities, different careers and changing occupations', () => {
    const routes = new Set<string>();
    for (let seed = 0; seed < 18; seed++) {
      const s = fixture(seed); routes.add(s.stories!.peer!.route);
      const original = structuredClone(s.stories!.peer); upgradeStoryPeople(s); expect(s.stories!.peer).toEqual(original);
      expect(peerOccupation(s)).toBe('같은 조 동기'); at(s, 1); expect(peerOccupation(s)).not.toBe('같은 조 동기');
      expect(peerStory(s, 'peer-distance')!.body).toContain(original!.person.name);
    }
    expect(routes.size).toBe(3);
  });
  it('keeps old open decisions exact and gives new people only after choosing', () => {
    let s = createCareerGame('old', 42); s.stories = initialStories(); s.life!.elapsedMs = 18_000;
    s.pendingEvent = careerEvent(s, 'story:shared-notebook'); const pending = structuredClone(s.pendingEvent);
    upgradeStoryPeople(s); expect(s.stories.peer).toBeUndefined(); expect(s.pendingEvent).toEqual(pending);
    s = choose(s, 'decline'); expect(s.stories!.peer).toBeDefined(); expect(validState(s)).toBe(true);
    const bad = structuredClone(s); bad.stories!.peer!.route = 'invented' as never; expect(validState(bad)).toBe(false);
  });
  it.each(SPECIALTIES.map(x => x.id))('%s has its own conflict and a choice unlocked by an actual training decision', (specialty: string) => {
    let s = at(fixture(), 2); Object.assign(s.career!, { specialty, application: 'accepted', institution: 'snuh', practice: 'employed', attempts: 1 });
    const key = `story:specialty-${specialty}`;
    expect(specialtyChapter(s, `specialty-${specialty}`)!.choices).toHaveLength(3);
    s.depth!.decisions['depth-training'] = { choice: SPECIALTY_DEPTH[specialty].training.choices[1].id, month: 78, followed: true };
    const episode = specialtyChapter(s, `specialty-${specialty}`)!;
    expect(episode.choices).toHaveLength(4); expect(episode.choices[2].description).toContain(SPECIALTY_DEPTH[specialty].training.choices[1].label);
    s.pendingEvent = careerEvent(s, key); expect(validState(s)).toBe(true);
    s = choose(s, 'practiced'); expect(s.stories!.decisions[`specialty-${specialty}`].choice).toBe('practiced'); expect(validState(s)).toBe(true);
    s.life!.elapsedMs += 3000; advanceStories(s);
    expect(s.journal.find(x => x.id === `auto:story:specialty-${specialty}:follow`)!.detail).toContain(SPECIALTY_DEPTH[specialty].training.choices[1].label);
  });
  it('replaces existing slots and leaves nine scheduled story decisions per life', () => {
    const s = fixture();
    for (let stage = 0; stage < 4; stage++) {
      at(s, stage); s.stories!.decisions[['shared-notebook', 'notebook-return', 'notebook-handover', 'notebook-ending'][stage]] = { choice: 'decline', month: s.life!.elapsedMs / 1000 - STORY_RULES.spacing[stage] - 1, followed: true };
      expect(requiredStory(s)).toBe(`story:${PEER_IDS[stage]}`);
      expect(settleStory(s, `story:${PEER_IDS[stage]}`, peerStory(s, PEER_IDS[stage])!.choices[0].id)).toBe(true);
    }
    expect(Object.keys(s.stories!.decisions)).toHaveLength(8);
  });
  it('reports actual clamped changes and the resolved outcome, without claiming unearned points', () => {
    const s = fixture(); s.stats.health = 99; at(s, 0); s.pendingEvent = careerEvent(s, 'story:peer-seat');
    const next = choose(s, 'rest'), result = choiceResult(s, next, 'choose:0')!;
    expect(result.changes).toContain('건강 +1'); expect(result.changes).not.toContain('건강 +3');
    expect(result.detail).toContain('오늘 남아');
    expect(choiceResult(s, s, 'ignored')).toBeNull();
    expect(renderToStaticMarkup(<ChoiceFeedback result={result} onClose={() => {}}/>)).toContain('선택 결과 닫기');
  });
});
