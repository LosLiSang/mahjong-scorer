// js/store/settings-store.js — 识图 API 设置持久化（localStorage，仅存本机）
// UMD：Node 测试时先注入 globalThis.localStorage 模拟实现再 require。
// 密钥只在此模块内进出存储，禁止进入日志/错误对象/验证记录。
(function (root, factory) {
'use strict';
  const storage = root && root.localStorage ? root.localStorage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const api = factory(storage);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  const MJ = (root.MJ = root.MJ || {});
  MJ.settings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (storage) {

  const KEY = 'mj.h5.settings.v1';
  const DEFAULTS = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: '',
    imageMaxEdge: 1600,   // 识别图最长边（px），控制 base64 体积
    jpegQuality: 0.85,
  };

  function get() {
    let saved = null;
    try {
      saved = storage ? JSON.parse(storage.getItem(KEY) || 'null') : null;
    } catch (e) {
      saved = null; // 存档损坏时回退默认值，不抛错
    }
    return Object.assign({}, DEFAULTS, saved || {});
  }

  // 部分更新：值为 undefined 的字段表示“不修改”（避免只改模型名时误清 Key）
  function save(partial) {
    const merged = get();
    const patch = partial || {};
    for (const k of Object.keys(patch)) {
      if (patch[k] === undefined) continue;
      merged[k] = patch[k];
    }
    if (storage) storage.setItem(KEY, JSON.stringify(merged));
    return get();
  }

  function clearApiKey() {
    return save({ apiKey: '' });
  }

  function clear() {
    if (storage) storage.removeItem(KEY);
    return get();
  }

  function isConfigured() {
    const s = get();
    return !!(s.baseUrl && s.apiKey && s.model);
  }

  return { KEY, DEFAULTS, get, save, clearApiKey, clear, isConfigured };
});
