export interface Player {
  name: string;
  points: number;
  riichi: boolean;
}

export interface HistoryEntry {
  type: 'win' | 'draw';
  round: string;
  winner?: number;
  loser?: number;
  isTsumo?: boolean;
  total?: number;
  han?: number;
  fu?: number;
  hand?: string[];
  tenpai?: number[];
}

export interface Game {
  mode: string;
  playerCount: number;
  sanmaTsumoRule: string;
  players: Player[];
  roundIndex: number;
  dealerIndex: number;
  honba: number;
  riichiSticks: number;
  history: HistoryEntry[];
  ended: boolean;
}

export interface Payment {
  from: number;
  to: number;
  amount: number;
}

export interface WinPaymentResult {
  base: number;
  payments: Payment[];
  stickBonus: number;
  total: number;
}

export interface MentsuOverride {
  tiles: string[];
  baseType: 'koutsu' | 'shuntsu';
  isOpen: boolean;
  isKan: boolean;
}

export interface Decomp {
  pair: { tiles: string[] };
  mentsus: { type: string; tiles: string[]; open: boolean }[];
}

export type RiichiState = 'none' | 'riichi' | 'double';

export interface WinConditions {
  isIppatsu: boolean;
  isLastTileTsumo: boolean;
  isLastTileRon: boolean;
  isRobbingKan: boolean;
  isWinFromDeadWall: boolean;
}

export interface YakuEntry {
  name: string;
  han?: number;
  yakuman?: number;
}

export interface EvalResult {
  valid: boolean;
  error?: string;
  han?: number;
  fu?: number;
  basePoint?: number;
  isYakuman?: boolean;
  yakumanCount?: number;
  type?: string;
  waitType?: string;
  yaku?: YakuEntry[];
}

export interface GameEngineApi {
  newGame(countOrMode?: number | string): Game;
  roundNames(game: Game): string[];
  seatOf(game: Game, playerIndex: number): string;
  roundWindTile(game: Game): string;
  seatWindTile(game: Game, playerIndex: number): string;
  calcBasePoint(han: number, fu: number): number;
  calcWinPayments(
    game: Game,
    winnerIdx: number,
    han: number,
    fu: number,
    isTsumo: boolean,
    loserIdx: number,
    baseOverride?: number | null
  ): WinPaymentResult;
  applyWin(
    game: Game,
    win: { winnerIdx: number; loserIdx: number; isTsumo: boolean; han: number; fu: number },
    result: WinPaymentResult
  ): Game;
  applyRiichi(game: Game, selected: number[]): Game;
  applyDraw(game: Game, tenpai: number[]): Game;
}

export interface MahjongLogicApi {
  countTiles(tiles: string[]): Record<string, number>;
  decompose(
    counts: Record<string, number>,
    opts: Set<string>,
    kanCandidates: Set<string>
  ): Decomp[];
  detectWaitType(decomp: Decomp, winTile: string): string;
  isYaochuu(tileId: string): boolean;
  evaluateHand(params: Record<string, unknown>): EvalResult;
}
