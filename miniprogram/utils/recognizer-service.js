// recognizer-service.js — 拍照识牌：选图 → 压缩 → base64 → 模型
// 两条通道：
//   · 用户在设置页填了自定义模型 → 小程序本地 wx.request 直连（图片与 Key 都不经过云端）
//   · 未填 → 调用云函数 tile-recognizer，使用云端默认模型（Key 只在服务端）
// 注意：正式版本地直连要求该域名已加入小程序后台「request 合法域名」。
const Config = require('../config');
const TileRecognition = require('./tile-recognition');
const Protocol = require('./model-protocol');

const MODEL_CONFIG_KEY = 'mj_tile_model_v1';
const COMPRESSED_WIDTH = 1280;
const LOCAL_TIMEOUT_MS = 30000;

const ERROR_MESSAGES = {
  CLOUD_NOT_CONFIGURED: '云端默认模型需要微信云开发环境，可在设置页填写自定义模型',
  IMAGE_REQUIRED: '没有取得照片',
  IMAGE_TOO_LARGE: '照片太大，请靠近手牌重拍',
  MODEL_NOT_CONFIGURED: '云端默认模型尚未配置，可在设置页填写自定义模型',
  INVALID_MODEL_CONFIG: '自定义模型配置无效，请在设置页检查',
  MODEL_AUTH_FAILED: '模型鉴权失败，请检查 API Key',
  MODEL_NOT_FOUND: '接口地址或模型名不存在，请检查',
  MODEL_RATE_LIMITED: '模型调用太频繁或额度不足，请稍后再试',
  MODEL_TIMEOUT: '识牌超时，请重试或手动选牌',
  MODEL_EMPTY_RESPONSE: '模型没有返回结果，请重试',
  MODEL_LIST_EMPTY: '该接口没有返回可用模型，请手动填写模型名',
  DOMAIN_NOT_ALLOWED: '该地址不在小程序合法域名中，无法从本机直连',
  UNKNOWN_ACTION: '云函数版本过旧，请重新部署 tile-recognizer',
  MODEL_REQUEST_FAILED: '识牌服务暂时不可用，请手动选牌'
};

function fail(code) {
  const err = new Error(ERROR_MESSAGES[code] || ERROR_MESSAGES.MODEL_REQUEST_FAILED);
  err.code = ERROR_MESSAGES[code] ? code : 'MODEL_REQUEST_FAILED';
  return err;
}

function cloudAvailable() {
  return !!(Config.cloudEnvId && typeof wx !== 'undefined' && wx.cloud);
}

function loadModelConfig() {
  try { return wx.getStorageSync(MODEL_CONFIG_KEY) || null; } catch (e) { return null; }
}

// 有自定义模型（本地直连）或云端可用时，显示「拍照识牌」入口
function isAvailable() {
  return !!loadModelConfig() || cloudAvailable();
}

function saveModelConfig(config) {
  const result = TileRecognition.normalizeModelConfig(config);
  if (!result.ok) return result;
  try {
    if (result.config) wx.setStorageSync(MODEL_CONFIG_KEY, result.config);
    else wx.removeStorageSync(MODEL_CONFIG_KEY);
  } catch (e) {}
  return result;
}

function promisify(fn, options) {
  return new Promise((resolve, reject) => fn(Object.assign({}, options, { success: resolve, fail: reject })));
}

// 返回压缩后的本地临时路径；用户取消返回 null
async function chooseImage() {
  let res;
  try {
    res = await promisify(wx.chooseMedia, {
      count: 1, mediaType: ['image'], sourceType: ['camera', 'album'], sizeType: ['compressed']
    });
  } catch (err) {
    if (/cancel/i.test(err && err.errMsg || '')) return null;
    throw err;
  }
  const file = res && res.tempFiles && res.tempFiles[0];
  if (!file) return null;
  try {
    const compressed = await promisify(wx.compressImage, {
      src: file.tempFilePath, quality: 70, compressedWidth: COMPRESSED_WIDTH
    });
    return compressed.tempFilePath || file.tempFilePath;
  } catch (e) {
    return file.tempFilePath;
  }
}

