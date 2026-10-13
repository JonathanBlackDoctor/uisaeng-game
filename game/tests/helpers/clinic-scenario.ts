import { createCareerGame } from '../../src/career-runtime';
import { economyAction } from '../../src/economy';
import { initialJourney } from '../../src/specialty-journey';
import { SPECIALTY_DEPTH } from '../../src/specialty-depth';

export function clinicScenario(seed = 42, cash = 300_000_000) {
  const s = createCareerGame('clinic-test', seed), month = 160;
  delete s.identity;
  s.stageIndex = 2;
  Object.assign(s.life!, { elapsedMs: month * 1000, paused: false, speed: 1 });
  Object.assign(s.career!, { specialty: 'internal', institution: 'snuh', application: 'accepted', attempts: 1, practice: 'clinic', lastMonth: month });
  Object.assign(s.economy!, { cash: cash + 20_000_000, assets: cash + 20_000_000, lastMonth: month });
  s.economy = economyAction(s.economy!, 'initial-clinic', 'open-clinic', month).state;
  Object.assign(s.progress!, { club: 'declined', marriage: 'settled', trainingStartMonth: 72, resolved: ['clinical-case', 'practice-required'] });
  s.campus!.lastMonth = s.campus!.lastAmbient = month;
  s.journey = initialJourney(month);
  s.depth!.decisions['depth-institution'] = { choice: 'evaluation', month: 73, followed: true };
  s.depth!.institutionPath = 'evaluation';
  s.depth!.decisions['depth-training'] = { choice: SPECIALTY_DEPTH.internal.training.choices[0].id, month: 78, followed: true };
  s.depth!.decisions['depth-work'] = { choice: SPECIALTY_DEPTH.internal.work.choices[0].id, month: 156, followed: true };
  s.depth!.decisions['depth-workload'] = { choice: 'balanced', month: 150, followed: true };
  return s;
}
