import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { MAJOR_EVENTS } from '../src/major-event-catalog';
import { advanceIncidents, eligibleIncidents, incidentEvent, initialIncidents, medicalProfile, openIncident, requiredIncident, settleIncident, validIncidents } from '../src/major-events';
import { SPECIALTIES } from '../src/career';
import { validEconomy } from '../src/economy';
import { validPortfolio } from '../src/portfolio';
import { validState, openGameDatabase, persistGame, loadGame } from '../src/storage';
import { financeView } from '../src/finance-view';
import PlayOverview from '../src/PlayOverview';
import { measureRun } from './helpers/pacing';
import { JournalHistory, logEmphasis, groupPlayLog } from '../src/PlayLog';
import { settleEncounters } from '../src/life-goals';

function clinical(specialty = 'internal', role: 'employed' | 'clinic' | 'research' = 'employed', seed = 42) {
  const s = createCareerGame('incident-test', seed);
  s.stageIndex = 2; s.life!.elapsedMs = 180_000;
  s.career = { ...s.career!, application: 'accepted', specialty, institution: 'snuh', attempts: 1, practice: role };
  s.economy!.income = 6_000_000;
  if (role === 'clinic') s.economy!.ledger.push({ id: 'test-clinic', month: 145, label: '개원', cashDelta: 0, debtDelta: 0, kind: 'open-clinic' });
  s.incidents = initialIncidents(seed, 180);
  return s;
}
const respond = (s: ReturnType<typeof clinical>, choice: string) => settleIncident(s, requiredIncident(s)!, choice);
function month(s: ReturnType<typeof clinical>, m: number) { s.life!.elapsedMs = m * 1000; s.economy!.income = 6_000_000; advanceIncidents(s); }

