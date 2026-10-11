'use strict';

// 每天 03:20 由定时触发器调用：删除已结束且过期的房间及其成员视图、审计事件。
// 用 where().remove() 按房间批量删除；时间预算内反复分批处理，处理不完的留到下次。

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const BATCH_SIZE = 100;
const TIME_BUDGET_MS = 45000; // 云函数超时 60 秒，留出余量

async function removeRoom(roomCode) {
  // 先删子数据、最后删房间：中途失败时房间仍在，下次还能找到并重试
  await db.collection('room_views').where({ roomCode }).remove();
  await db.collection('room_events').where({ roomCode }).remove();
  await db.collection('rooms').doc(roomCode).remove();
}

exports.main = async () => {
  const startedAt = Date.now();
  const now = new Date(startedAt);
  const deletedRooms = [];
  const failedRooms = [];
  let hasMore = true;

  while (hasMore && Date.now() - startedAt < TIME_BUDGET_MS) {
    const query = { status: 'ended', expiresAt: _.lt(now) };
    if (failedRooms.length) query._id = _.nin(failedRooms);
    const expired = await db.collection('rooms')
      .where(query)
      .field({ _id: true })
      .limit(BATCH_SIZE)
      .get();
    const roomCodes = (expired.data || []).map(room => room._id);
    if (!roomCodes.length) break;

    for (const roomCode of roomCodes) {
      try {
        await removeRoom(roomCode);
        deletedRooms.push(roomCode);
      } catch (err) {
        console.error('cleanup room failed', roomCode, err);
        failedRooms.push(roomCode);
      }
      if (Date.now() - startedAt >= TIME_BUDGET_MS) break;
    }
    hasMore = (expired.data || []).length === BATCH_SIZE;
  }

  const result = {
    checkedAt: now,
    deletedCount: deletedRooms.length,
    deletedRooms,
    failedRooms,
    timedOut: Date.now() - startedAt >= TIME_BUDGET_MS
  };
  console.log('cleanup done', JSON.stringify({ deletedCount: result.deletedCount, failed: failedRooms.length, timedOut: result.timedOut }));
  return result;
};
