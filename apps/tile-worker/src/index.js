// tile-worker — 拍照识牌「云端默认模型」的 Cloudflare Worker
// 调用链：小程序 → 微信云函数 tile-recognizer → 本 Worker → OpenAI 兼容多模态模型
// 云函数凭共享令牌调用。
//
// 模型后端（二选一）：
//   · 默认：Cloudflare Workers AI（AI 绑定），模型由 Var WORKERS_AI_MODEL 指定，无需任何 Key
//   · 设置了 Secret MODEL_API_KEY 时：改用 OpenAI 兼容外部接口（MODEL_BASE_URL / MODEL_NAME）
//
// 配置：
//   Secret  WORKER_TOKEN      与云函数 TILE_WORKER_TOKEN 相同的共享令牌（必填）
//   Var     WORKERS_AI_MODEL  默认 @cf/qwen/qwen3.8-27b
//   Secret  MODEL_API_KEY     可选，设置后改走外部接口
//   Var     MODEL_BASE_URL    外部接口地址，默认 https://dashscope.aliyuncs.com/compatible-mode/v1
//   Var     MODEL_NAME        外部接口模型名，默认 qwen-vl-max
//
// 接口（均为 POST JSON，Authorization: Bearer <WORKER_TOKEN>）：
//   /recognize  { imageBase64, mimeType } → { ok, text }
//   /test       {}                        → { ok, model, reply, seesImage, latencyMs }
//   失败统一返回 { ok:false, code }

import Protocol from '../../../miniprogram/utils/model-protocol.js';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-vl-max';
const DEFAULT_WORKERS_AI_MODEL = '@cf/qwen/qwen3.8-27b';
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

// 选择模型后端：配了外部 Key 就走外部接口，否则用 Workers AI
function modelFromEnv(env) {
  if (env.MODEL_API_KEY) {
    return {
      kind: 'external',
      baseUrl: Protocol.trimBaseUrl(env.MODEL_BASE_URL || DEFAULT_BASE_URL),
      model: env.MODEL_NAME || DEFAULT_MODEL,
      apiKey: env.MODEL_API_KEY
    };
  }
  if (env.AI && typeof env.AI.run === 'function') {
    return { kind: 'workers-ai', model: env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL, baseUrl: '', apiKey: '' };
  }
  throw new CodedError('MODEL_NOT_CONFIGURED', 500);
}

// Workers AI 的文本生成模型接受 OpenAI 风格的 messages / max_tokens，直接复用协议请求体；
// 返回既可能是 OpenAI 的 choices 结构，也可能是 { response }，统一成 choices 给 replyText
async function runWorkersAi(env, model, request) {
  const input = Object.assign({}, request.body);
  delete input.model;
  // 识牌是直接看图输出 JSON 的任务；关闭推理模型的思考，避免 token 耗尽在推理上、content 为空
  input.chat_template_kwargs = { enable_thinking: false };
  let output;
  const started = Date.now();
  try {
    output = await env.AI.run(model.model, input);
  } catch (err) {
    const msg = String(err && err.message || '');
    if (/4006|neuron|limit|quota/i.test(msg)) throw new CodedError('MODEL_RATE_LIMITED', 429);
    if (/timeout|timed out/i.test(msg)) throw new CodedError('MODEL_TIMEOUT');
    throw new CodedError('MODEL_REQUEST_FAILED');
  }
  const choice = output && output.choices && output.choices[0];
  console.log(JSON.stringify({
    message: 'workers-ai done',
    model: model.model,
    finish: choice && choice.finish_reason,
    modelMs: Date.now() - started,
    usage: output && output.usage
  }));
  if (output && Array.isArray(output.choices)) return output;
  const text = output && (typeof output.response === 'string' ? output.response : typeof output === 'string' ? output : '');
  return { choices: [{ message: { content: text || '' } }] };
}

async function callModel(request, fetcher, env, model) {
  if (model && model.kind === 'workers-ai') return runWorkersAi(env, model, request);
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
  const request = Protocol.chatRequest(model, image, body.mimeType);
  // 识牌只需输出一段 JSON；给推理类模型留足余量
  if (model.kind === 'workers-ai') request.body.max_tokens = 2048;
  const text = Protocol.replyText(await callModel(request, fetcher, env, model));
  if (!text) throw new CodedError('MODEL_EMPTY_RESPONSE');
  return { text };
}

async function testModel(body, env, fetcher) {
  const model = modelFromEnv(env);
  const started = Date.now();
  const request = Protocol.testRequest(model);
  if (model.kind === 'workers-ai') request.body.max_tokens = 512;
  const reply = Protocol.replyText(await callModel(request, fetcher, env, model));
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
