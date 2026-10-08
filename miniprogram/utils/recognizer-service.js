// recognizer-service.js — 拍照识牌：选图 → 压缩 → base64 → 云函数（图片不落盘）
const Config = require('../config');
const TileRecognition = require('./tile-recognition');

const MODEL_CONFIG_KEY = 'mj_tile_model_v1';
const COMPRESSED_WIDTH = 1280;

const ERROR_MESSAGES = {
  CLOUD_NOT_CONFIGURED: '识牌需要微信云开发环境，请先手动选牌',
  IMAGE_REQUIRED: '没有取得照片',
  IMAGE_TOO_LARGE: '照片太大，请靠近手牌重拍',
  MODEL_NOT_CONFIGURED: '识牌模型尚未配置，可在设置页填写自定义模型',
  INVALID_MODEL_CONFIG: '自定义模型配置无效，请在设置页检查',
  MODEL_AUTH_FAILED: '识牌模型鉴权失败，请检查 API Key',
  MODEL_TIMEOUT: '识牌超时，请重试或手动选牌',
  MODEL_EMPTY_RESPONSE: '模型没有返回结果，请重试',
  MODEL_REQUEST_FAILED: '识牌服务暂时不可用，请手动选牌'
};

function fail(code) {
  const err = new Error(ERROR_MESSAGES[code] || ERROR_MESSAGES.MODEL_REQUEST_FAILED);
  err.code = code;
  return err;
}

function isAvailable() {
  return !!(Config.cloudEnvId && typeof wx !== 'undefined' && wx.cloud);
}

function loadModelConfig() {
  try { return wx.getStorageSync(MODEL_CONFIG_KEY) || null; } catch (e) { return null; }
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

// 调用云函数并返回 parseRecognition 的结果（ok:false 时含给用户看的 message）
async function recognize(filePath) {
  if (!isAvailable()) throw fail('CLOUD_NOT_CONFIGURED');
  const imageBase64 = wx.getFileSystemManager().readFileSync(filePath, 'base64');
  const mimeType = /\.png$/i.test(filePath) ? 'image/png' : 'image/jpeg';
  let response;
  try {
    response = await wx.cloud.callFunction({
      name: Config.tileFunctionName || 'tile-recognizer',
      data: { imageBase64, mimeType, modelConfig: loadModelConfig() }
    });
  } catch (err) {
    throw fail(/timeout|超时/i.test(err && (err.errMsg || err.message) || '') ? 'MODEL_TIMEOUT' : 'MODEL_REQUEST_FAILED');
  }
  const result = response && response.result;
  if (!result || !result.ok) throw fail(result && result.code);
  return TileRecognition.parseRecognition(result.text);
}

module.exports = { isAvailable, loadModelConfig, saveModelConfig, chooseImage, recognize, ERROR_MESSAGES };
