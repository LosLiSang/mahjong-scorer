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

  console.log('tile recognizer tests passed');
})().catch(err => { console.error(err); process.exit(1); });
