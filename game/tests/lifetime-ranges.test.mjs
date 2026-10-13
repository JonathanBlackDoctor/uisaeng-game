import { writeFileSync, mkdirSync } from 'node:fs';
import { it, expect } from 'vitest';
import { simulateLifetime } from './helpers/lifetime-scenarios';

// Bounded scenarios, not human-player statistics or a search for global maxima.
it('measures four complete-lifetime play styles and saves a reproducible range report', async () => {
  const rows = [];
  for (const mode of ['balanced','research','clinical','family']) {
    for (const seed of [7,23,42,83,127,2026,2027,3011]) {
      const { values } = simulateLifetime(seed, mode); rows.push(values);
      expect(values.papers).toBeGreaterThanOrEqual(0);
      expect(values.familyHours).toBeLessThanOrEqual(16416);
      // Yield between lifetimes so the worker can service its RPC messages.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  const stats = values => { const sorted = [...values].sort((a,b)=>a-b); return { min:sorted[0], median:(sorted[3]+sorted[4])/2, max:sorted.at(-1) }; };
  const summary = Object.fromEntries(['balanced','research','clinical','family'].map(mode => {
    const group = rows.filter(x=>x.mode===mode);
    return [mode,Object.fromEntries(['encounters','assets','familyHours','papers'].map(k=>[k,stats(group.map(x=>x[k]))]))];
  }));
  mkdirSync(new URL('../../.orchestrator/ui-qa/publications-20261014/',import.meta.url),{recursive:true});
  writeFileSync(new URL('../../.orchestrator/ui-qa/publications-20261014/ranges.json',import.meta.url), JSON.stringify({rules:'publications-provisional-v1',runs:rows.length,rows,summary},null,2));
  console.log(JSON.stringify(summary));
}, 180000);
