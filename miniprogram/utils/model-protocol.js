'use strict';

// model-protocol.js — 识牌模型的 OpenAI 兼容协议（纯函数，零依赖）
// 真源在 miniprogram/utils/，由 scripts/sync-model-protocol.js 复制到 cloudfunctions/tile-recognizer/。
// 小程序本地直连（自定义模型）与云函数（默认模型）共用同一份请求构造与响应解析。

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
const MAX_IMAGE_BASE64 = 3 * 1024 * 1024;

function trimBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function authHeaders(model) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${model.apiKey}` };
}

// 识牌 / 测试请求：POST {baseUrl}/chat/completions
function chatRequest(model, imageBase64, mimeType, prompt, maxTokens) {
  const body = {
    model: model.model,
    temperature: 0,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } },
        { type: 'text', text: prompt || PROMPT }
      ]
    }]
  };
  if (maxTokens) body.max_tokens = maxTokens;
  return { method: 'POST', url: `${trimBaseUrl(model.baseUrl)}/chat/completions`, headers: authHeaders(model), body };
}

function testRequest(model) {
  return chatRequest(model, TEST_IMAGE, 'image/png', TEST_PROMPT, 10);
}

// 模型列表：GET {baseUrl}/models
function modelsRequest(model) {
  return { method: 'GET', url: `${trimBaseUrl(model.baseUrl)}/models`, headers: authHeaders(model) };
}

// 取出回复文本：兼容字符串与多段 content
function replyText(response) {
  const choice = response && response.choices && response.choices[0];
  const content = choice && choice.message && choice.message.content;
  return String(Array.isArray(content) ? content.map(part => part && part.text || '').join('') : (content || '')).trim();
}

// 模型列表：去重，视觉类模型排前面；返回 [] 表示接口没给出模型
function modelIds(response) {
  const ids = (response && Array.isArray(response.data) ? response.data : [])
    .map(item => item && item.id).filter(Boolean).map(String);
  const visual = id => (/vl|vision|4v|4o|gemini|omni|qvq|pixtral|llava|claude/i.test(id) ? 1 : 0);
  return Array.from(new Set(ids))
    .sort((a, b) => (visual(b) - visual(a)) || a.localeCompare(b))
    .slice(0, 200);
}

// 测试结果：是否看懂了纯红图片
function testSummary(model, reply, latencyMs) {
  return {
    model: model.model,
    reply: String(reply || '').slice(0, 40),
    seesImage: /红|red/i.test(reply || ''),
    latencyMs: Math.max(0, latencyMs || 0)
  };
}

// HTTP 状态码 → 错误码
function httpErrorCode(statusCode) {
  if (statusCode === 401 || statusCode === 403) return 'MODEL_AUTH_FAILED';
  if (statusCode === 404) return 'MODEL_NOT_FOUND';
  if (statusCode === 429) return 'MODEL_RATE_LIMITED';
  return 'MODEL_REQUEST_FAILED';
}

module.exports = {
  PROMPT, TEST_IMAGE, TEST_PROMPT, MAX_IMAGE_BASE64,
  trimBaseUrl, chatRequest, testRequest, modelsRequest,
  replyText, modelIds, testSummary, httpErrorCode
};
