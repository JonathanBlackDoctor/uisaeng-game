import { isAddedProfession, professionDefinition, professionOf, practiceLabel } from './professions';
import { STAT_LABELS, type GameState, type Stat } from './contracts';
import { ALL_SPECIALTIES as SPECIALTIES } from './career';
import { lifeStartAge } from './random-life';
import { calendarMonths } from './identity';
import { encounterLabel, netAssets } from './life-goals';
import { formatWon } from './money-format';
import { roundedValue } from './display-values';
import { ABILITIES, abilityState } from './abilities';

// Only the public game address is shared, never local preview URLs or save data.
export const GAME_SHARE_URL = 'https://JonathanBlackDoctor.github.io/uisaeng-game/';
export function resultShareData(game: GameState): ShareData {
  const context: string[] = [];
  if (game.career) {
    const specialty = SPECIALTIES.find(item => item.id === game.career!.specialty)?.name;
    const practice = { undecided: '진로 탐색', employed: '봉직의', clinic: '개원', research: '연구', untrained: '일반진료' }[game.career.practice];
    context.push(...[professionDefinition(game).label, specialty, isAddedProfession(game) ? practiceLabel(game) : practice].filter((value): value is string => !!value));
  }
  if (game.life) {
    const months = calendarMonths(game);
    context.push(`${lifeStartAge(game) + Math.floor(months / 12)}세${months % 12 ? ` ${months % 12}개월` : ''}`);
  }
  const lines = ['의생게임 · 이번 생의 기록'];
  if (context.length) lines.push([...new Set(context)].join(' · '));
  lines.push('');
  if (game.career) lines.push(`${professionOf(game) === 'nursing' ? '누적 돌봄' : '누적 진료'} ${encounterLabel(game)} · 순자산 ${netAssets(game) === null ? '기록 없음' : formatWon(netAssets(game)!)}`);
  if (game.abilities) {
    const values = abilityState(game).values;
    const strongest = [...ABILITIES].sort((a, b) => values[b.id] - values[a.id])[0];
    if (values[strongest.id] > 0) lines.push(`주력 능력 · ${strongest.label} ${roundedValue(values[strongest.id])}`);
  }
  if (game.statHighs?.fromStart) {
    const highs = game.statHighs.values;
    const peak = (Object.keys(STAT_LABELS) as Stat[]).sort((a, b) => highs[b] - highs[a])[0];
    lines.push(`인생 최고점 · ${STAT_LABELS[peak]} ${roundedValue(highs[peak])}`);
  }
  if (game.professional?.certificateEarned && game.professional.certificate) {
    lines.push(`전문자격까지 · ${game.professional.certificate} 전문간호사`);
  } else if (game.publications?.papers.length) {
    lines.push(`남긴 논문 · ${game.publications.papers.length.toLocaleString('ko-KR')}편`);
  }
  lines.push((Object.keys(STAT_LABELS) as Stat[]).map(key => `${STAT_LABELS[key]} ${roundedValue(game.stats[key])}`).join(' · '));
  return { title: '의생게임', text: lines.join('\n'), url: GAME_SHARE_URL };
}

export function resultShareText(data: ShareData): string {
  return [data.text, data.url].filter(Boolean).join('\n\n');
}

export type ShareBrowser = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
};
export type ShareOutcome = 'handed-off' | 'cancelled' | 'copied' | 'manual' | 'failed';

export async function copyResult(data: ShareData, browser: ShareBrowser): Promise<ShareOutcome> {
  try {
    if (!browser.clipboard?.writeText) return 'manual';
    await browser.clipboard.writeText(resultShareText(data));
    return 'copied';
  } catch { return 'manual'; }
}

export async function shareResult(data: ShareData, browser: ShareBrowser): Promise<ShareOutcome> {
  try {
    // Call share synchronously from the click, before any asynchronous work.
    if (browser.share && (!browser.canShare || browser.canShare(data))) {
      await browser.share(data);
      return 'handed-off';
    }
  } catch (error) {
    // A cancelled share must never trigger a clipboard write or retry.
    return (error as { name?: string } | null)?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
  return copyResult(data, browser);
}
