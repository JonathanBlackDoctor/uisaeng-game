import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { createRandomGame, randomEvent, RANDOM_EVENTS } from '../src/random-life';
import { reduceGame } from '../src/engine';
import type { GameState, EventChoice } from '../src/contracts';
import { ABILITIES, ABILITY_SITUATIONS } from '../src/abilities';
import { LIFE_STORIES, storyEvent } from '../src/life-stories';
import { SPECIALTY_DEPTH } from '../src/specialty-depth';
import { SPECIALTIES } from '../src/career';
import { archives, loadGame, openGameDatabase, persistGame, validState } from '../src/storage';

const tick = (s: GameState, ms = 1000) => reduceGame(s, { type: 'tick', id: `tick:${s.revision}`, elapsedMs: ms });
const choose = (s: GameState, id: string) => reduceGame(s, { type: 'choose', id: `choose:${s.revision}`, eventId: s.pendingEvent!.id, choiceId: id });
const at = (month: number) => {
  const s = createCareerGame('events', 42);
  s.life!.elapsedMs = month * 1000; s.life!.paused = false;
  s.progress!.club = 'declined';
  return s;
};
describe('meaningful event decisions', () => {
  it('applies scholarships once without stopping play or rerolling after restore', async () => {
    const before = at(6);
    const after = tick(before, 1);
    expect(after.pendingEvent).toBeNull();
    expect(after.progress!.resolved).toContain('scholarship-required');
    expect(after.journal.filter(x => x.id === 'auto:scholarship')).toHaveLength(1);
    const db = await openGameDatabase(`event-design-${crypto.randomUUID()}`);
    try {
      await persistGame(db, after, null);
      const restored = (await loadGame(db))!.state;
      expect(restored).toEqual(after);
      const next = tick(restored, 1);
      expect(next.seed).toBe(after.seed);
      expect(next.journal.filter(x => x.id === 'auto:scholarship')).toHaveLength(1);
      expect((await archives(db))).toHaveLength(0);
    } finally { db.close(); }
  });
  it('uses free support before debt and asks only about the remaining shortage', () => {
    const s = at(0); s.economy!.cash = s.economy!.assets = 0; s.economy!.due = 3_000_000;
    const after = tick(s, 1);
    expect(after.pendingEvent?.randomKey).toBe('funding');
    expect(after.pendingEvent!.choices.map(c => c.id)).not.toContain('grant');
    expect(after.economy!.ledger.filter(t => t.kind === 'grant')).toHaveLength(1);
    expect(after.economy!.debt).toBe(0);
    const covered = structuredClone(s); covered.economy!.due = 100_000;
    const paid = tick(covered, 1);
    expect(paid.pendingEvent).toBeNull(); expect(paid.economy!.due).toBe(0);
    expect(paid.economy!.debt).toBe(0);
  });
  it('does not generate simple confirmation events on a full career run', () => {
    let s = at(0); s.life!.speed = 8;
    const keys: string[] = [];
    for (let n = 0; n < 6000 && s.status === 'active'; n++) {
      if (s.pendingEvent) {
        const e = s.pendingEvent; keys.push(e.randomKey!);
        const preferred = e.randomKey === 'club-required' ? 'pass' : e.randomKey === 'funding' ? 'education-plan'
          : e.randomKey === 'specialty-required' ? 'untrained' : e.randomKey === 'practice-required' ? 'untrained'
          : e.randomKey === 'marriage-required' ? 'single' : e.randomKey?.startsWith('offer-') ? 'decline' : e.choices[0].id;
        s = choose(s, e.choices.some(c => c.id === preferred) ? preferred : e.choices[0].id);
      } else s = tick(s);
      expect(validState(s), `month ${s.life!.elapsedMs / 1000}, ${s.pendingEvent?.randomKey}`).toBe(true);
    }
    expect(s.status).toBe('completed');
    expect(keys).not.toEqual(expect.arrayContaining(['scholarship-required']));
    expect(keys).not.toContain('stage-end');
    expect(s.journal.filter(x => x.id.startsWith('auto:stage:'))).toHaveLength(4);
  });
  it.each(ABILITY_SITUATIONS.map(e => e.key))('%s distinguishes practice from help and recovery', (key: string) => {
    const s = at(key === 'ability-practice' || key === 'ability-technique' ? 42 : 0);
    if (key === 'ability-technique') { s.stageIndex = 1; s.career!.application = 'accepted'; s.career!.specialty = 'surgery'; }
    s.progress!.focus = key === 'ability-research' ? 'research' : key === 'ability-practice' ? 'clinical' : 'work';
    s.stats = { health: 60, happiness: 60, knowledge: 60, relationships: 60 };
    for (const { id } of ABILITIES) s.abilities!.values[id] = 70;
    s.abilities!.seed = 1; // Identical, successful draw for every approach.
    s.pendingEvent = careerEvent(s, key);
    expect(s.pendingEvent).not.toBeNull();
    const direct = choose(s, 'attempt'), help = choose(s, 'supported'), advanced = choose(s, 'advanced');
    const situation = ABILITY_SITUATIONS.find(e => e.key === key)!;
    const practiced = (x: GameState) => situation.skills.reduce((n, id) => n + x.abilities!.values[id], 0);
    expect(practiced(direct)).toBeGreaterThan(practiced(advanced));
    expect(practiced(advanced)).toBeGreaterThan(practiced(help));
    expect(help.stats.health).toBeGreaterThan(advanced.stats.health);
    expect(advanced.stats.health).toBeGreaterThan(direct.stats.health);
  });
  it('keeps old pending choices exact and rejects forged new effects', () => {
    const s = at(1); s.progress!.club = 'pending';
    s.pendingEvent = careerEvent(s, 'club-required', false, false, true);
    expect(s.pendingEvent!.choiceVersion).toBeUndefined(); expect(validState(s)).toBe(true);
    const next = choose(s, s.pendingEvent!.choices[0].id);
    expect(next.stats.knowledge).toBe(s.stats.knowledge);
    const current = at(1); current.progress!.club = 'pending'; current.pendingEvent = careerEvent(current, 'club-required');
    expect(validState(current)).toBe(true);
    current.pendingEvent!.choices[0].effects.health = 99;
    expect(validState(current)).toBe(false);
  });
  it('records random-path support and stage changes without confirmation prompts', () => {
    let seed = 0;
    while (createRandomGame('random-events', seed).life!.background.finances !== 'tight') seed++;
    let s = createRandomGame('random-events', seed); s.life!.paused = false; s.life!.speed = 8;
    for (let n = 0; n < 1500 && s.status === 'active'; n++) {
      expect(['milestone', 'study-cost']).not.toContain(s.pendingEvent?.randomKey);
      s = s.pendingEvent ? choose(s, s.pendingEvent.choices[0].id) : tick(s);
      expect(validState(s), `month ${s.life!.elapsedMs / 1000}, ${s.pendingEvent?.randomKey}`).toBe(true);
    }
    expect(s.status).toBe('completed');
    expect(s.journal.some(x => x.id.startsWith('auto:study-support:'))).toBe(true);
  });
});