// wx.request 失败信息 → 错误码
function localErrorCode(errMsg) {
  const msg = String(errMsg || '');
  if (/url not in domain list|不在以下 request 合法域名|domain/i.test(msg)) return 'DOMAIN_NOT_ALLOWED';
  if (/timeout|超时/i.test(msg)) return 'MODEL_TIMEOUT';
  return 'MODEL_REQUEST_FAILED';
}

// 本地直连：按 model-protocol 构造的请求发出，2xx 返回 JSON，否则抛对应错误码
function sendLocal(request) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: request.url,
      method: request.method,
      header: request.headers,
      data: request.body,
      timeout: LOCAL_TIMEOUT_MS,
      success: res => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(fail(Protocol.httpErrorCode(res.statusCode)));
        let data = res.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) { return reject(fail('MODEL_REQUEST_FAILED')); }
        }
        resolve(data);
      },
      fail: err => reject(fail(localErrorCode(err && err.errMsg)))
    });
  });
}

async function callCloud(data) {
  if (!cloudAvailable()) throw fail('CLOUD_NOT_CONFIGURED');
  let response;
  try {
    response = await wx.cloud.callFunction({ name: Config.tileFunctionName || 'tile-recognizer', data });
  } catch (err) {
    throw fail(/timeout|超时/i.test(err && (err.errMsg || err.message) || '') ? 'MODEL_TIMEOUT' : 'MODEL_REQUEST_FAILED');
  }
  const result = response && response.result;
  if (!result || !result.ok) throw fail(result && result.code);
  return result;
}

// 设置页草稿 → 模型配置；全空返回 null（= 云端默认）
function draftConfig(draft) {
  const d = draft || {};
  const baseUrl = Protocol.trimBaseUrl(d.baseUrl);
  const apiKey = String(d.apiKey || '').trim();
  const model = String(d.model || '').trim();
  return baseUrl || apiKey || model ? { baseUrl, apiKey, model } : null;
}

// 识牌：返回 parseRecognition 的结果（ok:false 时含给用户看的 message）
async function recognize(filePath, options) {
  const opts = options || {};
  const custom = opts.modelConfig !== undefined ? opts.modelConfig : loadModelConfig();
  const transport = opts.send || sendLocal;
  const imageBase64 = (opts.readFile || (p => wx.getFileSystemManager().readFileSync(p, 'base64')))(filePath);
  const mimeType = /\.png$/i.test(filePath) ? 'image/png' : 'image/jpeg';
  if (imageBase64.length > Protocol.MAX_IMAGE_BASE64) throw fail('IMAGE_TOO_LARGE');
  let text;
  if (custom) {
    text = Protocol.replyText(await transport(Protocol.chatRequest(custom, imageBase64, mimeType)));
    if (!text) throw fail('MODEL_EMPTY_RESPONSE');
  } else {
    text = (await callCloud({ action: 'recognize', imageBase64, mimeType })).text;
  }
  return TileRecognition.parseRecognition(text);
}

// 获取模型列表：只对自定义接口有意义（本地直连）
async function listModels(draft, send) {
  const custom = draftConfig(draft);
  if (!custom) throw fail('INVALID_MODEL_CONFIG');
  const models = Protocol.modelIds(await (send || sendLocal)(Protocol.modelsRequest(custom)));
  if (!models.length) throw fail('MODEL_LIST_EMPTY');
  return models;
}

// 测试模型：自定义 → 本地直连；未填 → 测试云端默认。返回 { model, reply, seesImage, latencyMs, via }
async function testModel(draft, send, now) {
  const custom = draftConfig(draft);
  if (!custom) return Object.assign({ via: 'cloud' }, await callCloud({ action: 'testModel' }));
  const clock = now || Date.now;
  const started = clock();
  const reply = Protocol.replyText(await (send || sendLocal)(Protocol.testRequest(custom)));
  if (!reply) throw fail('MODEL_EMPTY_RESPONSE');
  return Object.assign({ via: 'local' }, Protocol.testSummary(custom, reply, clock() - started));
}

module.exports = {
  isAvailable, cloudAvailable, loadModelConfig, saveModelConfig, chooseImage,
  recognize, listModels, testModel, draftConfig, localErrorCode, ERROR_MESSAGES
};
