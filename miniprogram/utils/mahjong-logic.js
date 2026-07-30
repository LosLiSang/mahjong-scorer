// mahjong-logic.js — 日麻翻符计算核心引擎
// 纯函数，不依赖 DOM，可单独测试

// ============ 牌定义 ============
// 数牌: 1m..9m, 1p..9p, 1s..9s
// 字牌: 1z(东) 2z(南) 3z(西) 4z(北) 5z(白) 6z(发) 7z(中)

const SUITS = ['m', 'p', 's'];
const HONOR_IDS = ['1z','2z','3z','4z','5z','6z','7z'];

// 牌的基本属性
function isHonor(id) { return id.endsWith('z'); }
function suitOf(id) { return id.slice(-1); }
function numOf(id) { return parseInt(id); }
function isTerminal(id) {
  if (isHonor(id)) return false;
  const n = numOf(id);
  return n === 1 || n === 9;
}
// 幺九牌 = 老头牌(1,9 数牌) + 字牌
function isYaochuu(id) { return isTerminal(id) || isHonor(id); }

// 获取某种花色的牌 id 数组
function suitTiles(suit) {
  return [1,2,3,4,5,6,7,8,9].map(n => n + suit);
}

// ============ 牌计数工具 ============
// tiles: string[]，每个 id 出现一次
// 返回 { id: count }
function countTiles(tiles) {
  const c = {};
  for (const t of tiles) c[t] = (c[t] || 0) + 1;
  return c;
}

// 从计数中减去
function subtractCount(counts, id, n=1) {
  const nc = {...counts};
  nc[id] = (nc[id] || 0) - n;
  if (nc[id] <= 0) delete nc[id];
  return nc;
}

// ============ 面子类型 ============
// 'shuntsu' 顺子, 'koutsu' 刻子, 'kantsu' 杠子, 'pair' 雀头
// 每个 mentsu = { type, tiles: string[], open: bool }
//   open=false: 暗刻/暗杠/暗顺子(门前)
//   open=true:  明刻/明杠/加杠/吃来的顺子

// ============ 分解算法 ============
// 给定计数 {id: count}，找出所有合法的 4面子+1雀头 分解
// 返回 [{ pairs: [雀头id], mentsus: [{type,tiles,open}] }]
function decompose(counts, openIds = new Set(), kanIds = new Set()) {
  const results = [];
  const work = {...counts};
  const allIds = Object.keys(work).sort(compareTiles);

  for (const pairId of Object.keys(work)) {
    if (work[pairId] >= 2) {
      const w1 = subtractCount(work, pairId, 2);
      const pairMentsu = { type: 'pair', tiles: [pairId, pairId], open: false };
      const mentsusList = findMentsus(w1, openIds, kanIds);
      for (const mentsus of mentsusList) {
        results.push({ pair: pairMentsu, mentsus });
      }
    }
  }
  return results;
}

function compareTiles(a, b) {
  const sa = suitOf(a), sb = suitOf(b);
  if (sa !== sb) return SUITS.indexOf(sa) - SUITS.indexOf(sb);
  return numOf(a) - numOf(b);
}

// 在剩余计数中找 4 个面子，递归
// 支持杠子（4张同种），但只有当 openIds 里标记了该 id 是杠时才用
function findMentsus(counts, openIds, kanIds) {
  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  if (total === 0) return [[]];
  // total 需要是 3 的倍数（无杠）或 含杠时每杠多1张
  // 杠子让 total 可以是 3k+1, 3k+2 等，所以这里不检查 %3
  // 改为：如果 total 不能被 (3 或 含杠组合) 整除就放弃
  // 简化：只要有牌就继续尝试，找不到匹配就自然返回空
  if (total < 3 && total !== 0) return [];

  // 找最小的 id
  const firstId = Object.keys(counts).sort(compareTiles)[0];
  const cnt = counts[firstId];
  const results = [];

  // 尝试杠子（仅当 kanIds 标记了且数量>=4）
  if (kanIds && kanIds.has(firstId) && cnt >= 4) {
    const w = subtractCount(counts, firstId, 4);
    const isOpen = openIds.has(firstId + ':kantsu-open');
    const isClosed = !isOpen;
    const rest = findMentsus(w, openIds, kanIds);
    for (const r of rest) {
      results.push([{ type: 'kantsu', tiles: [firstId,firstId,firstId,firstId], open: isOpen, closed: isClosed }, ...r]);
    }
  }

  // 尝试刻子
  if (cnt >= 3) {
    const w = subtractCount(counts, firstId, 3);
    const isOpen = openIds.has(firstId + ':koutsu');
    const rest = findMentsus(w, openIds, kanIds);
    for (const r of rest) {
      results.push([{ type: 'koutsu', tiles: [firstId,firstId,firstId], open: isOpen }, ...r]);
    }
  }

  // 尝试顺子（仅数牌）
  if (!isHonor(firstId)) {
    const n = numOf(firstId);
    const s = suitOf(firstId);
    if (n <= 7) {
      const id2 = (n+1) + s, id3 = (n+2) + s;
      if (counts[id2] > 0 && counts[id3] > 0) {
        let w = subtractCount(counts, firstId, 1);
        w = subtractCount(w, id2, 1);
        w = subtractCount(w, id3, 1);
        const isOpen = openIds.has(firstId + ':shuntsu');
        const rest = findMentsus(w, openIds, kanIds);
        for (const r of rest) {
          results.push([{ type: 'shuntsu', tiles: [firstId,id2,id3], open: isOpen }, ...r]);
        }
      }
    }
  }

  return results;
}

