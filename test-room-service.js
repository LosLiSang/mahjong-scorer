const assert = require('assert');
const Config = require('./miniprogram/config');

Config.cloudEnvId = 'test-env';
let lastCall = null;
let watchQuery = null;
let watcherClosed = false;

global.wx = {
  cloud: {
    async callFunction(options) {
      lastCall = options;
      if (options.data.action === 'identity') return { result: { openId: 'openid-self' } };
      if (options.data.action === 'inspect') {
        return { result: { roomCode: options.data.roomCode, mode: 'yonma', seats: [] } };
      }
      return { result: { ok: true } };
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

  const parsed = RoomService.parseError({ message: 'cloud function failed: VERSION_CONFLICT' });
  assert.equal(parsed.code, 'VERSION_CONFLICT');
  assert(parsed.message.includes('状态已更新'));

  console.log('room service tests: 13 assertions passed');
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
