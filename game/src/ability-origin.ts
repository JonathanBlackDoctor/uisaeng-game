import type { LifeBackground, Stat } from './contracts';
import { backgroundAbilityBonuses, backgroundStatEffects } from './background';
import { LEGACY_ABILITY_MEMBERS, type AbilityId } from './ability-schema';

// Read the same contributions used by generation. Never infer an experience
// from a high or low roll, wealth, region, or a later saved ability value.
export function startingStatReason(background: LifeBackground, stat: Stat): string {
  const factors: { reason: string; amount: number }[] = [];
  backgroundStatEffects(background, (reason, effects) => {
    if (effects[stat]) factors.push({ reason, amount: effects[stat]! });
  });
  factors.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return factors[0]?.reason ?? '입학 당시의 개인차';
}

export function startingAbilityReason(background: LifeBackground | undefined, id: AbilityId): string {
  const members: readonly string[] = LEGACY_ABILITY_MEMBERS[id];
  const factors = new Map<string, number>();
  backgroundAbilityBonuses(background, (reason, skills, amount) => {
    const contribution = skills.filter(skill => members.includes(skill)).length * amount;
    if (contribution) factors.set(reason, (factors.get(reason) ?? 0) + contribution);
  });
  const strongest = [...factors].filter(([, n]) => n !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  if (!strongest) return ['technique', 'research', 'management'].includes(id)
    ? '전문 훈련을 시작하기 전이라 기초부터 익힙니다.' : '입학 당시의 개인차에서 출발합니다.';
  return `${strongest[0]} · 시작 실력에 ${strongest[1] > 0 ? '보탬이 됐습니다.' : '부담으로 작용했습니다.'}`;
}
