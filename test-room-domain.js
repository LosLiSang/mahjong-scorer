const assert = require('assert');
const Room = require('./cloudfunctions/mahjong-room/domain');

const generated = Room.generateRoomCode(() => 0);
assert.equal(generated, '222222');
assert.equal(Room.normalizeRoomCode(' o1-a2b3c4 '), 'A2B3C4');
assert.equal(Room.generateRoomCode(() => 0.999999).length, 6);

const created = Room.createRoomDocument({
  code: 'ABC234',
  mode: 4,
  ownerOpenId: 'openid-owner',
  ownerNickname: '房主',
  seatIndex: 2,
  now: new Date('2026-08-22T00:00:00.000Z')
});
assert.equal(created.mode, 'yonma');
assert.equal(created.game.players.length, 4);
assert.equal(created.game.players[2].name, '房主');
assert.equal(created.seats[2].openId, 'openid-owner');
assert.equal(created.seats[0].occupied, false);
assert(Room.validateGame(created.game, created.mode));

const joined = Room.joinSeat(created, {
  openId: 'openid-guest',
  nickname: '来宾',
  seatIndex: 0
});
assert.equal(joined.seats[0].occupied, true);
assert.equal(joined.game.players[0].name, '来宾');
assert.equal(joined.game.players[0].points, 25000, '中途入座应继承座位当前点数');
assert.equal(created.seats[0].occupied, false, '房间领域操作不得修改原对象');

const memberView = Room.roomView(joined, 'openid-guest');
assert.equal(memberView.mySeat, 0);
assert.equal(memberView.isHost, false);
assert.equal(memberView.seats[2].nickname, '房主');
assert(!JSON.stringify(memberView).includes('openid-owner'), '成员视图不得泄露其他玩家 OpenID');
assert.equal(memberView._openid, 'openid-guest', '成员视图只保留安全规则所需的本人 OpenID');

const preview = Room.publicRoomPreview(joined);
assert.equal(preview.roomCode, 'ABC234');
assert.equal(preview.seats[0].occupied, true);
assert(!JSON.stringify(preview).includes('openid'));

joined.game.players[0].points += 1000;
joined.game.players[1].points -= 1000;
assert(Room.validateGame(joined.game, joined.mode));

const invalid = JSON.parse(JSON.stringify(joined.game));
invalid.players[0].points += 100;
assert.throws(() => Room.validateGame(invalid, joined.mode), /POINT_TOTAL_MISMATCH/);

const untrusted = Object.assign({ unexpected: 'drop-me' }, joined.game);
untrusted.players = joined.game.players.map(player => Object.assign({ admin: true }, player));
const normalized = Room.normalizeGame(untrusted);
assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'unexpected'), false);
assert.equal(Object.prototype.hasOwnProperty.call(normalized.players[0], 'admin'), false);
assert(Room.validateGame(normalized, joined.mode));

const released = Room.releaseSeat(joined, 0);
assert.equal(released.seats[0].occupied, false);
assert.equal(released.game.players[0].name, '玩家一');
assert.equal(released.game.players[0].points, 26000, '释放座位不得重置该座位点数');
assert.throws(() => Room.releaseSeat(joined, 2), /HOST_SEAT_LOCKED/);

const sanma = Room.createRoomDocument({
  code: 'ZXCV23',
  mode: 'sanma',
  ownerOpenId: 'sanma-owner',
  ownerNickname: '三麻房主',
  seatIndex: 0
});
assert.equal(sanma.game.players.length, 3);
assert.equal(sanma.game.players.reduce((sum, player) => sum + player.points, 0), 105000);
assert(Room.validateGame(sanma.game, sanma.mode));

console.log('room domain tests: 33 assertions passed');
