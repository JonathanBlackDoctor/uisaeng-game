import type { IncidentDefinition } from './major-event-catalog';

// Game tuning only. Keep past versions stable: an open case retains its balance version.
export const INCIDENT_BALANCE = {
  version: 2, provisional: true,
  lifeCostMultiplier: 3, medicalCostMultiplier: 2, assetLoss: .75,
  durationMultiplier: 1.5, incomeCutMultiplier: 1.5, maximumIncomeCut: .95,
  initialHealthLoss: 10, initialMedicalHealthLoss: 20, initialHappinessLoss: 20, initialRelationshipLoss: 8,
  quarterlyStrain: 2, slowQuarterlyStrain: 3,
  majorStatChange: 12, majorCombinedChange: 25,
  majorWealthChange: 30_000_000, minimumRelativeWealthChange: 10_000_000, majorRelativeWealthChange: .5,
} as const;

export const adverseIncident = (d: IncidentDefinition) =>
  (d.mode === 'loss' && d.id !== 'retraining') || d.mode === 'asset-loss';

export function incidentAmount(d: IncidentDefinition, liability = 1, version = 1) {
  const multiplier = version === 2 && adverseIncident(d)
    ? d.pool === 'medical' ? INCIDENT_BALANCE.medicalCostMultiplier : INCIDENT_BALANCE.lifeCostMultiplier : 1;
  return Math.round(d.amount * liability * multiplier);
}

export function recoveryPlan(d: IncidentDefinition, second: boolean, version = 1) {
  const stronger = version === 2 && adverseIncident(d);
  return {
    months: Math.round(d.months * (stronger ? INCIDENT_BALANCE.durationMultiplier : 1) * (second ? 1.5 : 1)),
    cut: Math.min(stronger ? INCIDENT_BALANCE.maximumIncomeCut : .8,
      d.cut * (stronger ? INCIDENT_BALANCE.incomeCutMultiplier : 1) + (second ? .1 : 0)),
    strain: stronger ? second ? INCIDENT_BALANCE.slowQuarterlyStrain : INCIDENT_BALANCE.quarterlyStrain : second ? 2 : 1,
    relationship: stronger ? second ? 2 : 1 : 0,
  };
}
