// js/core/vision-result.js — 识图结果纯逻辑：JSON 提取/牌码校验/多重集合比对/准确率
// UMD：浏览器挂 window.MJ.visionResult，Node 直接 require 供单测。
// 不依赖 DOM 与网络；模型返回的解析规则只在这里定义一次。
(function (root, factory) {
'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  const MJ = (root.MJ = root.MJ || {});
  MJ.visionResult = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  // 合法牌码：34 种常规牌 + 红宝牌（红5万/红5筒/红5索 → 0m/0p/0s）
  const NUMBER_CODES = [];
  for (const s of ['m', 'p', 's']) for (let n = 1; n <= 9; n++) NUMBER_CODES.push(n + s);
  const HONOR_CODES = ['1z', '2z', '3z', '4z', '5z', '6z', '7z'];
  const RED_CODES = ['0m', '0p', '0s'];
  const VALID_CODES = new Set([].concat(NUMBER_CODES, HONOR_CODES, RED_CODES));
  const RED_TO_PLAIN = { '0m': '5m', '0p': '5p', '0s': '5s' };

  function isValidCode(code) {
    return VALID_CODES.has(code);
  }

  // 从模型原文中提取第一个 JSON 对象文本（容忍 ```json 围栏与前后说明文字）
  function extractJsonObject(text) {
    if (typeof text !== 'string') return null;
    const cleaned = text.replace(/```[a-zA-Z]*\s*/g, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    return cleaned.slice(start, end + 1);
  }

  // 解析模型返回：fail-closed —— 非法牌码/超4张直接报错；张数异常只警告不吞结果
  // 返回 { ok:true, tiles, count, warnings } 或 { ok:false, kind, error }
  function parseModelTiles(rawText) {
    if (rawText == null || typeof rawText !== 'string' || !rawText.trim()) {
      return { ok: false, kind: 'EMPTY', error: '模型返回为空' };
    }
    const jsonText = extractJsonObject(rawText);
    if (!jsonText) return { ok: false, kind: 'NO_JSON', error: '返回中未找到 JSON 对象' };
    let obj;
    try {
      obj = JSON.parse(jsonText);
    } catch (e) {
      return { ok: false, kind: 'BAD_JSON', error: 'JSON 解析失败：' + e.message };
    }
    const tiles = obj && obj.tiles;
    if (!Array.isArray(tiles)) return { ok: false, kind: 'BAD_SCHEMA', error: 'JSON 缺少 tiles 数组' };

    const invalid = tiles.filter(function (t) { return !isValidCode(t); });
    if (invalid.length) {
      return { ok: false, kind: 'INVALID_CODE', error: '存在非法牌码：' + unique(invalid).join(', ') };
    }
    const counts = countBy(tiles);
    const over = Object.keys(counts).filter(function (c) { return counts[c] > 4; });
    if (over.length) {
      return { ok: false, kind: 'COUNT_EXCEEDED', error: '同种牌超过4张：' + over.join(', ') };
    }

    const warnings = [];
    if (typeof obj.count === 'number' && obj.count !== tiles.length) {
      warnings.push('count 字段(' + obj.count + ')与 tiles 长度(' + tiles.length + ')不一致');
    }
    if (tiles.length !== 13 && tiles.length !== 14) {
      warnings.push('识别张数为 ' + tiles.length + '（通常为13/14张），请人工核对');
    }
    return { ok: true, tiles: tiles.slice(), count: tiles.length, warnings };
  }

  // 红宝牌归一化：0m/0p/0s → 普通5m/5p/5s + 各花色红宝计数
  function normalizeRedFives(tiles) {
    const plain = [];
    const red = { m: 0, p: 0, s: 0 };
    for (const t of tiles || []) {
      if (RED_TO_PLAIN[t]) { plain.push(RED_TO_PLAIN[t]); red[t[1]] += 1; }
      else plain.push(t);
    }
    return { plain, red };
  }

  // 多重集合比对：以期望为分母的逐张准确率；期望为空时 accuracy=null（防零分母）
  // missing=期望有而识别没有；extra=识别多出
  function compareMultisets(expected, actual) {
    const e = expected || [];
    const a = actual || [];
    const need = countBy(e);
    const got = countBy(a);
    const missing = [];
    const extra = [];
    let correct = 0;
    const codes = new Set(Object.keys(need).concat(Object.keys(got)));
    codes.forEach(function (c) {
      const n = need[c] || 0;
      const g = got[c] || 0;
      correct += Math.min(n, g);
      for (let i = 0; i < n - g; i++) missing.push(c);
      for (let i = 0; i < g - n; i++) extra.push(c);
    });
    return {
      correct,
      missing,
      extra,
      accuracy: e.length ? correct / e.length : null,
      expectedCount: e.length,
      actualCount: a.length,
      exact: e.length === a.length && missing.length === 0 && extra.length === 0,
    };
  }

  function countBy(list) {
    const c = {};
    for (const item of list || []) c[item] = (c[item] || 0) + 1;
    return c;
  }

  function unique(list) {
    return Array.from(new Set(list));
  }

  return {
    VALID_CODES, RED_CODES, RED_TO_PLAIN,
    isValidCode, extractJsonObject, parseModelTiles,
    normalizeRedFives, compareMultisets,
  };
});
