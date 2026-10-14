import type { GameState } from './contracts';
import { ABILITIES, ABILITY_SITUATIONS, FOCUS_ABILITIES, abilityPerformance, abilityState, specialtySynergy } from './abilities';
import { isLegacyAbilities } from './ability-schema';
import { roundedValue, signedValue, synergyLabel } from './display-values';
import { abilityRoute, performancePreview } from './ability-impact';

export function relevantAbilities(game: GameState) {
  const situation = ABILITY_SITUATIONS.find(s => s.key === game.pendingEvent?.randomKey);
  if (!situation && game.pendingEvent?.abilityImpactVersion === 1) return [...new Set(game.pendingEvent.choices.map(c => abilityRoute(game, game.pendingEvent!, c.id)?.skill).filter((id): id is (typeof ABILITIES)[number]['id'] => !!id))].slice(0, 3);
  return (situation?.skills ?? FOCUS_ABILITIES[game.progress?.focus ?? 'study']).slice(0, 3);
}

// Read-only feedback; inspecting abilities never rolls an outcome.
export default function AbilitySummary({ game, decision = false }: { game: GameState; decision?: boolean }) {
  if (!game.abilities || !game.progress) return null;
  const situation = ABILITY_SITUATIONS.find(s => s.key === game.pendingEvent?.randomKey);
  if (decision) {
    if (!situation || isLegacyAbilities(game.abilities)) return null;
    const value = abilityPerformance(game, situation.gate).current;
    const name = ABILITIES.find(a => a.id === situation.gate)!.label;
    const available = game.pendingEvent!.choices.some(c => c.id === 'advanced');
    return <p className="ability-impact">{name} {roundedValue(value)} · {available
      ? `‘${situation.advanced}’ 선택 가능`
      : roundedValue(value) >= situation.threshold
        ? `실력을 더 쌓으면 ‘${situation.advanced}’ 선택 가능`
        : `${situation.threshold}부터 ‘${situation.advanced}’ 선택 가능`}</p>;
  }
  const performance = performancePreview(game, game.progress.focus);
  const synergy = specialtySynergy(game, game.progress.focus);
  const month = Math.floor((game.life?.elapsedMs ?? 0) / 1000);
  const abilities = abilityState(game);
  const recent = relevantAbilities(game).map(id => ({ id, change: abilities.changes[id] }))
    .filter(x => x.change && x.change.month === month && roundedValue(x.change.delta) !== 0).slice(0, 2);
  return <div className="ability-impact">
    {synergy > 1 && <p>전공 시너지 {synergyLabel(synergy)} · 성장과 성과 보상에 적용</p>}
    <p>{ABILITIES.find(a => a.id === performance.skill)!.label} 중심 수행력 {roundedValue(performance.score)} · {performance.tier}</p>
    {performance.margin < 25 && <p>다음 단계까지 수행력 {Math.ceil((performance.margin < -10 ? -10 : performance.margin < 8 ? 8 : 25) - performance.margin)}</p>}
    {recent.length > 0 && <p className="ability-growth">이번 달 · {recent.map(({ id, change }) => `${ABILITIES.find(a => a.id === id)!.label} ${signedValue(change!.delta)}`).join(' · ')}</p>}
  </div>;
}
