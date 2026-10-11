const assert = require('assert');
const Config = require('./miniprogram/config');

Config.cloudEnvId = 'test-env';
let lastCall = null;
let watchQuery = null;
let watcherClosed = false;
let uploadOptions = null;

global.wx = {
  cloud: {
    async uploadFile(options) {
      uploadOptions = options;
      return { fileID: 'cloud://test-env/room-avatars/openid-self/avatar.png' };
    },
    async callFunction(options) {
      lastCall = options;
      if (options.data.action === 'identity') return { result: { code: 'OK', msg: '', data: { openId: 'openid-self' } } };
      if (options.data.action === 'inspect') {
        // 旧版云函数直接返回数据，过渡期仍兼容
        return { result: { roomCode: options.data.roomCode, mode: 'yonma', seats: [] } };
      }
      if (options.data.roomCode === 'CNF234') {
        return { result: { code: 'VERSION_CONFLICT', msg: '服务端：版本冲突', data: null } };
      }
      return { result: { code: 'OK', msg: '', data: { version: 2 } } };
    },
    database() {
      return {
        collection(name) {
          assert.equal(name, 'room_views');
          return {
            where(query) {
              watchQuery = query;
              return {
                watch(handlers) {
                  handlers.onChange({ docs: [{ roomCode: 'ABC234', version: 1 }] });
                  return { close() { watcherClosed = true; } };
                }
              };
            }
          };
        }
      };
    }
  }
};

delete require.cache[require.resolve('./miniprogram/utils/room-service')];
const RoomService = require('./miniprogram/utils/room-service');

(async () => {
  assert(RoomService.isConfigured());
  assert.equal(RoomService.normalizeCode(' o1-ab2c34 '), 'AB2C34');

  const openId = await RoomService.identity();
  assert.equal(openId, 'openid-self');
  assert.equal(lastCall.name, 'mahjong-room');
  assert.equal(lastCall.data.action, 'identity');

  const preview = await RoomService.inspect('abc234');
  assert.equal(preview.roomCode, 'ABC234');
  assert.equal(lastCall.data.roomCode, 'ABC234');

  const avatarFileId = await RoomService.uploadAvatar('C:\\temp\\avatar.png');
  assert.equal(avatarFileId, 'cloud://test-env/room-avatars/openid-self/avatar.png');
  assert.equal(uploadOptions.filePath, 'C:\\temp\\avatar.png');
  assert(uploadOptions.cloudPath.includes('room-avatars/openid-self/avatar-'));
  assert(uploadOptions.cloudPath.endsWith('.png'));

  await RoomService.updateProfile('abc234', 7, avatarFileId);
  assert.equal(lastCall.data.action, 'updateProfile');
  assert.equal(lastCall.data.roomCode, 'ABC234');
  assert.equal(lastCall.data.expectedVersion, 7);
  assert.equal(lastCall.data.avatarFileId, avatarFileId);

  await RoomService.moveSeat('abc234', 9, 2);
  assert.equal(lastCall.data.action, 'moveSeat');
  assert.equal(lastCall.data.roomCode, 'ABC234');
  assert.equal(lastCall.data.expectedVersion, 9);
  assert.equal(lastCall.data.seatIndex, 2);

  let watchedRoom = null;
  await RoomService.watch('abc234', {
    onChange(room) { watchedRoom = room; }
  });
  assert.equal(watchedRoom.version, 1);
  assert.deepEqual(watchQuery, {
    _id: 'ABC234_openid-self',
    _openid: 'openid-self'
  });

  RoomService.stopWatch();
  assert.equal(watcherClosed, true);

  // 云函数通过返回值报错：抛出带 code 的异常，消息取服务端 msg
  await assert.rejects(RoomService.undo('cnf234', 1), err => err.code === 'VERSION_CONFLICT' && err.message === '服务端：版本冲突');
  assert.deepEqual(await RoomService.undo('abc234', 1), { version: 2 }, '成功时只返回 data');

  const parsed = RoomService.parseError({ message: 'cloud function failed: VERSION_CONFLICT' });
  assert.equal(parsed.code, 'VERSION_CONFLICT');
  assert(parsed.message.includes('状态已更新'));

  console.log('room service tests passed');
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
