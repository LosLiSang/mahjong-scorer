// test-h5-vision.js — 识图纯逻辑单测（解析/校验/比对/准确率/设置存储/URL拼接）
// 用法: node test-h5-vision.js
// 在 require 之前注入 localStorage 模拟，settings-store 才能读到。
'use strict';

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}
function section(name) { console.log('\n=== ' + name + ' ==='); }

// ---- localStorage 模拟（必须在 require settings-store 之前就位）----
const mockStore = {};
globalThis.localStorage = {
  getItem: k => (k in mockStore ? mockStore[k] : null),
  setItem: (k, v) => { mockStore[k] = String(v); },
  removeItem: k => { delete mockStore[k]; },
};

const VR = require('./js/core/vision-result');
const Tiles = require('./js/core/tiles');
const Settings = require('./js/store/settings-store');
const Openai = require('./js/api/openai-client');

// ============ parseModelTiles ============
section('parseModelTiles：JSON 提取与校验')

let r = VR.parseModelTiles('{"tiles":["1m","2m","3m","4m","5m","6m","7m","8m","9m","1z","2z","3z","4z"]}');
check('纯 JSON（13张，无 count）解析成功且无警告', r.ok === true && r.tiles.length === 13 && r.warnings.length === 0);

r = VR.parseModelTiles('好的，结果如下：\n```json\n{"tiles":["1m","2m"],"count":2}\n```\n以上。');
check('围栏+前后说明文字可解析', r.ok === true && r.tiles.length === 2);

r = VR.parseModelTiles('  \n  ');
check('空返回 → EMPTY', !r.ok && r.kind === 'EMPTY');

r = VR.parseModelTiles('没有结构化内容');
check('无 JSON → NO_JSON', !r.ok && r.kind === 'NO_JSON');

r = VR.parseModelTiles('{"tiles":["1m",}');
check('畸形 JSON → BAD_JSON', !r.ok && r.kind === 'BAD_JSON');

r = VR.parseModelTiles('{"count":3}');
check('缺 tiles 数组 → BAD_SCHEMA', !r.ok && r.kind === 'BAD_SCHEMA');

r = VR.parseModelTiles('{"tiles":["1m","9m","Xx"]}');
check('非法牌码 → INVALID_CODE', !r.ok && r.kind === 'INVALID_CODE' && r.error.includes('Xx'));

r = VR.parseModelTiles('{"tiles":["1m","1m","1m","1m","1m"]}');
check('同种牌5张 → COUNT_EXCEEDED', !r.ok && r.kind === 'COUNT_EXCEEDED');

r = VR.parseModelTiles('{"tiles":["1m","2m"],"count":5}');
check('count 与长度不一致 → 警告不拒绝（另有张数警告）', r.ok === true && r.warnings.length === 2
  && r.warnings.some(w => w.includes('不一致')) && r.warnings.some(w => w.includes('13/14')));

r = VR.parseModelTiles('{"tiles":["1m","2m","3m","4m","5m","6m","7m","8m","9m","1z","2z","3z","4z"],"count":13}');
check('13张无警告', r.ok === true && r.warnings.length === 0);

r = VR.parseModelTiles('{"tiles":["1m","2m","3m"],"count":3}');
check('3张 → 张数警告', r.ok === true && r.warnings.length === 1 && r.warnings[0].includes('13/14'));

r = VR.parseModelTiles('{"tiles":["0m","0p","0s"],"count":3}');
check('红宝牌 0m/0p/0s 合法', r.ok === true && r.tiles.length === 3);

// ============ normalizeRedFives ============
section('normalizeRedFives：红宝牌归一化')

let n = VR.normalizeRedFives(['0m', '5m', '0p', '1z']);
check('0m→5m 且 red.m=1', JSON.stringify(n.plain) === '["5m","5m","5p","1z"]' && n.red.m === 1 && n.red.p === 1 && n.red.s === 0);

n = VR.normalizeRedFives(['1m', '2p']);
check('无红宝时原样透传', JSON.stringify(n.plain) === '["1m","2p"]' && n.red.m === 0 && n.red.p === 0 && n.red.s === 0);