// ============ 符数计算 ============
// params:
//   decomposition: { pair, mentsus }
//   isTsumo: bool
//   isClosed: bool 门前清
//   winTile: string 和的那张牌（用于判断边张/嵌张/单骑听牌）
//   isPinfu: bool 是否平和（外层判定，平和走特殊符）
//   isChiitoi: bool 是否七对子（固定25符）
function calcFu(decomp, isTsumo, isClosed, winTile, opts = {}) {
  if (opts.isChiitoi) return { fu: 25, base: 25 };

  // 所有牌型从副底 20 符开始；门前荣和另加 10 符
  let fu = 20;
  // 平和荣和 = 30符，平和自摸 = 20符，不走细节加符

  if (opts.isPinfu) {
    // 平和：不加任何刻子符，只加自摸符(2)
    // 自摸平和 = 20符，荣和平和 = 30符
    fu = isTsumo ? 20 : 30;
    return { fu, base: roundFu(fu) };
  }

  // 雀头符
  const pairId = decomp.pair.tiles[0];
  // 场风/自风/三元牌 雀头 +2符，连风 +4
  if (opts.pairBonus && opts.pairBonus > 0) {
    fu += opts.pairBonus;
  }

  // 面子符
  for (const m of decomp.mentsus) {
    if (m.type === 'shuntsu') continue;
    const id = m.tiles[0];
    const yao = isYaochuu(id) ? 2 : 1;
    if (m.type === 'kantsu') {
      fu += (m.open ? 16 : 32) * yao / 2;
    } else if (m.type === 'koutsu') {
      // 荣和在双碰听时，胡牌张补成的刻子按明刻计算符数
      const ronCompletedTriplet = !isTsumo && opts.waitType === 'shanpon' && id === winTile;
      const effectiveOpen = m.open || ronCompletedTriplet;
      fu += (effectiveOpen ? 2 : 4) * yao;
    }
  }

  // 听牌符
  if (opts.waitType === 'kanchan' || opts.waitType === 'penchan' || opts.waitType === 'tanki') {
    fu += 2;
  }

  // 和牌方式符
  if (isTsumo && !opts.isPinfu) {
    fu += 2; // 门前/副露自摸都+2（除平和自摸）
  } else if (!isTsumo && isClosed) {
    fu += 10; // 只有门前荣和 +10；副露荣和不加
  }

  // 向上取整到十位（20/30 除外，但标准规则是任何符数都向上取整）
  // 实际上 20/30 是底符，加完符才取整
  // 七对子 25 符不取整
  return { fu, base: roundFu(fu) };
}

function roundFu(fu) {
  return Math.ceil(fu / 10) * 10;
}

