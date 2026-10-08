// test-tile-recognizer.js — 拍照识牌：本地直连（自定义模型）/ 云函数 → Cloudflare Worker（默认模型）
// 模型调用全部 mock，不发网络请求。用法: node test-tile-recognizer.js
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

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
  // ── Cloudflare Worker：令牌校验 + 默认模型（fetch 注入 mock）──
  const Worker = await import(pathToFileURL(path.join(__dirname, 'apps/tile-worker/src/index.js')).href);
  const workerEnv = { MODEL_API_KEY: 'model-key', WORKER_TOKEN: 'tok' };
  const post = (pathname, body, token) => new Request(`https://w.example${pathname}`, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {}),
    body: JSON.stringify(body || {})
  });
  let modelCalls = [];
  let modelReply = () => new Response(JSON.stringify({ choices: [{ message: { content: '{"hand":[]}' } }] }));
  const fakeFetch = async (url, init) => { modelCalls.push({ url, init }); return modelReply(); };
  const call = async (req, env) => {
    const res = await Worker.handle(req, env || workerEnv, fakeFetch);
    return { status: res.status, body: await res.json() };
  };
  const origError = console.error;
  const origLog = console.log;
  console.error = () => {};
  console.log = () => {};
  try {
    let r = await call(post('/recognize', { imageBase64: 'AAAA', mimeType: 'image/png' }, 'tok'));
    assert.deepEqual(r, { status: 200, body: { ok: true, text: '{"hand":[]}' } });
    assert.equal(modelCalls[0].url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 'Worker 使用默认模型地址');
    assert.equal(modelCalls[0].init.headers.Authorization, 'Bearer model-key', '模型 Key 只在 Worker 内使用');
    assert.equal(JSON.parse(modelCalls[0].init.body).model, 'qwen-vl-max');

    for (const c of [
      { req: () => post('/recognize', { imageBase64: 'A' }), code: 'WORKER_UNAUTHORIZED', status: 401 },
      { req: () => post('/recognize', { imageBase64: 'A' }, 'wrong'), code: 'WORKER_UNAUTHORIZED', status: 401 },
      { req: () => post('/nope', {}, 'tok'), code: 'UNKNOWN_ACTION', status: 404 },
      { req: () => new Request('https://w.example/test', { headers: { Authorization: 'Bearer tok' } }), code: 'METHOD_NOT_ALLOWED', status: 405 },
      { req: () => post('/recognize', {}, 'tok'), code: 'IMAGE_REQUIRED', status: 400 },
    ]) {
      r = await call(c.req());
      assert.deepEqual(r, { status: c.status, body: { ok: false, code: c.code } }, c.code);
    }
    r = await call(post('/recognize', { imageBase64: 'A' }, 'tok'), { WORKER_TOKEN: 'tok' });
    assert.equal(r.body.code, 'MODEL_NOT_CONFIGURED');
    r = await call(post('/recognize', { imageBase64: 'A' }, ''), { MODEL_API_KEY: 'k' });
    assert.equal(r.body.code, 'WORKER_UNAUTHORIZED', '未设置 WORKER_TOKEN 时一律拒绝');

    modelReply = () => new Response('{}', { status: 429 });
    r = await call(post('/recognize', { imageBase64: 'A' }, 'tok'));
    assert.equal(r.body.code, 'MODEL_RATE_LIMITED');

    modelCalls = [];
    modelReply = () => new Response(JSON.stringify({ choices: [{ message: { content: '红色' } }] }));
    r = await call(post('/test', {}, 'tok'));
    assert.equal(r.body.ok, true);
    assert.equal(r.body.seesImage, true);
    assert.equal(r.body.model, 'qwen-vl-max');
    assert.equal(JSON.parse(modelCalls[0].init.body).max_tokens, 10);
  } finally {
    console.error = origError;
    console.log = origLog;
  }

  // ── 微信云函数：只转发到 Worker，白名单字段，带共享令牌 ──
  const cloudEnv = { TILE_WORKER_URL: 'https://mahjong-tile-worker.me.workers.dev/', TILE_WORKER_TOKEN: 'tok' };
  assert.throws(() => Cloud.workerConfig({}), err => err.code === 'MODEL_NOT_CONFIGURED');
  assert.throws(() => Cloud.workerConfig({ TILE_WORKER_URL: 'http://x', TILE_WORKER_TOKEN: 't' }), err => err.code === 'MODEL_NOT_CONFIGURED');
  const fwd = Cloud.buildForward('recognize', { imageBase64: 'IMG', mimeType: 'image/png', modelConfig: custom, apiKey: 'leak' }, cloudEnv);
  assert.equal(fwd.url, 'https://mahjong-tile-worker.me.workers.dev/recognize');
  assert.equal(fwd.headers.Authorization, 'Bearer tok');
  assert.deepEqual(fwd.body, { imageBase64: 'IMG', mimeType: 'image/png' }, '只转发白名单字段');
  assert.deepEqual(Cloud.buildForward('testModel', {}, cloudEnv).body, {});
  assert.equal(Cloud.buildForward('testModel', {}, cloudEnv).url, 'https://mahjong-tile-worker.me.workers.dev/test');
  assert.throws(() => Cloud.buildForward('listModels', {}, cloudEnv), err => err.code === 'UNKNOWN_ACTION');
  assert.throws(() => Cloud.buildForward('recognize', {}, cloudEnv), err => err.code === 'IMAGE_REQUIRED');
  assert.throws(() => Cloud.buildForward('recognize', { imageBase64: 'x'.repeat(Cloud.MAX_IMAGE_BASE64 + 1) }, cloudEnv), err => err.code === 'IMAGE_TOO_LARGE');
  assert.deepEqual(
    await Cloud.relay({ action: 'recognize', imageBase64: 'IMG' }, cloudEnv, async () => ({ ok: true, text: 'T' })),
    { ok: true, text: 'T' }
  );
  await assert.rejects(
    Cloud.relay({ action: 'testModel' }, cloudEnv, async () => ({ ok: false, code: 'WORKER_UNAUTHORIZED' })),
    err => err.code === 'WORKER_UNAUTHORIZED', 'Worker 错误码原样透传'
  );

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
