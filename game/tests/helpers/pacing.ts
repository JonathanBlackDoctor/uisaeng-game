import { createCareerGame } from '../../src/career-runtime';
import { reduceGame } from '../../src/engine';
import { validState } from '../../src/storage';
import type { TimeSpeed } from '../../src/contracts';

export function measureRun(seed: number, mode: 'untrained' | 'specialist' | 'academic', compact = true, speed: TimeSpeed = 16) {
  let state = createCareerGame('pacing-measure', seed);
  if (!compact) delete state.progress!.pacingVersion;
  state.life!.paused = false; state.life!.speed = speed;
  const keys: string[] = []; let chars = 0;
  for (let n = 0; n < 6000 && state.status !== 'completed'; n++) {
    if (!state.pendingEvent) state = reduceGame(state, { type: 'tick', id: `t:${state.revision}`, elapsedMs: 1000 });
    else {
      const e = state.pendingEvent, k = e.randomKey!;
      keys.push(k); chars += e.body.length + e.choices.reduce((a,c) => a + c.label.length + c.description.length, 0);
      const pick = (...ids: string[]) => ids.find(id => e.choices.some(c => c.id === id)) ?? e.choices[0].id;
      let id = e.choices[0].id;
      if (k === 'funding') id = pick('education-plan', 'loan');
      else if (k === 'specialty-required') id = mode === 'untrained' ? 'untrained' : e.choices[0].id;
      else if (k === 'application-result') id = pick('untrained');
      else if (k === 'practice-required') id = mode === 'untrained' ? pick('untrained') : mode === 'academic' ? pick('research', 'employed') : pick('employed');
      else if (k === 'marriage-required') id = pick('single', 'stay');
      else if (k.startsWith('offer-')) id = pick('decline');
      else if (k === 'journey:route') id = mode === 'academic' ? pick('research', 'academic') : pick('general');
      else if (k === 'journey:academic-entry') id = pick('apply');
      else if (k.startsWith('journey:review:')) id = pick('promote', 'research');
      else if (k === 'depth-application') id = pick('submit');
      state = reduceGame(state, { type: 'choose', id: `c:${state.revision}`, eventId: e.id, choiceId: id });
    }
    const position = `${seed}/${mode}/${state.life!.elapsedMs}/${state.pendingEvent?.randomKey}`;
    if (!validState(state)) throw new Error(`Invalid pacing state: ${position}`);
  }
  if (state.status !== 'completed') throw new Error(`Incomplete pacing run: ${seed}/${mode}`);
  return { state, keys, chars, activeSeconds: state.progress!.activeMs.reduce((a,b) => a+b,0) * speed / 1000 };
}
