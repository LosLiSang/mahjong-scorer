'use strict';

// tile-recognizer — 拍照识牌：把 base64 图片转发给 OpenAI 兼容的多模态模型
// 图片不落盘，只在本次调用的内存中使用。
// 默认模型由云函数环境变量配置（API Key 不进小程序包）：
//   TILE_MODEL_BASE_URL  默认 https://dashscope.aliyuncs.com/compatible-mode/v1
//   TILE_MODEL_NAME      默认 qwen-vl-max
//   TILE_MODEL_API_KEY   必填（或由用户在设置页填写自定义模型）

const https = require('https');
const { URL } = require('url');

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-vl-max';
const MAX_IMAGE_BASE64 = 3 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 18000;

const PROMPT = [
  '你是日本麻将牌面识别器。照片里是一手和牌后的手牌（门前手牌，可能包含刚摸到 / 荣和的那张）。',
  '请逐张识别，用以下编码：万子 1m-9m，筒子 1p-9p，索子 1s-9s，赤五写 0m/0p/0s；',
  '字牌 1z=东 2z=南 3z=西 4z=北 5z=白 6z=发 7z=中。',
  '若能判断和了牌（通常与其他牌分开摆放或横置的那张），填入 winTile，否则 winTile 为 null。',
  'confidence 为 0-1 的整体把握。只输出 JSON，不要任何解释：',
  '{"hand":["1m","2m"],"winTile":"5p","confidence":0.9}'
].join('\n');

// 测试模型用的 32×32 纯红 PNG
const TEST_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGO4IydHU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAJI2YD1ZaHIvAAAAAElFTkSuQmCC';
const TEST_PROMPT = '这张图片是什么颜色？只回答一个词。';

function error(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

// requireModel=false 时（获取模型列表）允许自定义配置不填模型名
function resolveModel(custom, env, requireModel) {
  const needModel = requireModel !== false;
  if (custom && custom.baseUrl && custom.apiKey && (custom.model || !needModel)) {
    if (!/^https:\/\//i.test(custom.baseUrl)) throw error('INVALID_MODEL_CONFIG');
    return {
      baseUrl: String(custom.baseUrl).replace(/\/+$/, ''),
      model: String(custom.model || ''),
      apiKey: String(custom.apiKey)
    };
  }
  const apiKey = env.TILE_MODEL_API_KEY || '';
  if (!apiKey) throw error('MODEL_NOT_CONFIGURED');
  return {
    baseUrl: String(env.TILE_MODEL_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: env.TILE_MODEL_NAME || DEFAULT_MODEL,
    apiKey
  };
}

function buildRequest(model, imageBase64, mimeType) {
  return {
    url: `${model.baseUrl}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`
    },
    body: {
      model: model.model,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } },
          { type: 'text', text: PROMPT }
        ]
      }]
    }
  };
}

// request.body 为空时发 GET（模型列表），否则 POST JSON
function postJson(request) {
  return new Promise((resolve, reject) => {
    const url = new URL(request.url);
    const payload = request.body ? JSON.stringify(request.body) : '';
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: request.body ? 'POST' : 'GET',
      headers: Object.assign(request.body ? { 'Content-Length': Buffer.byteLength(payload) } : {}, request.headers),
      timeout: REQUEST_TIMEOUT_MS
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(error(res.statusCode === 401 || res.statusCode === 403 ? 'MODEL_AUTH_FAILED' : 'MODEL_REQUEST_FAILED'));
        }
        try { resolve(JSON.parse(text)); } catch (e) { reject(error('MODEL_REQUEST_FAILED')); }
      });
    });
    req.on('timeout', () => req.destroy(error('MODEL_TIMEOUT')));
    req.on('error', err => reject(err && err.code === 'MODEL_TIMEOUT' ? err : error('MODEL_REQUEST_FAILED')));
    if (payload) req.end(payload); else req.end();
  });
}

function replyText(response) {
  const choice = response && response.choices && response.choices[0];
  const content = choice && choice.message && choice.message.content;
  return Array.isArray(content) ? content.map(part => part && part.text || '').join('') : (content || '');
}

// 获取模型列表：GET {baseUrl}/models（OpenAI 兼容），视觉类模型排前面
async function listModels(event, env, send) {
  const model = resolveModel(event.modelConfig, env, false);
  const response = await send({
    url: `${model.baseUrl}/models`,
    headers: { Authorization: `Bearer ${model.apiKey}` }
  });
  const ids = (response && Array.isArray(response.data) ? response.data : [])
    .map(item => item && item.id).filter(Boolean).map(String);
  if (!ids.length) throw error('MODEL_LIST_EMPTY');
  const visual = id => /vl|vision|4v|4o|gemini|omni|qvq|pixtral|llava|claude/i.test(id) ? 1 : 0;
  const models = Array.from(new Set(ids))
    .sort((a, b) => (visual(b) - visual(a)) || a.localeCompare(b))
    .slice(0, 200);
  return { models };
}

// 测试模型：发一张 32×32 纯红小图，检验连通、鉴权与看图能力，并返回耗时
async function testModel(event, env, send, now) {
  const model = resolveModel(event.modelConfig, env);
  const clock = now || Date.now;
  const started = clock();
  const request = buildRequest(model, TEST_IMAGE, 'image/png');
  request.body.messages[0].content[1].text = TEST_PROMPT;
  request.body.max_tokens = 10;
  const reply = String(replyText(await send(request))).trim();
  if (!reply) throw error('MODEL_EMPTY_RESPONSE');
  return {
    model: model.model,
    reply: reply.slice(0, 40),
    seesImage: /红|red/i.test(reply),
    latencyMs: clock() - started
  };
}

async function recognize(event, env, post) {
  const image = String(event && event.imageBase64 || '');
  if (!image) throw error('IMAGE_REQUIRED');
  if (image.length > MAX_IMAGE_BASE64) throw error('IMAGE_TOO_LARGE');
  const model = resolveModel(event.modelConfig, env);
  const response = await post(buildRequest(model, image, event.mimeType));
  const text = replyText(response);
  if (!text) throw error('MODEL_EMPTY_RESPONSE');
  return { text: String(text) };
}

exports.main = async event => {
  try {
    const action = event && event.action || 'recognize';
    const handler = { recognize, listModels, testModel }[action];
    if (!handler) throw error('UNKNOWN_ACTION');
    return Object.assign({ ok: true }, await handler(event, process.env, postJson));
  } catch (err) {
    return { ok: false, code: err && err.code || 'MODEL_REQUEST_FAILED' };
  }
};

// 供单测使用
exports._internal = { resolveModel, buildRequest, recognize, listModels, testModel, PROMPT, DEFAULT_BASE_URL, DEFAULT_MODEL };
