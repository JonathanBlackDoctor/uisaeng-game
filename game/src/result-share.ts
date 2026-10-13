import { STAT_LABELS, type GameState, type Stat } from './contracts';
import { SPECIALTIES } from './career';
import { lifeStartAge, RANDOM_RULES } from './random-life';

// Only the public game address is shared, never local preview URLs or save data.
export const GAME_SHARE_URL = 'https://JonathanBlackDoctor.github.io/uisaeng-game/';
export function resultShareData(game: GameState): ShareData {
  const lines = ['의생게임 · 나의 결과'];
  if (game.life) {
    const months = Math.floor(game.life.elapsedMs / RANDOM_RULES.monthMs);
    lines.push(`${lifeStartAge(game) + Math.floor(months / 12)}세 ${months % 12}개월에 마친 이야기`);
  }
  if (game.career) {
    const specialty = SPECIALTIES.find(item => item.id === game.career!.specialty)?.name;
    const practice = { undecided: '진로 탐색', employed: '봉직의', clinic: '개원', research: '연구', untrained: '일반진료' }[game.career.practice];
    lines.push([specialty, practice].filter(Boolean).join(' · '));
  }
  lines.push((Object.keys(STAT_LABELS) as Stat[]).map(key => `${STAT_LABELS[key]} ${game.stats[key]}`).join(' · '));
  lines.push(`생애 기록 ${game.journal.length}개`);
  return { title: '의생게임 · 나의 결과', text: lines.join('\n'), url: GAME_SHARE_URL };
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
