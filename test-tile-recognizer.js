// test-tile-recognizer.js — 拍照识牌两条通道：本地直连（自定义模型）+ 云函数（默认模型）
// 模型调用全部 mock，不发网络请求。用法: node test-tile-recognizer.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 防漂移：云函数里的协议文件必须与小程序真源一致（先跑 node scripts/sync-model-protocol.js）
assert.equal(
  fs.readFileSync(path.join(__dirname, 'miniprogram/utils/model-protocol.js'), 'utf8'),
  fs.readFileSync(path.join(__dirname, 'cloudfunctions/tile-recognizer/model-protocol.js'), 'utf8'),
  'model-protocol 已漂移：请改 miniprogram/utils/model-protocol.js 后运行 node scripts/sync-model-protocol.js'
);

const Protocol = require('./miniprogram/utils/model-protocol');
const Cloud = require('./cloudfunctions/tile-recognizer')._internal;

// ── 协议纯函数 ──
const custom = { baseUrl: 'https://my.ai/v1/', model: 'glm-4v', apiKey: 'u' };
const chat = Protocol.chatRequest(custom, 'AAAA', 'image/png');
assert.equal(chat.method, 'POST');
assert.equal(chat.url, 'https://my.ai/v1/chat/completions');
assert.equal(chat.headers.Authorization, 'Bearer u');
assert.equal(chat.body.messages[0].content[0].image_url.url, 'data:image/png;base64,AAAA', '图片以 data URL 内联');
assert.equal(Protocol.testRequest(custom).body.max_tokens, 10);
assert.deepEqual(Protocol.modelsRequest(custom), { method: 'GET', url: 'https://my.ai/v1/models', headers: chat.headers });
[
  { response: { choices: [{ message: { content: ' 红色 ' } }] }, want: '红色' },
  { response: { choices: [{ message: { content: [{ text: '{"a"' }, { text: ':1}' }] } }] }, want: '{"a":1}' },
  { response: { choices: [] }, want: '' },
].forEach(c => assert.equal(Protocol.replyText(c.response), c.want));
assert.deepEqual(
  Protocol.modelIds({ data: [{ id: 'text-embed' }, { id: 'qwen-max' }, { id: 'qwen-vl-max' }, { id: 'qwen-vl-max' }, { id: 'gpt-4o' }] }),
  ['gpt-4o', 'qwen-vl-max', 'qwen-max', 'text-embed'],
  '视觉类模型排前、去重'
);
[[401, 'MODEL_AUTH_FAILED'], [403, 'MODEL_AUTH_FAILED'], [404, 'MODEL_NOT_FOUND'], [429, 'MODEL_RATE_LIMITED'], [500, 'MODEL_REQUEST_FAILED']]
  .forEach(([status, code]) => assert.equal(Protocol.httpErrorCode(status), code));

