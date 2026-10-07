// theme.js — 主题预设与切换
// 强调色与背景以 CSS 变量注入页面根节点（--accent / --bg / --surface），
// 样式层统一使用 var(--accent, #c96442) 形式取色，保证未设置时回退默认。

const THEME_KEY = 'mj_theme_v1';

const ACCENTS = [
  { id: 'terracotta', name: '陶土橙', color: '#c96442' },
  { id: 'indigo', name: '黛青', color: '#3d6b7d' },
  { id: 'pine', name: '松绿', color: '#5a7a4a' },
  { id: 'plum', name: '绛紫', color: '#8f5a7d' }
];

const BACKGROUNDS = [
  { id: 'cream', name: '米白', color: '#f5f4ee', surface: '#faf9f3', tabBar: 'rgba(250,248,242,.98)' },
  { id: 'white', name: '纯白', color: '#ffffff', surface: '#fafaf8', tabBar: 'rgba(255,255,255,.97)' }
];

function readSaved() {
  try { return wx.getStorageSync(THEME_KEY) || {}; } catch (err) { return {}; }
}

function current() {
  const saved = readSaved();
  const accent = ACCENTS.find(item => item.id === saved.accentId) || ACCENTS[0];
  const bg = BACKGROUNDS.find(item => item.id === saved.bgId) || BACKGROUNDS[0];
  return {
    accentId: accent.id,
    bgId: bg.id,
    accents: ACCENTS,
    backgrounds: BACKGROUNDS,
    pageStyle: `--accent:${accent.color};--bg:${bg.color};--surface:${bg.surface};`,
    tabBarStyle: `--accent:${accent.color};--tabbar-bg:${bg.tabBar};`
  };
}

function save(accentId, bgId) {
  const accent = ACCENTS.find(item => item.id === accentId) || ACCENTS[0];
  const bg = BACKGROUNDS.find(item => item.id === bgId) || BACKGROUNDS[0];
  try { wx.setStorageSync(THEME_KEY, { accentId: accent.id, bgId: bg.id }); } catch (err) {}
  return current();
}

module.exports = { ACCENTS, BACKGROUNDS, current, save, THEME_KEY };
