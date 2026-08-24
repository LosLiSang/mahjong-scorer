function detectRoomGameType(room) {
  if (!room) return 'unknown';
  if (room.gameType === 'sichuan') return 'sichuan';
  if (room.gameType === 'riichi') return 'riichi';

  const players = room.game && Array.isArray(room.game.players) ? room.game.players : [];
  if (players.length === 4 && players.every(player => player && Number.isFinite(Number(player.score)))) {
    return 'sichuan';
  }
  if (players.length >= 3 && players.every(player => player && Number.isFinite(Number(player.points)))) {
    return 'riichi';
  }
  return 'unknown';
}

function roomError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function requireSichuanRoom(room) {
  const detected = detectRoomGameType(room);
  if (detected === 'sichuan') return room;

  if (room && room.gameType === 'riichi') {
    throw roomError('INVALID_GAME_TYPE', '该房间是日麻房间，请从日麻计分页加入');
  }

  if (!room || !room.gameType) {
    throw roomError(
      'ROOM_PROTOCOL_OUTDATED',
      '川麻房间协议未生效，请重新部署 mahjong-room 云函数，并重新创建房间'
    );
  }

  throw roomError('INVALID_GAME_TYPE', '该房间不是川麻房间');
}

module.exports = { detectRoomGameType, requireSichuanRoom };
