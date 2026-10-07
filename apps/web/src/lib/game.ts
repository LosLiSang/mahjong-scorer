import { Engine } from './shared';
import type { Game } from './types';

const STORAGE_KEY = 'mj_h5_game_v3';
const LEGACY_KEY = 'mj_game';

function normalize(raw: Partial<Game>): Game {
  const game = Engine.newGame(4);
  if (Array.isArray(raw.players) && raw.players.length === 4) {
    game.players = raw.players.map((p, i) => ({
      name: typeof p?.name === 'string' && p.name ? p.name : game.players[i].name,
      points: Number.isFinite(p?.points) ? Number(p.points) : 25000,
      riichi: !!p?.riichi
    }));
  }
  if (Number.isInteger(raw.roundIndex)) game.roundIndex = raw.roundIndex as number;
  if (Number.isInteger(raw.dealerIndex)) game.dealerIndex = raw.dealerIndex as number;
  if (Number.isInteger(raw.honba)) game.honba = raw.honba as number;
  if (Number.isInteger(raw.riichiSticks)) game.riichiSticks = raw.riichiSticks as number;
  if (Array.isArray(raw.history)) game.history = raw.history as Game['history'];
  game.ended = !!raw.ended;
  return game;
}

export function loadGame(): Game {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return normalize(JSON.parse(legacy));
  } catch {
    // 存档损坏时按新对局处理
  }
  return Engine.newGame(4);
}

export function saveGame(game: Game): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  } catch {
    // 忽略存储失败（隐私模式等）
  }
}