// 判断听牌类型
// decomp: 分解, winTile: 和的那张牌
// 返回 'ryanmen'(两面) / 'kanchan'(嵌张) / 'penchan'(边张) / 'tanki'(单骑) / 'shanpon'(双碰)
function detectWaitType(decomp, winTile) {
  // 雀头单骑
  if (decomp.pair.tiles[0] === winTile) return 'tanki';

  // 面子听
  for (const m of decomp.mentsus) {
    if (m.type === 'koutsu' || m.type === 'kantsu') {
      if (m.tiles[0] === winTile) return 'shanpon';
      continue;
    }
    if (m.type === 'shuntsu') {
      const ids = m.tiles.map(numOf).sort((a,b)=>a-b);
      const wN = numOf(winTile);
      // 顺子含 winTile 的情况（这个面子靠 winTile 完成）
      if (m.tiles.includes(winTile)) {
        if (ids[0] === 1 && wN === 3) return 'penchan';
        if (ids[2] === 9 && wN === 7) return 'penchan';
        if (wN === ids[0] + 1) return 'kanchan';
        return 'ryanmen';
      }
    }
  }
  // 默认
  return 'ryanmen';
}

// ============ 役判定 ============
// params: {
//   decomp, tiles (全部14张), isClosed, isTsumo, isRiichi, winTile,
//   roundWind: '1z'(东)/'2z'(南), seatWind: '1z'..'4z',
//   doraTiles: string[] (手里的宝牌), indicatorTiles: string[] (指示牌，转成宝牌),
//   isIppatsu, isRobbingKan, isLastDraw, isLastDiscard, isTenhou/Chiihou
// }
// 返回 [{ name, han, yakuman }] 满足的役列表
// 注意：门前限定、副露降翻 都在此处理

const YAKU_RULES = [
  // === 1 翻 ===
  { name: '立直', han: 1, closed: true, check: p => p.isRiichi && !p.isOpened },
  { name: '一发', han: 1, closed: true, check: p => p.isIppatsu && (p.isRiichi || p.isDoubleRiichi) && !p.isOpened },
  { name: '门前清自摸和', han: 1, closed: true, check: p => p.isTsumo && !p.isOpened },
  {
    name: '平和',
    han: 1,
    closed: true,
    check: (p, r) => r.isPinfu,
    // 平和判定单独做，传入 r.isPinfu
  },
  {
    name: '断幺九',
    han: 1,
    check: p => p.tiles.every(t => !isYaochuu(t)),
    // 副露可，雀魂规则断幺不要求门前
  },
  { name: '一杯口', han: 1, closed: true, check: (p, r) => r.hasIipeikou },
  { name: '枪杠', han: 1, check: p => p.isRobbingKan },
  { name: '岭上开花', han: 1, check: p => p.isWinFromDeadWall },
  { name: '海底摸月', han: 1, check: p => p.isTsumo && p.isLastTile },
  { name: '河底捞鱼', han: 1, check: p => !p.isTsumo && p.isLastTile },
  // 场风/自风/三元
  {
    name: '场风',
    han: 1,
    check: (p, r) => r.roundWindSets.length > 0,
    special: 'wind',
  },
  {
    name: '自风',
    han: 1,
    check: (p, r) => r.seatWindSets.length > 0,
    special: 'wind',
  },
  {
    name: '白',
    han: 1,
    check: (p, r) => r.hasHaku,
  },
  {
    name: '发',
    han: 1,
    check: (p, r) => r.hasHatsu,
  },
  {
    name: '中',
    han: 1,
    check: (p, r) => r.hasChun,
  },

  // === 2 翻 ===
  { name: '两立直', han: 2, closed: true, check: p => p.isDoubleRiichi },
  { name: '七对子', han: 2, closed: true, check: (p, r) => r.isChiitoi },
  {
    name: '混全带幺九',
    han: 2, closed: true, hanOpen: 1,
    check: (p, r) => r.isChanta && !r.isJunchan,
  },
  {
    name: '一气通贯',
    han: 2, closed: true, hanOpen: 1,
    check: (p, r) => r.isIkkitsuukan,
  },
  {
    name: '三色同顺',
    han: 2, closed: true, hanOpen: 1,
    check: (p, r) => r.isSanshoku,
  },
  { name: '三色同刻', han: 2, check: (p, r) => r.isSanshokuDoukou },
  { name: '三暗刻', han: 2, check: (p, r) => r.sanAnkou >= 3 },
  { name: '三杠子', han: 2, check: (p, r) => r.kanCount >= 3 },
  { name: '对对和', han: 2, check: (p, r) => r.allTriplets },
  {
    name: '混一色',
    han: 3, closed: true, hanOpen: 2,
    check: (p, r) => r.isChinitsu && r.hasHonor && !r.isChinitsuOnly,
    // 实际是混一色 = 单一花色+字牌
  },
  {
    name: '纯全带幺九',
    han: 3, closed: true, hanOpen: 2,
    check: (p, r) => r.isJunchan,
  },

  // === 4-6 翻 ===
  { name: '二杯口', han: 3, closed: true, check: (p, r) => r.isRyanpeikou },
  {
    name: '清一色',
    han: 6, closed: true, hanOpen: 5,
    check: (p, r) => r.isChinitsuOnly,
  },

  // === 役满 ===
  { name: '天和', han: 0, yakuman: 1, check: p => p.isTenhou },
  { name: '地和', han: 0, yakuman: 1, check: p => p.isChiihou },
  { name: '人和', han: 0, yakuman: 1, check: p => p.isRenhou, optional: true },
  { name: '大三元', han: 0, yakuman: 1, check: (p, r) => r.daiSanGen },
  { name: '大四喜', han: 0, yakuman: 2, check: (p, r) => r.daiSuushii },
  { name: '小四喜', han: 0, yakuman: 1, check: (p, r) => r.shouSuushii },
  { name: '字一色', han: 0, yakuman: 1, check: (p, r) => r.tsuuiisou },
  { name: '绿一色', han: 0, yakuman: 1, check: (p, r) => r.ryuuiisou },
  { name: '清老头', han: 0, yakuman: 1, check: (p, r) => r.chinroutou },
  { name: '四杠子', han: 0, yakuman: 1, check: (p, r) => r.kanCount >= 4 },
  { name: '小三元', han: 0, yakuman: 1, check: (p, r) => r.shouSanGen },
  { name: '四暗刻', han: 0, yakuman: 1, check: (p, r) => r.suAnkou >= 4 && !r.suAnkouSingle },
  { name: '四暗刻单骑', han: 0, yakuman: 2, check: (p, r) => r.suAnkouSingle },
  {
    name: '九莲宝灯',
    han: 0, yakuman: 1, closed: true,
    check: (p, r) => r.chuurenPoutou && !r.chuurenPure,
  },
  {
    name: '纯正九莲宝灯',
    han: 0, yakuman: 2, closed: true,
    check: (p, r) => r.chuurenPure,
  },
  {
    name: '国士无双',
    han: 0, yakuman: 1, closed: true,
    check: (p, r) => r.kokushi && !r.kokushi13,
  },
  {
    name: '国士无双十三面',
    han: 0, yakuman: 2, closed: true,
    check: (p, r) => r.kokushi13,
  },
];

