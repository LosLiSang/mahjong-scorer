// js/core/tiles.js — 牌定义、SVG 映射与牌码解析（H5 全局共享，Node 可 require）
// 从原 index.html 内联脚本原样抽出；TILE_IMG/TILE_DEFS/tileImgSrc 保持全局可见。
(function (root) {
'use strict';

// tile id → svg 文件名映射（FluffyStuff riichi-mahjong-tiles）
const TILE_IMG = {
  '1m':'Man1','2m':'Man2','3m':'Man3','4m':'Man4','5m':'Man5','6m':'Man6','7m':'Man7','8m':'Man8','9m':'Man9',
  '1p':'Pin1','2p':'Pin2','3p':'Pin3','4p':'Pin4','5p':'Pin5','6p':'Pin6','7p':'Pin7','8p':'Pin8','9p':'Pin9',
  '1s':'Sou1','2s':'Sou2','3s':'Sou3','4s':'Sou4','5s':'Sou5','6s':'Sou6','7s':'Sou7','8s':'Sou8','9s':'Sou9',
  '1z':'Ton','2z':'Nan','3z':'Shaa','4z':'Pei','5z':'Haku','6z':'Hatsu','7z':'Chun',
  // 红宝牌变体
  '0m':'Man5-Dora','0p':'Pin5-Dora','0s':'Sou5-Dora',
};

const TILE_DEFS = [
  ...[1,2,3,4,5,6,7,8,9].map(n => ({ id: n+'m', display: n+'万', suit: 'm', num: n })),
  ...[1,2,3,4,5,6,7,8,9].map(n => ({ id: n+'p', display: n+'筒', suit: 'p', num: n })),
  ...[1,2,3,4,5,6,7,8,9].map(n => ({ id: n+'s', display: n+'索', suit: 's', num: n })),
  { id: '1z', display: '东', suit: 'z', num: 1 },
  { id: '2z', display: '南', suit: 'z', num: 2 },
  { id: '3z', display: '西', suit: 'z', num: 3 },
  { id: '4z', display: '北', suit: 'z', num: 4 },
  { id: '5z', display: '白', suit: 'z', num: 5 },
  { id: '6z', display: '发', suit: 'z', num: 6 },
  { id: '7z', display: '中', suit: 'z', num: 7 },
];

function tileImgSrc(tileId) {
  const name = TILE_IMG[tileId];
  return name ? `tiles/${name}.svg` : '';
}


  // ============ 全局暴露（scorer/vision 视图依赖这些全局名，原内联脚本即如此） ============
  root.TILE_IMG = TILE_IMG;
  root.TILE_DEFS = TILE_DEFS;
  root.tileImgSrc = tileImgSrc;

  // ============ 牌码解析（供识图/验证用） ============
  const MJ = (root.MJ = root.MJ || {});
  const VALID_CODES = new Set(Object.keys(TILE_IMG));
  MJ.tiles = {
    VALID_CODES,
    isValid: function (code) { return VALID_CODES.has(code); },
    // 解析用户输入的牌码列表（空格/逗号/顿号分隔），非法码不吞掉而是报告
    parseTileList: function (text) {
      const parts = String(text == null ? '' : text).split(/[\s,，、]+/).filter(Boolean);
      const tiles = [];
      const invalid = [];
      for (const p of parts) {
        if (VALID_CODES.has(p)) tiles.push(p);
        else invalid.push(p);
      }
      return { ok: invalid.length === 0, tiles, invalid };
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MJ.tiles;
})(typeof window !== 'undefined' ? window : globalThis);
