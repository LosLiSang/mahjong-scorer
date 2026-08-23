'use strict';

const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROOM_CODE_LENGTH = 6;
const ROOM_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PLAYER_LABELS = ['一', '二', '三', '四'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function playerCountFromMode(mode) {
  return Number(mode) === 3 || mode === 'sanma' ? 3 : 4;
}

function normalizeRoomCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, '').slice(0, ROOM_CODE_LENGTH);
}

function generateRoomCode(random) {
  const pick = typeof random === 'function' ? random : Math.random;
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.floor(pick() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[Math.max(0, Math.min(index, ROOM_CODE_ALPHABET.length - 1))];
  }
  return code;
}

function sanitizeNickname(value) {
  const nickname = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 12);
  if (!nickname) throw new Error('NICKNAME_REQUIRED');
  return nickname;
}

function newGame(mode) {
  const count = playerCountFromMode(mode);
  const startPoints = count === 3 ? 35000 : 25000;
  return {
    mode: count === 3 ? 'sanma' : 'yonma',
    playerCount: count,
    sanmaTsumoRule: 'loss',
    players: Array.from({ length: count }, (_, index) => ({
      name: `玩家${PLAYER_LABELS[index]}`,
      points: startPoints,
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

function createSeats(game, ownerOpenId, ownerNickname, seatIndex) {
  const index = Number(seatIndex);
  if (!Number.isInteger(index) || index < 0 || index >= game.playerCount) throw new Error('INVALID_SEAT');
  return game.players.map((player, playerIndex) => ({
    index: playerIndex,
    openId: playerIndex === index ? ownerOpenId : '',
    nickname: playerIndex === index ? ownerNickname : player.name,
    occupied: playerIndex === index
  }));
}

function applySeatNames(game, seats) {
  const next = clone(game);
  next.players.forEach((player, index) => {
    const seat = seats[index];
    player.name = seat && seat.nickname ? seat.nickname : `玩家${PLAYER_LABELS[index]}`;
  });
  return next;
}

function createRoomDocument({ code, mode, ownerOpenId, ownerNickname, seatIndex, now }) {
  const createdAt = now instanceof Date ? now : new Date(now || Date.now());
  const nickname = sanitizeNickname(ownerNickname);
  const game = newGame(mode);
  const seats = createSeats(game, ownerOpenId, nickname, seatIndex);
  const createdAction = {
    id: `created-${createdAt.getTime()}`,
    type: 'create',
    summary: `${nickname} 创建了房间`,
    operatorOpenId: ownerOpenId,
    operatorNickname: nickname,
    createdAt
  };
  return {
    _id: normalizeRoomCode(code),
    status: 'active',
    mode: game.mode,
    version: 0,
    hostOpenId: ownerOpenId,
    seats,
    game: applySeatNames(game, seats),
    lastAction: createdAction,
    activity: [createdAction],
    lastGameEventId: '',
    createdAt,
    updatedAt: createdAt,
    endedAt: null,
    expiresAt: new Date(createdAt.getTime() + ROOM_RETENTION_MS)
  };
}

function occupiedOpenIds(room) {
  return (room.seats || []).filter(seat => seat.occupied && seat.openId).map(seat => seat.openId);
}

function findSeatByOpenId(room, openId) {
  return (room.seats || []).findIndex(seat => seat.occupied && seat.openId === openId);
}

function isMember(room, openId) {
  return findSeatByOpenId(room, openId) >= 0;
}

function joinSeat(room, { openId, nickname, seatIndex }) {
  if (!room || room.status !== 'active') throw new Error('ROOM_NOT_ACTIVE');
  const cleanNickname = sanitizeNickname(nickname);
  const existingIndex = findSeatByOpenId(room, openId);
  const targetIndex = existingIndex >= 0 ? existingIndex : Number(seatIndex);
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= room.seats.length) throw new Error('INVALID_SEAT');

  const next = Object.assign({}, room, {
    seats: clone(room.seats),
    game: clone(room.game),
    activity: (room.activity || []).slice()
  });
  const seat = next.seats[targetIndex];
  if (seat.occupied && seat.openId !== openId) throw new Error('SEAT_OCCUPIED');
  seat.openId = openId;
  seat.nickname = cleanNickname;
  seat.occupied = true;
  next.game = applySeatNames(next.game, next.seats);
  return next;
}

function releaseSeat(room, seatIndex) {
  const index = Number(seatIndex);
  if (!Number.isInteger(index) || index < 0 || index >= room.seats.length) throw new Error('INVALID_SEAT');
  const seat = room.seats[index];
  if (!seat.occupied) throw new Error('SEAT_EMPTY');
  if (seat.openId === room.hostOpenId) throw new Error('HOST_SEAT_LOCKED');

  const next = Object.assign({}, room, {
    seats: clone(room.seats),
    game: clone(room.game),
    activity: (room.activity || []).slice()
  });
  next.seats[index] = {
    index,
    openId: '',
    nickname: `玩家${PLAYER_LABELS[index]}`,
    occupied: false
  };
  next.game = applySeatNames(next.game, next.seats);
  return next;
}

function expectedPointTotal(playerCount) {
  return playerCount === 3 ? 105000 : 100000;
}

function normalizeHistoryEntry(entry) {
  const source = entry || {};
  const type = source.type === 'draw' ? 'draw' : 'win';
  const normalized = {
    type,
    round: String(source.round || '').slice(0, 20)
  };
  if (type === 'draw') {
    normalized.tenpai = Array.isArray(source.tenpai)
      ? source.tenpai.filter(Number.isInteger).slice(0, 4)
      : [];
  } else {
    normalized.winner = Number(source.winner);
    normalized.loser = Number(source.loser);
    normalized.isTsumo = !!source.isTsumo;
    normalized.total = Number(source.total);
    normalized.han = Number(source.han);
    normalized.fu = Number(source.fu);
  }
  return normalized;
}

function normalizeGame(game) {
  const source = game || {};
  return {
    mode: source.mode,
    playerCount: Number(source.playerCount),
    sanmaTsumoRule: source.sanmaTsumoRule === 'half' ? 'half' : 'loss',
    players: Array.isArray(source.players) ? source.players.slice(0, 4).map(player => ({
      name: String(player && player.name || '').slice(0, 12),
      points: Number(player && player.points),
      riichi: !!(player && player.riichi)
    })) : [],
    roundIndex: Number(source.roundIndex),
    dealerIndex: Number(source.dealerIndex),
    honba: Number(source.honba),
    riichiSticks: Number(source.riichiSticks),
    history: Array.isArray(source.history) ? source.history.slice(0, 500).map(normalizeHistoryEntry) : [],
    ended: !!source.ended
  };
}

function validateGame(game, roomMode) {
  if (!game || !Array.isArray(game.players)) throw new Error('INVALID_GAME');
  const count = playerCountFromMode(roomMode);
  if (game.playerCount !== count || game.players.length !== count) throw new Error('INVALID_GAME_MODE');
  if ((count === 3 ? 'sanma' : 'yonma') !== game.mode) throw new Error('INVALID_GAME_MODE');
  if (!Number.isInteger(game.roundIndex) || game.roundIndex < 0) throw new Error('INVALID_GAME');
  if (!Number.isInteger(game.dealerIndex) || game.dealerIndex < 0 || game.dealerIndex >= count) throw new Error('INVALID_GAME');
  if (!Number.isInteger(game.honba) || game.honba < 0) throw new Error('INVALID_GAME');
  if (!Number.isInteger(game.riichiSticks) || game.riichiSticks < 0) throw new Error('INVALID_GAME');
  if (!Array.isArray(game.history) || game.history.length > 500) throw new Error('INVALID_GAME');
  game.history.forEach(entry => {
    if (!entry || !['win', 'draw'].includes(entry.type) || typeof entry.round !== 'string') throw new Error('INVALID_GAME');
    if (entry.type === 'draw') {
      if (!Array.isArray(entry.tenpai) || entry.tenpai.some(index => !Number.isInteger(index) || index < 0 || index >= count)) throw new Error('INVALID_GAME');
    } else if (
      !Number.isInteger(entry.winner) || entry.winner < 0 || entry.winner >= count ||
      !Number.isInteger(entry.loser) || entry.loser < -1 || entry.loser >= count ||
      !Number.isInteger(entry.total) || entry.total < 0 ||
      !Number.isInteger(entry.han) || entry.han < 0 ||
      !Number.isInteger(entry.fu) || entry.fu < 0
    ) {
      throw new Error('INVALID_GAME');
    }
  });

  let pointTotal = game.riichiSticks * 1000;
  game.players.forEach(player => {
    if (!player || !Number.isInteger(player.points) || typeof player.riichi !== 'boolean') throw new Error('INVALID_GAME');
    pointTotal += player.points;
  });
  if (pointTotal !== expectedPointTotal(count)) throw new Error('POINT_TOTAL_MISMATCH');
  return true;
}

function publicRoomPreview(room) {
  return {
    roomCode: room._id,
    status: room.status,
    mode: room.mode,
    seats: room.seats.map(seat => ({
      index: seat.index,
      nickname: seat.nickname,
      occupied: !!seat.occupied
    })),
    createdAt: room.createdAt,
    expiresAt: room.expiresAt
  };
}

function roomView(room, openId) {
  const mySeat = findSeatByOpenId(room, openId);
  if (mySeat < 0) throw new Error('NOT_ROOM_MEMBER');
  return {
    _id: `${room._id}_${openId}`,
    _openid: openId,
    roomCode: room._id,
    status: room.status,
    mode: room.mode,
    version: room.version,
    isHost: room.hostOpenId === openId,
    mySeat,
    seats: room.seats.map(seat => ({
      index: seat.index,
      nickname: seat.nickname,
      occupied: !!seat.occupied,
      isMe: seat.openId === openId
    })),
    game: clone(room.game),
    lastAction: room.lastAction ? {
      id: room.lastAction.id,
      type: room.lastAction.type,
      summary: room.lastAction.summary,
      operatorNickname: room.lastAction.operatorNickname,
      isMine: room.lastAction.operatorOpenId === openId,
      createdAt: room.lastAction.createdAt
    } : null,
    activity: (room.activity || []).map(item => ({
      id: item.id,
      type: item.type,
      summary: item.summary,
      operatorNickname: item.operatorNickname,
      isMine: item.operatorOpenId === openId,
      createdAt: item.createdAt
    })),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    endedAt: room.endedAt,
    expiresAt: room.expiresAt
  };
}

module.exports = {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_RETENTION_MS,
  clone,
  playerCountFromMode,
  normalizeRoomCode,
  generateRoomCode,
  sanitizeNickname,
  newGame,
  createSeats,
  applySeatNames,
  createRoomDocument,
  occupiedOpenIds,
  findSeatByOpenId,
  isMember,
  joinSeat,
  releaseSeat,
  normalizeGame,
  validateGame,
  publicRoomPreview,
  roomView
};