// 计算牌型结构特征（用于役判定）
function analyzeStructure(tiles, decomp, params) {
  const counts = countTiles(tiles);
  const r = {
    sanAnkou: 0,
    suAnkou: 0,
    suAnkouSingle: false,
    kanCount: 0,
    allTriplets: true,
    hasHonor: false,
    isChiitoi: false,
    isChanta: true,        // 全带幺九（混或纯）
    isJunchan: true,       // 纯全（无数牌幺九）
    isIkkitsuukan: false,
    isSanshoku: false,
    isSanshokuDoukou: false,
    hasIipeikou: false,
    isRyanpeikou: false,
    isChinitsu: false,      // 单一数牌花色
    isChinitsuOnly: false,  // 清一色（无数牌以外）
    daiSanGen: false,
    daiSuushii: false,
    shouSuushii: false,
    tsuuiisou: false,
    ryuuiisou: false,
    chinroutou: false,
    shouSanGen: false,
    kokushi: false,
    kokushi13: false,
    chuurenPoutou: false,
    chuurenPure: false,
    hasHaku: false,
    hasHatsu: false,
    hasChun: false,
    roundWindSets: [],
    seatWindSets: [],
  };

  // 是否有字牌
  r.hasHonor = tiles.some(isHonor);

  // 七对子判定（7 组对子）
  if (Object.values(counts).every(c => c === 2) && Object.keys(counts).length === 7) {
    r.isChiitoi = true;
  }

  // 分析每个面子
  let allShuntsu = true;
  let allKoutsu = true;
  for (const m of decomp.mentsus) {
    if (m.type !== 'shuntsu') allShuntsu = false;
    if (m.type !== 'koutsu' && m.type !== 'kantsu') allKoutsu = false;
    if (m.type === 'kantsu') r.kanCount++;
    const ronCompletedTriplet = !params.isTsumo && m.type === 'koutsu' &&
      m.tiles[0] === params.winTile && decomp.pair.tiles[0] !== params.winTile;
    if ((m.type === 'koutsu' || m.type === 'kantsu') && !m.open && !ronCompletedTriplet) {
      r.sanAnkou++;
      r.suAnkou++;
    }
  }
  r.allTriplets = allKoutsu && decomp.mentsus.every(m => m.type !== 'shuntsu');

  // 三暗刻
  // （上面已数）

  // 四暗刻单骑：雀头是单骑听牌 + 4 个暗刻
  if (r.suAnkou >= 4 && params.winTile && decomp.pair.tiles[0] === params.winTile) {
    r.suAnkouSingle = true;
  }

  // 幺九相关
  // 混全/纯全：所有面子和雀头都含至少一张幺九
  // 纯全：都是数牌幺九（无字牌）
  const allMentsusAndPair = [...decomp.mentsus, decomp.pair];
  for (const m of allMentsusAndPair) {
    if (!m.tiles.some(isYaochuu)) {
      r.isChanta = false;
      r.isJunchan = false;
      break;
    }
    if (m.tiles.some(isHonor)) {
      r.isJunchan = false;
    }
  }

  // 一气通贯：某花色 123+456+789
  for (const s of SUITS) {
    const has123 = hasShuntsuMentsu(decomp, 1, s);
    const has456 = hasShuntsuMentsu(decomp, 4, s);
    const has789 = hasShuntsuMentsu(decomp, 7, s);
    if (has123 && has456 && has789) {
      r.isIkkitsuukan = true;
      break;
    }
  }

  // 三色同顺：三花色同一数字顺子
  for (let n = 1; n <= 7; n++) {
    if (SUITS.every(s => hasShuntsuMentsu(decomp, n, s))) {
      r.isSanshoku = true;
      break;
    }
  }

  // 三色同刻：三花色同一数字刻子
  for (let n = 1; n <= 9; n++) {
    if (SUITS.every(s => hasKoutsuMentsu(decomp, n, s))) {
      r.isSanshokuDoukou = true;
      break;
    }
  }

  // 一杯口：同花色同数字两组相同顺子
  const shuntsuSeen = {};
  for (const m of decomp.mentsus) {
    if (m.type !== 'shuntsu') continue;
    const key = m.tiles.join('');
    shuntsuSeen[key] = (shuntsuSeen[key] || 0) + 1;
  }
  if (Object.values(shuntsuSeen).some(c => c === 2)) r.hasIipeikou = true;

  // 二杯口：两组一杯口
  const dupCount = Object.values(shuntsuSeen).filter(c => c === 2).length;
  if (dupCount === 2) r.isRyanpeikou = true;

  // 清一色 / 混一色判定
  const suitCounts = { m: 0, p: 0, s: 0 };
  let honorCount = 0;
  for (const t of tiles) {
    if (isHonor(t)) honorCount++;
    else suitCounts[suitOf(t)]++;
  }
  const nonZeroSuits = SUITS.filter(s => suitCounts[s] > 0);
  if (nonZeroSuits.length === 1 && honorCount === 0) {
    r.isChinitsuOnly = true; // 清一色
  }
  if (nonZeroSuits.length === 1 && honorCount > 0) {
    r.isChinitsu = true; // 混一色基础
  }

  // 役满类
  // 字一色：全是字牌
  if (tiles.every(isHonor)) r.tsuuiisou = true;

  // 清老头：全是老头牌(1,9 数牌)
  if (tiles.every(t => !isHonor(t) && isTerminal(t))) r.chinroutou = true;

  // 绿一色：全是绿色牌 (2,3,4,6,8 索 + 发)
  const greenTiles = new Set(['2s','3s','4s','6s','8s','6z']);
  if (tiles.every(t => greenTiles.has(t))) r.ryuuiisou = true;

  // 大三元 / 小三元
  const sangenCounts = ['5z','6z','7z'].map(id => counts[id] || 0);
  const sangenTriples = sangenCounts.filter(c => c >= 3).length;
  if (sangenTriples === 3) r.daiSanGen = true;
  if (sangenTriples === 2 && sangenCounts.some(c => c === 2)) r.shouSanGen = true;

  // 大四喜 / 小四喜
  const windCounts = ['1z','2z','3z','4z'].map(id => counts[id] || 0);
  const windTriples = windCounts.filter(c => c >= 3).length;
  const windPairs = windCounts.filter(c => c === 2).length;
  if (windTriples === 4) r.daiSuushii = true;
  if (windTriples === 3 && windPairs === 1) r.shouSuushii = true;

  // 国士无双
  const kokushiTiles = ['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'];
  const kokushiAll = kokushiTiles.every(t => counts[t] > 0);
  if (kokushiAll && Object.keys(counts).length === 13) {
    r.kokushi = true;
    // 十三面：和的那张是重复的，即所有 13 种各一张+和牌是其中之一
    if (params.winTile && kokushiTiles.includes(params.winTile) && counts[params.winTile] === 2) {
      r.kokushi13 = true;
    }
  }

  // 九莲宝灯
  if (!r.hasHonor && nonZeroSuits.length === 1 && !params.isOpened) {
    const s = nonZeroSuits[0];
    // 标准九莲：1112345678999 + 任一张
    const base = {'1m':3,'2m':1,'3m':1,'4m':1,'5m':1,'6m':1,'7m':1,'8m':1,'9m':3};
    const baseS = {};
    for (const k in base) baseS[k.replace('m', s)] = base[k];
    // 检查 counts 是否 >= baseS 的每一项
    const matches = Object.keys(baseS).every(k => counts[k] === baseS[k] + (k === params.winTile ? 1 : 0));
    if (matches) {
      r.chuurenPoutou = true;
      // 纯正：和的那张让结构正好是 1112345678999+x
      // 简化：纯正是和 1-9 任意一张构成九莲
      const pureBase = {'1m':3,'2m':1,'3m':1,'4m':1,'5m':1,'6m':1,'7m':1,'8m':1,'9m':3};
      const pureMatch = Object.keys(pureBase).every(k => {
        const sid = k.replace('m', s);
        return counts[sid] === pureBase[k] + (sid === params.winTile ? 1 : 0);
      });
      r.chuurenPure = pureMatch && counts[params.winTile] >= 1;
    }
  }

  // 三元役牌
  if ((counts['5z'] || 0) >= 3) r.hasHaku = true;
  if ((counts['6z'] || 0) >= 3) r.hasHatsu = true;
  if ((counts['7z'] || 0) >= 3) r.hasChun = true;

  // 场风/自风
  const roundWind = params.roundWind;
  const seatWind = params.seatWind;
  if (roundWind && (counts[roundWind] || 0) >= 3) r.roundWindSets = [roundWind];
  if (seatWind && (counts[seatWind] || 0) >= 3) r.seatWindSets = [seatWind];

  // 平和判定（外层调用，这里给提示）
  // 平和：门前 + 全顺子 + 雀头不是役牌 + 两面听
  r.isPinfu = checkPinfu(decomp, params, counts);

  return r;
}

