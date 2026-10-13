import type { GameState } from './contracts';
import { campusClub } from './campus';

export type SceneActivity = 'study' | 'connect' | 'rest';
export type SceneRoom = 'library' | 'ward' | 'clinic' | 'research' | 'preparation' | 'home' | 'lounge' | 'campus' | 'park';
export type NotebookState = 'none' | 'offered' | 'kept' | 'returned';
export const NOTEBOOK_IDS = ['shared-notebook', 'notebook-return', 'notebook-handover', 'notebook-ending'];

export function sceneActivity(game: GameState | null): SceneActivity {
  const focus = game?.progress?.focus;
  return focus ? focus === 'rest' ? 'rest' : focus === 'people' ? 'connect' : 'study'
    : game?.life?.focus.main ?? 'study';
}

// Presentation only: no random draws, game-clock changes or new saved state.
export function sceneStory(game: GameState | null) {
  if (!game) return { notebook: 'none' as NotebookState, guestName: undefined };
  const pending = game.pendingEvent?.randomKey;
  const offered = NOTEBOOK_IDS.some(id => pending === `story:${id}`);
  const latest = NOTEBOOK_IDS.map(id => game.stories?.decisions[id]).filter(x => x != null)
    .sort((a, b) => b.month - a.month)[0];
  const notebook: NotebookState = offered ? 'offered' : latest ? latest.choice === 'decline' ? 'returned' : 'kept' : 'none';
  const club = campusClub(game);
  const guestName = offered ? club ? `${club.mentor.split(' 선배 ')[1]} 선배`
    : game.stageIndex === 0 || game.stories?.decisions['shared-notebook'] ? '같은 조였던 동기'
      : game.stageIndex === 3 ? '모임의 후배' : '함께 일하는 동료' : undefined;
  return { notebook, guestName };
}

export function sceneRoom(stage: string, focus: SceneActivity, work?: 'research' | 'preparation', notebook?: NotebookState): SceneRoom {
  if (notebook === 'offered' && stage === 'university') return 'library';
  if (focus === 'connect' && stage === 'retirement') return 'park';
  if (focus === 'rest' || stage === 'retirement') return 'home';
  if (work) return work;
  if (focus === 'connect' && stage === 'university') return 'campus';
  if (focus === 'connect') return 'lounge';
  return stage === 'training' ? 'ward' : stage === 'career' ? 'clinic' : 'library';
}

// Only completed career choices and enabled activities may decorate the scene.
export function sceneAppearance(game: GameState | null) {
  return {
    gender: game?.identity?.gender,
    protagonistName: game?.identity?.name,
    specialty: game && game.stageIndex > 0 && game.career?.application === 'accepted'
      ? game.career.specialty ?? undefined : undefined,
    exercise: game?.lifestyle?.enabled.exercise === true,
    extraStudy: game?.lifestyle?.enabled.study === true,
  };
}

export function seasonIndex(month: number) {
  const safe = ((Math.floor(month) % 12) + 12) % 12;
  return safe < 2 || safe === 11 ? 3 : safe < 5 ? 0 : safe < 8 ? 1 : 2;
}
