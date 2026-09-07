// js/views/vision.js — 拍照识牌 + 期望对照验证
// 流程：拍照/选图/粘贴 → 本地压缩 → OpenAI 兼容视觉接口 → 严格 JSON 解析 → 牌图渲染可纠错 → 填入计分器
// 验证：输入期望牌型 → 多重集合逐张比对 → 准确率入档（只存 时间/模型/延迟/期望/实际/准确率，绝不含 Key）
(function () {
'use strict';
  const MJ = (window.MJ = window.MJ || {});
  const VR = MJ.visionResult;
  const RECORDS_KEY = 'mj.vision.records.v1';
  const RECORDS_CAP = 100;

  const RECOGNIZE_PROMPT = [
    '你是麻将牌识别器。照片中是一副日麻手牌（通常13张，和牌时14张）的实体牌照片。',
    '请识别照片中每一张可见的牌，输出严格 JSON，不要输出任何其他文字：',
    '{"tiles":["1m","2m"],"count":2}',
    '牌码规则：万=1m..9m，筒=1p..9p，索=1s..9s；字牌：1z东 2z南 3z西 4z北 5z白 6z发 7z中；红宝牌（红5万/红5筒/红5索）分别用 0m/0p/0s。',
    '注意：每张实体牌按出现次数逐一列出；同种牌最多4张；背面朝上或被严重遮挡的牌跳过；不要把牌桌背纹当成牌。',
  ].join('\n');

  // 自检样例：带说明文字 + ```json 围栏 + 红宝牌，验证解析/渲染/填入全链路（不联网）
  const SELF_TEST_RAW = [
    '好的，识别结果如下：',
    '```json',
    '{"tiles":["1m","1m","2m","3m","4m","0p","6m","7m","8m","9m","1z","1z","5z","7z"],"count":14}',
    '```',
  ].join('\n');

  const state = {
    imageDataUrl: null,
    tiles: [],
    meta: null, // { model, latencyMs, source: 'api'|'selftest' }
    busy: false,
  };
  MJ.vision = { fromScorer: false, state };

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, cls) {
    const el = $('visionStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'vision-status' + (cls ? ' ' + cls : '');
  }

  function configured() { return MJ.settings.isConfigured(); }

  // ============ 图片获取与压缩 ============
  function compressImage(dataUrl, maxEdge, quality) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = function () { reject(new Error('图片读取失败')); };
      img.src = dataUrl;
    });
  }

  function handleFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { setStatus('请选择图片文件', 'error'); return; }
    const reader = new FileReader();
    reader.onload = async function () {
      try {
        const s = MJ.settings.get();
        state.imageDataUrl = await compressImage(reader.result, s.imageMaxEdge, s.jpegQuality);
        $('visionPreview').src = state.imageDataUrl;
        $('visionPreviewWrap').style.display = 'block';
        setStatus('图片已就绪（' + Math.round(state.imageDataUrl.length / 1024) + 'KB），点击「开始识别」');
      } catch (e) {
        setStatus(e.message || '图片处理失败', 'error');
      }
    };
    reader.onerror = function () { setStatus('图片读取失败', 'error'); };
    reader.readAsDataURL(file);
  }

  // ============ 识别 ============
  async function recognize() {
    if (state.busy) return;
    if (!state.imageDataUrl) { setStatus('请先拍照或选择图片', 'error'); return; }
    if (!configured()) {
      setStatus('尚未配置识图 API：请到「设置」填写 Base URL / API Key / 模型名', 'error');
      return;
    }
    const s = MJ.settings.get();
    setBusy(true);
    setStatus('识别中…（视觉模型调用通常需要数秒到数十秒）');
    const res = await MJ.openai.chatVision({
      baseUrl: s.baseUrl,
      apiKey: s.apiKey,
      model: s.model,
      imageDataUrl: state.imageDataUrl,
      prompt: RECOGNIZE_PROMPT,
      timeoutMs: 90000,
    });
    setBusy(false);
    if (!res.ok) {
      setStatus('[' + res.kind + '] ' + res.message, 'error');
      return;
    }
    const parsed = VR.parseModelTiles(res.content);
    state.meta = { model: res.model || s.model, latencyMs: res.latencyMs, source: 'api' };
    if (!parsed.ok) {
      setStatus('[' + parsed.kind + '] 模型返回无法采信：' + parsed.error, 'error');
      console.warn('[vision] 原始返回：', res.content);
      return;
    }
    state.tiles = parsed.tiles.slice();
    (parsed.warnings || []).forEach(function (w) { console.warn('[vision] ' + w); });
    renderResult();
    setStatus('识别成功：' + state.tiles.length + ' 张 · ' + (state.meta.latencyMs / 1000).toFixed(1) + 's · ' + state.meta.model
      + (parsed.warnings && parsed.warnings.length ? '（有警告，请人工核对）' : ''), 'ok');
  }

  function selfTest() {
    const parsed = VR.parseModelTiles(SELF_TEST_RAW);
    if (!parsed.ok) { setStatus('自检失败：' + parsed.error, 'error'); return; }
    state.meta = { model: 'selftest', latencyMs: 0, source: 'selftest' };
    state.tiles = parsed.tiles.slice();
    renderResult();
    setStatus('自检通过：解析/校验/渲染/填入链路正常（未联网）', 'ok');
  }

  function setBusy(b) {
    state.busy = b;
    $('visionRun').disabled = b;
    $('visionRun').textContent = b ? '识别中…' : '开始识别';
  }

  // ============ 结果渲染（点牌可删） ============
  function renderResult() {
    const area = $('visionTiles');
    area.innerHTML = '';
    const uniqueIds = Array.from(new Set(state.tiles));
    if (uniqueIds.length === 0) {
      area.innerHTML = '<span class="empty-hint">无识别结果</span>';
    }
    uniqueIds.forEach(function (id) {
      const n = state.tiles.filter(function (t) { return t === id; }).length;
      const key = document.createElement('div');
      key.className = 'tile-key vision-chip';
      key.title = '点击删除一张 ' + id;
      key.innerHTML = '<img src="' + tileImgSrc(id) + '" alt="' + id + '">'
        + (n > 1 ? '<div class="count-badge">' + n + '</div>' : '');
      key.onclick = function () {
        const idx = state.tiles.indexOf(id);
        if (idx >= 0) state.tiles.splice(idx, 1);
        renderResult();
      };
      area.appendChild(key);
    });
    $('visionTileCount').textContent = state.tiles.length + ' 张';
    $('visionResultWrap').style.display = 'block';
  }

  // ============ 填入计分器 ============
  function applyToScorer() {
    if (state.tiles.length === 0) { setStatus('没有可填入的识别结果', 'error'); return; }
    const norm = VR.normalizeRedFives(state.tiles);
    const result = MJ.scorer.applyHandTiles(norm.plain);
    if (!result.ok) { setStatus(result.error, 'error'); return; }
    if (norm.red.m + norm.red.p + norm.red.s > 0) {
      MJ.scorer.setRedFives(norm.red.m + norm.red.p + norm.red.s);
    }
    const back = MJ.vision.fromScorer ? '' : '（已打开计分器结算弹窗，请指定最终和牌张）';
    MJ.vision.fromScorer = false;
    location.hash = '#/scorer';
    setStatus('已填入 ' + result.applied + ' 张'
      + (norm.red.m + norm.red.p + norm.red.s ? '（含红宝牌 ' + (norm.red.m + norm.red.p + norm.red.s) + '）' : '')
      + (result.skipped ? '，超出4张的同种牌丢弃 ' + result.skipped + ' 张' : '')
      + back, 'ok');
  }

  // ============ 验证对照 ============
  function compare() {
    const parsed = MJ.tiles.parseTileList($('visionExpected').value);
    const diffEl = $('visionDiff');
    if (!parsed.ok) {
      diffEl.innerHTML = '<span class="diff-error">期望牌型有误，非法码：' + parsed.invalid.join(', ') + '</span>';
      return;
    }
    if (parsed.tiles.length === 0) { diffEl.innerHTML = '<span class="diff-error">请先输入期望牌型</span>'; return; }
    const cmp = VR.compareMultisets(parsed.tiles, state.tiles);
    diffEl.innerHTML = renderDiffHtml(cmp);
    if (state.meta && state.meta.source === 'api') {
      saveRecord(parsed.tiles, cmp);
    }
    renderStats();
  }

  function renderDiffHtml(cmp) {
    const pct = cmp.accuracy == null ? '—' : (cmp.accuracy * 100).toFixed(1) + '%';
    const lines = [];
    lines.push(cmp.exact
      ? '<span class="diff-ok">✓ 完全一致（' + cmp.expectedCount + ' 张）</span>'
      : '<span class="diff-error">✗ 不一致</span> 准确率 ' + cmp.correct + '/' + cmp.expectedCount + ' = <b>' + pct + '</b>');
    if (cmp.missing.length) lines.push('漏识（期望有识别无）：' + cmp.missing.join(' '));
    if (cmp.extra.length) lines.push('多识（识别有期望无）：' + cmp.extra.join(' '));
    return lines.join('<br>');
  }

  function loadRecords() {
    try { return JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]'); }
    catch (e) { return []; }
  }

  // 验证记录只存：时间/模型/延迟/期望牌码/实际牌码/漏多/准确率 —— 绝不含 Key 与请求头
  function saveRecord(expectedTiles, cmp) {
    const records = loadRecords();
    records.push({
      ts: Date.now(),
      model: state.meta.model,
      latencyMs: state.meta.latencyMs,
      expected: expectedTiles.slice(),
      actual: state.tiles.slice(),
      missing: cmp.missing.slice(),
      extra: cmp.extra.slice(),
      accuracy: cmp.accuracy,
    });
    while (records.length > RECORDS_CAP) records.shift();
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  }

  function renderStats() {
    const records = loadRecords().filter(function (r) { return typeof r.accuracy === 'number'; });
    const el = $('visionStats');
    if (records.length === 0) { el.innerHTML = ''; return; }
    const n = records.length;
    const mean = records.reduce(function (s, r) { return s + r.accuracy; }, 0) / n;
    const exactN = records.filter(function (r) { return r.accuracy === 1; }).length;
    const feasible = n >= 10 && mean >= 0.9;
    let html = '累计真实调用 <b>' + n + '</b> 次 · 平均逐张准确率 <b>' + (mean * 100).toFixed(1) + '%</b> · 全对率 '
      + (exactN / n * 100).toFixed(1) + '%（' + exactN + '/' + n + '）'
      + '<br>判定标准：≥10 张真实照片且平均准确率 ≥90% → ' + (feasible
        ? '<span class="diff-ok">已达标：方案可行</span>'
        : '<span class="diff-error">未达标：继续采样或调整拍摄方式/模型</span>');
    html += '<table><tr><th>时间</th><th>模型</th><th>耗时</th><th>张数</th><th>漏/多</th><th>准确率</th></tr>';
    records.slice(-8).reverse().forEach(function (r) {
      html += '<tr><td>' + new Date(r.ts).toLocaleTimeString() + '</td><td>' + escapeHtml(r.model)
        + '</td><td>' + (r.latencyMs / 1000).toFixed(1) + 's</td><td>' + (r.expected || []).length + '→' + (r.actual || []).length
        + '</td><td>' + (r.missing || []).length + '/' + (r.extra || []).length
        + '</td><td>' + (r.accuracy * 100).toFixed(0) + '%</td></tr>';
    });
    html += '</table>';
    el.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ============ 事件绑定 ============
  function init() {
    $('visionFile').addEventListener('change', function (e) {
      handleFile(e.target.files && e.target.files[0]);
      e.target.value = '';
    });
    $('visionSelfTest').addEventListener('click', selfTest);
    $('visionRun').addEventListener('click', recognize);
    $('visionApply').addEventListener('click', applyToScorer);
    $('visionCompare').addEventListener('click', compare);
    // 粘贴图片（视觉视图可见时）
    document.addEventListener('paste', function (e) {
      if (!$('view-vision').classList.contains('active')) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.indexOf('image/') === 0) {
          handleFile(item.getAsFile());
          break;
        }
      }
    });
    renderStats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
