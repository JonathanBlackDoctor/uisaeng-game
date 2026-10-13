import { createCareerGame } from '../../src/career-runtime';
import { reduceGame } from '../../src/engine';
import { netAssets } from '../../src/life-goals';
import { lifestyleSchedule } from '../../src/lifestyle';
import { validState } from '../../src/storage';

export type Scenario = 'balanced' | 'research' | 'clinical' | 'family';
export function simulateLifetime(seed: number, mode: Scenario) {
  let s = createCareerGame(`range:${seed}:${mode}`, seed);
  // Research, normal clinical work, a busy clinic, or a family-focused employed doctor.
  s.life!.paused = false; s.life!.speed = 16;
  for (let i = 0; i < 5000 && s.status !== 'completed'; i++) {
    const e = s.pendingEvent;
    if (e) {
      const k = e.randomKey ?? '';
      let prefs = ['promote', 'apply', 'lead', 'qualify', 'continue', 'balanced', 'pass', 'decline'];
      if (k === 'funding') prefs = ['education-plan', 'pay-due', 'loan'];
      if (k === 'club-required' || k === 'campus-club-kind') prefs = mode === 'research' ? ['research', 'decline'] : ['decline'];
      if (k === 'application-result') prefs = ['continue', 'untrained'];
      if (k === 'practice-required') prefs = mode === 'research' ? ['research'] : mode === 'clinical' ? ['clinic', 'employed', 'untrained'] : ['employed', 'untrained'];
      if (k === 'clinic-funding') prefs = ['open-clinic', 'loan'];
      if (k === 'journey:route') prefs = [mode === 'research' ? 'research' : 'general'];
      if (k === 'depth-workload') prefs = [mode === 'clinical' ? 'extended' : 'balanced'];
      if (k.startsWith('offer-')) prefs = ['decline'];
      if (k === 'marriage-required') prefs = ['single', 'stay'];
      const choiceId = prefs.find(id => e.choices.some(c => c.id === id)) ?? e.choices[0].id;
      s = reduceGame(s, {type:'choose',id:`range:${s.revision}`,eventId:e.id,choiceId});
    } else {
      const focus = mode === 'research' ? 'research' : s.stageIndex === 0 || s.stageIndex === 1 ? 'study'
        : mode === 'family' || s.stageIndex === 3 ? 'rest' : mode === 'clinical' ? 'work' : 'clinical';
      if (s.progress!.focus !== focus) s = reduceGame(s, {type:'career-focus',id:`range:${s.revision}`,focus});
      if (mode !== 'clinical' && !s.lifestyle!.enabled.family && lifestyleSchedule(s).remaining >= 6)
        s = reduceGame(s, {type:'lifestyle',id:`range:${s.revision}`,key:'family',enabled:true});
      if ((mode === 'research' || mode === 'balanced' && s.stageIndex >= 2) && !s.lifestyle!.enabled.research && lifestyleSchedule(s).remaining >= 6)
        s = reduceGame(s, {type:'lifestyle',id:`range:${s.revision}`,key:'research',enabled:true});
      if (s.stageIndex === 2 && s.career!.practice !== 'undecided') {
        if (s.portfolio!.autoRepay !== 1000000) s = reduceGame(s, {type:'money-plan',id:`range:${s.revision}`,field:'autoRepay',amount:1000000});
        const workload = mode === 'clinical' && s.career!.practice !== 'research' ? 'extended' : 'balanced';
        if (s.depth!.workload !== workload) s = reduceGame(s, {type:'workload',id:`range:${s.revision}`,workload});
      }
      s = reduceGame(s, {type:'tick',id:`range:${s.revision}`,elapsedMs:1000});
    }
    const diagnostic = `Invalid simulation ${seed}/${mode}/${s.life!.elapsedMs}/${s.pendingEvent?.randomKey}`;
    if (!validState(s)) throw new Error(diagnostic);
  }
  if (s.status !== 'completed') throw new Error(`Incomplete simulation ${seed}/${mode}/${s.pendingEvent?.randomKey}`);
  return { state:s, values:{ seed,mode,practice:s.career!.practice, encounters:s.encounters!.total, assets:netAssets(s)!,
    familyHours:Math.floor(s.legacy!.familyTimeUnits/1000), papers:s.publications!.papers.length } };
}
