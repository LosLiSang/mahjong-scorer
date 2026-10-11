// test-cloud-response.js — 云函数统一返回结构 { code, msg, data }（服务端包装 + 小程序端解析）
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Response = require('./packages/cloud-response');
const CloudResult = require('./miniprogram/utils/cloud-result');
const { syncTargets } = require('./scripts/sync-shared');

// 防漂移：云函数目录里的副本必须与真源一致（先跑 node scripts/sync-shared.js）
syncTargets().forEach(({ source, target }) => {
  assert.equal(fs.readFileSync(source, 'utf8'), fs.readFileSync(target, 'utf8'), `${target} 已漂移：请运行 node scripts/sync-shared.js`);
});

// 云函数入口：用假的 wx-server-sdk 载入，失败路径也必须返回统一结构而不是抛异常
const Module = require('module');
const fakeSdk = {
  DYNAMIC_CURRENT_ENV: 'test',
  init() {},
  getWXContext: () => ({}),
  database: () => ({
    command: { lt: v => v, nin: v => v },
    collection() { throw new Error('db down'); }
  })
};
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  return request === 'wx-server-sdk' ? fakeSdk : originalLoad.call(this, request, ...rest);
};
const entry = name => require(path.resolve('cloudfunctions', name, 'index.js')).main;
const entryCases = [
  { name: 'mahjong-room', event: { action: 'inspect' }, code: 'IDENTITY_UNAVAILABLE' },
  { name: 'mahjong-room-cleanup', event: {}, code: 'INTERNAL_ERROR' },
  { name: 'tile-recognizer', event: { action: 'listModels' }, code: 'UNKNOWN_ACTION' }
];
assert.deepEqual(entryCases.map(c => c.name).sort(), fs.readdirSync('cloudfunctions').sort(), '每个云函数都要覆盖');

const MESSAGES = { ROOM_NOT_FOUND: '没有找到这个房间', VERSION_CONFLICT: '版本冲突', INTERNAL_ERROR: '服务不可用' };

// errorCode：从各种异常形态取出已登记的错误码
[
  { name: 'CodedError', err: new Response.CodedError('ROOM_NOT_FOUND'), code: 'ROOM_NOT_FOUND' },
  { name: '领域层 new Error(CODE)', err: new Error('VERSION_CONFLICT'), code: 'VERSION_CONFLICT' },
  { name: '被包装的消息', err: new Error('transaction failed: VERSION_CONFLICT'), code: 'VERSION_CONFLICT' },
  { name: 'errMsg 中的错误码', err: { errMsg: 'x ROOM_NOT_FOUND y' }, code: 'ROOM_NOT_FOUND' },
  { name: '未登记的错误', err: new Error('db exploded'), code: 'INTERNAL_ERROR' },
  { name: '错误码子串不误判', err: new Error('XVERSION_CONFLICTX'), code: 'INTERNAL_ERROR' },
  { name: '空异常', err: undefined, code: 'INTERNAL_ERROR' }
].forEach(c => assert.equal(Response.errorCode(c.err, MESSAGES), c.code, c.name));

(async () => {
  const origError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await Response.handle(() => ({ a: 1 }), MESSAGES), { code: 'OK', msg: '', data: { a: 1 } });
    assert.deepEqual(await Response.handle(async () => undefined, MESSAGES), { code: 'OK', msg: '', data: null });
    assert.deepEqual(await Response.handle(() => Response.fail('ROOM_NOT_FOUND'), MESSAGES), { code: 'ROOM_NOT_FOUND', msg: '没有找到这个房间', data: null });
    assert.deepEqual(await Response.handle(async () => { throw new Error('secret stack'); }, MESSAGES), { code: 'INTERNAL_ERROR', msg: '服务不可用', data: null }, '未知异常不泄露内部信息');
    for (const c of entryCases) {
      const result = await entry(c.name)(c.event);
      assert.equal(result.code, c.code, c.name);
      assert(result.msg && result.data === null, `${c.name} 失败时应带 msg、data 为 null`);
    }
  } finally {
    console.error = origError;
    Module._load = originalLoad;
  }

  // 小程序端 unwrap：新结构 + 过渡期兼容旧结构
  [
    { name: '成功', result: { code: 'OK', msg: '', data: { v: 1 } }, expect: { ok: true, data: { v: 1 } } },
    { name: '失败', result: { code: 'HOST_ONLY', msg: '只有房主', data: null }, expect: { ok: false, code: 'HOST_ONLY', msg: '只有房主' } },
    { name: '旧识牌成功', result: { ok: true, text: 'T' }, expect: { ok: true, data: { text: 'T' } } },
    { name: '旧识牌失败', result: { ok: false, code: 'MODEL_TIMEOUT' }, expect: { ok: false, code: 'MODEL_TIMEOUT', msg: '' } },
    { name: '旧房间直接返回数据', result: { roomCode: 'ABC234', version: 3 }, expect: { ok: true, data: { roomCode: 'ABC234', version: 3 } } },
    { name: '数据里恰好有 code 字段不误判', result: { code: 'X', other: 1 }, expect: { ok: true, data: { code: 'X', other: 1 } } }
  ].forEach(c => assert.deepEqual(CloudResult.unwrap(c.result), c.expect, c.name));

  console.log('cloud response tests passed');
})().catch(err => { console.error(err); process.exit(1); });
