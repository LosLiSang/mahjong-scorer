'use strict';

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function removeByRoom(collectionName, roomCode) {
  while (true) {
    const result = await db.collection(collectionName).where({ roomCode }).limit(100).get();
    const documents = result.data || [];
    if (!documents.length) return;
    await Promise.all(documents.map(document => db.collection(collectionName).doc(document._id).remove()));
    if (documents.length < 100) return;
  }
}

exports.main = async () => {
  const now = new Date();
  const expired = await db.collection('rooms').where({
    status: 'ended',
    expiresAt: _.lt(now)
  }).limit(100).get();

  const deletedRooms = [];
  for (const room of expired.data || []) {
    const roomCode = room._id;
    await removeByRoom('room_views', roomCode);
    await removeByRoom('room_events', roomCode);
    await db.collection('rooms').doc(roomCode).remove();
    deletedRooms.push(roomCode);
  }

  return {
    checkedAt: now,
    deletedCount: deletedRooms.length,
    deletedRooms
  };
};
