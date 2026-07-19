const SEATS = ['东', '南', '西', '北'];
const ROUND_NAMES = ['东一', '东二', '东三', '东四', '南一', '南二', '南三', '南四', '西一', '西二', '西三', '西四'];
const START_POINTS = 25000;

function newGame() {
  return {
    players: SEATS.map((seat) => ({ name: `${seat}家`, points: START_POINTS, riichi: false })),
    roundIndex: 0,
    dealerIndex: 0,
    honba: 0,
    riichiSticks: 0,
    history: []
  };
}

function ceil100(n) { return Math.ceil(n / 100) * 100; }

function calcWinPayments(game, winnerIdx, han, fu, isTsumo, loserIdx, baseOverride) {
  const { calcBasePoint } = require('./mahjong-logic');
  const base = baseOverride == null ? calcBasePoint(han, fu) : baseOverride;
  const isDealer = winnerIdx === game.dealerIndex;
  const payments = [];
  if (isTsumo) {
    const honbaPer = game.honba * 100;
    for (let i = 0; i < 4; i++) {
      if (i === winnerIdx) continue;
      const multiplier = isDealer || i === game.dealerIndex ? 2 : 1;
      payments.push({ from: i, to: winnerIdx, amount: ceil100(base * multiplier) + honbaPer });
    }
  } else {
    payments.push({
      from: loserIdx,
      to: winnerIdx,
      amount: ceil100(base * (isDealer ? 6 : 4)) + game.honba * 300
    });
  }
  const stickBonus = game.riichiSticks * 1000;
  return {
    base,
    payments,
    stickBonus,
    total: payments.reduce((sum, item) => sum + item.amount, 0) + stickBonus
  };
}

function applyWin(game, win, result) {
  const next = JSON.parse(JSON.stringify(game));
  result.payments.forEach((p) => {
    next.players[p.from].points -= p.amount;
    next.players[p.to].points += p.amount;
  });
  next.players[win.winnerIdx].points += result.stickBonus;
  next.riichiSticks = 0;
  next.history.unshift({
    type: 'win', round: ROUND_NAMES[next.roundIndex], winner: win.winnerIdx,
    loser: win.loserIdx, isTsumo: win.isTsumo, total: result.total,
    han: win.han, fu: win.fu
  });
  next.players.forEach((p) => { p.riichi = false; });
  if (win.winnerIdx === next.dealerIndex) next.honba += 1;
  else advanceRound(next);
  return next;
}

function applyRiichi(game, selected) {
  const next = JSON.parse(JSON.stringify(game));
  selected.forEach((idx) => {
    const p = next.players[idx];
    if (!p.riichi && p.points >= 1000) {
      p.riichi = true;
      p.points -= 1000;
      next.riichiSticks += 1;
    }
  });
  return next;
}

function applyDraw(game, tenpai) {
  const next = JSON.parse(JSON.stringify(game));
  const set = new Set(tenpai);
  const count = set.size;
  if (count > 0 && count < 4) {
    const pay = [0, 3000, 1500, 1000][count];
    const receive = [0, 1000, 1500, 3000][count];
    next.players.forEach((p, idx) => { p.points += set.has(idx) ? receive : -pay; });
  }
  next.history.unshift({ type: 'draw', round: ROUND_NAMES[next.roundIndex], tenpai: [...set] });
  next.players.forEach((p) => { p.riichi = false; });
  if (set.has(next.dealerIndex)) next.honba += 1;
  else advanceRound(next);
  return next;
}

function advanceRound(game) {
  game.roundIndex += 1;
  game.dealerIndex = game.roundIndex % 4;
  game.honba = 0;
}

module.exports = { SEATS, ROUND_NAMES, START_POINTS, newGame, calcWinPayments, applyWin, applyRiichi, applyDraw };
