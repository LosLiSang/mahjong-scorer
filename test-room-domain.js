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
  ownerAvatarFileId: 'cloud://test-env/avatar-owner.jpg',
  seatIndex: 2,
  now: new Date('2026-08-22T00:00:00.000Z')
});
assert.equal(created.mode, 'yonma');
assert.equal(created.game.players.length, 4);
assert.equal(created.game.players[2].name, '房主');
assert.equal(created.seats[2].openId, 'openid-owner');
assert.equal(created.seats[2].avatarFileId, 'cloud://test-env/avatar-owner.jpg');
assert.equal(created.seats[0].occupied, false);
assert(Room.validateGame(created.game, created.mode));

const joined = Room.joinSeat(created, {
  openId: 'openid-guest',
  nickname: '来宾',
  avatarFileId: 'cloud://test-env/avatar-guest.jpg',
  seatIndex: 0
});
assert.equal(joined.seats[0].occupied, true);
assert.equal(joined.game.players[0].name, '来宾');
assert.equal(joined.seats[0].avatarFileId, 'cloud://test-env/avatar-guest.jpg');
assert.equal(joined.game.players[0].points, 25000, '中途入座应继承座位当前点数');
assert.equal(created.seats[0].occupied, false, '房间领域操作不得修改原对象');

const memberView = Room.roomView(joined, 'openid-guest');
assert.equal(memberView.mySeat, 0);
assert.equal(memberView.isHost, false);
assert.equal(memberView.seats[2].nickname, '房主');
assert.equal(memberView.seats[2].avatarFileId, 'cloud://test-env/avatar-owner.jpg');
assert(!JSON.stringify(memberView).includes('openid-owner'), '成员视图不得泄露其他玩家 OpenID');
assert.equal(memberView._openid, 'openid-guest', '成员视图只保留安全规则所需的本人 OpenID');

const preview = Room.publicRoomPreview(joined);
assert.equal(preview.roomCode, 'ABC234');
assert.equal(preview.seats[0].occupied, true);
assert.equal(preview.seats[0].avatarFileId, 'cloud://test-env/avatar-guest.jpg');
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

const profiled = Room.updateSeatProfile(joined, {
  openId: 'openid-guest',
  avatarFileId: 'cloud://test-env/avatar-guest-new.jpg'
});
assert.equal(profiled.seats[0].avatarFileId, 'cloud://test-env/avatar-guest-new.jpg');
assert.equal(joined.seats[0].avatarFileId, 'cloud://test-env/avatar-guest.jpg', '更新头像不得修改原房间对象');
assert.equal(Room.sanitizeAvatarFileId('https://example.com/avatar.jpg'), '', '房间只接受本云存储 fileID');

const released = Room.releaseSeat(joined, 0);
assert.equal(released.seats[0].occupied, false);
assert.equal(released.seats[0].avatarFileId, '');
assert.equal(released.game.players[0].name, '玩家一');
assert.equal(released.game.players[0].points, 26000, '释放座位不得重置该座位点数');
assert.throws(() => Room.releaseSeat(joined, 2), /HOST_SEAT_LOCKED/);

// 换座：成员移到空座，分数跟着人走；原对象不被修改，总分守恒
joined.game.history.push({ type: 'win', round: 'E1', winner: 0, loser: 1, isTsumo: false, total: 1000, han: 1, fu: 30 });
const moved = Room.moveSeat(joined, { openId: 'openid-guest', seatIndex: 1 });
assert.equal(moved.seats[1].openId, 'openid-guest', '成员应移动到目标空座');
assert.equal(moved.seats[1].occupied, true);
assert.equal(moved.seats[0].occupied, false, '原座位应腾空');
assert.equal(moved.seats[0].openId, '', '腾空座位不应保留原成员 OpenID');
assert.equal(moved.seats[2].openId, 'openid-owner', '其他成员座位不受影响');
assert.equal(moved.game.players[1].points, 26000, '分数应跟着成员走（26000 从原座位移到新座）');
assert.equal(moved.game.players[0].points, 24000, '原空座应保留目标座位原有点数池（24000）');
assert.equal(moved.game.players[1].name, '来宾', '新座位显示成员昵称');
assert.equal(moved.game.players[0].name, '玩家一', '腾空座位恢复占位昵称');
assert.equal(moved.game.history[0].winner, 1, '日麻历史 winner 应随座位对调');
assert.equal(moved.game.history[0].loser, 0, '日麻历史 loser 应随座位对调');
assert(Room.validateGame(moved.game, moved.mode), '换座后总分必须守恒');
assert.equal(joined.seats[0].openId, 'openid-guest', '换座不得修改原房间对象');
assert.equal(joined.game.players[0].points, 26000, '换座不得修改原房间分数');
assert.equal(joined.game.history[0].winner, 0, '换座不得修改原房间历史');

