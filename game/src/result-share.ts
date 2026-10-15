import { isAddedProfession, professionDefinition, professionOf, practiceLabel } from './professions';
import { STAT_LABELS, type GameState, type Stat } from './contracts';
import { ALL_SPECIALTIES as SPECIALTIES } from './career';
import { lifeStartAge } from './random-life';
import { calendarMonths } from './identity';
import { encounterLabel, netAssets } from './life-goals';
import { formatWon } from './money-format';
import { roundedValue } from './display-values';
import { familyTimeLabel } from './legacy-goals';
import { publicationLabel } from './publications';

// Presentation rules only: use saved accomplishments and resolved choices.
function shareNickname(game: GameState): string {
  const papers = game.publications?.papers.length ?? 0;
  if (papers >= 5 && (game.legacy?.familyTimeUnits ?? 0) >= 1_000_000) return '논문 쓰는 가족파';
  const expansions = new Set(game.economy?.ledger.filter(t => /^clinic:\d+:\d+:expand$/.test(t.id)).map(t => t.id));
  if (expansions.size >= 2) return '원장님, 또 확장이요?';
  if (papers >= 20) return '마감과 평생 동행';
  return '이번 생의 기록';
}

const SHARE_SCENES = [
  { id: 'club-reservation', choices: ['outside', 'negotiate', 'reschedule'], text: '동아리 모임, 장소보다 예약자가 많았다.' },
  { id: 'poster-print', choices: ['simplify'], text: '발표 전날 사라진 그림, 표 하나로 정리했다.' },
  { id: 'roommate-exam', choices: ['agree'], text: '룸메이트와 협상한 안건: 불 끄는 시간.' },
  { id: 'work-boundary', choices: ['today'], text: '퇴근 후 알림 끄기. 오늘의 마지막 업무였다.' },
  { id: 'library-shift', choices: ['read'], text: '도서관에서 책을 빌렸다. 이번 마감은 반납일.' },
  { id: 'walking-route', choices: ['new'], followed: true, text: '새 산책로에서 단골 벤치를 찾았다.' },
  { id: 'notebook-handover', choices: ['lead'], followed: true, text: '노트의 다음 담당자를 찾았다. 저녁 시간도 되찾았다.' },
  { id: 'notebook-ending', choices: ['share'], followed: true, text: '노트는 후배에게. 다음 만남의 안건은 서로의 근황.' },
] as const;

function shareScene(game: GameState): string | undefined {
  return SHARE_SCENES.find(scene => {
    const saved = game.stories?.decisions[scene.id];
    return saved && (scene.choices as readonly string[]).includes(saved.choice)
      && (!('followed' in scene) || saved.followed);
  })?.text;
}

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
  const lines = [`🩺 의생게임 · ${shareNickname(game)}`];
  if (context.length) lines.push([...new Set(context)].join(' · '));
  lines.push('');
  if (game.career) lines.push(`${professionOf(game) === 'nursing' ? '누적 돌봄' : '누적 진료'} ${encounterLabel(game)} · 순자산 ${netAssets(game) === null ? '기록 없음' : formatWon(netAssets(game)!)}`);
  if (game.career) lines.push(`가족과 보낸 시간 ${familyTimeLabel(game)} · 발표한 논문 ${publicationLabel(game)}`);
  lines.push((Object.keys(STAT_LABELS) as Stat[]).map(key => `${STAT_LABELS[key]} ${roundedValue(game.stats[key])}`).join(' · '));
  const scene = shareScene(game);
  if (scene) lines.push('', `🎬 ${scene}`);
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
