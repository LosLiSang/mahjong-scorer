'use strict';

const cloud = require('wx-server-sdk');
const Domain = require('./domain');
const Response = require('./response');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ROOMS = 'rooms';
const VIEWS = 'room_views';
const EVENTS = 'room_events';
let collectionsReady = null;

// 错误码 → 给用户看的提示（随返回值的 msg 下发；领域层 domain.js 抛出的错误码也在这里登记）
const MESSAGES = {
  IDENTITY_UNAVAILABLE: '无法取得微信身份，请稍后重试',
  UNKNOWN_ACTION: '未知的房间操作',
  INVALID_ROOM_CODE: '房间码格式不正确',
  ROOM_NOT_FOUND: '没有找到这个房间',
  ROOM_NOT_ACTIVE: '房间已经结束',
  ROOM_ENDED: '房间已经结束，只能查看记录',
  ROOM_CODE_EXHAUSTED: '暂时无法生成房间码，请稍后重试',
  NICKNAME_REQUIRED: '请填写微信昵称',
  INVALID_SEAT: '请选择有效座位',
  SEAT_OCCUPIED: '该座位已被其他玩家占用',
  SEAT_EMPTY: '该座位当前无人占用',
  HOST_SEAT_LOCKED: '房主座位不能释放，请先结束房间',
  NOT_ROOM_MEMBER: '你已不在该房间中',
  HOST_ONLY: '只有房主可以执行此操作',
  VERSION_CONFLICT: '房间状态已更新，请确认后重试',
  INVALID_COMMAND: '不支持的房间操作',
  INVALID_GAME: '对局数据不完整，请重新同步',
  INVALID_GAME_MODE: '房间人数模式不一致',
  INVALID_GAME_TYPE: '房间计分类型不一致',
  POINT_TOTAL_MISMATCH: '点数总计异常，已拒绝同步',
  NOTHING_TO_UNDO: '没有可撤销的最新计分',
  HAND_IN_PROGRESS: '本局已有人和牌，结束本局后才能关闭血战到底',
  INTERNAL_ERROR: '房间服务暂时不可用，请稍后重试'
};

const error = Response.fail;

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

const ACTIONS = {
  identity: (event, openId) => ({ openId }),
  create: createRoom,
  inspect: inspectRoom,
  join: joinRoom,
  updateProfile: updateRoomProfile,
  command: submitGame,
  undo: undoGame,
  reset: resetGame,
  releaseSeat: releaseRoomSeat,
  moveSeat: moveRoomSeat,
  end: endRoom
};

// 返回 { code, msg, data }，不抛异常
exports.main = event => Response.handle(() => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) error('IDENTITY_UNAVAILABLE');
  const action = ACTIONS[event && event.action];
  if (!action) error('UNKNOWN_ACTION');
  return action(event, OPENID);
}, MESSAGES);

exports._internal = { MESSAGES };