// 换座权限与边界
assert.throws(() => Room.moveSeat(joined, { openId: 'openid-ghost', seatIndex: 1 }), /NOT_ROOM_MEMBER/, '非成员不能换座');
assert.throws(() => Room.moveSeat(joined, { openId: 'openid-guest', seatIndex: 2 }), /SEAT_OCCUPIED/, '目标已被占用不能换座');
assert.throws(() => Room.moveSeat(joined, { openId: 'openid-guest', seatIndex: 0 }), /SEAT_EMPTY/, '不能换到自己当前座位');
assert.throws(() => Room.moveSeat(joined, { openId: 'openid-guest', seatIndex: 9 }), /INVALID_SEAT/, '非法目标座位应拒绝');

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

const sichuan = Room.createRoomDocument({
  code: 'SCMJ24',
  mode: 4,
  gameType: 'sichuan',
  ownerOpenId: 'sichuan-owner',
  ownerNickname: '川麻房主',
  seatIndex: 1
});
assert.equal(sichuan.gameType, 'sichuan');
assert.equal(sichuan.mode, 'yonma');
assert.equal(sichuan.game.players.length, 4);
assert.equal(sichuan.game.players[1].name, '川麻房主');
assert.equal(sichuan.game.players.reduce((sum, player) => sum + player.score, 0), 0);
sichuan.game.players[0].score -= 2;
sichuan.game.players[1].score += 2;
sichuan.game.players[0].missingSuit = 'm';
sichuan.game.history.push({
  type: 'win', receiver: 1, payers: [0], amountPerPayer: 2,
  label: '胡牌 · 平胡 · 1番', createdAt: Date.now(), deltas: [-2, 2, 0, 0]
});
assert(Room.validateGame(sichuan.game, sichuan.mode, sichuan.gameType));
const normalizedSichuan = Room.normalizeGame(Object.assign({ admin: true }, sichuan.game), 'sichuan');
assert.equal(Object.prototype.hasOwnProperty.call(normalizedSichuan, 'admin'), false);
assert.equal(normalizedSichuan.players[0].missingSuit, 'm');
assert(Room.validateGame(normalizedSichuan, sichuan.mode, 'sichuan'));
const invalidSichuan = JSON.parse(JSON.stringify(normalizedSichuan));
invalidSichuan.players[0].score += 1;
assert.throws(() => Room.validateGame(invalidSichuan, 'yonma', 'sichuan'), /POINT_TOTAL_MISMATCH/);
assert.equal(Room.publicRoomPreview(sichuan).gameType, 'sichuan');
assert.equal(Room.roomView(sichuan, 'sichuan-owner').gameType, 'sichuan');

// 川麻换座同样遵循分数跟着人走
const sichuanMoved = Room.moveSeat(sichuan, { openId: 'sichuan-owner', seatIndex: 0 });
assert.equal(sichuanMoved.seats[0].occupied, true, '川麻房主移到空座后目标座位应有人');
assert.equal(sichuanMoved.seats[1].occupied, false, '川麻房主离开的座位应腾空');
assert.equal(sichuanMoved.game.players[0].score, 2, '分数跟着人走：房主 +2 移到座位 0');
assert.equal(sichuanMoved.game.players[1].score, -2, '原空位保留座位 0 原有点数池 -2');
assert.equal(sichuanMoved.game.players[0].name, '川麻房主', '新座位显示房主昵称');
assert.equal(sichuanMoved.game.history[0].receiver, 0, '川麻历史 receiver 应随座位对调');
assert.deepEqual(sichuanMoved.game.history[0].deltas, [2, -2, 0, 0], '历史 delta 应随座位对调保持总和守恒');
assert(Room.validateGame(sichuanMoved.game, sichuanMoved.mode, 'sichuan'), '川麻换座后总分必须守恒');

console.log('room domain tests passed');
