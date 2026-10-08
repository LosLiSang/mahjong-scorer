'use strict';

// tile-recognizer — 拍照识牌「云端默认模型」的微信云函数中转
// 调用链：小程序 → 本云函数 → Cloudflare Worker（*.workers.dev）→ 多模态模型
// 小程序正式版不能直接请求 workers.dev（无 ICP 备案、不能登记为合法域名），所以由云函数转发。
// 模型 Key 只在 Worker Secret 中；这里只保存调用 Worker 的共享令牌。
//
// 云函数环境变量：
//   TILE_WORKER_URL    Worker 地址，如 https://mahjong-tile-worker.<子域>.workers.dev（必填）
//   TILE_WORKER_TOKEN  与 Worker Secret WORKER_TOKEN 相同的令牌（必填）
// 图片以 base64 传入，只在本次调用的内存中转发，不落盘。

const https = require('https');
const { URL } = require('url');

const MAX_IMAGE_BASE64 = 3 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 19000;
const ROUTES = { recognize: '/recognize', testModel: '/test' };

function error(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function workerConfig(env) {
  const url = String(env.TILE_WORKER_URL || '').trim().replace(/\/+$/, '');
  const token = String(env.TILE_WORKER_TOKEN || '').trim();
  if (!url || !token) throw error('MODEL_NOT_CONFIGURED');
  if (!/^https:\/\//i.test(url)) throw error('MODEL_NOT_CONFIGURED');
  return { url, token };
}

// 只转发白名单字段，不把客户端传来的其他内容（如模型地址、Key）带给 Worker
function buildForward(action, event, env) {
  const path = ROUTES[action];
  if (!path) throw error('UNKNOWN_ACTION');
  const worker = workerConfig(env);
  let body = {};
  if (action === 'recognize') {
    const image = String(event.imageBase64 || '');
    if (!image) throw error('IMAGE_REQUIRED');
    if (image.length > MAX_IMAGE_BASE64) throw error('IMAGE_TOO_LARGE');
    body = { imageBase64: image, mimeType: event.mimeType === 'image/png' ? 'image/png' : 'image/jpeg' };
  }
  return {
    url: worker.url + path,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${worker.token}` },
    body
  };
}

// Worker 返回 { ok, ... } / { ok:false, code }；网络层失败映射为错误码
function postJson(request) {
  return new Promise((resolve, reject) => {
    const url = new URL(request.url);
    const payload = JSON.stringify(request.body);
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: Object.assign({ 'Content-Length': Buffer.byteLength(payload) }, request.headers),
      timeout: REQUEST_TIMEOUT_MS
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(text)); } catch (e) { reject(error('WORKER_UNREACHABLE')); }
      });
    });
    req.on('timeout', () => req.destroy(error('MODEL_TIMEOUT')));
    req.on('error', err => reject(err && err.code === 'MODEL_TIMEOUT' ? err : error('WORKER_UNREACHABLE')));
    req.end(payload);
  });
}

async function relay(event, env, send) {
  const action = event && event.action || 'recognize';
  const result = await send(buildForward(action, event || {}, env));
  if (!result || typeof result !== 'object') throw error('WORKER_UNREACHABLE');
  if (!result.ok) throw error(result.code || 'MODEL_REQUEST_FAILED');
  return result;
}

exports.main = async event => {
  try {
    return await relay(event, process.env, postJson);
  } catch (err) {
    return { ok: false, code: err && err.code || 'MODEL_REQUEST_FAILED' };
  }
};

// 供单测使用
exports._internal = { workerConfig, buildForward, relay, MAX_IMAGE_BASE64 };
