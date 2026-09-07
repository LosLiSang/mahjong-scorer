// js/views/settings.js — 识图 API 设置视图（Base URL / API Key / 模型名，仅存本机 localStorage）
(function () {
'use strict';
  const MJ = (window.MJ = window.MJ || {});

  function $(id) { return document.getElementById(id); }

  function renderKeyState(s) {
    const el = $('setKeyState');
    if (!el) return;
    el.textContent = s.apiKey
      ? '已保存 Key（长度 ' + s.apiKey.length + '，仅存本机浏览器）'
      : '未保存 Key';
  }

  function load() {
    const s = MJ.settings.get();
    $('setBaseUrl').value = s.baseUrl || '';
    $('setModel').value = s.model || '';
    $('setApiKey').value = ''; // 已存的 Key 不回显明文
    renderKeyState(s);
  }

  function save() {
    MJ.settings.save({
      baseUrl: $('setBaseUrl').value.trim(),
      model: $('setModel').value.trim(),
      apiKey: $('setApiKey').value.trim() || undefined, // 留空 = 不改动已存 Key
    });
    load();
  }

  function clearKey() {
    MJ.settings.clearApiKey();
    load();
  }

  function init() {
    $('setSave').addEventListener('click', save);
    $('setClear').addEventListener('click', clearKey);
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
