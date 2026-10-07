// tile id → svg 文件名映射（FluffyStuff riichi-mahjong-tiles，牌图来自 miniprogram/assets/tiles）
export const TILE_IMG: Record<string, string> = {
  '1m': 'Man1', '2m': 'Man2', '3m': 'Man3', '4m': 'Man4', '5m': 'Man5', '6m': 'Man6', '7m': 'Man7', '8m': 'Man8', '9m': 'Man9',
  '1p': 'Pin1', '2p': 'Pin2', '3p': 'Pin3', '4p': 'Pin4', '5p': 'Pin5', '6p': 'Pin6', '7p': 'Pin7', '8p': 'Pin8', '9p': 'Pin9',
  '1s': 'Sou1', '2s': 'Sou2', '3s': 'Sou3', '4s': 'Sou4', '5s': 'Sou5', '6s': 'Sou6', '7s': 'Sou7', '8s': 'Sou8', '9s': 'Sou9',
  '1z': 'Ton', '2z': 'Nan', '3z': 'Shaa', '4z': 'Pei', '5z': 'Haku', '6z': 'Hatsu', '7z': 'Chun',
  '0m': 'Man5-Dora', '0p': 'Pin5-Dora', '0s': 'Sou5-Dora'
};

export interface TileDef {
  id: string;
  display: string;
  suit: 'm' | 'p' | 's' | 'z';
  num: number;
}

export const TILE_DEFS: TileDef[] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ id: `${n}m`, display: `${n}万`, suit: 'm' as const, num: n })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ id: `${n}p`, display: `${n}筒`, suit: 'p' as const, num: n })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ id: `${n}s`, display: `${n}索`, suit: 's' as const, num: n })),
  { id: '1z', display: '东', suit: 'z', num: 1 },
  { id: '2z', display: '南', suit: 'z', num: 2 },
  { id: '3z', display: '西', suit: 'z', num: 3 },
  { id: '4z', display: '北', suit: 'z', num: 4 },
  { id: '5z', display: '白', suit: 'z', num: 5 },
  { id: '6z', display: '发', suit: 'z', num: 6 },
  { id: '7z', display: '中', suit: 'z', num: 7 }
];

export function tileImgSrc(tileId: string): string {
  const name = TILE_IMG[tileId];
  return name ? `${import.meta.env.BASE_URL}tiles/${name}.svg` : '';
}

export function tileDisplay(tileId: string): string {
  return TILE_DEFS.find((t) => t.id === tileId)?.display || tileId;
}