function hasShuntsuMentsu(decomp, startN, suit) {
  const ids = [startN+suit, (startN+1)+suit, (startN+2)+suit];
  return decomp.mentsus.some(m =>
    m.type === 'shuntsu' &&
    ids.every(id => m.tiles.includes(id))
  );
}
function hasKoutsuMentsu(decomp, n, suit) {
  const id = n + suit;
  return decomp.mentsus.some(m =>
    (m.type === 'koutsu' || m.type === 'kantsu') &&
    m.tiles.every(t => t === id)
  );
}

function checkPinfu(decomp, params, counts) {
  if (params.isOpened) return false;
  // 全顺子
  if (!decomp.mentsus.every(m => m.type === 'shuntsu')) return false;
  // 雀头不是役牌
  const pairId = decomp.pair.tiles[0];
  const isYakuHai = pairId === params.roundWind || pairId === params.seatWind ||
    pairId === '5z' || pairId === '6z' || pairId === '7z';
  if (isYakuHai) return false;
  // 两面听
  const wait = detectWaitType(decomp, params.winTile);
  if (wait !== 'ryanmen') return false;
  return true;
}

// ============ 主入口 ============
// params: {
//   tiles: string[],          // 全部 14 张牌（含和牌）
//   isOpened: bool,           // 是否有副露
//   openMentsus: array,       // 副露的面子（标记 open:true）
//   isTsumo: bool,
//   isRiichi: bool,
//   isDoubleRiichi: bool,
//   isIppatsu: bool,
//   winTile: string,
//   roundWind: '1z'|'2z',
//   seatWind: '1z'|'2z'|'3z'|'4z',
//   doraCount: number,        // 手里的宝牌数量（外层算好）
//   akadoraCount: number,     // 红宝牌数量
//   isRobbingKan: bool,
//   isWinFromDeadWall: bool,
//   isLastTile: bool,
//   isTenhou: bool,
//   isChiihou: bool,
// }
// 返回 {
//   valid: bool,
//   decompositions: [{ pair, mentsus, fu, waitType }],
//   best: { decomp, yaku: [...], han, fu, basePoint, isYakuman }
// }
function evaluateHand(params) {
  const { tiles } = params;
  if (!tiles || !Array.isArray(tiles)) return { valid: false, error: '请提供有效牌张列表' };
  // 有效牌数：14（无杠）/ 15（1杠）/ 16（2杠）/ 17（3杠）/ 18（4杠）
  // 杠子信息通过 openMentsus(type=kantsu) 和 closedKantsus 传入
  // 计算杠子数量来决定合法牌数
  let kanCount = 0;
  if (params.openMentsus) kanCount += params.openMentsus.filter(m => m.type === 'kantsu').length;
  if (params.closedKantsus) kanCount += params.closedKantsus.length;
  const expectedLen = 14 + kanCount;
  if (tiles.length !== expectedLen) {
    // 也尝试无杠的14张（可能用户没标记杠子但选了4张同种）
    if (tiles.length !== 14) {
      return { valid: false, error: `需要 ${expectedLen} 张牌（含${kanCount}个杠），当前 ${tiles.length} 张` };
    }
  }

  const counts = countTiles(tiles);

  // 七对子先单独判
  let bestResult = null;
  if (!params.isOpened && Object.values(counts).every(c => c === 2) && Object.keys(counts).length === 7) {
    const chiitoiResult = evaluateChiitoi(params);
    if (chiitoiResult && (!bestResult || chiitoiResult.han > bestResult.han)) {
      bestResult = chiitoiResult;
    }
  }

  // 国士无双单独判
  if (!params.isOpened) {
    const kokushiResult = evaluateKokushi(tiles, counts, params);
    if (kokushiResult && kokushiResult.isYakuman && (!bestResult || !bestResult.isYakuman || kokushiResult.han > bestResult.han)) {
      bestResult = kokushiResult;
    }
  }

  // 标准分解
  // 副露信息：openIds 标记哪些面子是副露来的，kanIds 标记哪些是杠子
  const openIds = new Set();
  const kanIds = new Set();
  if (params.openMentsus) {
    for (const m of params.openMentsus) {
      const key = m.tiles[0];
      if (m.type === 'shuntsu') {
        openIds.add(key + ':shuntsu');
      } else if (m.type === 'kantsu') {
        kanIds.add(key);
        if (m.open) openIds.add(key + ':kantsu-open');
      } else {
        openIds.add(key + ':koutsu');
      }
    }
  }
  // 暗杠也要加入 kanIds（通过 closed kantsu 标记）
  if (params.closedKantsus) {
    for (const id of params.closedKantsus) {
      kanIds.add(id);
    }
  }

  const decompositions = decompose(counts, openIds, kanIds);
  for (const decomp of decompositions) {
    // 应用副露标记（精确匹配）
    if (params.openMentsus) {
      applyOpenMentsus(decomp, params.openMentsus);
    }
    const result = evaluateDecomposition(decomp, params);
    if (result && (!bestResult || compareResults(result, bestResult) > 0)) {
      bestResult = result;
    }
  }

  if (!bestResult) {
    return { valid: false, error: '无合法和牌形' };
  }
  return { valid: true, ...bestResult };
}

