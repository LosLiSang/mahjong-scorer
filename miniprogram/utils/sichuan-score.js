(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const SICHUAN_PENALTY_TYPES = [
    {
      id: 'huazhu', name: '查花猪', short: '花猪',
      situation: '流局时手牌仍保留万、筒、索三门，没有完成定缺。',
      rule: '花猪向所选的非花猪玩家逐一支付；成都常见玩法按封顶分处罚，具体金额以牌局约定为准。'
    },
    {
      id: 'dajiao', name: '查大叫', short: '大叫',
      situation: '流局查叫时，玩家没有听牌。',
      rule: '未听牌者向所选的听牌玩家支付；常按听牌者当时可胡的最大牌型计算，可分玩家分别结算。'
    },
    {
      id: 'tuishui', name: '退税', short: '退税',
      situation: '流局后按规则需要退回本局已经收取的杠分。',
      rule: '选择原杠分收取者为送分方、原付款者为收分方，按实际收过的杠分退回，不额外翻倍。'
    },
    {
      id: 'zhahu', name: '诈和', short: '诈和',
      situation: '误报或错误宣告胡牌。',
      rule: '诈和者向所选玩家支付约定罚分；是否按封顶、是否继续牌局因地区规则不同。'
    },
    {
      id: 'custom', name: '自定义', short: '自定义',
      situation: '牌局约定的包赔、违规或其他转分。',
      rule: '自行选择收分方、送分方和每位收分者获得的金额。'
    },
  ];

  const SICHUAN_FAN_TYPES = [
    { id: 'pinghu', name: '平胡', fan: 1, group: 'base', exampleTiles: ['1m','2m','3m','4m','5m','6m','2p','3p','4p','6s','7s','8s','5p','5p'], exampleText: '四组顺子加一对将牌。' },
    { id: 'duiduihu', name: '对对胡', fan: 2, group: 'base', exampleTiles: ['1m','1m','1m','2p','2p','2p','3s','3s','3s','7s','7s','7s','5p','5p'], exampleText: '四组刻子加一对将牌。' },
    { id: 'qingyise', name: '清一色', fan: 3, group: 'base', exampleTiles: ['1m','2m','3m','4m','5m','6m','7m','8m','9m','2m','2m','2m','5m','5m'], exampleText: '整手牌只使用一种花色。' },
    { id: 'daiyaojiu', name: '带幺九', fan: 3, group: 'base', exampleTiles: ['1m','2m','3m','7m','8m','9m','1p','1p','1p','9s','9s','9s','1s','1s'], exampleText: '每组面子和将牌都带一或九。' },
    { id: 'qidui', name: '七对', fan: 3, group: 'base', exampleTiles: ['1m','1m','2m','2m','3p','3p','4p','4p','5s','5s','6s','6s','7s','7s'], exampleText: '由七组对子组成。' },
    { id: 'qingdui', name: '清对', fan: 4, group: 'base', exampleTiles: ['1m','1m','1m','2m','2m','2m','3m','3m','3m','7m','7m','7m','9m','9m'], exampleText: '清一色与对对胡的组合。' },
    { id: 'jiangdui', name: '将对', fan: 4, group: 'base', exampleTiles: ['2m','2m','2m','5m','5m','5m','8p','8p','8p','2s','2s','2s','5s','5s'], exampleText: '全部由二、五、八组成的对对胡。' },
    { id: 'longqidui', name: '龙七对', fan: 5, group: 'base', exampleTiles: ['1m','1m','1m','1m','2m','2m','3p','3p','4p','4p','5s','5s','6s','6s'], exampleText: '七对中含一组四张相同牌。' },
    { id: 'qingqidui', name: '清七对', fan: 5, group: 'base', exampleTiles: ['1m','1m','2m','2m','3m','3m','4m','4m','5m','5m','6m','6m','7m','7m'], exampleText: '同一种花色组成的七对。' },
    { id: 'qingyaojiu', name: '清幺九', fan: 5, group: 'base', exampleTiles: ['1m','2m','3m','1m','2m','3m','7m','8m','9m','7m','8m','9m','9m','9m'], exampleText: '同一种花色，且每组都带一或九。' },
    { id: 'tianhu', name: '天胡', fan: 6, group: 'base', exampleTiles: [], exampleText: '庄家起手十四张牌即完成和牌。' },
    { id: 'dihu', name: '地胡', fan: 6, group: 'base', exampleTiles: [], exampleText: '闲家在首次摸牌时自摸，期间无人鸣牌。' },
    { id: 'qinglongqidui', name: '清龙七对', fan: 6, group: 'base', exampleTiles: ['1m','1m','1m','1m','2m','2m','3m','3m','4m','4m','5m','5m','6m','6m'], exampleText: '同一种花色的龙七对。' },
    { id: 'zimo', name: '自摸', fan: 1, group: 'extra', exampleTiles: [], exampleText: '和牌张由自己摸入。' },
    { id: 'gangshanghua', name: '杠上花', fan: 1, group: 'extra', exampleTiles: [], exampleText: '开杠后从牌尾补牌并自摸。' },
    { id: 'gangshangpao', name: '杠上炮', fan: 1, group: 'extra', exampleTiles: [], exampleText: '开杠补牌后打出的牌被他人和牌。' },
    { id: 'qianggang', name: '抢杠', fan: 1, group: 'extra', exampleTiles: [], exampleText: '他人加杠时，用该牌完成和牌。' },
    { id: 'gen', name: '根', fan: 1, group: 'extra', exampleTiles: ['1m','1m','1m','1m'], exampleText: '手牌中每一组四张相同牌计一根。' },
  ];

  function calculateSichuanFan(selectedIds = [], fanCap = 6, rootCount = 0) {
    const normalizedRootCount = Math.max(0, Math.min(4, Math.trunc(Number(rootCount) || 0)));
    const resolved = [...new Set(selectedIds)]
      .filter(id => id !== 'gen')
      .map(id => SICHUAN_FAN_TYPES.find(type => type.id === id))
      .filter(Boolean);
    const baseTypes = resolved.filter(type => type.group === 'base');
    const baseType = baseTypes[baseTypes.length - 1] || SICHUAN_FAN_TYPES.find(type => type.id === 'pinghu');
    const extraTypes = resolved.filter(type => type.group === 'extra');
    const selected = [baseType].concat(extraTypes);
    const rawFan = selected.reduce((sum, type) => sum + type.fan, 0) + normalizedRootCount;
    const fan = Math.min(Number(fanCap) || 6, rawFan);
    const labels = selected.map(type => type.name);
    if (normalizedRootCount) labels.push(`根×${normalizedRootCount}`);
    return { fan: Math.max(1, fan), label: labels.join(' + '), rootCount: normalizedRootCount };
  }

  function setSichuanMissingSuit(game, playerIndex, suit) {
    if (!game.players[playerIndex]) return false;
    game.players[playerIndex].missingSuit = ['m', 'p', 's'].includes(suit) ? suit : '';
    return true;
  }

  function scoreFromFan(fan, baseMultiplier = 1, unitScore = 1, fanCap = 6) {
    const totalFan = Math.max(1, Math.min(Number(fanCap) || 6, Number(fan) || 1));
    return (Number(unitScore) || 1) * (Number(baseMultiplier) || 1) * Math.pow(2, totalFan - 1);
  }

  function createSichuanGame(names = ['玩家一', '玩家二', '玩家三', '玩家四'], initialScore = 0) {
    return {
      version: 1,
      players: names.slice(0, 4).map((name, index) => ({
        name: String(name || `玩家${index + 1}`),
        score: Number(initialScore) || 0,
        missingSuit: '',
      })),
      history: [],
    };
  }

  function createTransferEntry({ type = 'manual', receiver, payers = [], amountPerPayer, label = '' }) {
    const amount = Math.max(0, Number(amountPerPayer) || 0);
    return {
      type,
      receiver: Number(receiver),
      payers: [...new Set(payers.map(Number))],
      amountPerPayer: amount,
      label: String(label || type),
      createdAt: Date.now(),
    };
  }

  function entryDeltas(game, entry) {
    const deltas = Array(game.players.length).fill(0);
    if (!Number.isInteger(entry.receiver) || !game.players[entry.receiver]) return deltas;
    entry.payers.forEach(payer => {
      if (!Number.isInteger(payer) || !game.players[payer] || payer === entry.receiver) return;
      deltas[payer] -= entry.amountPerPayer;
      deltas[entry.receiver] += entry.amountPerPayer;
    });
    return deltas;
  }

  function applySichuanEntry(game, entry) {
    const deltas = entryDeltas(game, entry);
    game.players.forEach((player, index) => { player.score += deltas[index]; });
    game.history.push({ ...entry, deltas });
    return deltas;
  }

  function undoSichuanEntry(game) {
    const entry = game.history.pop();
    if (!entry) return null;
    game.players.forEach((player, index) => { player.score -= Number(entry.deltas[index] || 0); });
    return entry;
  }

  return {
    SICHUAN_FAN_TYPES,
    SICHUAN_PENALTY_TYPES,
    calculateSichuanFan,
    setSichuanMissingSuit,
    scoreFromFan,
    createSichuanGame,
    createTransferEntry,
    entryDeltas,
    applySichuanEntry,
    undoSichuanEntry,
  };
});
