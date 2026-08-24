'use strict';

const cloud = require('wx-server-sdk');
const Domain = require('./domain');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ROOMS = 'rooms';
const VIEWS = 'room_views';
const EVENTS = 'room_events';
const GAME_COMMANDS = new Set(['win', 'draw', 'riichi', 'sichuan-win', 'sichuan-gang', 'sichuan-penalty', 'sichuan-setup']);
let collectionsReady = null;

function error(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}

function withoutId(document) {
  const data = Object.assign({}, document);
  delete data._id;
  return data;
}

function cleanSummary(value, fallback) {
  return String(value || fallback || '更新了房间').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
}

function eventId(roomCode, version, type) {
  return `${roomCode}_${String(version).padStart(8, '0')}_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function transactionValue(result) {
  return result && Object.prototype.hasOwnProperty.call(result, 'result') ? result.result : result;
}

async function ensureCollections() {
  if (!collectionsReady) {
    collectionsReady = Promise.all([ROOMS, VIEWS, EVENTS].map(async name => {
      try {
        await db.createCollection(name);
      } catch (err) {
        const message = String(err && (err.errMsg || err.message) || err);
        if (!/exist|已存在|collection.*exist/i.test(message)) {
          console.warn(`create collection ${name} failed`, err);
        }
      }
    }));
  }
  return collectionsReady;
}

function isDuplicateDocumentError(err) {
  const message = String(err && (err.errMsg || err.message || err.code) || err);
  return /duplicate|already exists|已存在|-502001|E11000/i.test(message);
}

async function readRoom(collection, roomCode) {
  const code = Domain.normalizeRoomCode(roomCode);
  if (code.length !== Domain.ROOM_CODE_LENGTH) error('INVALID_ROOM_CODE');
  let result;
  try {
    result = await collection.doc(code).get();
  } catch (err) {
    error('ROOM_NOT_FOUND');
  }
  if (!result || !result.data) error('ROOM_NOT_FOUND');
  return result.data;
}

async function setDocument(collection, id, document) {
  return collection.doc(id).set({ data: withoutId(document) });
}

async function syncViews(transaction, room) {
  const openIds = Domain.occupiedOpenIds(room);
  for (const openId of openIds) {
    const view = Domain.roomView(room, openId);
    await setDocument(transaction.collection(VIEWS), view._id, view);
  }
}

async function addEvent(transaction, event) {
  await setDocument(transaction.collection(EVENTS), event._id, event);
}

function operatorNickname(room, openId) {
  const index = Domain.findSeatByOpenId(room, openId);
  return index >= 0 ? room.seats[index].nickname : '未知玩家';
}

function assertMember(room, openId) {
  if (!Domain.isMember(room, openId)) error('NOT_ROOM_MEMBER');
}

function assertActive(room) {
  if (room.status !== 'active') error('ROOM_ENDED');
}

function assertVersion(room, expectedVersion) {
  if (!Number.isInteger(expectedVersion) || expectedVersion !== room.version) error('VERSION_CONFLICT');
}

function actionRecord({ id, type, summary, openId, nickname, now }) {
  return {
    id,
    type,
    summary,
    operatorOpenId: openId,
    operatorNickname: nickname,
    createdAt: now
  };
}

function recordActivity(room, action) {
  room.lastAction = action;
  room.activity = [action].concat(room.activity || []).slice(0, 100);
}

async function createRoom(event, openId) {
  await ensureCollections();
  const nickname = Domain.sanitizeNickname(event.nickname);
  const now = new Date();
  let lastError;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = Domain.generateRoomCode();
    const room = Domain.createRoomDocument({
      code,
      mode: event.mode,
      gameType: event.gameType,
      ownerOpenId: openId,
      ownerNickname: nickname,
      ownerAvatarFileId: event.avatarFileId,
      seatIndex: event.seatIndex,
      now
    });

    try {
      await db.collection(ROOMS).add({ data: room });
      const view = Domain.roomView(room, openId);
      try {
        await db.collection(VIEWS).add({ data: view });
      } catch (viewError) {
        await db.collection(ROOMS).doc(code).remove();
        throw viewError;
      }
      return view;
    } catch (err) {
      lastError = err;
      if (!isDuplicateDocumentError(err)) {
        console.error('create room storage failed', err);
        throw err;
      }
    }
  }

  console.error('create room failed', lastError);
  error('ROOM_CODE_EXHAUSTED');
}

async function inspectRoom(event) {
  const room = await readRoom(db.collection(ROOMS), event.roomCode);
  return Domain.publicRoomPreview(room);
}

async function joinRoom(event, openId) {
  const code = Domain.normalizeRoomCode(event.roomCode);
  const result = await db.runTransaction(async transaction => {
    let room = await readRoom(transaction.collection(ROOMS), code);
    assertActive(room);
    if (event.gameType && Domain.normalizeGameType(room.gameType) !== Domain.normalizeGameType(event.gameType)) {
      error('INVALID_GAME_TYPE');
    }
    room = Domain.joinSeat(room, {
      openId,
      nickname: event.nickname,
      avatarFileId: event.avatarFileId,
      seatIndex: event.seatIndex
    });

    const now = new Date();
    const nickname = operatorNickname(room, openId);
    room.version += 1;
    room.updatedAt = now;
    const id = eventId(code, room.version, 'join');
    recordActivity(room, actionRecord({
      id,
      type: 'join',
      summary: `${nickname} 加入了房间`,
      openId,
      nickname,
      now
    }));

    await setDocument(transaction.collection(ROOMS), code, room);
    await syncViews(transaction, room);
    await addEvent(transaction, {
      _id: id,
      roomCode: code,
      version: room.version,
      type: 'join',
      operatorOpenId: openId,
      operatorNickname: nickname,
      summary: room.lastAction.summary,
      createdAt: now
    });
    return Domain.roomView(room, openId);
  });
  return transactionValue(result);
}

async function updateRoomProfile(event, openId) {
  const code = Domain.normalizeRoomCode(event.roomCode);
  const result = await db.runTransaction(async transaction => {
    let room = await readRoom(transaction.collection(ROOMS), code);
    assertActive(room);
    assertMember(room, openId);
    assertVersion(room, event.expectedVersion);
    room = Domain.updateSeatProfile(room, {
      openId,
      avatarFileId: event.avatarFileId
    });

    const now = new Date();
    const nickname = operatorNickname(room, openId);
    room.version += 1;
    room.updatedAt = now;
    const id = eventId(code, room.version, 'profile');
    recordActivity(room, actionRecord({
      id,
      type: 'profile',
      summary: `${nickname} 更新了头像`,
      openId,
      nickname,
      now
    }));

    await setDocument(transaction.collection(ROOMS), code, room);
    await syncViews(transaction, room);
    await addEvent(transaction, {
      _id: id,
      roomCode: code,
      version: room.version,
      type: 'profile',
      operatorOpenId: openId,
      operatorNickname: nickname,
      summary: room.lastAction.summary,
      createdAt: now
    });
    return Domain.roomView(room, openId);
  });
  return transactionValue(result);
}

async function submitGame(event, openId) {
  const code = Domain.normalizeRoomCode(event.roomCode);
  const type = String(event.commandType || '');
  if (!GAME_COMMANDS.has(type)) error('INVALID_COMMAND');

  const result = await db.runTransaction(async transaction => {
    const room = await readRoom(transaction.collection(ROOMS), code);
    assertActive(room);
    const roomGameType = Domain.normalizeGameType(room.gameType);
    const commandGameType = type.startsWith('sichuan-') ? 'sichuan' : 'riichi';
    if (roomGameType !== commandGameType) error('INVALID_GAME_TYPE');
    assertMember(room, openId);
    assertVersion(room, event.expectedVersion);

    let nextGame = Domain.normalizeGame(event.nextGame, room.gameType);
    nextGame = Domain.applySeatNames(nextGame, room.seats);
    Domain.validateGame(nextGame, room.mode, room.gameType);

    const now = new Date();
    const nickname = operatorNickname(room, openId);
    const nextVersion = room.version + 1;
    const id = eventId(code, nextVersion, type);
    const beforeGame = Domain.clone(room.game);
    room.game = nextGame;
    room.version = nextVersion;
    room.updatedAt = now;
    room.lastGameEventId = id;
    recordActivity(room, actionRecord({
      id,
      type,
      summary: cleanSummary(event.summary, `${nickname} 更新了计分`),
      openId,
      nickname,
      now
    }));

    await setDocument(transaction.collection(ROOMS), code, room);
    await syncViews(transaction, room);
    await addEvent(transaction, {
      _id: id,
      roomCode: code,
      version: room.version,
      type,
      operatorOpenId: openId,
      operatorNickname: nickname,
      summary: room.lastAction.summary,
      beforeGame,
      afterGame: Domain.clone(room.game),
      createdAt: now
    });
    return Domain.roomView(room, openId);
  });
  return transactionValue(result);
}

async function undoGame(event, openId) {
  const code = Domain.normalizeRoomCode(event.roomCode);
  const result = await db.runTransaction(async transaction => {
    const room = await readRoom(transaction.collection(ROOMS), code);
    assertActive(room);
    assertMember(room, openId);
    assertVersion(room, event.expectedVersion);
    if (!room.lastGameEventId) error('NOTHING_TO_UNDO');

    const previousResult = await transaction.collection(EVENTS).doc(room.lastGameEventId).get();
    const previousEvent = previousResult && previousResult.data;
    if (!previousEvent || !previousEvent.beforeGame || previousEvent.type === 'undo') error('NOTHING_TO_UNDO');

    const now = new Date();
    const nickname = operatorNickname(room, openId);
    const nextVersion = room.version + 1;
    const id = eventId(code, nextVersion, 'undo');
    const beforeGame = Domain.clone(room.game);
    room.game = Domain.applySeatNames(Domain.normalizeGame(previousEvent.beforeGame, room.gameType), room.seats);
    Domain.validateGame(room.game, room.mode, room.gameType);
    room.version = nextVersion;
    room.updatedAt = now;
    room.lastGameEventId = id;
    recordActivity(room, actionRecord({
      id,
      type: 'undo',
      summary: `${nickname} 撤销了最新计分`,
      openId,
      nickname,
      now
    }));

    await setDocument(transaction.collection(ROOMS), code, room);
    await syncViews(transaction, room);
    await addEvent(transaction, {
      _id: id,
      roomCode: code,
      version: room.version,
      type: 'undo',
      operatorOpenId: openId,
      operatorNickname: nickname,
      summary: room.lastAction.summary,
      beforeGame,
      afterGame: Domain.clone(room.game),
      undoneEventId: previousEvent._id,
      createdAt: now
    });
    return Domain.roomView(room, openId);
  });
  return transactionValue(result);
}

async function resetGame(event, openId) {
  const code = Domain.normalizeRoomCode(event.roomCode);
  const result = await db.runTransaction(async transaction => {
    const room = await readRoom(transaction.collection(ROOMS), code);
    assertActive(room);
    if (room.hostOpenId !== openId) error('HOST_ONLY');
    assertVersion(room, event.expectedVersion);

    const now = new Date();
    const nickname = operatorNickname(room, openId);
    const nextVersion = room.version + 1;
    const id = eventId(code, nextVersion, 'reset');
    const beforeGame = Domain.clone(room.game);
    room.game = Domain.applySeatNames(Domain.newGame(room.mode, room.gameType), room.seats);
    room.version = nextVersion;
    room.updatedAt = now;
    room.lastGameEventId = id;
    recordActivity(room, actionRecord({
      id,
      type: 'reset',
      summary: `${nickname} 重置了整场`,
      openId,
      nickname,
      now
    }));

    await setDocument(transaction.collection(ROOMS), code, room);
    await syncViews(transaction, room);
    await addEvent(transaction, {
      _id: id,
      roomCode: code,
      version: room.version,
      type: 'reset',
      operatorOpenId: openId,
      operatorNickname: nickname,
      summary: room.lastAction.summary,
      beforeGame,
      afterGame: Domain.clone(room.game),
      createdAt: now
    });
    return Domain.roomView(room, openId);
  });
  return transactionValue(result);
}

async function releaseRoomSeat(event, openId) {
  const code = Domain.normalizeRoomCode(event.roomCode);
  const result = await db.runTransaction(async transaction => {
    let room = await readRoom(transaction.collection(ROOMS), code);
    assertActive(room);
    if (room.hostOpenId !== openId) error('HOST_ONLY');
    assertVersion(room, event.expectedVersion);

    const target = room.seats[Number(event.seatIndex)];
    const removedOpenId = target && target.openId;
    const removedNickname = target && target.nickname;
    room = Domain.releaseSeat(room, event.seatIndex);

    const now = new Date();
    const nickname = operatorNickname(room, openId);
    room.version += 1;
    room.updatedAt = now;
    const id = eventId(code, room.version, 'release-seat');
    recordActivity(room, actionRecord({
      id,
      type: 'release-seat',
      summary: `${nickname} 释放了 ${removedNickname || '玩家'} 的座位`,
      openId,
      nickname,
      now
    }));

    await setDocument(transaction.collection(ROOMS), code, room);
    if (removedOpenId) {
      await transaction.collection(VIEWS).doc(`${code}_${removedOpenId}`).remove();
    }
    await syncViews(transaction, room);
    await addEvent(transaction, {
      _id: id,
      roomCode: code,
      version: room.version,
      type: 'release-seat',
      operatorOpenId: openId,
      operatorNickname: nickname,
      summary: room.lastAction.summary,
      createdAt: now
    });
    return Domain.roomView(room, openId);
  });
  return transactionValue(result);
}

async function moveRoomSeat(event, openId) {
  const code = Domain.normalizeRoomCode(event.roomCode);
  const result = await db.runTransaction(async transaction => {
    let room = await readRoom(transaction.collection(ROOMS), code);
    assertActive(room);
    assertMember(room, openId);
    assertVersion(room, event.expectedVersion);

    const sourceIndex = Domain.findSeatByOpenId(room, openId);
    room = Domain.moveSeat(room, { openId, seatIndex: event.seatIndex });

    const now = new Date();
    const nickname = operatorNickname(room, openId);
    room.version += 1;
    room.updatedAt = now;
    const id = eventId(code, room.version, 'move-seat');
    recordActivity(room, actionRecord({
      id,
      type: 'move-seat',
      summary: `${nickname} 换座`,
      openId,
      nickname,
      now
    }));

    await setDocument(transaction.collection(ROOMS), code, room);
    await syncViews(transaction, room);
    await addEvent(transaction, {
      _id: id,
      roomCode: code,
      version: room.version,
      type: 'move-seat',
      operatorOpenId: openId,
      operatorNickname: nickname,
      summary: room.lastAction.summary,
      fromSeat: sourceIndex,
      toSeat: Number(event.seatIndex),
      createdAt: now
    });
    return Domain.roomView(room, openId);
  });
  return transactionValue(result);
}

async function endRoom(event, openId) {
  const code = Domain.normalizeRoomCode(event.roomCode);
  const result = await db.runTransaction(async transaction => {
    const room = await readRoom(transaction.collection(ROOMS), code);
    assertActive(room);
    if (room.hostOpenId !== openId) error('HOST_ONLY');
    assertVersion(room, event.expectedVersion);

    const now = new Date();
    const nickname = operatorNickname(room, openId);
    room.status = 'ended';
    room.endedAt = now;
    room.expiresAt = new Date(now.getTime() + Domain.ROOM_RETENTION_MS);
    room.version += 1;
    room.updatedAt = now;
    const id = eventId(code, room.version, 'end');
    recordActivity(room, actionRecord({
      id,
      type: 'end',
      summary: `${nickname} 结束了房间`,
      openId,
      nickname,
      now
    }));

    await setDocument(transaction.collection(ROOMS), code, room);
    await syncViews(transaction, room);
    await addEvent(transaction, {
      _id: id,
      roomCode: code,
      version: room.version,
      type: 'end',
      operatorOpenId: openId,
      operatorNickname: nickname,
      summary: room.lastAction.summary,
      createdAt: now
    });
    return Domain.roomView(room, openId);
  });
  return transactionValue(result);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) error('IDENTITY_UNAVAILABLE');

  switch (event && event.action) {
    case 'identity':
      return { openId: OPENID };
    case 'create':
      return createRoom(event, OPENID);
    case 'inspect':
      return inspectRoom(event);
    case 'join':
      return joinRoom(event, OPENID);
    case 'updateProfile':
      return updateRoomProfile(event, OPENID);
    case 'command':
      return submitGame(event, OPENID);
    case 'undo':
      return undoGame(event, OPENID);
    case 'reset':
      return resetGame(event, OPENID);
    case 'releaseSeat':
      return releaseRoomSeat(event, OPENID);
    case 'moveSeat':
      return moveRoomSeat(event, OPENID);
    case 'end':
      return endRoom(event, OPENID);
    default:
      error('UNKNOWN_ACTION');
  }
};
