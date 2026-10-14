import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { ECONOMY_RULES } from '../src/economy';
import { canExpandClinic, clinicCapital, clinicRevenue, clinicTierAt, CLINIC_RULES, nextClinicTier, settleClinicChoice } from '../src/clinic';
import { validState } from '../src/storage';
import ClinicPanel from '../src/ClinicPanel';
import { clinicScenario } from './helpers/clinic-scenario';


// Evaluate the exit after facility-sale losses, independent of clock frame size.
function exitNet(s: ReturnType<typeof createCareerGame>) {
  const book = clinicCapital(s.clinic?.level ?? 0, 'book') + ECONOMY_RULES.clinicNonCashAssets;
  return s.economy!.assets - s.economy!.debt - s.economy!.due - book + Math.round(book * CLINIC_RULES.saleRatio);
}

describe('simple repeat hospital expansion', () => {
  it('keeps the old three tiers and scales additional investment, capacity and operating costs', () => {
    expect(clinicTierAt(3)).toEqual(CLINIC_RULES.tiers[3]);
    expect(clinicTierAt(4)).toMatchObject({ name: '대형 병원 · 2배', revenue: 840_000_000, equity: 150_000_000, loan: 1_800_000_000 });
    expect(clinicCapital(4, 'loan')).toBe(4_380_000_000);
    expect(clinicTierAt(5).cost).toBeLessThan(clinicTierAt(4).cost * 2);
  });
  it('expands, restores and unwinds high-scale facilities without losing debt or duplicating assets', () => {
    const s = clinicScenario(42, 500_000_000_000);
    for (let n = 1; n <= CLINIC_RULES.maxLevel; n++) {
      if (n > 1) s.life!.elapsedMs += 12_000;
      expect(canExpandClinic(s)).toBe(true);
      s.pendingEvent = careerEvent(s, 'clinic:expand'); expect(validState(JSON.parse(JSON.stringify(s)))).toBe(true);
      s.pendingEvent = null;
      expect(settleClinicChoice(s, 'clinic:expand', 'borrow')).toBe(true);
      expect(s.economy!.debt).toBe(clinicCapital(n, 'loan'));
      expect(validState(s)).toBe(true);
    }
    expect(nextClinicTier(s)).toBeUndefined(); expect(canExpandClinic(s)).toBe(false);
    expect(clinicRevenue(s)).toBe(215_040_000_000);
    expect(renderToStaticMarkup(<ClinicPanel game={s} disabled={false} act={() => {}}/>)).toContain('512배');
    const previous = s.economy!.assets - s.economy!.debt;
    expect(settleClinicChoice(s, 'clinic:manage', 'shrink')).toBe(true);
    expect(s.economy!.assets - s.economy!.debt).toBe(previous - Math.round(clinicTierAt(12).book * 0.55));
    expect(validState(s)).toBe(true);
    s.revision++;
    expect(settleClinicChoice(s, 'clinic:manage', 'close')).toBe(true);
    expect(s.economy!.assets).toBe(s.economy!.cash); expect(s.economy!.debt).toBeGreaterThan(0);
    expect(validState(s)).toBe(true);
  });
  it('restores exact old open contracts, while rejecting edited revenue quotes', () => {
    let s = clinicScenario();
    for (const [level, oldRevenue, newRevenue] of [[1, 100_000_000, 140_000_000], [2, 260_000_000, 420_000_000]]) {
      if (level === 1) expect(settleClinicChoice(s, 'clinic:expand', 'borrow')).toBe(true);
      s.life!.elapsedMs += 12_000;
      s.pendingEvent = careerEvent(s, 'clinic:expand');
      s.pendingEvent!.body = s.pendingEvent!.body.replace(newRevenue.toLocaleString('ko-KR'), oldRevenue.toLocaleString('ko-KR'));
      expect(validState(s)).toBe(true);
      const bad = structuredClone(s); bad.pendingEvent!.body += '추가 수익 보장'; expect(validState(bad)).toBe(false);
      s = reduceGame(s, { type: 'choose', id: `legacy:${level}`, eventId: s.pendingEvent!.id, choiceId: 'borrow' });
      expect(s.clinic!.level).toBe(level + 1); expect(validState(s)).toBe(true);
    }
  });
  it('measures reachable wealth using only normal choices from admission', async () => {
    const rows = [];
    for (const seed of [7, 23, 42, 83, 127, 2026, 2027, 3011]) {
      let s = createCareerGame(`growth:${seed}`, seed), peak = 0, level = 0;
      s.life!.paused = false; s.life!.speed = 16;
      for (let i = 0; i < 6000 && s.status !== 'completed'; i++) {
        const e = s.pendingEvent;
        if (e) {
          const k = e.randomKey ?? '';
          let prefs = ['apply', 'continue', 'balanced', 'pass', 'decline'];
          if (k === 'funding') prefs = ['education-plan', 'pay-due', 'loan'];
          if (k === 'application-result') prefs = ['continue', 'retry', 'untrained'];
          if (k === 'practice-required') prefs = ['clinic', 'employed', 'untrained'];
          if (k === 'clinic-funding') prefs = ['open-clinic', 'loan'];
          if (k === 'clinic:expand') prefs = ['borrow'];
          if (k === 'clinic:crisis') prefs = exitNet(s) >= 200_000_000_000 ? ['close'] : ['hold', 'shrink', 'close'];
          if (k === 'clinic:manage') prefs = ['close'];
          if (k === 'journey:route') prefs = ['general'];
          if (k === 'marriage-required') prefs = ['single', 'stay'];
          if (k.startsWith('offer-')) prefs = ['decline'];
          const choiceId = prefs.find(id => e.choices.some(c => c.id === id)) ?? e.choices[0].id;
          s = reduceGame(s, { type: 'choose', id: `growth:${s.revision}`, eventId: e.id, choiceId });
        } else if (s.career!.practice === 'clinic' && (s.clinic?.level ?? 0) > 0 && exitNet(s) >= 200_000_000_000) {
          // Realise the winnings using the same existing exit choice, rather than expanding forever.
          s = reduceGame(s, { type: 'clinic', id: `growth:${s.revision}`, kind: 'manage' });
        } else if (canExpandClinic(s) && s.life!.elapsedMs / 1000 - (s.clinic?.changedAt ?? 0) >= 24) {
          s = reduceGame(s, { type: 'clinic', id: `growth:${s.revision}`, kind: 'expand' });
        } else {
          const focus = s.stageIndex <= 1 ? 'study' : 'rest';
          if (s.progress!.focus !== focus) s = reduceGame(s, { type: 'career-focus', id: `growth:${s.revision}`, focus });
          s = reduceGame(s, { type: 'tick', id: `growth:${s.revision}`, elapsedMs: 1000 });
        }
        expect(validState(s), `seed ${seed}, month ${s.life!.elapsedMs / 1000}, ${s.pendingEvent?.randomKey}`).toBe(true);
        peak = Math.max(peak, s.economy!.assets - s.economy!.debt - s.economy!.due);
        level = Math.max(level, s.clinic?.level ?? 0);
      }
      expect(s.status).toBe('completed');
      rows.push({ seed, peak, final: s.economy!.assets - s.economy!.debt - s.economy!.due, level });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    console.log('CLINIC_GROWTH_RUNS ' + JSON.stringify(rows));
    expect(Math.max(...rows.map(r => r.final))).toBeGreaterThanOrEqual(100_000_000_000);
  }, 180_000);
});
