// game-engine.js — 日麻对局状态管理（四麻 + 三麻）
const Logic = require('./mahjong-logic');

const SEATS_4P = ['东', '南', '西', '北'];
const SEATS_3P = ['东', '南', '西'];
const ROUND_NAMES_4P = ['东一','东二','东三','东四','南一','南二','南三','南四','西一','西二','西三','西四'];
const ROUND_NAMES_3P = ['东一','东二','东三','南一','南二','南三','西一','西二','西三'];

const MODE_CONFIG = {
  4: { startPoints: 25000, returnPoints: 30000, seats: SEATS_4P, label: '四麻' },
  3: { startPoints: 35000, returnPoints: 40000, seats: SEATS_3P, label: '三麻' }
};

function newGame(countOrMode) {
  const count = (Number(countOrMode) === 3 || countOrMode === 'sanma') ? 3 : 4;
  const config = MODE_CONFIG[count];
  return {
    mode: count === 3 ? 'sanma' : 'yonma',
    playerCount: count,
    sanmaTsumoRule: 'loss',
    players: config.seats.map((seat, i) => ({
      name: `玩家${['一','二','三','四'][i]}`,
      points: config.startPoints,
      riichi: false
    })),
    roundIndex: 0,
    dealerIndex: 0,
    honba: 0,
    riichiSticks: 0,
    history: [],
    ended: false
  };
}

function ceil100(n) { return Math.ceil(n / 100) * 100; }

function modeConfig(game) {
  return MODE_CONFIG[game.playerCount || 4];
}

function roundNames(game) {
  return game.playerCount === 3 ? ROUND_NAMES_3P : ROUND_NAMES_4P;
}

function seatOf(game, playerIndex) {
  const seats = modeConfig(game).seats;
  const count = game.playerCount || 4;
  return seats[(playerIndex - game.dealerIndex + count) % count];
}

function roundWindTile(game) {
  const n = game.playerCount || 4;
  return ['1z','2z','3z','4z'][Math.floor(game.roundIndex / n) % 4];
}

function seatWindTile(game, playerIndex) {
  const seat = seatOf(game, playerIndex);
  return { '东':'1z','南':'2z','西':'3z','北':'4z' }[seat];
}

function calcBasePoint(han, fu) {
  return Logic.calcBasePoint(han, fu);
}

function calcWinPayments(game, winnerIdx, han, fu, isTsumo, loserIdx, baseOverride) {
  const base = baseOverride != null ? baseOverride : calcBasePoint(han, fu);
  const isDealer = winnerIdx === game.dealerIndex;
  const count = game.playerCount || 4;
  const payments = [];

  if (isTsumo) {
    if (count === 4) {
      const honbaPer = game.honba * 100;
      for (let i = 0; i < count; i++) {
        if (i === winnerIdx) continue;
        const multiplier = isDealer || i === game.dealerIndex ? 2 : 1;
        payments.push({ from: i, to: winnerIdx, amount: ceil100(base * multiplier) + honbaPer });
      }
    } else {
      // 三麻自摸损：每家付 base（亲子基础倍率 2）
      const honbaPer = game.honba * 100;
      for (let i = 0; i < count; i++) {
        if (i === winnerIdx) continue;
        const multiplier = isDealer || i === game.dealerIndex ? 2 : 1;
        payments.push({ from: i, to: winnerIdx, amount: ceil100(base * multiplier) + honbaPer });
      }
    }
  } else {
    if (count === 4) {
      payments.push({
        from: loserIdx,
        to: winnerIdx,
        amount: ceil100(base * (isDealer ? 6 : 4)) + game.honba * 300
      });
    } else {
      // 三麻荣和
      payments.push({
        from: loserIdx,
        to: winnerIdx,
        amount: ceil100(base * (isDealer ? 6 : 4)) + game.honba * 300
      });
    }
  }

  const stickBonus = game.riichiSticks * 1000;
  return {
    base,
    payments,
    stickBonus,
    total: payments.reduce((sum, p) => sum + p.amount, 0) + stickBonus
  };
}

function applyWin(game, win, result) {
  const next = JSON.parse(JSON.stringify(game));
  result.payments.forEach(p => {
    next.players[p.from].points -= p.amount;
    next.players[p.to].points += p.amount;
  });
  next.players[win.winnerIdx].points += result.stickBonus;
  next.riichiSticks = 0;
  next.history.unshift({
    type: 'win', round: roundNames(game)[next.roundIndex] || `第${next.roundIndex + 1}局`,
    winner: win.winnerIdx, loser: win.loserIdx, isTsumo: win.isTsumo,
    total: result.total, han: win.han, fu: win.fu
  });
  next.players.forEach(p => { p.riichi = false; });
  if (win.winnerIdx === next.dealerIndex) {
    next.honba += 1;
  } else {
    advanceRound(next);
  }
  return next;
}

function applyRiichi(game, selected) {
  const next = JSON.parse(JSON.stringify(game));
  selected.forEach(idx => {
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
  const total = game.playerCount || 4;
  if (count > 0 && count < total) {
    const notenCount = total - count; // 不聴人数
    if (total === 4) {
      const pay = [0, 3000, 1500, 1000][notenCount];       // 不聴者每人付
      const receive = [0, 1000, 1500, 3000][notenCount];    // 聴牌者每人得
      next.players.forEach((p, idx) => { p.points += set.has(idx) ? receive : -pay; });
    } else {
      const pay = [0, 2000, 1000][notenCount];
      const receive = [0, 1000, 2000][notenCount];
      next.players.forEach((p, idx) => { p.points += set.has(idx) ? receive : -pay; });
    }
  }
  next.history.unshift({
    type: 'draw', round: roundNames(game)[next.roundIndex],
    tenpai: [...set]
  });
  next.players.forEach(p => { p.riichi = false; });
  if (set.has(next.dealerIndex)) {
    next.honba += 1;
  } else {
    advanceRound(next);
  }
  return next;
}

function advanceRound(game) {
  const total = game.playerCount || 4;
  game.roundIndex += 1;
  game.dealerIndex = game.roundIndex % total;
  game.honba = 0;
}

module.exports = {
  SEATS_4P, SEATS_3P, ROUND_NAMES_4P, ROUND_NAMES_3P, MODE_CONFIG,
  newGame, ceil100, modeConfig, roundNames, seatOf,
  roundWindTile, seatWindTile, calcBasePoint,
  calcWinPayments, applyWin, applyRiichi, applyDraw
};
