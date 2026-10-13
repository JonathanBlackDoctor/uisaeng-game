import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame } from '../src/career-runtime';
import { reduceGame } from '../src/engine';
import { initialEncounters, monthlyEncounters, settleEncounters, validEncounters, netAssets } from '../src/life-goals';
import { openGameDatabase, persistGame, loadGame, validState } from '../src/storage';
import { resultShareData } from '../src/result-share';
import LifeGoals from '../src/LifeGoals';

describe('lifetime goals', () => {
  it('counts only clinical work, with workload and opened-clinic conditions', () => {
    const s = createCareerGame('rates', 42);
    expect(monthlyEncounters(s)).toBe(0);
    s.stageIndex = 1; s.career!.application = 'accepted';
    expect(monthlyEncounters(s)).toBe(120);
    s.stageIndex = 2; s.career!.practice = 'employed';
    expect(monthlyEncounters(s)).toBe(400);
    s.depth!.workload = 'extended'; expect(monthlyEncounters(s)).toBe(600);
    s.depth!.workload = 'learning'; expect(monthlyEncounters(s)).toBe(240);
    s.career!.practice = 'research'; expect(monthlyEncounters(s)).toBe(0);
    s.career!.practice = 'clinic'; expect(monthlyEncounters(s)).toBe(0);
    s.career!.practice = 'untrained'; expect(monthlyEncounters(s)).toBe(240);
    s.stageIndex = 3; expect(monthlyEncounters(s)).toBe(0);
  });
  it('settles once per month, preserves partial history, and rejects corrupt totals', () => {
    const s = createCareerGame('settle', 42);
    s.stageIndex = 2; s.career!.practice = 'employed';
    s.encounters = initialEncounters(144); s.life!.elapsedMs = 145000;
    settleEncounters(s); settleEncounters(s);
    expect(s.encounters.total).toBe(400);
    expect(validEncounters(s)).toBe(true);
    const html = renderToStaticMarkup(<LifeGoals game={s}/>);
    expect(html).toContain('집계 시작 이후');
    expect(html).toContain('다음 목표 1,000건');
    for (const total of [-1, NaN, Infinity, 0.5, 601]) {
      s.encounters.total = total; expect(validEncounters(s)).toBe(false);
    }
  });
  it('keeps the ledger net asset formula including unpaid bills', () => {
    const s = createCareerGame('assets', 42);
    s.economy!.assets = 30_000_000; s.economy!.debt = 20_000_000; s.economy!.due = 2_000_000;
    expect(netAssets(s)).toBe(8_000_000);
    s.economy!.assets += 10_000_000; s.economy!.debt += 10_000_000;
    expect(netAssets(s)).toBe(8_000_000);
    expect(resultShareData(s).text).toContain('누적 진료 0건 · 순자산 8,000,000원');
  });
  it('keeps old saves valid without inventing past encounters', async () => {
    const s = createCareerGame('old', 42); delete s.encounters;
    expect(validState(s)).toBe(true);
    expect(renderToStaticMarkup(<LifeGoals game={s}/>)).toContain('집계 전');
    const db = await openGameDatabase('goals-old');
    await persistGame(db, s, null);
    expect((await loadGame(db))!.state.encounters).toBeUndefined(); db.close();
  });
  it('survives a complete life, pause/duplicate ticks, and save restoration', async () => {
    let s = createCareerGame('goals-life', 42);
    s.life!.paused = true;
    expect(reduceGame(s, {type:'tick', id:'paused', elapsedMs:1000})).toEqual(s);
    s = reduceGame(s, {type:'control', id:'start', paused:false, speed:8});
    let countedMonths = 0;
    for (let i = 0; i < 8000 && s.status !== 'completed'; i++) {
      const before = s.encounters!.total;
      const e = s.pendingEvent;
      if (e) {
        const prefs = e.randomKey === 'funding' ? ['education-plan','pay-due','loan']
          : e.randomKey === 'specialty-required' ? ['untrained']
          : e.randomKey === 'practice-required' ? ['untrained','employed'] : ['continue','pass','decline'];
        const choice = prefs.find(id => e.choices.some(c => c.id === id)) ?? e.choices[0].id;
        s = reduceGame(s, {type:'choose', id:`c:${i}`, eventId:e.id, choiceId:choice});
        expect(s.encounters!.total).toBe(before);
      } else {
        const action = {type:'tick' as const, id:`t:${i}`, elapsedMs:1000};
        s = reduceGame(s, action);
        expect(reduceGame(s, action)).toEqual(s);
      }
      if (s.encounters!.total > before) countedMonths++;
      expect(validState(s)).toBe(true);
    }
    expect(s.status).toBe('completed'); expect(countedMonths).toBeGreaterThan(0);
    expect(s.encounters!.total).toBeGreaterThan(1000);
    expect(reduceGame(s, {type:'tick', id:'after-end', elapsedMs:1000})).toEqual(s);
    const db = await openGameDatabase('goals-finished');
    await persistGame(db, s, null);
    expect((await loadGame(db))!.state.encounters).toEqual(s.encounters); db.close();
  });
});
