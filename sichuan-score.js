(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const SICHUAN_FAN_TYPES = [
    { id: 'pinghu', name: '平胡', fan: 1, group: 'base' },
    { id: 'duiduihu', name: '对对胡', fan: 2, group: 'base' },
    { id: 'qingyise', name: '清一色', fan: 3, group: 'base' },
    { id: 'daiyaojiu', name: '带幺九', fan: 3, group: 'base' },
    { id: 'qidui', name: '七对', fan: 3, group: 'base' },
    { id: 'qingdui', name: '清对', fan: 4, group: 'base' },
    { id: 'jiangdui', name: '将对', fan: 4, group: 'base' },
    { id: 'longqidui', name: '龙七对', fan: 5, group: 'base' },
    { id: 'qingqidui', name: '清七对', fan: 5, group: 'base' },
    { id: 'qingyaojiu', name: '清幺九', fan: 5, group: 'base' },
    { id: 'tianhu', name: '天胡', fan: 6, group: 'base' },
    { id: 'dihu', name: '地胡', fan: 6, group: 'base' },
    { id: 'qinglongqidui', name: '清龙七对', fan: 6, group: 'base' },
    { id: 'zimo', name: '自摸', fan: 1, group: 'extra' },
    { id: 'gangshanghua', name: '杠上花', fan: 1, group: 'extra' },
    { id: 'gangshangpao', name: '杠上炮', fan: 1, group: 'extra' },
    { id: 'qianggang', name: '抢杠', fan: 1, group: 'extra' },
    { id: 'gang', name: '杠', fan: 1, group: 'extra' },
    { id: 'gen', name: '根', fan: 1, group: 'extra' },
  ];

  function calculateSichuanFan(selectedIds = [], fanCap = 6) {
    const selected = selectedIds.map(id => SICHUAN_FAN_TYPES.find(type => type.id === id)).filter(Boolean);
    const fan = Math.min(Number(fanCap) || 6, selected.reduce((sum, type) => sum + type.fan, 0));
    return { fan: Math.max(1, fan), label: selected.map(type => type.name).join(' + ') || '平胡' };
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