(async () => {
  // ── 云函数：只服务默认模型，忽略任何客户端传来的模型配置 ──
  assert.deepEqual(
    Cloud.defaultModel({ TILE_MODEL_API_KEY: 'env-key' }),
    { baseUrl: Cloud.DEFAULT_BASE_URL, model: Cloud.DEFAULT_MODEL, apiKey: 'env-key' }
  );
  assert.throws(() => Cloud.defaultModel({}), err => err.code === 'MODEL_NOT_CONFIGURED');
  let sent = null;
  const cloudSend = async request => { sent = request; return { choices: [{ message: { content: '{"hand":[]}' } }] }; };
  const out = await Cloud.recognize({ imageBase64: 'AAAA', modelConfig: custom }, { TILE_MODEL_API_KEY: 'k' }, cloudSend);
  assert.equal(out.text, '{"hand":[]}');
  assert(sent.url.startsWith(Cloud.DEFAULT_BASE_URL), '云函数不接受客户端传入的自定义地址');
  assert.equal(sent.headers.Authorization, 'Bearer k');
  await assert.rejects(Cloud.recognize({}, { TILE_MODEL_API_KEY: 'k' }, cloudSend), err => err.code === 'IMAGE_REQUIRED');
  await assert.rejects(Cloud.recognize({ imageBase64: 'x'.repeat(Protocol.MAX_IMAGE_BASE64 + 1) }, { TILE_MODEL_API_KEY: 'k' }, cloudSend), err => err.code === 'IMAGE_TOO_LARGE');
  let tick = 1000;
  const cloudTest = await Cloud.testModel({}, { TILE_MODEL_API_KEY: 'k' }, async () => { tick += 700; return { choices: [{ message: { content: '红' } }] }; }, () => tick);
  assert.deepEqual(cloudTest, { model: Cloud.DEFAULT_MODEL, reply: '红', seesImage: true, latencyMs: 700 });

  // ── 小程序端：自定义模型本地直连，未配置走云函数 ──
  const store = {};
  let cloudCalls = [];
  let requests = [];
  let requestReply = () => ({ statusCode: 200, data: { choices: [{ message: { content: '{"hand":[]}' } }] } });
  global.wx = {
    getStorageSync: key => store[key],
    setStorageSync: (key, value) => { store[key] = value; },
    removeStorageSync: key => { delete store[key]; },
    cloud: {
      async callFunction(options) {
        cloudCalls.push(options.data);
        return { result: { ok: true, text: '{"hand":["1z"]}', model: 'qwen-vl-max', reply: '红', seesImage: true, latencyMs: 5 } };
      }
    },
    request(options) {
      requests.push(options);
      const r = requestReply(options);
      if (r.errMsg) options.fail({ errMsg: r.errMsg }); else options.success(r);
    }
  };
  const Config = require('./miniprogram/config');
  Config.cloudEnvId = 'test-env';
  const Service = require('./miniprogram/utils/recognizer-service');
  const readFile = () => 'IMG';

  // 未配置自定义模型 → 云函数，不带任何模型配置 / Key
  await Service.recognize('a.jpg', { readFile });
  assert.equal(requests.length, 0, '默认模型不走本地直连');
  assert.deepEqual(cloudCalls[0], { action: 'recognize', imageBase64: 'IMG', mimeType: 'image/jpeg' }, '云函数调用不携带客户端模型配置');

  // 保存自定义模型 → 本地直连，图片与 Key 不经过云函数
  assert.equal(Service.saveModelConfig(custom).ok, true);
  cloudCalls = [];
  await Service.recognize('b.png', { readFile });
  assert.equal(cloudCalls.length, 0, '自定义模型不经过云函数');
  assert.equal(requests[0].url, 'https://my.ai/v1/chat/completions');
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].header.Authorization, 'Bearer u');
  assert.equal(requests[0].data.messages[0].content[0].image_url.url, 'data:image/png;base64,IMG');
  assert.equal(Service.isAvailable(), true);

  // 本地直连错误映射
  for (const c of [
    { reply: { statusCode: 401, data: {} }, code: 'MODEL_AUTH_FAILED' },
    { reply: { statusCode: 404, data: {} }, code: 'MODEL_NOT_FOUND' },
    { reply: { errMsg: 'request:fail url not in domain list' }, code: 'DOMAIN_NOT_ALLOWED' },
    { reply: { errMsg: 'request:fail timeout' }, code: 'MODEL_TIMEOUT' },
    { reply: { statusCode: 200, data: { choices: [] } }, code: 'MODEL_EMPTY_RESPONSE' },
  ]) {
    requestReply = () => c.reply;
    await assert.rejects(Service.recognize('c.jpg', { readFile }), err => err.code === c.code, c.code);
  }

  // 获取模型：本地 GET /models；未填地址不允许
  requests = [];
  requestReply = () => ({ statusCode: 200, data: JSON.stringify({ data: [{ id: 'qwen-max' }, { id: 'qwen-vl-plus' }] }) });
  assert.deepEqual(await Service.listModels(custom), ['qwen-vl-plus', 'qwen-max']);
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].url, 'https://my.ai/v1/models');
  await assert.rejects(Service.listModels({}), err => err.code === 'INVALID_MODEL_CONFIG');
  requestReply = () => ({ statusCode: 200, data: { data: [] } });
  await assert.rejects(Service.listModels(custom), err => err.code === 'MODEL_LIST_EMPTY');

  // 测试模型：填了 → 本地直连；全空 → 测云端默认
  requestReply = () => ({ statusCode: 200, data: { choices: [{ message: { content: 'I see nothing' } }] } });
  let t = 0;
  const local = await Service.testModel(custom, undefined, () => (t += 400));
  assert.deepEqual(local, { via: 'local', model: 'glm-4v', reply: 'I see nothing', seesImage: false, latencyMs: 400 });
  cloudCalls = [];
  const viaCloud = await Service.testModel({});
  assert.equal(viaCloud.via, 'cloud');
  assert.deepEqual(cloudCalls[0], { action: 'testModel' });

  console.log('tile recognizer tests passed');
})().catch(err => { console.error(err); process.exit(1); });
