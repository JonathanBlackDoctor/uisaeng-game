import type { GameState } from './contracts';
import { ABILITIES, ABILITY_SITUATIONS, FOCUS_ABILITIES, abilityPerformance, focusAbilityModifier } from './abilities';

export function relevantAbilities(game: GameState) {
  const situation = ABILITY_SITUATIONS.find(s => s.key === game.pendingEvent?.randomKey);
  return (situation?.skills ?? FOCUS_ABILITIES[game.progress?.focus ?? 'study']).slice(0, 3);
}

// Read-only feedback; inspecting abilities never rolls an outcome.
export default function AbilitySummary({ game, decision = false }: { game: GameState; decision?: boolean }) {
  if (!game.abilities || !game.progress) return null;
  const situation = ABILITY_SITUATIONS.find(s => s.key === game.pendingEvent?.randomKey);
  if (decision) {
    if (!situation) return null;
    const value = abilityPerformance(game, situation.gate).current;
    const name = ABILITIES.find(a => a.id === situation.gate)!.label;
    const available = game.pendingEvent!.choices.some(c => c.id === 'advanced');
    return <p className="ability-impact">{name} {value.toFixed(1)} · {available
      ? `‘${situation.advanced}’ 선택 가능`
      : `${situation.threshold}부터 ‘${situation.advanced}’ 선택 가능`}</p>;
  }
  const modifier = focusAbilityModifier(game, game.progress.focus);
  const month = Math.floor((game.life?.elapsedMs ?? 0) / 1000);
  const recent = relevantAbilities(game).map(id => ({ id, change: game.abilities!.changes[id] }))
    .filter(x => x.change && x.change.month === month && x.change.delta !== 0).slice(0, 2);
  return <div className="ability-impact">
    <p>{modifier > 0 ? '지금 실력이 활동 성과에 도움이 됩니다.' : modifier < 0 ? '실력과 컨디션이 부족해 활동 성과가 줄어듭니다.' : '관련 실력을 쌓으며 활동하고 있습니다.'}</p>
    {recent.length > 0 && <p className="ability-growth">이번 달 · {recent.map(({ id, change }) => `${ABILITIES.find(a => a.id === id)!.label} ${change!.delta > 0 ? '+' : ''}${change!.delta.toFixed(1)}`).join(' · ')}</p>}
  </div>;
}