// A numeric audit is only a warning signal. Identity/relationship preferences,
// different follow-up paths, cash costs and experience are inspected separately.
it('audits authored numeric options', () => {
  const findings: string[] = [];
  const audit = (key: string, choices: Pick<EventChoice, 'id' | 'effects'>[], extra: (id: string) => number[] = () => []) => {
    const vector = (c: Pick<EventChoice, 'id' | 'effects'>) => [...(['health','happiness','knowledge','relationships'] as const).map(k => c.effects[k] ?? 0), ...extra(c.id)];
    for (const a of choices) for (const b of choices) {
      if (a === b) continue;
      const x = vector(a), y = vector(b);
      if (x.every((n, i) => n >= y[i]) && x.some((n, i) => n > y[i])) findings.push(`${key}: ${a.id} > ${b.id}`);
    }
  };
  for (const story of LIFE_STORIES) {
    const s = at([36, 100, 200, 600][story.stage]); s.stageIndex = story.stage;
    s.career!.application = 'accepted'; s.career!.specialty = 'internal'; s.career!.practice = 'employed'; s.campus!.club = 'band';
    const e = careerEvent(s, `story:${story.id}`), raw = storyEvent(s, `story:${story.id}`);
    if (!e || !raw) continue;
    audit(`story:${story.id}`, e.choices, id => ['study','research','clinical','people'].map(k => story.choices.find(c => c.id === id)?.experience === k ? 4 : 0));
  }
  for (const spec of SPECIALTIES) for (const part of ['training','work'] as const) {
    const episode = SPECIALTY_DEPTH[spec.id][part];
    audit(episode.id, episode.choices, id => { const c = episode.choices.find(c => c.id === id)!; return [c.skill, c.safety, c.cash ?? 0]; });
  }
  for (const def of RANDOM_EVENTS) {
    if (['acquaintance','marriage','parenthood','ask-introduction','study-cost'].includes(def.key) || def.key.startsWith('offer-')) continue;
    const e = randomEvent(at(0), def.key); if (e) audit(def.key, e.choices);
  }
  expect(findings).toEqual([]);
});