// ============ compareMultisets ============
section('compareMultisets：多重集合比对与准确率')

let c = VR.compareMultisets(['1m', '1m', '2m'], ['1m', '3p']);
check('逐张比对 correct/missing/extra', c.correct === 1
  && JSON.stringify(c.missing) === '["1m","2m"]'
  && JSON.stringify(c.extra) === '["3p"]');
check('准确率 = correct/期望数 = 1/3', c.accuracy !== null && Math.abs(c.accuracy - 1 / 3) < 1e-9);

c = VR.compareMultisets(['1m', '2m'], ['2m', '1m']);
check('顺序无关完全一致', c.exact === true && c.accuracy === 1);

c = VR.compareMultisets([], ['1m']);
check('期望为空 → accuracy=null（防零分母）', c.accuracy === null && c.extra.length === 1);

c = VR.compareMultisets(['1m', '1m', '1m', '1m'], ['1m', '1m', '1m']);
check('数量差归入 missing', c.correct === 3 && c.missing.length === 1 && c.missing[0] === '1m' && c.extra.length === 0);

// ============ tiles.parseTileList ============
section('tiles.parseTileList：期望牌型输入解析')

let p = Tiles.parseTileList('1m, 2m 3p、4z');
check('空格/逗号/顿号混用可解析', p.ok === true && JSON.stringify(p.tiles) === '["1m","2m","3p","4z"]');

p = Tiles.parseTileList('1m abc 5z');
check('非法码不吞掉而是报告', p.ok === false && p.tiles.length === 2 && JSON.stringify(p.invalid) === '["abc"]');

p = Tiles.parseTileList('0m 0s 7z');
check('红宝码合法', p.ok === true && p.tiles.length === 3);

p = Tiles.parseTileList('');
check('空输入 → ok 且空列表', p.ok === true && p.tiles.length === 0);

// ============ settings-store ============
section('settings-store：localStorage 持久化')

delete mockStore[Settings.KEY];
let s = Settings.get();
check('默认 baseUrl 为 OpenAI 官方', s.baseUrl === 'https://api.openai.com/v1' && s.apiKey === '' && s.imageMaxEdge === 1600);
check('未配置 → isConfigured false', Settings.isConfigured() === false);

Settings.save({ apiKey: 'sk-test-123', model: 'gpt-4o-mini' });
s = Settings.get();
check('保存 key/model', s.apiKey === 'sk-test-123' && s.model === 'gpt-4o-mini');
check('配置齐全 → isConfigured true', Settings.isConfigured() === true);

Settings.save({ model: 'qwen-vl-plus' });
s = Settings.get();
check('部分更新不动 apiKey', s.apiKey === 'sk-test-123' && s.model === 'qwen-vl-plus');

Settings.clearApiKey();
check('清除 key', Settings.get().apiKey === '' && Settings.isConfigured() === false);

Settings.save({ baseUrl: 'https://gw.example/v1', apiKey: 'k2', model: 'm' });
Settings.clear();
check('clear 恢复默认', Settings.get().baseUrl === 'https://api.openai.com/v1' && Settings.get().apiKey === '');

// 存档损坏 → 回退默认
mockStore[Settings.KEY] = '{broken json';
check('存档损坏 → 回退默认不抛错', Settings.get().model === '');

// ============ openai-client：URL 拼接与配置闸门 ============
section('openai-client：joinUrl 与 CONFIG 闸门')

check('baseUrl 追加端点', Openai.joinUrl('https://gw.example/v1/', '/chat/completions') === 'https://gw.example/v1/chat/completions');
check('已含端点则不重复追加', Openai.joinUrl('https://gw.example/v1/chat/completions', '/chat/completions') === 'https://gw.example/v1/chat/completions');

(async () => {
  const cfg = await Openai.chatVision({});
  check('缺配置 → CONFIG 闸门，不发请求', cfg.ok === false && cfg.kind === 'CONFIG');

  // ============ 汇总 ============
  console.log(`\n结果: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