function evaluateChiitoi(params) {
  const yaku = [{ name: '七对子', han: 2, closed: true }];
  const extraHan = addBonusYaku(yaku, params);
  const fu = 25;
  const han = yaku.reduce((s, y) => s + y.han, 0) + extraHan;
  return {
    type: 'chiitoi',
    fu,
    han,
    yaku,
    basePoint: calcBasePoint(han, fu),
    isYakuman: false,
  };
}

function evaluateKokushi(tiles, counts, params) {
  const kokushiTiles = ['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'];
  const allPresent = kokushiTiles.every(t => counts[t] > 0);
  if (!allPresent) return null;
  const is13 = params.winTile && counts[params.winTile] === 2 && kokushiTiles.includes(params.winTile);
  const yaku = [{ name: is13 ? '国士无双十三面' : '国士无双', han: 0, yakuman: is13 ? 2 : 1 }];
  return {
    type: 'kokushi',
    fu: 0,
    han: 0,
    yaku,
    isYakuman: true,
    yakumanCount: is13 ? 2 : 1,
    basePoint: is13 ? 16000 : 8000,
  };
}

function evaluateDecomposition(decomp, params) {
  const r = analyzeStructure(params.tiles, decomp, params);

  // 检查是否役满
  const yakumanYaku = YAKU_RULES.filter(y => y.yakuman && !y.optional && y.check(params, r));
  if (yakumanYaku.length > 0) {
    let ymCount = yakumanYaku.reduce((s, y) => s + y.yakuman, 0);
    return {
      type: 'standard',
      decomp,
      yaku: yakumanYaku.map(y => ({ name: y.name, yakuman: y.yakuman })),
      han: 0,
      fu: 0,
      isYakuman: true,
      yakumanCount: ymCount,
      basePoint: 8000 * ymCount,
    };
  }

  // 普通役
  const yaku = [];
  for (const rule of YAKU_RULES) {
    if (rule.yakuman) continue;
    if (rule.closed && params.isOpened) continue;
    if (!rule.check(params, r)) continue;
    let han = rule.han;
    if (!params.isOpened && rule.han === rule.han) {
      // 门前用 han
    } else if (params.isOpened && rule.hanOpen !== undefined) {
      han = rule.hanOpen;
    }
    yaku.push({ name: rule.name, han });
  }

  // 如果没有役，不成立
  if (yaku.length === 0) return null;

  // 加宝牌
  const extraHan = addBonusYaku(yaku, params);
  const totalHan = yaku.reduce((s, y) => s + y.han, 0) + extraHan;

  // 符计算
  const waitType = detectWaitType(decomp, params.winTile);
  const pairId = decomp.pair.tiles[0];
  let pairBonus = 0;
  if (pairId === params.roundWind && pairId === params.seatWind) pairBonus = 4;
  else if (pairId === params.roundWind || pairId === params.seatWind) pairBonus = 2;
  else if (['5z','6z','7z'].includes(pairId)) pairBonus = 2;

  const fuResult = calcFu(decomp, params.isTsumo, !params.isOpened, params.winTile, {
    isPinfu: r.isPinfu,
    isChiitoi: false,
    waitType,
    pairBonus,
  });

  return {
    type: 'standard',
    decomp,
    yaku,
    han: totalHan,
    fu: fuResult.base,
    waitType,
    isYakuman: false,
    basePoint: calcBasePoint(totalHan, fuResult.base),
  };
}

