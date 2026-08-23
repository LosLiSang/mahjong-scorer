const Config = require('../config');

let watcher = null;
let openId = '';

const ERROR_MESSAGES = {
  IDENTITY_UNAVAILABLE: '无法取得微信身份，请稍后重试',
  INVALID_ROOM_CODE: '房间码格式不正确',
  ROOM_NOT_FOUND: '没有找到这个房间',
  ROOM_NOT_ACTIVE: '房间已经结束',
  ROOM_ENDED: '房间已经结束，只能查看记录',
  NICKNAME_REQUIRED: '请填写微信昵称',
  INVALID_SEAT: '请选择有效座位',
  SEAT_OCCUPIED: '该座位已被其他玩家占用',
  NOT_ROOM_MEMBER: '你已不在该房间中',
  VERSION_CONFLICT: '房间状态已更新，请确认后重试',
  INVALID_COMMAND: '不支持的房间操作',
  INVALID_GAME: '对局数据不完整，请重新同步',
  INVALID_GAME_MODE: '房间人数模式不一致',
  POINT_TOTAL_MISMATCH: '点数总计异常，已拒绝同步',
  NOTHING_TO_UNDO: '没有可撤销的最新计分',
  HOST_ONLY: '只有房主可以执行此操作',
  HOST_SEAT_LOCKED: '房主座位不能释放，请先结束房间',
  SEAT_EMPTY: '该座位当前无人占用',
  ROOM_CODE_EXHAUSTED: '暂时无法生成房间码，请稍后重试',
  DATABASE_COLLECTION_NOT_EXIST: '云数据库集合尚未创建，请检查云环境初始化',
  DATABASE_PERMISSION_DENIED: '云数据库读取权限尚未配置，请检查 room_views 安全规则',
  UNKNOWN_ACTION: '未知的房间操作'
};

function isConfigured() {
  return !!(Config.cloudEnvId && typeof wx !== 'undefined' && wx.cloud);
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, '').slice(0, 6);
}

function parseError(err) {
  const raw = [
    err && err.code,
    err && err.errCode,
    err && err.message,
    err && err.errMsg
  ].filter(Boolean).join(' ');
  let code = Object.keys(ERROR_MESSAGES).find(key => raw.includes(key));
  if (!code && /collection.*not.*exist|集合.*不存在|-502005/i.test(raw)) code = 'DATABASE_COLLECTION_NOT_EXIST';
  if (!code && /permission.*denied|权限.*拒绝|-502003/i.test(raw)) code = 'DATABASE_PERMISSION_DENIED';
  const parsed = new Error(code ? ERROR_MESSAGES[code] : '房间服务暂时不可用，请检查网络后重试');
  parsed.code = code || 'ROOM_SERVICE_ERROR';
  parsed.cause = err;
  return parsed;
}

async function call(action, data) {
  if (!isConfigured()) {
    const err = new Error('请先在 miniprogram/config.js 中填写微信云开发 envId');
    err.code = 'CLOUD_NOT_CONFIGURED';
    throw err;
  }
  try {
    const response = await wx.cloud.callFunction({
      name: Config.roomFunctionName,
      data: Object.assign({ action }, data || {})
    });
    return response.result;
  } catch (err) {
    throw parseError(err);
  }
}

async function identity() {
  if (openId) return openId;
  const result = await call('identity');
  openId = result && result.openId;
  if (!openId) throw parseError({ message: 'IDENTITY_UNAVAILABLE' });
  return openId;
}

async function create(options) {
  const result = await call('create', options);
  openId = result && result._openid || openId;
  if (!openId) await identity();
  return result;
}

function inspect(roomCode) {
  return call('inspect', { roomCode: normalizeCode(roomCode) });
}

async function join(options) {
  const result = await call('join', Object.assign({}, options, {
    roomCode: normalizeCode(options.roomCode)
  }));
  openId = result && result._openid || openId;
  if (!openId) await identity();
  return result;
}

function command(options) {
  return call('command', Object.assign({}, options, {
    roomCode: normalizeCode(options.roomCode)
  }));
}

function undo(roomCode, expectedVersion) {
  return call('undo', { roomCode: normalizeCode(roomCode), expectedVersion });
}

function reset(roomCode, expectedVersion) {
  return call('reset', { roomCode: normalizeCode(roomCode), expectedVersion });
}

function releaseSeat(roomCode, expectedVersion, seatIndex) {
  return call('releaseSeat', {
    roomCode: normalizeCode(roomCode),
    expectedVersion,
    seatIndex
  });
}

function end(roomCode, expectedVersion) {
  return call('end', { roomCode: normalizeCode(roomCode), expectedVersion });
}

async function watch(roomCode, handlers) {
  stopWatch();
  const currentOpenId = await identity();
  const code = normalizeCode(roomCode);
  const db = wx.cloud.database();
  watcher = db.collection('room_views').where({
    _id: `${code}_${currentOpenId}`,
    _openid: currentOpenId
  }).watch({
    onChange(snapshot) {
      const view = snapshot && snapshot.docs && snapshot.docs[0];
      if (view && handlers && handlers.onChange) handlers.onChange(view, snapshot);
      if (!view && handlers && handlers.onRemoved) handlers.onRemoved(snapshot);
    },
    onError(err) {
      watcher = null;
      if (handlers && handlers.onError) handlers.onError(parseError(err));
    }
  });
  return watcher;
}

function stopWatch() {
  if (watcher && typeof watcher.close === 'function') {
    try { watcher.close(); } catch (e) {}
  }
  watcher = null;
}

module.exports = {
  ERROR_MESSAGES,
  isConfigured,
  normalizeCode,
  parseError,
  identity,
  create,
  inspect,
  join,
  command,
  undo,
  reset,
  releaseSeat,
  end,
  watch,
  stopWatch
};
