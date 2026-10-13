import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { initialStories, LIFE_STORIES, requiredStory, settleStory, advanceStories, finishStories, storyEvent, validStories } from '../src/life-stories';
import { linkedStory, STORYLINE_IDS } from '../src/storyline';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import { CLUBS } from '../src/campus';

const fixture = () => { const s = createCareerGame('storyline', 42); s.stories = initialStories(); return s; };
describe('a continuing life story inside existing slots', () => {
  it.each(['lead', 'share', 'decline'])('carries %s into the next conflict, delayed result and ending', (id: string) => {
    const s = fixture(); s.campus!.club = 'band';
    const bodies: string[] = [];
    for (let stage = 0; stage < 4; stage++) {
      s.stageIndex = stage; s.life!.elapsedMs = [18, 100, 230, 600][stage] * 1000;
      const key = `story:${STORYLINE_IDS[stage]}`, event = storyEvent(s, key)!;
      expect(event.body).toContain('서연 선배'); expect(event.choices).toHaveLength(3);
      bodies.push(event.body); expect(settleStory(s, key, id)).toBe(true);
      s.life!.elapsedMs += 3000; advanceStories(s);
      expect(s.journal.at(-1)!.detail).toContain(linkedStory(s, STORYLINE_IDS[stage], LIFE_STORIES)!.choices.find(x => x.id === id)!.followup);
      const n = s.journal.length; advanceStories(s); expect(s.journal).toHaveLength(n);
      expect(validStories(s.stories, s.life!.elapsedMs / 1000)).toBe(true);
    }
    expect(bodies[1]).toContain(id === 'decline' ? '돌려준' : id === 'share' ? '답이 달라' : '전체도 확인한 줄');
    expect(bodies[2]).toContain(id === 'decline' ? '확인자에서 뺀' : id === 'share' ? '확인 날짜가 오래' : '내 이름이 남아');
    expect(bodies[3]).toContain(id === 'decline' ? '내 이름이 빠진' : id === 'share' ? '후배가 다시 고친' : '손을 뗀 뒤');
    finishStories(s); const ending = s.journal.at(-1)!;
    expect(ending.title).toBe('남긴 일과 내려놓은 일'); expect(ending.detail).toContain('대학 때'); expect(ending.detail).toContain('은퇴 뒤');
    expect(ending.detail).toContain('결혼을 택하지 않고');
    const count = s.journal.length; finishStories(s); expect(s.journal).toHaveLength(count);
  });
  it('uses the chosen club senior consistently, and establishes an anonymous peer without a club', () => {
    for (const club of CLUBS) {
      const s = fixture(); s.campus!.club = club.id;
      expect(linkedStory(s, STORYLINE_IDS[0], LIFE_STORIES)!.body).toContain(club.mentor.split(' 선배 ')[1]);
    }
    const s = fixture(); expect(linkedStory(s, STORYLINE_IDS[0], LIFE_STORIES)!.body).toContain('같은 조였던 동기');
    s.stories!.decisions['shared-notebook'] = { choice: 'decline', month: 18, followed: true };
    expect(linkedStory(s, STORYLINE_IDS[1], LIFE_STORIES)!.body).toContain('같은 조였던 동기');
  });
  it.each(['accepted', 'rejected', 'untrained'] as const)('keeps the %s career and single ending grounded', (application: 'accepted' | 'rejected' | 'untrained') => {
    const s = fixture(); s.stageIndex = 1; s.career!.application = application; s.career!.specialty = application === 'accepted' ? 'emergency' : null;
    s.stories!.decisions['shared-notebook'] = { choice: 'lead', month: 18, followed: true };
    const body = linkedStory(s, STORYLINE_IDS[1], LIFE_STORIES)!.body;
    expect(body).toContain(application === 'accepted' ? '응급의학과' : application === 'rejected' ? '탈락한 뒤' : '수련을 택하지 않고');
    if (application !== 'accepted') expect(body).not.toContain('에서 배운 인계');
    finishStories(s); expect(s.journal.at(-1)!.detail).toContain(application === 'accepted' ? '응급의학과 수련을 거친' : application === 'rejected' ? '탈락한 뒤' : '수련을 택하지 않은');
  });
  it('connects research and the actual partner without inventing a spouse on the single path', () => {
    const s = fixture(); s.career!.practice = 'research';
    expect(linkedStory(s, STORYLINE_IDS[1], LIFE_STORIES)!.body).toContain('연구하며 남긴 자료');
    expect(linkedStory(s, STORYLINE_IDS[2], LIFE_STORIES)!.body).toContain('내 시간');
    expect(linkedStory(s, STORYLINE_IDS[2], LIFE_STORIES)!.body).not.toContain('배우자');
    s.family!.status = 'dating'; s.family!.partner = { id: 'actual', name: '한결', temperament: '', occupation: '' };
    expect(linkedStory(s, STORYLINE_IDS[2], LIFE_STORIES)!.body).toContain('한결과');
  });
  it('remembers successful reapplication and uses retirement time rather than work hours', () => {
    const s = fixture(); s.career!.application = 'accepted'; s.career!.specialty = 'ent'; s.career!.attempts = 2;
    expect(linkedStory(s, STORYLINE_IDS[1], LIFE_STORIES)!.body).toContain('재지원 끝에');
    s.stageIndex = 3; const body = linkedStory(s, STORYLINE_IDS[3], LIFE_STORIES)!.body;
    expect(body).toContain('새로 생긴 시간'); expect(body).not.toContain('퇴근');
    s.stories!.decisions['shared-notebook'] = { choice: 'decline', month: 18, followed: true };
    finishStories(s); expect(s.journal.at(-1)!.detail).toContain('재지원 끝에 이비인후과');
  });
  it('uses a real earlier standalone decision when resuming partway through life', () => {
    const s = fixture(); s.stageIndex = 1; s.stories!.decisions['practice-note'] = { choice: 'limit', month: 36, followed: true };
    delete s.progress!.pacingVersion;
    const body = linkedStory(s, STORYLINE_IDS[1], LIFE_STORIES)!.body;
    expect(body).toContain('일지에서 빠진 한 문장'); expect(body).toContain('기억나지 않는다고 말하'); expect(body).not.toContain('예전에 돌려준');
    s.life!.elapsedMs = 100_000; expect(requiredStory(s)).toBe('story:notebook-return');
  });
  it('restores an old open story exactly and enables the thread only after it is resolved', async () => {
    let s = fixture(); delete s.stories!.narrativeVersion; s.life!.elapsedMs = 18_000;
    s.pendingEvent = careerEvent(s, 'story:group-chat'); const original = structuredClone(s.pendingEvent);
    expect(validState(s)).toBe(true);
    const db = await openGameDatabase('old-storyline');
    try { await persistGame(db, s, null); s = (await loadGame(db))!.state; expect(s.pendingEvent).toEqual(original); }
    finally { db.close(); }
    s = reduceGame(s, { type: 'choose', id: 'old:choose', eventId: s.pendingEvent!.id, choiceId: 'own' });
    expect(validState(s)).toBe(true); expect(s.stories!.narrativeVersion).toBe(1);
    expect(s.stories!.decisions['group-chat'].choice).toBe('own');
  });
  it('restores a contextual pending event, rejects tampering and does not draw a new candidate', async () => {
    let s = fixture(); s.campus!.club = 'band'; s.life!.elapsedMs = 18_000; s.pendingEvent = careerEvent(s, 'story:shared-notebook');
    expect(validState(s)).toBe(true); const original = structuredClone(s);
    const db = await openGameDatabase('new-storyline');
    try { await persistGame(db, s, null); s = (await loadGame(db))!.state; expect(s).toEqual(original); }
    finally { db.close(); }
    const tampered = structuredClone(s); tampered.pendingEvent!.body += 'changed'; expect(validState(tampered)).toBe(false);
    const result = reduceGame(s, { type: 'choose', id: 'new:choose', eventId: s.pendingEvent!.id, choiceId: 'decline' });
    expect(result.stories!.decisions['shared-notebook'].choice).toBe('decline'); expect(validState(result)).toBe(true);
  });
  it('preserves the exact earlier retirement pending text after an editorial update', async () => {
    let s = fixture(); s.stageIndex = 3; s.life!.elapsedMs = 600_000; s.campus!.club = 'band';
    s.pendingEvent = careerEvent(s, 'story:notebook-ending', false, true);
    expect(s.pendingEvent!.body).toContain('퇴근 뒤'); expect(validState(s)).toBe(true);
    const original = structuredClone(s.pendingEvent), db = await openGameDatabase('editorial-storyline');
    try { await persistGame(db, s, null); s = (await loadGame(db))!.state; expect(s.pendingEvent).toEqual(original); }
    finally { db.close(); }
    const bad = structuredClone(s); bad.pendingEvent!.body += 'changed'; expect(validState(bad)).toBe(false);
    s = reduceGame(s, { type: 'choose', id: 'editorial:choose', eventId: s.pendingEvent!.id, choiceId: 'decline' });
    expect(s.stories!.decisions['notebook-ending'].choice).toBe('decline'); expect(validState(s)).toBe(true);
  });
});
