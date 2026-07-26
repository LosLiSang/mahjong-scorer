(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
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
    scoreFromFan,
    createSichuanGame,
    createTransferEntry,
    entryDeltas,
    applySichuanEntry,
    undoSichuanEntry,
  };
});