function addBonusYaku(yaku, params) {
  let extra = 0;
  if (params.doraCount) extra += params.doraCount;
  if (params.akadoraCount) extra += params.akadoraCount;
  if (params.northCount) extra += params.northCount;
  if (params.isRiichi || params.isDoubleRiichi) {
    // 里宝牌（不在此处理，外层算入 doraCount）
  }
  if (params.isDoubleRiichi && !yaku.find(y => y.name === '两立直')) {
    // 两立直已经被规则匹配，这里不重复
  }
  return extra;
}

function applyOpenMentsus(decomp, openMentsus) {
  // 标记哪些面子是副露的（按牌的多重集合匹配）
  for (const om of openMentsus) {
    const omSorted = [...om.tiles].sort(compareTiles).join(',');
    const match = decomp.mentsus.find(m =>
      !m.open &&
      m.type === om.type &&
      [...m.tiles].sort(compareTiles).join(',') === omSorted
    );
    if (match) match.open = true;
  }
}

function compareResults(a, b) {
  // 优先役满
  if (a.isYakuman && !b.isYakuman) return 1;
  if (!a.isYakuman && b.isYakuman) return -1;
  if (a.isYakuman && b.isYakuman) return (a.yakumanCount||1) - (b.yakumanCount||1);
  // 普通比较 basePoint
  return a.basePoint - b.basePoint;
}

// ============ 点数计算 ============
function calcBasePoint(han, fu) {
  if (han >= 13) return 8000;   // 役满
  if (han >= 11) return 6000;   // 三倍满
  if (han >= 8) return 4000;    // 倍满
  if (han >= 6) return 3000;    // 跳满
  if (han >= 5) return 2000;    // 满贯
  let base = fu * Math.pow(2, han + 2);
  return Math.min(base, 2000);
}

// 导出（Node 测试用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    countTiles, decompose, calcFu, detectWaitType, evaluateHand,
    calcBasePoint, analyzeStructure, isYaochuu, isHonor,
  };
}
