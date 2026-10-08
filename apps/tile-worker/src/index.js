// tile-worker — 拍照识牌「云端默认模型」的 Cloudflare Worker
// 调用链：小程序 → 微信云函数 tile-recognizer → 本 Worker → OpenAI 兼容多模态模型
// 模型 Key 只保存在 Worker Secret 中；云函数凭共享令牌调用。
//
// 配置：
//   Secret  MODEL_API_KEY   模型 API Key（必填）
//   Secret  WORKER_TOKEN    与云函数 TILE_WORKER_TOKEN 相同的共享令牌（必填）
//   Var     MODEL_BASE_URL  默认 https://dashscope.aliyuncs.com/compatible-mode/v1
//   Var     MODEL_NAME      默认 qwen-vl-max
//
// 接口（均为 POST JSON，Authorization: Bearer <WORKER_TOKEN>）：
//   /recognize  { imageBase64, mimeType } → { ok, text }
//   /test       {}                        → { ok, model, reply, seesImage, latencyMs }
//   失败统一返回 { ok:false, code }

import Protocol from '../../../miniprogram/utils/model-protocol.js';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-vl-max';
const MODEL_TIMEOUT_MS = 18000;
// base64 上限 + JSON 外壳余量
const MAX_BODY_BYTES = Protocol.MAX_IMAGE_BASE64 + 64 * 1024;

class CodedError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status || 502;
  }
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

// 先 SHA-256 再定长比较，避免通过耗时泄露令牌长度或内容
async function tokenMatches(provided, expected) {
  if (!expected) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided || '')),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ]);
  if (crypto.subtle.timingSafeEqual) return crypto.subtle.timingSafeEqual(a, b);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function modelFromEnv(env) {
  if (!env.MODEL_API_KEY) throw new CodedError('MODEL_NOT_CONFIGURED', 500);
  return {
    baseUrl: Protocol.trimBaseUrl(env.MODEL_BASE_URL || DEFAULT_BASE_URL),
    model: env.MODEL_NAME || DEFAULT_MODEL,
    apiKey: env.MODEL_API_KEY
  };
}

async function callModel(request, fetcher) {
  let response;
  try {
    response = await fetcher(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS)
    });
  } catch (err) {
    throw new CodedError(err && (err.name === 'TimeoutError' || err.name === 'AbortError') ? 'MODEL_TIMEOUT' : 'MODEL_REQUEST_FAILED');
  }
  if (!response.ok) throw new CodedError(Protocol.httpErrorCode(response.status));
  try {
    return await response.json();
  } catch (err) {
    throw new CodedError('MODEL_REQUEST_FAILED');
  }
}

async function readBody(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY_BYTES) throw new CodedError('IMAGE_TOO_LARGE', 413);
  try {
    return await request.json();
  } catch (err) {
    return {};
  }
}

async function recognize(body, env, fetcher) {
  const image = String(body.imageBase64 || '');
  if (!image) throw new CodedError('IMAGE_REQUIRED', 400);
  if (image.length > Protocol.MAX_IMAGE_BASE64) throw new CodedError('IMAGE_TOO_LARGE', 413);
  const model = modelFromEnv(env);
  const text = Protocol.replyText(await callModel(Protocol.chatRequest(model, image, body.mimeType), fetcher));
  if (!text) throw new CodedError('MODEL_EMPTY_RESPONSE');
  return { text };
}

async function testModel(body, env, fetcher) {
  const model = modelFromEnv(env);
  const started = Date.now();
  const reply = Protocol.replyText(await callModel(Protocol.testRequest(model), fetcher));
  if (!reply) throw new CodedError('MODEL_EMPTY_RESPONSE');
  return Protocol.testSummary(model, reply, Date.now() - started);
}

const ROUTES = { '/recognize': recognize, '/test': testModel };

// fetcher 可注入，便于单测 mock 模型
export async function handle(request, env, fetcher) {
  const path = new URL(request.url).pathname;
  const route = ROUTES[path];
  if (!route) return json({ ok: false, code: 'UNKNOWN_ACTION' }, 404);
  if (request.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!(await tokenMatches(token, env.WORKER_TOKEN))) return json({ ok: false, code: 'WORKER_UNAUTHORIZED' }, 401);
  try {
    const result = await route(await readBody(request), env, fetcher || fetch);
    console.log(JSON.stringify({ message: 'tile request ok', path }));
    return json(Object.assign({ ok: true }, result));
  } catch (err) {
    const code = err instanceof CodedError ? err.code : 'MODEL_REQUEST_FAILED';
    console.error(JSON.stringify({ message: 'tile request failed', path, code, error: err && err.message }));
    return json({ ok: false, code }, err instanceof CodedError ? err.status : 500);
  }
}

export default {
  fetch(request, env) {
    return handle(request, env);
  }
};
