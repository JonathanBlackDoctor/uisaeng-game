import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { allowRoutineChoice, careerMonthMs } from '../src/pacing';
import { incidentDepth } from '../src/career-depth';
import { ALL_MAJOR_EVENTS } from '../src/major-event-catalog';
import { advanceIncidents, eligibleIncidents, initialIncidents, openIncident, requiredIncident, settleIncident } from '../src/major-events';
import { reduceGame } from '../src/engine';
import { nextRandom } from '../src/random-life';
import { loadGame, openGameDatabase, persistGame, validState } from '../src/storage';
import { JournalHistory, logEmphasis, recentPlayLog } from '../src/PlayLog';
import type { JournalEntry } from '../src/contracts';
import { clinicScenario } from './helpers/clinic-scenario';

describe('fewer interruptions without cutting connected stories', () => {
  it('preserves clock speeds and lets relationship and story choices through the routine budget', () => {
    const s = createCareerGame('compact', 42); s.progress!.runLength = 'short';
    expect(careerMonthMs(s)).toBe(3900); s.stageIndex = 2; expect(careerMonthMs(s)).toBe(2000);
    s.progress!.counts.friend = 1;
    for (const key of ['friend', 'rest', 'home', 'friend-request', 'retirement-hobby']) expect(allowRoutineChoice(s, key)).toBe(false);
    for (const key of ['offer-campus', 'offer-blind-date', 'offer-gwating', 'ask-introduction', 'acquaintance', 'cc-life', 'relationship', 'marriage', 'parenthood', 'care', 'child-growth', 'relocation', 'story:peer-retirement', 'journey:legacy']) expect(allowRoutineChoice(s, key), key).toBe(true);
    s.progress!.runLength = 'standard'; expect(allowRoutineChoice(s, 'home')).toBe(true); expect(careerMonthMs(s)).toBe(4000);
  });

  it('caps new background clinical encounters but keeps an already-open second encounter playable', async () => {
    const s = clinicScenario(); s.progress!.runLength = 'short';
    s.depth!.decisions['depth-incident:review:150'] = { choice: 'team', month: 150, followed: true };
    expect(incidentDepth(s)).toBeNull();
    s.pendingEvent = careerEvent(s, 'depth-incident:review:160');
    expect(validState(s)).toBe(true);
    const db = await openGameDatabase(`compact-depth-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      const restored = (await loadGame(db))!.state;
      expect(restored.pendingEvent).toEqual(s.pendingEvent);
      const next = reduceGame(restored, { type: 'choose', id: 'finish-existing', eventId: restored.pendingEvent!.id, choiceId: restored.pendingEvent!.choices[0].id });
      expect(next.depth!.decisions['depth-incident:review:160']).toBeDefined();
      expect(validState(next)).toBe(true);
    } finally { db.close(); }
  });

  it('continues an old medical case beyond the new cap through its negotiation and outcome', async () => {
    const s = clinicScenario(); s.progress!.runLength = 'short';
    s.incidents = initialIncidents(42, 160);
    const ids = eligibleIncidents(s, 'medical').slice(0, 3).map(e => e.id);
    expect(ids).toHaveLength(3);
    s.incidents.seen = ids.slice(0, 2);
    s.incidents.history = ids.slice(0, 2).map(id => ({ id, opened: 160, closed: 160, filed: false, outcome: '소송 전 종결' }));
    expect(openIncident(s, ids[2])).toBe(true);
    expect(settleIncident(s, requiredIncident(s)!, 'supported')).toBe(true);
    s.incidents.seed = Array.from({ length: 100 }, (_, seed) => seed).find(seed => nextRandom(seed).value < .5)!;
    for (let m = 161; m <= 163; m++) { s.life!.elapsedMs = m * 1000; advanceIncidents(s); }
    expect(s.incidents.active!.phase).toBe('negotiation');
    s.pendingEvent = careerEvent(s, requiredIncident(s)!);
    const db = await openGameDatabase(`compact-incident-${crypto.randomUUID()}`);
    try {
      await persistGame(db, s, null);
      const restored = (await loadGame(db))!.state;
      expect(restored).toEqual(s);
      const next = reduceGame(restored, { type: 'choose', id: 'resolve-old-case', eventId: restored.pendingEvent!.id, choiceId: 'settle' });
      expect(next.incidents!.active).toBeNull();
      expect(next.incidents!.history.some(h => h.id === ids[2])).toBe(true);
      expect(validState(next)).toBe(true);
      for (let m = 164; m <= 205; m++) { next.life!.elapsedMs = m * 1000; advanceIncidents(next); const key = requiredIncident(next); if (key) settleIncident(next, key, 'first'); }
      expect(next.journal.some(e => e.id.startsWith(`impact:${ids[2]}:`) && e.id.endsWith(':end'))).toBe(true);
      expect(next.incidents!.seen.filter(id => ALL_MAJOR_EVENTS.find(e => e.id === id)?.pool === 'medical')).toHaveLength(3);
    } finally { db.close(); }
  });

  it('moves repeated reports to history while keeping story follow-ups, warnings and the latest burden readable', () => {
    const entry = (id: string, detail: string): JournalEntry => ({ id, title: id, detail, stage: 'career', effects: {} });
    const entries = [
      entry('auto:story:peer-offer:follow', '동료와 정한 약속의 결과'),
      entry('auto:journey:recap', '전문 분야의 결말'),
      entry('impact:diagnosis:160:163:health', '이전 생활 부담'),
      entry('auto:money:164', '정기 수입'),
      entry('impact:diagnosis:160:166:health', '최근 수입 공백과 남은 기간'),
      entry('auto:lifestyle:167', '꾸준히 보낸 시간이 생활에 남았습니다.'),
      entry('depth-load:168', '추가 업무의 정기 보고'),
      entry('auto:career:168', '정기 업무 보고'),
      entry('auto:lifestyle:169', '유료 교육은 비용이 부족해 쉬었습니다.'),
      { ...entry('auto:lifestyle:170', '큰 건강 변화'), effects: { health: -20 } },
    ];
    const snapshot = structuredClone(entries);
    const recent = recentPlayLog(entries, true).flat();
    for (const index of [0, 1, 4, 8, 9]) expect(recent).toContain(entries[index]);
    for (const index of [2, 3, 5, 6, 7]) expect(recent).not.toContain(entries[index]);
    expect(logEmphasis(entries[7])).toBe('milestone');
    const html = renderToStaticMarkup(<JournalHistory entries={entries} compact/>);
    for (const e of entries.filter((_, index) => index !== 2)) expect(html).toContain(e.detail);
    expect(html).not.toContain('이전 생활 부담');
    expect(html).toContain('일상 기록'); expect(entries).toEqual(snapshot);
  });
});
