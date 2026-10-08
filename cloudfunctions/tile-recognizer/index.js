'use strict';

// tile-recognizer — 拍照识牌的「云端默认模型」通道
// 用户在设置页填了自定义模型时，小程序直接从本地请求该模型，不经过这里。
// 这里只服务默认模型，API Key 只存在云函数环境变量中，不进小程序包：
//   TILE_MODEL_API_KEY   必填
//   TILE_MODEL_BASE_URL  默认 https://dashscope.aliyuncs.com/compatible-mode/v1
//   TILE_MODEL_NAME      默认 qwen-vl-max
// 图片以 base64 传入，只在本次调用的内存中使用，不落盘。

const https = require('https');
const { URL } = require('url');
const Protocol = require('./model-protocol');

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-vl-max';
const REQUEST_TIMEOUT_MS = 18000;

function error(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function defaultModel(env) {
  const apiKey = env.TILE_MODEL_API_KEY || '';
  if (!apiKey) throw error('MODEL_NOT_CONFIGURED');
  return {
    baseUrl: Protocol.trimBaseUrl(env.TILE_MODEL_BASE_URL || DEFAULT_BASE_URL),
    model: env.TILE_MODEL_NAME || DEFAULT_MODEL,
    apiKey
  };
}

function send(request) {
  return new Promise((resolve, reject) => {
    const url = new URL(request.url);
    const payload = request.body ? JSON.stringify(request.body) : '';
    const headers = Object.assign({}, request.headers);
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: request.method,
      headers,
      timeout: REQUEST_TIMEOUT_MS
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(error(Protocol.httpErrorCode(res.statusCode)));
        try { resolve(JSON.parse(text)); } catch (e) { reject(error('MODEL_REQUEST_FAILED')); }
      });
    });
    req.on('timeout', () => req.destroy(error('MODEL_TIMEOUT')));
    req.on('error', err => reject(err && err.code === 'MODEL_TIMEOUT' ? err : error('MODEL_REQUEST_FAILED')));
    if (payload) req.end(payload); else req.end();
  });
}

async function recognize(event, env, transport) {
  const image = String(event && event.imageBase64 || '');
  if (!image) throw error('IMAGE_REQUIRED');
  if (image.length > Protocol.MAX_IMAGE_BASE64) throw error('IMAGE_TOO_LARGE');
  const model = defaultModel(env);
  const text = Protocol.replyText(await transport(Protocol.chatRequest(model, image, event.mimeType)));
  if (!text) throw error('MODEL_EMPTY_RESPONSE');
  return { text };
}

async function testModel(event, env, transport, now) {
  const model = defaultModel(env);
  const clock = now || Date.now;
  const started = clock();
  const reply = Protocol.replyText(await transport(Protocol.testRequest(model)));
  if (!reply) throw error('MODEL_EMPTY_RESPONSE');
  return Protocol.testSummary(model, reply, clock() - started);
}

exports.main = async event => {
  try {
    const action = event && event.action || 'recognize';
    const handler = { recognize, testModel }[action];
    if (!handler) throw error('UNKNOWN_ACTION');
    return Object.assign({ ok: true }, await handler(event || {}, process.env, send));
  } catch (err) {
    return { ok: false, code: err && err.code || 'MODEL_REQUEST_FAILED' };
  }
};

// 供单测使用
exports._internal = { defaultModel, recognize, testModel, DEFAULT_BASE_URL, DEFAULT_MODEL };
