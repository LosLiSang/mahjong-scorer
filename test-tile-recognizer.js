// test-tile-recognizer.js — 识牌云函数（模型调用 mock，不发网络请求）
// 用法: node test-tile-recognizer.js
const assert = require('assert');
const { _internal: R } = require('./cloudfunctions/tile-recognizer');

(async () => {
  // 模型选择：用户自定义优先，其次环境变量，缺 Key 报未配置
  assert.deepEqual(
    R.resolveModel(null, { TILE_MODEL_API_KEY: 'env-key' }),
    { baseUrl: R.DEFAULT_BASE_URL, model: R.DEFAULT_MODEL, apiKey: 'env-key' }
  );
  assert.deepEqual(
    R.resolveModel({ baseUrl: 'https://my.ai/v1/', model: 'glm-4v', apiKey: 'u' }, { TILE_MODEL_API_KEY: 'env-key' }),
    { baseUrl: 'https://my.ai/v1', model: 'glm-4v', apiKey: 'u' }
  );
  assert.throws(() => R.resolveModel(null, {}), err => err.code === 'MODEL_NOT_CONFIGURED');
  assert.throws(() => R.resolveModel({ baseUrl: 'http://x', model: 'm', apiKey: 'k' }, {}), err => err.code === 'INVALID_MODEL_CONFIG');

  let sent = null;
  const post = async request => {
    sent = request;
    return { choices: [{ message: { content: '{"hand":["1m"],"winTile":null}' } }] };
  };
  const out = await R.recognize({ imageBase64: 'AAAA', mimeType: 'image/png' }, { TILE_MODEL_API_KEY: 'k' }, post);
  assert.equal(out.text, '{"hand":["1m"],"winTile":null}');
  assert.equal(sent.url, `${R.DEFAULT_BASE_URL}/chat/completions`);
  assert.equal(sent.headers.Authorization, 'Bearer k');
  assert.equal(sent.body.messages[0].content[0].image_url.url, 'data:image/png;base64,AAAA', '图片以 data URL 内联，不落盘');

  // 多段 content 拼接
  const multi = await R.recognize({ imageBase64: 'A' }, { TILE_MODEL_API_KEY: 'k' },
    async () => ({ choices: [{ message: { content: [{ type: 'text', text: '{"a"' }, { type: 'text', text: ':1}' }] } }] }));
  assert.equal(multi.text, '{"a":1}');

  await assert.rejects(R.recognize({}, { TILE_MODEL_API_KEY: 'k' }, post), err => err.code === 'IMAGE_REQUIRED');
  await assert.rejects(R.recognize({ imageBase64: 'x'.repeat(3 * 1024 * 1024 + 1) }, { TILE_MODEL_API_KEY: 'k' }, post), err => err.code === 'IMAGE_TOO_LARGE');
  await assert.rejects(R.recognize({ imageBase64: 'A' }, { TILE_MODEL_API_KEY: 'k' }, async () => ({ choices: [] })), err => err.code === 'MODEL_EMPTY_RESPONSE');

  // 获取模型：自定义配置可不填模型名；GET /models，视觉类排前、去重
  let listReq = null;
  const listed = await R.listModels(
    { modelConfig: { baseUrl: 'https://my.ai/v1', apiKey: 'u' } }, {},
    async request => {
      listReq = request;
      return { data: [{ id: 'text-embed' }, { id: 'qwen-max' }, { id: 'qwen-vl-max' }, { id: 'qwen-vl-max' }, { id: 'gpt-4o' }] };
    }
  );
  assert.equal(listReq.url, 'https://my.ai/v1/models');
  assert.equal(listReq.body, undefined, '模型列表用 GET');
  assert.deepEqual(listed.models, ['gpt-4o', 'qwen-vl-max', 'qwen-max', 'text-embed']);
  await assert.rejects(R.listModels({}, { TILE_MODEL_API_KEY: 'k' }, async () => ({ data: [] })), err => err.code === 'MODEL_LIST_EMPTY');

  // 测试模型：发小图、限制 token，判断是否看得懂图片并计时
  let testReq = null;
  let tick = 1000;
  const tested = await R.testModel({}, { TILE_MODEL_API_KEY: 'k' }, async request => {
    testReq = request;
    tick += 850;
    return { choices: [{ message: { content: '红色' } }] };
  }, () => tick);
  assert.equal(testReq.body.max_tokens, 10);
  assert(/^data:image\/png;base64,/.test(testReq.body.messages[0].content[0].image_url.url));
  assert.deepEqual(tested, { model: R.DEFAULT_MODEL, reply: '红色', seesImage: true, latencyMs: 850 });
  const blind = await R.testModel({}, { TILE_MODEL_API_KEY: 'k' }, async () => ({ choices: [{ message: { content: 'I cannot see images' } }] }));
  assert.equal(blind.seesImage, false);

  console.log('tile recognizer tests passed');
})().catch(err => { console.error(err); process.exit(1); });
