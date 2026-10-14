import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../src/contracts';
import { reduceGame } from '../src/engine';
import { careerEvent, careerStageEnds } from '../src/career-runtime';
import { CLINIC_RULES as R, clinicRevenue, clinicService, clinicTier, prepareClinic, settleClinic, settleClinicChoice, canExpandClinic, validClinic } from '../src/clinic';
import { preparePortfolio } from '../src/portfolio';
import { settleEconomyMonth } from '../src/economy';
import { financeView } from '../src/finance-view';
import { validState, openGameDatabase, loadGame, persistGame } from '../src/storage';
import ClinicPanel from '../src/ClinicPanel';
import { clinicScenario } from './helpers/clinic-scenario';
import { careerMonthMs } from '../src/pacing';

const choose = (s: GameState, id: string) => reduceGame(s, { type: 'choose', id: `choose:${s.revision}`, eventId: s.pendingEvent!.id, choiceId: id });
function expand(s = clinicScenario()) {
  s = reduceGame(s, { type: 'clinic', kind: 'expand', id: `expand:${s.revision}` });
  expect(s.pendingEvent?.randomKey).toBe('clinic:expand');
  return choose(s, 'borrow');
}
function month(s: GameState) {
  s.life!.elapsedMs += 1000;
  preparePortfolio(s); prepareClinic(s);
  s.economy = settleEconomyMonth(s.economy!, s.life!.elapsedMs / 1000, { stage: 'career', practice: 'clinic', working: false, scholarship: false, clinicRevenue: clinicRevenue(s), clinicCost: clinicTier(s).cost });
  settleClinic(s);
}
describe('hospital leverage', () => {
  it('preserves old clinic saves and does not borrow before the explicit choice', () => {
    const old = clinicScenario(); expect(validState(old)).toBe(true);
    const offer = reduceGame(old, { type: 'clinic', kind: 'expand', id: 'offer' });
    expect(offer.economy).toEqual(old.economy); expect(validState(offer)).toBe(true);
    expect(reduceGame(offer, { type: 'tick', id: 'wait', elapsedMs: 1000 })).toBe(offer);
    expect(choose(offer, 'cancel').clinic).toBeUndefined();
    expect(choose(offer, 'borrow').economy!.debt).toBe(180_000_000);
    expect(old.clinic).toBeUndefined();
  });
  it('records investment loss, loan, assets and rejects duplicate/early expansion', () => {
    const s = expand(); expect(s.clinic!.level).toBe(1); expect(validState(s)).toBe(true);
    expect(s.economy!.cash).toBe(280_000_000); expect(s.economy!.assets).toBe(432_000_000);
    expect(canExpandClinic(s)).toBe(false);
    expect(reduceGame(s, { type: 'clinic', kind: 'expand', id: 'again' })).toBe(s);
    const bad = clinicScenario(); bad.economy!.cash = 0;
    expect(canExpandClinic(bad)).toBe(false);
    bad.career!.practice = 'employed'; expect(settleClinicChoice(bad, 'clinic:expand', 'borrow')).toBe(false);
  });
  it('grows to three tiers with higher debt, revenue, interest and scheduled payments', () => {
    const s = expand(clinicScenario(42, 3_000_000_000));
    for (let n = 2; n <= 3; n++) { s.life!.elapsedMs += 12_000; expect(settleClinicChoice(s, 'clinic:expand', 'borrow')).toBe(true); }
    expect(s.clinic!.level).toBe(3); expect(s.economy!.debt).toBe(2_580_000_000);
    expect(clinicRevenue(s)).toBe(420_000_000); expect(clinicService(s)).toBe(60_200_000);
    s.economy!.lastMonth = s.life!.elapsedMs / 1000;
    month(s); expect(s.portfolio!.lastDebtInterest).toBe(38_700_000);
    expect(s.economy!.ledger.find(t => t.label === '개원 매출')!.cashDelta).toBe(420_000_000);
    expect(s.clinic!.lastService).toBeGreaterThan(60_000_000);
    expect(canExpandClinic(s)).toBe(false); expect(validState(s)).toBe(true);
    const settled = structuredClone(s); settleClinic(s); prepareClinic(s); expect(s).toEqual(settled);
  });
  it('turns a cash shortfall into a paused crisis before the generic loan loop', () => {
    let s = expand(clinicScenario(12, 20_000_000));
    s.clinic!.shockUntil = 166;
    for (let ms = 0; ms < careerMonthMs(s) && !s.pendingEvent; ms += 1000) {
      s = reduceGame(s, { type: 'tick', id: `month:${ms}`, elapsedMs: Math.min(1000, careerMonthMs(s) - ms) });
    }
    expect(s.pendingEvent?.randomKey).toBe('clinic:crisis'); expect(validState(s)).toBe(true);
    expect(s.clinic!.lastService).toBe(0); // Essential unpaid bills take priority over the lender.
    expect(s.pendingEvent!.choices.map(c => c.id)).not.toContain('hold');
    expect(reduceGame(s, { type: 'tick', id: 'wait', elapsedMs: 1000 })).toBe(s);
    s = choose(s, 'close'); expect(s.career!.practice).toBe('employed');
    expect(s.economy!.debt).toBeGreaterThan(100_000_000); expect(validState(s)).toBe(true);
    expect(s.economy!.assets).toBeGreaterThanOrEqual(s.economy!.cash);
  });
  it('sells facilities at a loss and preserves debt without liquidating savings', () => {
    const s = expand(); s.portfolio!.savings = 1_000_000; s.economy!.cash -= 1_000_000;
    const net = s.economy!.assets - s.economy!.debt;
    expect(settleClinicChoice(s, 'clinic:manage', 'shrink')).toBe(true);
    expect(s.economy!.assets - s.economy!.debt).toBe(net - R.tiers[1].book * (1 - R.saleRatio));
    expect(s.portfolio!.savings).toBe(1_000_000); expect(s.economy!.debt).toBe(117_000_000);
    expect(s.clinic!.level).toBe(0); expect(validState(s)).toBe(true);
  });
  it('lets a cash reserve absorb losses, then asks again after three months', () => {
    let s = expand(); s.clinic!.crisis = true; s.clinic!.losses = 3; s.clinic!.shockUntil = 166;
    s.pendingEvent = careerEvent(s, 'clinic:crisis');
    const before = { ...s.stats }; s = choose(s, 'hold');
    expect(s.stats.health).toBe(before.health - 3); expect(s.stats.happiness).toBe(before.happiness - 5);
    expect(s.clinic!.crisis).toBe(false); expect(s.clinic!.reviewAt).toBe(163);
    month(s); expect(s.clinic!.crisis).toBe(false);
    month(s); expect(s.clinic!.crisis).toBe(false);
    month(s); expect(s.clinic!.crisis).toBe(true); expect(validState(s)).toBe(true);
  });
  it('restores an open contract and crisis exactly through IndexedDB', async () => {
    const db = await openGameDatabase(`clinic-${crypto.randomUUID()}`);
    let s = reduceGame(clinicScenario(), { type: 'clinic', kind: 'expand', id: 'offer' });
    await persistGame(db, s, null); expect((await loadGame(db))!.state).toEqual(s);
    const previous = { runId: s.runId, revision: s.revision }; s = choose(s, 'borrow');
    s.clinic!.crisis = true; s.pendingEvent = careerEvent(s, 'clinic:crisis');
    await persistGame(db, s, previous); expect((await loadGame(db))!.state).toEqual(s); db.close();
  });
  it('uses fixed RNG across reload and shows scaled finances in the UI', () => {
    const a = expand(), b = structuredClone(a);
    for (let i = 0; i < 12; i++) { month(a); month(b); if (a.economy!.due) break; }
    expect(a).toEqual(b);
    const s = expand(); expect(financeView(s).repayment).toBe(clinicService(s));
    expect(financeView(s).salary).toBe(36_000_000 * 12);
    expect(financeView(s).disposable).toBe(financeView(s).income - financeView(s).expenses - clinicService(s));
    const html = renderToStaticMarkup(<ClinicPanel game={s} disabled={false} act={() => {}}/>);
    expect(html).toContain('확장 의원'); expect(html).toContain('연 9%'); expect(html).toContain('축소·폐업');
  });
  it('rejects corrupt optional states and prevents abandoned expansion assets at retirement', () => {
    const s = expand(); const bad = structuredClone(s); bad.clinic!.level = 9; expect(validClinic(bad)).toBe(false);
    bad.clinic = { ...s.clinic!, seed: -1 }; expect(validState(bad)).toBe(false);
    s.life!.elapsedMs = careerStageEnds(s)[2] * 1000;
    const event = careerEvent(s, 'clinic:retire'); expect(event!.choices.map(c => c.id)).toEqual(['close']);
    expect(settleClinicChoice(s, 'clinic:retire', 'close')).toBe(true); expect(s.clinic!.level).toBe(0);
    expect(s.economy!.debt).toBeGreaterThan(0);
  });
  it('settles identical monthly risks and money at 1x and 16x through the actual reducer', () => {
    function play(speed: 1 | 16) {
      let s = expand(clinicScenario(25)); s.life!.speed = speed;
      for (let i = 0; i < 1500 && s.life!.elapsedMs < 184_000; i++) {
        if (s.pendingEvent) {
          const choices = s.pendingEvent.choices;
          const id = s.pendingEvent.randomKey === 'clinic:crisis' ? 'shrink'
            : choices.find(c => ['decline', 'single', 'pass', 'loan'].includes(c.id))?.id ?? choices[0].id;
          s = choose(s, id);
        } else {
          const remainder = 1000 - s.life!.elapsedMs % 1000;
          s = reduceGame(s, { type: 'tick', id: `tick:${s.revision}`, elapsedMs: Math.min(1000, Math.ceil(remainder * careerMonthMs(s) / 1000 / speed)) });
        }
        expect(validState(s)).toBe(true);
      }
      expect(s.life!.elapsedMs).toBeGreaterThanOrEqual(184_000);
      return { clinic: s.clinic, money: [s.economy!.cash, s.economy!.assets, s.economy!.debt, s.economy!.due], seed: s.seed };
    }
    expect(play(1)).toEqual(play(16));
  });
});