describe('major incidents', () => {
  it('ships 50 unique scenes with 18 medical, 28 life and 4 rare', () => {
    expect(MAJOR_EVENTS).toHaveLength(50);
    expect(new Set(MAJOR_EVENTS.map(d => d.id)).size).toBe(50);
    expect(['medical', 'life', 'rare'].map(p => MAJOR_EVENTS.filter(d => d.pool === p).length)).toEqual([18, 28, 4]);
  });
  it('gates medical claims on real practice and every specialty has a defined profile', () => {
    const s = clinical();
    for (const specialty of SPECIALTIES) { s.career!.specialty = specialty.id; expect(medicalProfile(s)?.specialty).toBe(specialty.id); expect(eligibleIncidents(s, 'medical').length).toBeGreaterThan(1); }
    s.career!.practice = 'research'; expect(eligibleIncidents(s, 'medical')).toEqual([]);
    s.career!.practice = 'employed'; s.stageIndex = 3; expect(medicalProfile(s)).toBeNull();
    s.stageIndex = 0; expect(medicalProfile(s)).toBeNull();
    s.stageIndex = 2; s.career!.practice = 'clinic'; expect(medicalProfile(s)).toBeNull();
    expect(eligibleIncidents(clinical('pathology'), 'medical').map(d => d.id)).toContain('specimen');
    expect(eligibleIncidents(clinical('pathology'), 'medical').map(d => d.id)).not.toContain('operation');
    expect(eligibleIncidents(clinical('obgyn'), 'medical').map(d => d.id)).toContain('birth');
    expect(eligibleIncidents(clinical('anesthesia'), 'medical').map(d => d.id)).toContain('anesthesia');
    expect(eligibleIncidents(clinical('internal'), 'medical').map(d => d.id)).not.toContain('birth');
    expect(medicalProfile(clinical('obgyn', 'clinic'))!.liability).toBeGreaterThan(medicalProfile(clinical('pathology'))!.liability * 3);
  });
  it('never invents investments, savings or an operating clinic', () => {
    const s = createCareerGame('eligibility', 1);
    const ids = eligibleIncidents(s, 'life').map(d => d.id);
    for (const id of ['market-loss', 'savings-fraud', 'equipment', 'closure', 'job-loss', 'interest']) expect(ids).not.toContain(id);
    expect(eligibleIncidents(clinical('internal', 'clinic'), 'life').map(d => d.id)).not.toContain('job-loss');
  });
  it('settles both choices of every scene without breaking money or save invariants', () => {
    for (const d of MAJOR_EVENTS) for (const choice of d.pool === 'medical' ? ['supported', 'prepare'] : ['first', 'second']) {
      const s = SPECIALTIES.flatMap(x => [clinical(x.id, 'clinic'), clinical(x.id)]).find(s => eligibleIncidents(s, d.pool).some(x => x.id === d.id)) ?? clinical('internal', 'clinic');
      s.portfolio!.investments = 30_000_000; s.portfolio!.savings = 20_000_000; s.economy!.assets += 50_000_000; s.economy!.debt = 10_000_000;
      expect(openIncident(s, d.id), d.id).toBe(true);
      expect(respond(s, choice), `${d.id}/${choice}`).toBe(true);
      expect(validIncidents(s), `${d.id}/${choice}`).toBe(true);
      expect(validEconomy(s.economy), d.id).toBe(true);
      expect(validPortfolio(s.portfolio, s), d.id).toBe(true);
    }
  });
  it('persists the open decision and rejects altered choices, repeated actions and corrupt state', async () => {
    let s = createCareerGame('restore-incidents', 42);
    expect(openIncident(s, 'fire')).toBe(true);
    s.pendingEvent = careerEvent(s, requiredIncident(s)!);
    expect(validState(s)).toBe(true);
    const db = await openGameDatabase(`major-test-${Date.now()}`);
    await persistGame(db, s, null); const restored = (await loadGame(db))!.state;
    expect(restored).toEqual(s);
    const action = { type: 'choose' as const, id: 'fire-choice', eventId: s.pendingEvent!.id, choiceId: 'first' };
    s = reduceGame(s, action); expect(validState(s)).toBe(true);
    expect(reduceGame(s, action)).toEqual(s);
    expect(s.economy!.debt).toBeGreaterThan(0);
    await persistGame(db, s, { runId: restored.runId, revision: restored.revision });
    expect((await loadGame(db))!.state).toEqual(s);
    const bad = structuredClone(restored); bad.pendingEvent!.choices[0].label = '변조'; expect(validState(bad)).toBe(false);
    const invalid = structuredClone(s); invalid.incidents!.impacts[0].cut = Infinity; expect(validState(invalid)).toBe(false);
    db.close();
  });
  it('continues the original claim after changing job, restores during litigation and supports both endings', () => {
    let filed = 0, early = 0, judgments = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = clinical('obgyn', 'clinic', seed);
      expect(openIncident(s, 'birth')).toBe(true); respond(s, 'supported');
      const oldAmount = s.incidents!.active!.amount;
      s.career!.practice = 'research'; month(s, 183);
      if (s.incidents!.active?.phase === 'negotiation') {
        filed++; const restored = JSON.parse(JSON.stringify(s));
        expect(incidentEvent(restored, requiredIncident(restored)!)?.body).toContain('산부인과 · 개원의');
        expect(restored.incidents.active.amount).toBe(oldAmount);
        const choice = seed % 2 ? 'contest' : 'settle'; respond(s, choice);
        if (choice === 'contest') { month(s, 195); judgments++; }
      } else early++;
      expect(s.incidents!.history[0]?.id).toBe('birth'); expect(validIncidents(s)).toBe(true);
      expect(openIncident(s, 'birth')).toBe(false);
    }
    expect(filed).toBeGreaterThan(5); expect(early).toBeGreaterThan(5); expect(judgments).toBeGreaterThan(0);
  });
  it('doubles medical liability and applies five years of larger consequences after an adverse judgment', () => {
    let checked = false;
    for (let seed = 1; seed <= 30 && !checked; seed++) {
      const s = clinical('obgyn', 'clinic', seed); s.stats = { health: 100, happiness: 100, knowledge: 100, relationships: 100 };
      openIncident(s, 'birth'); expect(s.incidents!.active!.amount).toBe(624_000_000);
      respond(s, 'supported'); month(s, 183);
      if (s.incidents!.active?.phase !== 'negotiation') continue;
      expect(incidentEvent(s, requiredIncident(s)!)!.choices[0].description).toContain('280,800,000원');
      respond(s, 'contest'); month(s, 195);
      if (s.incidents!.history[0].outcome !== '배상 부담') continue;
      checked = true;
      expect(s.incidents!.impacts.at(-1)).toMatchObject({ start: 195, until: 255, cut: .6, strain: 3, relationship: 2 });
      expect(s.journal.at(-1)!.effects).toMatchObject({ health: -12, happiness: -25, relationships: -8 });
      expect(validIncidents(s)).toBe(true); expect(validEconomy(s.economy)).toBe(true);
    }
    expect(checked).toBe(true);
  });
  it('applies income loss and monthly bills once, shows ongoing effects and stops on schedule', () => {
    const s = clinical(); openIncident(s, 'accident'); respond(s, 'first');
    const before = financeView(s); expect(before.income).toBeLessThan(6_000_000);
    month(s, 181); expect(s.economy!.income).toBe(2_400_000);
    const settled = structuredClone(s); advanceIncidents(s); expect(s).toEqual(settled);
    const html = renderToStaticMarkup(<PlayOverview game={s} busy={false} onAbilities={() => {}}><span>생활</span></PlayOverview>);
    expect(html).toContain('진행 중인 영향'); expect(html).toContain('44개월');
    s.incidents!.nextMedical = s.incidents!.nextLife = 1000;
    month(s, 226); expect(s.economy!.income).toBe(6_000_000);
  });
  it('makes an accident affect wealth, health, happiness, relationships, fatigue and clinical work', () => {
    const s = clinical(); s.stats = { health: 80, happiness: 80, knowledge: 80, relationships: 80 };
    const net = s.economy!.assets - s.economy!.debt;
    openIncident(s, 'accident'); respond(s, 'first');
    expect(net - (s.economy!.assets - s.economy!.debt)).toBe(105_000_000);
    expect(s.stats).toEqual({ health: 60, happiness: 60, knowledge: 80, relationships: 72 });
    const fatigue = s.dynamics!.fatigue, stats = { ...s.stats };
    s.encounters!.lastMonth = 182; const encounters = s.encounters!.total;
    month(s, 183); settleEncounters(s);
    expect(s.stats.health).toBe(stats.health - 2); expect(s.stats.happiness).toBe(stats.happiness - 2);
    expect(s.stats.relationships).toBe(stats.relationships - 1); expect(s.dynamics!.fatigue).toBeGreaterThan(fatigue);
    expect(s.encounters!.total - encounters).toBe(160);
    expect(s.journal.at(-1)!.detail).toContain('수입 공백 3,600,000원');
    expect(validIncidents(s)).toBe(true);
  });
  it('charges the stated tradeoff, supports 108-month effects and takes 75% of actual assets', () => {
    const fire = clinical(); openIncident(fire, 'fire');
    expect(incidentEvent(fire, requiredIncident(fire)!)!.choices[0].description).toContain('72,000,000원');
    respond(fire, 'second');
    expect(fire.incidents!.impacts[0]).toMatchObject({ until: 234, cut: .28, monthly: 800_000, strain: 3, relationship: 2 });
    const disaster = clinical(); openIncident(disaster, 'disaster'); respond(disaster, 'second');
    expect(disaster.incidents!.impacts[0].until).toBe(288); expect(validIncidents(disaster)).toBe(true);
    for (const id of ['market-loss', 'savings-fraud']) for (const choice of ['first', 'second']) {
      const s = clinical(); s.portfolio!.savings = 40_000_000; s.portfolio!.investments = 40_000_000; s.economy!.assets += 80_000_000;
      const net = s.economy!.assets - s.economy!.debt;
      openIncident(s, id); respond(s, choice);
      expect(net - (s.economy!.assets - s.economy!.debt)).toBe(30_000_000 + (id === 'savings-fraud' && choice === 'first' ? 3_000_000 : 0));
      expect(validIncidents(s)).toBe(true); expect(validEconomy(s.economy)).toBe(true);
    }
  });
  it('keeps old pending decisions and saved impacts at their original severity', async () => {
    let s = createCareerGame('legacy-incident', 42); openIncident(s, 'fire');
    delete s.incidents!.active!.balanceVersion; s.incidents!.active!.amount = 24_000_000;
    s.pendingEvent = careerEvent(s, requiredIncident(s)!);
    expect(s.pendingEvent!.choices[0].description).toContain('24,000,000원'); expect(validState(s)).toBe(true);
    const db = await openGameDatabase(`major-legacy-${Date.now()}`);
    await persistGame(db, s, null); const restored = (await loadGame(db))!.state;
    expect(restored.pendingEvent).toEqual(s.pendingEvent);
    s = reduceGame(restored, { type: 'choose', id: 'legacy-first', eventId: s.pendingEvent!.id, choiceId: 'first' });
    expect(s.incidents!.impacts[0]).toMatchObject({ start: 0, until: 24, cut: .12, strain: 1 });
    expect(s.incidents!.impacts[0].relationship).toBeUndefined(); expect(validState(s)).toBe(true);
    await persistGame(db, s, { runId: restored.runId, revision: restored.revision }); expect((await loadGame(db))!.state).toEqual(s); db.close();
  });
  it('highlights the combined chosen incident and its resolution without showing its result twice', () => {
    const s = createCareerGame('major-log', 42); openIncident(s, 'fire'); s.pendingEvent = careerEvent(s, requiredIncident(s)!);
    const next = reduceGame(s, { type: 'choose', id: 'major-choice', eventId: s.pendingEvent!.id, choiceId: 'first' });
    const visible = groupPlayLog(next.journal).flat(), chosen = visible.find(e => e.id === 'major-choice')!;
    expect(chosen.importance).toBe('major'); expect(logEmphasis(chosen)).toBe('major');
    expect(visible.some(e => e.id === chosen.choice!.resultId)).toBe(false);
    const html = renderToStaticMarkup(<JournalHistory entries={next.journal}/>);
    expect(html).toContain('log-major'); expect(html).toContain('큰 사건'); expect(html).toContain('7,200만 원');
    expect(html).toContain('36개월'); expect(html).toContain('건강');
    const invalid = structuredClone(next); (invalid.journal.at(-1)! as unknown as { importance: string }).importance = 'fake';
    expect(validState(invalid)).toBe(false);
  });
  it('does not replay history on migration and enforces rare-event lifetime and cooldown limits', () => {
    const s = clinical(); delete s.incidents; advanceIncidents(s);
    expect(s.incidents!.since).toBe(180); expect(s.incidents!.seen).toEqual([]);
    openIncident(s, 'windfall'); respond(s, 'first');
    expect(openIncident(s, 'fire')).toBe(false);
    s.life!.elapsedMs = 220_000; expect(openIncident(s, 'disaster')).toBe(false);
    expect(openIncident(s, 'fire')).toBe(true);
  });
  it('completes real gameplay with identical incidents at 1x and 16x', () => {
    const slow = measureRun(42, 'specialist', true, 1), fast = measureRun(42, 'specialist', true, 16);
    expect(slow.state.incidents).toEqual(fast.state.incidents);
    const financial = (s: typeof slow.state) => ({ ...s.economy, ledger: s.economy!.ledger.map(({ id: _id, ...t }) => t) });
    expect(financial(slow.state)).toEqual(financial(fast.state));
    expect(slow.state.incidents!.seen.length).toBeGreaterThan(0);
    expect(validState(fast.state)).toBe(true);
  }, 120_000);
});
