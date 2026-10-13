import { expect, it } from 'vitest';
import { createCareerGame } from '../src/career-runtime';
import { MAJOR_EVENTS } from '../src/major-event-catalog';
import { advanceIncidents, requiredIncident, settleIncident, validIncidents } from '../src/major-events';

it('measures monthly scheduler frequencies across 1600 deterministic lifetimes', () => {
  const rows = [];
  for (const [specialty, practice] of [['internal', 'employed'], ['obgyn', 'clinic'], ['pathology', 'employed'], ['internal', 'research']] as const) {
    let medical = 0, filed = 0, life = 0, rare = 0, maxRare = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const s = createCareerGame('frequency', seed);
      s.portfolio!.investments = 20_000_000; s.portfolio!.savings = 20_000_000; s.economy!.assets += 40_000_000;
      for (let m = 1; m <= 684; m++) {
        s.life!.elapsedMs = m * 1000; s.stageIndex = m <= 72 ? 0 : m <= 144 ? 1 : m <= 564 ? 2 : 3;
        s.career!.specialty = specialty; s.career!.application = 'accepted';
        s.career!.practice = m <= 144 && practice !== 'research' ? 'undecided' : practice;
        if (m === 145 && practice === 'clinic') s.economy!.ledger.push({ id: 'clinic', month: m, label: '개원', cashDelta: 0, debtDelta: 0, kind: 'open-clinic' });
        s.economy!.income = s.stageIndex === 0 || s.stageIndex === 3 ? 0 : 6_000_000;
        advanceIncidents(s);
        const key = requiredIncident(s);
        if (key) settleIncident(s, key, s.incidents!.active!.phase === 'negotiation' ? (seed % 2 ? 'contest' : 'settle') : s.incidents!.active!.profile ? 'supported' : 'first');
      }
      expect(validIncidents(s)).toBe(true);
      const count = (pool: string) => s.incidents!.seen.filter(id => MAJOR_EVENTS.find(d => d.id === id)!.pool === pool).length;
      medical += count('medical'); life += count('life'); rare += count('rare'); maxRare = Math.max(maxRare, count('rare'));
      filed += s.incidents!.history.filter(h => h.filed).length + Number(s.incidents!.active?.filed ?? false);
    }
    rows.push({ specialty, practice, runs: 400, medical: medical / 400, lawsuits: filed / 400, life: life / 400, rare: rare / 400 });
    expect(maxRare).toBeLessThanOrEqual(1);
  }
  expect(rows[0].medical).toBeGreaterThan(3); expect(rows[0].medical).toBeLessThan(6);
  expect(rows[0].life).toBeGreaterThan(2); expect(rows[0].life).toBeLessThan(4);
  expect(rows[1].medical).toBeGreaterThan(rows[2].medical * 1.4);
  expect(rows[3].medical).toBe(0);
  console.info(JSON.stringify(rows));
}, 120_000);
