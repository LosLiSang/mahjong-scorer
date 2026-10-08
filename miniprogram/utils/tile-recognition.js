// tile-recognition.js — 拍照识牌：模型返回文本 → 校验 → 手牌（纯函数，零依赖）
// 模型约定输出：{ "hand": ["1m", ...], "winTile": "5p", "confidence": 0.86 }
// 赤五允许写成 0m/0p/0s，统一折算为 5m/5p/5s（当前计分不区分赤宝牌）。

const VALID_TILES = [
  '1m','2m','3m','4m','5m','6m','7m','8m','9m',
  '1p','2p','3p','4p','5p','6p','7p','8p','9p',
  '1s','2s','3s','4s','5s','6s','7s','8s','9s',
  '1z','2z','3z','4z','5z','6z','7z'
];
const MIN_TILES = 14;
const MAX_TILES = 18;
const MIN_CONFIDENCE = 0.6;

function fail(message) {
  return { ok: false, message };
}

// 从模型回复中取出 JSON：允许 ```json 代码块或前后夹带说明文字
function extractJson(text) {
  if (text && typeof text === 'object') return text;
  const raw = String(text || '');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch (e) { return null; }
}

// 单张牌 ID 归一化；非法返回 null
function normalizeTile(value) {
  const id = String(value == null ? '' : value).trim().toLowerCase();
  if (/^0[mps]$/.test(id)) return { id: '5' + id[1], aka: true };
  return VALID_TILES.includes(id) ? { id, aka: false } : null;
}

function compareTile(a, b) {
  return VALID_TILES.indexOf(a) - VALID_TILES.indexOf(b);
}

/**
 * @param {string|object} modelOutput 模型原始回复
 * @returns {{ok:true, hand:string[], winTile:string|null, akaCount:number, confidence:number|null, message:string}
 *          | {ok:false, message:string}}
 */
function parseRecognition(modelOutput) {
  const data = extractJson(modelOutput);
  if (!data || !Array.isArray(data.hand)) return fail('识别结果格式不正确，请手动选牌');

  const confidence = typeof data.confidence === 'number' ? data.confidence : null;
  if (confidence !== null && confidence < MIN_CONFIDENCE) {
    return fail(`识别把握较低（${Math.round(confidence * 100)}%），请重拍或手动选牌`);
  }

  const hand = [];
  let akaCount = 0;
  for (const item of data.hand) {
    const tile = normalizeTile(item);
    if (!tile) return fail(`识别到无法解析的牌「${item}」，请手动选牌`);
    if (tile.aka) akaCount++;
    hand.push(tile.id);
  }
  if (hand.length < MIN_TILES || hand.length > MAX_TILES) {
    return fail(`识别到 ${hand.length} 张牌，和牌应为 ${MIN_TILES}-${MAX_TILES} 张，请重拍或手动选牌`);
  }
  const counts = {};
  for (const id of hand) {
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > 4) return fail(`识别到 5 张以上的同一种牌（${id}），请重拍或手动选牌`);
  }

  const win = data.winTile == null || data.winTile === '' ? null : normalizeTile(data.winTile);
  const winTile = win && hand.includes(win.id) ? win.id : null;

  hand.sort(compareTile);
  return {
    ok: true,
    hand,
    winTile,
    akaCount,
    confidence,
    message: winTile
      ? `已识别 ${hand.length} 张，请核对`
      : `已识别 ${hand.length} 张，请核对并选择和牌张`
  };
}

// 设置页的自定义模型：三项都填才生效；Base URL 必须是 https
function normalizeModelConfig(config) {
  const c = config || {};
  const baseUrl = String(c.baseUrl || '').trim().replace(/\/+$/, '');
  const model = String(c.model || '').trim();
  const apiKey = String(c.apiKey || '').trim();
  if (!baseUrl && !model && !apiKey) return { ok: true, config: null };
  if (!baseUrl || !model || !apiKey) return { ok: false, message: 'Base URL、模型名、API Key 需同时填写' };
  if (!/^https:\/\/[^\s/]+/i.test(baseUrl)) return { ok: false, message: 'Base URL 必须以 https:// 开头' };
  return { ok: true, config: { baseUrl, model, apiKey } };
}

// 获取 / 测试前的草稿校验：全空 = 用云端默认；填了任一项就要求地址 + Key（测试还要模型名）
function checkModelDraft(draft, needModel) {
  const d = draft || {};
  const baseUrl = String(d.baseUrl || '').trim();
  const apiKey = String(d.apiKey || '').trim();
  const model = String(d.model || '').trim();
  if (!baseUrl && !apiKey && !model) return { ok: true, useDefault: true };
  if (!baseUrl || !apiKey) return { ok: false, message: '请先填写地址和 Key' };
  if (!/^https:\/\/[^\s/]+/i.test(baseUrl)) return { ok: false, message: '地址必须以 https:// 开头' };
  if (needModel && !model) return { ok: false, message: '请先填写或获取模型名' };
  return { ok: true, useDefault: false };
}

// 测试结果 → 展示文案
function describeModelTest(result) {
  if (!result || !result.ok) {
    return { ok: false, title: '测试失败', detail: (result && result.message) || '请检查地址、Key 与模型名' };
  }
  const seconds = (Math.max(0, result.latencyMs || 0) / 1000).toFixed(1);
  return {
    ok: true,
    seesImage: !!result.seesImage,
    title: result.seesImage ? `可用 · ${seconds}s` : `已连通 · ${seconds}s，但可能看不懂图片`,
    detail: `${result.via === 'local' ? '本机直连' : '云端默认'} · ${result.model || ''}：“${result.reply || ''}”`
  };
}

module.exports = {
  VALID_TILES, MIN_TILES, MAX_TILES, MIN_CONFIDENCE,
  extractJson, normalizeTile, parseRecognition, normalizeModelConfig,
  checkModelDraft, describeModelTest
};
