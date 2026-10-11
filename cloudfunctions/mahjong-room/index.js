'use strict';

const cloud = require('wx-server-sdk');
const Domain = require('./domain');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ROOMS = 'rooms';
const VIEWS = 'room_views';
const EVENTS = 'room_events';
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

// 房间写操作的统一流程（单个事务内）：
//   读房间 → 校验状态 / 权限 / 版本 → spec.apply 产生新房间 → 版本 +1、记录动作
//   → 写 rooms、同步成员视图、追加审计事件 → 返回操作者的视图
// spec:
//   type         事件类型
//   access       'anyone'（不校验成员与版本，仅 join）| 'member' | 'host'
//   apply        (room, ctx) => ({ room, summary(nickname), gameChanged?, eventData?, removedOpenId? })
async function mutateRoom(event, openId, spec) {
  const code = Domain.normalizeRoomCode(event.roomCode);
  const result = await db.runTransaction(async transaction => {
    const current = await readRoom(transaction.collection(ROOMS), code);
    assertActive(current);
    if (spec.access === 'host' && current.hostOpenId !== openId) error('HOST_ONLY');
    if (spec.access === 'member') assertMember(current, openId);
    if (spec.access !== 'anyone') assertVersion(current, event.expectedVersion);

    const now = new Date();
    const beforeGame = Domain.clone(current.game);
    const change = await spec.apply(current, { transaction, now });
    const room = change.room;
    const nickname = operatorNickname(room, openId);
    room.version = current.version + 1;
    room.updatedAt = now;
    const id = eventId(code, room.version, spec.type);
    if (change.gameChanged) room.lastGameEventId = id;
    recordActivity(room, actionRecord({ id, type: spec.type, summary: change.summary(nickname), openId, nickname, now }));

    await setDocument(transaction.collection(ROOMS), code, room);
    if (change.removedOpenId) {
      await transaction.collection(VIEWS).doc(`${code}_${change.removedOpenId}`).remove();
    }
    await syncViews(transaction, room);
    await addEvent(transaction, Object.assign({
      _id: id,
      roomCode: code,
      version: room.version,
      type: spec.type,
      operatorOpenId: openId,
      operatorNickname: nickname,
      summary: room.lastAction.summary
    }, change.gameChanged ? { beforeGame, afterGame: Domain.clone(room.game) } : {}, change.eventData, { createdAt: now }));
    return Domain.roomView(room, openId);
  });
  return transactionValue(result);
}

function joinRoom(event, openId) {
  return mutateRoom(event, openId, {
    type: 'join',
    access: 'anyone',
    apply: room => {
      if (event.gameType && Domain.normalizeGameType(room.gameType) !== Domain.normalizeGameType(event.gameType)) {
        error('INVALID_GAME_TYPE');
      }
      return {
        room: Domain.joinSeat(room, { openId, nickname: event.nickname, avatarFileId: event.avatarFileId, seatIndex: event.seatIndex }),
        summary: nickname => `${nickname} 加入了房间`
      };
    }
  });
}

function updateRoomProfile(event, openId) {
  return mutateRoom(event, openId, {
    type: 'profile',
    access: 'member',
    apply: room => ({
      room: Domain.updateSeatProfile(room, { openId, avatarFileId: event.avatarFileId }),
      summary: nickname => `${nickname} 更新了头像`
    })
  });
}

function submitGame(event, openId) {
  const type = String(event.commandType || '');
  if (!Domain.GAME_COMMANDS.includes(type)) error('INVALID_COMMAND');
  return mutateRoom(event, openId, {
    type,
    access: 'member',
    apply: room => ({
      room: Object.assign({}, room, { game: Domain.applyGameCommand(room, { openId, type, nextGame: event.nextGame }) }),
      summary: nickname => cleanSummary(event.summary, `${nickname} 更新了计分`),
      gameChanged: true
    })
  });
}

function undoGame(event, openId) {
  return mutateRoom(event, openId, {
    type: 'undo',
    access: 'member',
    apply: async (room, { transaction }) => {
      if (!room.lastGameEventId) error('NOTHING_TO_UNDO');
      const previousResult = await transaction.collection(EVENTS).doc(room.lastGameEventId).get();
      const previousEvent = previousResult && previousResult.data;
      if (!previousEvent || !previousEvent.beforeGame || previousEvent.type === 'undo') error('NOTHING_TO_UNDO');
      const game = Domain.applySeatNames(Domain.normalizeGame(previousEvent.beforeGame, room.gameType), room.seats);
      Domain.validateGame(game, room.mode, room.gameType);
      return {
        room: Object.assign({}, room, { game }),
        summary: nickname => `${nickname} 撤销了最新计分`,
        gameChanged: true,
        eventData: { undoneEventId: previousEvent._id }
      };
    }
  });
}

function resetGame(event, openId) {
  return mutateRoom(event, openId, {
    type: 'reset',
    access: 'host',
    apply: room => ({
      room: Object.assign({}, room, { game: Domain.applySeatNames(Domain.newGame(room.mode, room.gameType, room.game), room.seats) }),
      summary: nickname => `${nickname} 重置了整场`,
      gameChanged: true
    })
  });
}

function releaseRoomSeat(event, openId) {
  return mutateRoom(event, openId, {
    type: 'release-seat',
    access: 'host',
    apply: room => {
      const target = room.seats[Number(event.seatIndex)];
      return {
        room: Domain.releaseSeat(room, event.seatIndex),
        summary: nickname => `${nickname} 释放了 ${(target && target.nickname) || '玩家'} 的座位`,
        removedOpenId: target && target.openId
      };
    }
  });
}

function moveRoomSeat(event, openId) {
  return mutateRoom(event, openId, {
    type: 'move-seat',
    access: 'member',
    apply: room => ({
      room: Domain.moveSeat(room, { openId, seatIndex: event.seatIndex }),
      summary: nickname => `${nickname} 换座`,
      eventData: { fromSeat: Domain.findSeatByOpenId(room, openId), toSeat: Number(event.seatIndex) }
    })
  });
}

function endRoom(event, openId) {
  return mutateRoom(event, openId, {
    type: 'end',
    access: 'host',
    apply: (room, { now }) => ({
      room: Object.assign({}, room, {
        status: 'ended',
        endedAt: now,
        expiresAt: new Date(now.getTime() + Domain.ROOM_RETENTION_MS)
      }),
      summary: nickname => `${nickname} 结束了房间`
    })
  });
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
