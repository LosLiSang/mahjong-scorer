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

// 对局级规则：xuezhan = 血战到底（一家和牌后本局继续，和满 n-1 家才结束）
function normalizeRules(rules) {
  return { xuezhan: !!(rules && rules.xuezhan) };
}

// 旧存档 / 旧房间补齐规则与本局已和名单
function ensureRules(game) {
  if (!game) return game;
  game.rules = normalizeRules(game.rules);
  const count = game.playerCount || (game.players ? game.players.length : 4);
  game.handWinners = Array.isArray(game.handWinners)
    ? [...new Set(game.handWinners.map(Number))].filter(i => Number.isInteger(i) && i >= 0 && i < count)
    : [];
  if (!game.rules.xuezhan) game.handWinners = [];
  return game;
}

function isXuezhan(game) {
  return !!(game && game.rules && game.rules.xuezhan);
}

function handWinnersOf(game) {
  return isXuezhan(game) && Array.isArray(game.handWinners) ? game.handWinners : [];
}

// 血战中本局已有人和牌：后续和牌不再收本场与供托
function isFollowUpWin(game) {
  return handWinnersOf(game).length > 0;
}

function newGame(countOrMode, rules) {
  const count = (Number(countOrMode) === 3 || countOrMode === 'sanma') ? 3 : 4;
  const config = MODE_CONFIG[count];
  return {
    mode: count === 3 ? 'sanma' : 'yonma',
    playerCount: count,
    sanmaTsumoRule: 'loss',
    rules: normalizeRules(rules),
    handWinners: [],
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
  // 血战：本场与供托只算给本局第一个和牌者；已和玩家离场，不再支付
  const followUp = isFollowUpWin(game);
  const honba = followUp ? 0 : game.honba;
  const sticks = followUp ? 0 : game.riichiSticks;
  const out = new Set(handWinnersOf(game));

  if (isTsumo) {
    if (count === 4) {
      const honbaPer = honba * 100;
      for (let i = 0; i < count; i++) {
        if (i === winnerIdx || out.has(i)) continue;
        const multiplier = isDealer || i === game.dealerIndex ? 2 : 1;
        payments.push({ from: i, to: winnerIdx, amount: ceil100(base * multiplier) + honbaPer });
      }
    } else {
      // 三麻自摸损：每家付 base（亲子基础倍率 2）
      const honbaPer = honba * 100;
      for (let i = 0; i < count; i++) {
        if (i === winnerIdx || out.has(i)) continue;
        const multiplier = isDealer || i === game.dealerIndex ? 2 : 1;
        payments.push({ from: i, to: winnerIdx, amount: ceil100(base * multiplier) + honbaPer });
      }
    }
  } else {
    if (count === 4) {
      payments.push({
        from: loserIdx,
        to: winnerIdx,
        amount: ceil100(base * (isDealer ? 6 : 4)) + honba * 300
      });
    } else {
      // 三麻荣和
      payments.push({
        from: loserIdx,
        to: winnerIdx,
        amount: ceil100(base * (isDealer ? 6 : 4)) + honba * 300
      });
    }
  }

  const stickBonus = sticks * 1000;
  return {
    base,
    payments,
    stickBonus,
    total: payments.reduce((sum, p) => sum + p.amount, 0) + stickBonus
  };
}

// 血战：已和玩家不能再和，也不能放铳
function canWin(game, winnerIdx, loserIdx, isTsumo) {
  const out = handWinnersOf(game);
  if (out.includes(winnerIdx)) return false;
  if (!isTsumo && (out.includes(loserIdx) || loserIdx === winnerIdx)) return false;
  return true;
}

// 结束本局：连庄看 renchan（标准规则看亲家，血战看本局第一个和牌者）
function finishHand(next, renchan) {
  next.players.forEach(p => { p.riichi = false; });
  next.handWinners = [];
  if (renchan) next.honba += 1;
  else advanceRound(next);
}

function applyWin(game, win, result) {
  const next = ensureRules(JSON.parse(JSON.stringify(game)));
  if (!canWin(next, win.winnerIdx, win.loserIdx, win.isTsumo)) throw new Error('INVALID_WINNER');
  const xuezhan = isXuezhan(next);
  const followUp = isFollowUpWin(next);
  result.payments.forEach(p => {
    next.players[p.from].points -= p.amount;
    next.players[p.to].points += p.amount;
  });
  next.players[win.winnerIdx].points += result.stickBonus;
  if (!followUp) next.riichiSticks = 0;
  const entry = {
    type: 'win', round: roundNames(game)[next.roundIndex] || `第${next.roundIndex + 1}局`,
    winner: win.winnerIdx, loser: win.loserIdx, isTsumo: win.isTsumo,
    total: result.total, han: win.han, fu: win.fu
  };
  if (!xuezhan) {
    next.history.unshift(entry);
    finishHand(next, win.winnerIdx === next.dealerIndex);
    return next;
  }
  next.handWinners.push(win.winnerIdx);
  entry.seq = next.handWinners.length;
  next.history.unshift(entry);
  // 已和玩家离场：立直状态随和牌清除
  next.players[win.winnerIdx].riichi = false;
  const count = next.playerCount || 4;
  if (next.handWinners.length >= count - 1) {
    finishHand(next, next.handWinners[0] === next.dealerIndex);
  }
  return next;
}

function applyRiichi(game, selected) {
  const next = ensureRules(JSON.parse(JSON.stringify(game)));
  const out = handWinnersOf(next);
  selected.forEach(idx => {
    const p = next.players[idx];
    if (p && !out.includes(idx) && !p.riichi && p.points >= 1000) {
      p.riichi = true;
      p.points -= 1000;
      next.riichiSticks += 1;
    }
  });
  return next;
}

function applyDraw(game, tenpai) {
  const next = ensureRules(JSON.parse(JSON.stringify(game)));
  const winners = handWinnersOf(next).slice();
  // 血战：已和玩家视为听牌，不付不听罚符
  const set = new Set(tenpai.concat(winners));
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
  // 本局已有人和牌：连庄只看第一个和牌者；否则看亲家是否听牌
  finishHand(next, winners.length ? winners[0] === next.dealerIndex : set.has(next.dealerIndex));
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
  newGame, normalizeRules, ensureRules, isXuezhan, handWinnersOf, isFollowUpWin, canWin,
  ceil100, modeConfig, roundNames, seatOf,
  roundWindTile, seatWindTile, calcBasePoint,
  calcWinPayments, applyWin, applyRiichi, applyDraw
};
