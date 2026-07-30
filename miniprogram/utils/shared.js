// shared.js — 日麻计分器共享工具
// 牌面定义、图片路径、通用函数

const TILE_DEFS = [
  { id:'1m', display:'一萬' },{ id:'2m', display:'二萬' },{ id:'3m', display:'三萬' },
  { id:'4m', display:'四萬' },{ id:'5m', display:'五萬' },{ id:'6m', display:'六萬' },
  { id:'7m', display:'七萬' },{ id:'8m', display:'八萬' },{ id:'9m', display:'九萬' },
  { id:'1p', display:'一筒' },{ id:'2p', display:'二筒' },{ id:'3p', display:'三筒' },
  { id:'4p', display:'四筒' },{ id:'5p', display:'五筒' },{ id:'6p', display:'六筒' },
  { id:'7p', display:'七筒' },{ id:'8p', display:'八筒' },{ id:'9p', display:'九筒' },
  { id:'1s', display:'一索' },{ id:'2s', display:'二索' },{ id:'3s', display:'三索' },
  { id:'4s', display:'四索' },{ id:'5s', display:'五索' },{ id:'6s', display:'六索' },
  { id:'7s', display:'七索' },{ id:'8s', display:'八索' },{ id:'9s', display:'九索' },
  { id:'1z', display:'東' },{ id:'2z', display:'南' },{ id:'3z', display:'西' },
  { id:'4z', display:'北' },{ id:'5z', display:'白' },{ id:'6z', display:'發' },{ id:'7z', display:'中' },
];

const TILE_FILES = {
  '1m':'Man1','2m':'Man2','3m':'Man3','4m':'Man4','5m':'Man5','6m':'Man6','7m':'Man7','8m':'Man8','9m':'Man9',
  '1p':'Pin1','2p':'Pin2','3p':'Pin3','4p':'Pin4','5p':'Pin5','6p':'Pin6','7p':'Pin7','8p':'Pin8','9p':'Pin9',
  '1s':'Sou1','2s':'Sou2','3s':'Sou3','4s':'Sou4','5s':'Sou5','6s':'Sou6','7s':'Sou7','8s':'Sou8','9s':'Sou9',
  '1z':'Ton','2z':'Nan','3z':'Shaa','4z':'Pei','5z':'Haku','6z':'Hatsu','7z':'Chun'
};

const ALL_TILES = Object.keys(TILE_FILES);
const TILE_NAME_MAP = { '1z':'東','2z':'南','3z':'西','4z':'北','5z':'白','6z':'發','7z':'中' };

function tileSrc(id) {
  const file = TILE_FILES[id];
  return file ? `/assets/tiles/${file}.svg` : '/assets/tiles/Blank.svg';
}

function tileDisplay(id) {
  if (!id) return '—';
  const def = TILE_DEFS.find(t => t.id === id);
  return def ? def.display : id;
}

function tileShortName(id) {
  if (!id) return '未选择';
  if (id.endsWith('z')) return TILE_NAME_MAP[id] || id;
  const suit = { m:'万', p:'筒', s:'索' }[id[1]] || '';
  return id[0] + suit;
}

function compareTile(a, b) {
  return ALL_TILES.indexOf(a) - ALL_TILES.indexOf(b);
}

function nextDora(indicator) {
  if (indicator.endsWith('z')) {
    const winds = ['1z','2z','3z','4z'];
    const dragons = ['5z','6z','7z'];
    const group = winds.includes(indicator) ? winds : dragons;
    return group[(group.indexOf(indicator) + 1) % group.length];
  }
  return `${parseInt(indicator[0], 10) % 9 + 1}${indicator[1]}`;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function unique(arr) {
  return [...new Set(arr)];
}

function emptyConditions() {
  return { isIppatsu:false, isLastTileTsumo:false, isLastTileRon:false, isRobbingKan:false, isWinFromDeadWall:false };
}

module.exports = {
  TILE_DEFS, TILE_FILES, ALL_TILES, TILE_NAME_MAP,
  tileSrc, tileDisplay, tileShortName,
  compareTile, nextDora, clone, unique, emptyConditions
};
