// js/views/scoring-guide.js — 算分详解（移植自小程序 pages/scoring-guide）
// 数据：js/data/scoring-guide-data.js（全局 FU_REFERENCE/LIMIT_REFERENCE）
// 计算：js/core/mahjong-logic.js 的全局 calcBasePoint
(function () {
'use strict';
  const TABS = [
    { key: 'fu', label: '符数' },
    { key: 'points', label: '点数' },
    { key: 'mangan', label: '满贯' },
  ];
  const FU_VALUES = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
  const HAN_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

  // 42→50 符的完整计算示例（与小程序页内常量一致）
  const FU_EXAMPLE = {
    desc: '以下是一个典型的门前清荣和手牌（嵌张听牌）的符数计算过程：',
    steps: [
      { label: '副底', fu: 20, note: '所有和牌的起点' },
      { label: '门前荣和', fu: 10, note: '未副露时荣和加 10 符' },
      { label: '雀头（自风）', fu: 2, note: '自风作雀头加 2 符' },
      { label: '嵌张听牌', fu: 2, note: '听牌形为嵌张，加 2 符' },
      { label: '幺九暗刻', fu: 8, note: '幺九牌暗刻加 8 符' },
    ],
    raw: 42,
    rounded: 50,
  };

  const state = { currentTab: 'fu', hanIndex: 2, fuIndex: 2, isDealer: false, isTsumo: false };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ceil100(n) { return Math.ceil(n / 100) * 100; }

  function calculate() {
    const han = HAN_VALUES[state.hanIndex];
    const fu = FU_VALUES[state.fuIndex];
    const isDealer = state.isDealer;
    const isTsumo = state.isTsumo;

    const basePoint = calcBasePoint(han, fu);
    const isMangan = han >= 5 || basePoint >= 2000;
    const actualBase = Math.min(basePoint, han >= 13 ? 8000 : han >= 11 ? 6000 : han >= 8 ? 4000 : han >= 6 ? 3000 : 2000);

    let formula, totalPoints, breakdown;
    if (isTsumo) {
      if (isDealer) {
        const perChild = ceil100(actualBase * 2);
        totalPoints = perChild * 3;
        formula = '基本点 ' + actualBase + ' × 2 = ' + perChild + '（每家）';
        breakdown = '每家 ' + perChild + ' 点 × 3 人 = ' + totalPoints + ' 点';
      } else {
        const fromDealer = ceil100(actualBase * 2);
        const fromChild = ceil100(actualBase * 1);
        totalPoints = fromDealer + fromChild * 2;
        formula = '基本点 ' + actualBase;
        breakdown = '亲付 ' + fromDealer + ' 点 + 子付 ' + fromChild + ' 点 × 2 = ' + totalPoints + ' 点';
      }
    } else {
      if (isDealer) {
        totalPoints = ceil100(actualBase * 6);
        formula = '基本点 ' + actualBase + ' × 6 = ' + totalPoints;
        breakdown = '放铳者支付 ' + totalPoints + ' 点';
      } else {
        totalPoints = ceil100(actualBase * 4);
        formula = '基本点 ' + actualBase + ' × 4 = ' + totalPoints;
        breakdown = '放铳者支付 ' + totalPoints + ' 点';
      }
    }

    let manganLabel = '';
    if (han >= 13) manganLabel = '役满';
    else if (han >= 11) manganLabel = '三倍满';
    else if (han >= 8) manganLabel = '倍满';
    else if (han >= 6) manganLabel = '跳满';
    else if (han >= 5 || (fu >= 40 && han >= 4) || (fu >= 70 && han >= 3)) manganLabel = '满贯';

    const baseFormula = han < 5
      ? fu + ' × 2^(' + han + '+2) = ' + fu + ' × 2^' + (han + 2) + ' = ' + fu + ' × ' + Math.pow(2, han + 2) + ' = ' + basePoint
      : '满贯档：基本点固定为 ' + actualBase;

    return { han, fu, basePoint, actualBase, isMangan, manganLabel, formula, totalPoints, breakdown, baseFormula, isDealer, isTsumo };
  }

  function renderTabs() {
    $('sgTabs').innerHTML = TABS.map(function (t) {
      return '<div class="seg-btn' + (state.currentTab === t.key ? ' active' : '') + '" data-tab="' + t.key + '">' + t.label + '</div>';
    }).join('');
  }

  function fuTabHtml() {
    return '<div class="tab-content">'
      + '<div class="guide-intro"><span class="intro-title">符数是什么？</span>'
      + '<span class="intro-text">符数是衡量手牌「含金量」的基础单位。一副手牌从副底 20 符出发，根据面子构成、听牌形、雀头和和牌方式逐项加符，最终向上进位到整十。</span></div>'
      + '<div class="section-title">📋 符数细目</div>'
      + '<div class="fu-table"><div class="fu-table-header">'
      + '<span class="fu-col-name">项目</span><span class="fu-col-value">符数</span><span class="fu-col-detail">说明</span></div>'
      + FU_REFERENCE.map(function (item) {
        return '<div class="fu-table-row"><span class="fu-col-name">' + esc(item.title) + '</span>'
          + '<span class="fu-col-value">' + esc(item.value) + '</span>'
          + '<span class="fu-col-detail">' + esc(item.detail) + '</span></div>';
      }).join('') + '</div>'
      + '<div class="section-title">🧮 完整示例：42 符 → 50 符</div>'
      + '<div class="fu-example"><span class="example-desc">' + esc(FU_EXAMPLE.desc) + '</span>'
      + '<div class="example-steps">' + FU_EXAMPLE.steps.map(function (s) {
        return '<div class="example-step"><span class="step-label">' + esc(s.label) + '</span>'
          + '<span class="step-fu">+' + s.fu + ' 符</span><span class="step-note">' + esc(s.note) + '</span></div>';
      }).join('') + '</div>'
      + '<div class="example-total"><span class="total-label">合计</span>'
      + '<span class="total-raw">' + FU_EXAMPLE.steps.map(function (s) { return s.fu; }).join(' + ') + ' = ' + FU_EXAMPLE.raw + ' 符</span>'
      + '<span class="total-rounded">进位 → <span class="highlight">' + FU_EXAMPLE.rounded + ' 符</span></span></div></div>'
      + '</div>';
  }

  function pointsTabHtml() {
    const r = calculate();
    const han = HAN_VALUES[state.hanIndex];
    const fu = FU_VALUES[state.fuIndex];
    const hanLabel = han >= 13 ? '（役满）' : han >= 5 ? '（满贯档）' : '';
    return '<div class="tab-content">'
      + '<div class="guide-intro"><span class="intro-title">点数怎么算？</span>'
      + '<span class="intro-text">基本点 = 符 × 2^(番+2)。子荣和 = 基本点 × 4，亲荣和 = 基本点 × 6（向上百位取整）。自摸时亲付基本点 × 2，子付基本点 × 1。5 番以上进入满贯档，基本点不再按公式计算。</span></div>'
      + '<div class="section-title">🔢 点数计算器</div>'
      + '<div class="calculator">'
      + '<span class="label">番数</span>'
      + '<select id="sgHan">' + HAN_VALUES.map(function (v, i) {
        return '<option value="' + i + '"' + (i === state.hanIndex ? ' selected' : '') + '>' + v + ' 番' + (v >= 13 ? '（役满）' : v >= 5 ? '（满贯档）' : '') + '</option>';
      }).join('') + '</select>'
      + '<span class="label">符数</span>'
      + '<select id="sgFu">' + FU_VALUES.map(function (v, i) {
        return '<option value="' + i + '"' + (i === state.fuIndex ? ' selected' : '') + '>' + v + ' 符</option>';
      }).join('') + '</select>'
      + '<span class="label">和牌者</span>'
      + '<div class="toggle-row"><div class="toggle-btn' + (!state.isDealer ? ' active' : '') + '" data-dealer="0">子</div>'
      + '<div class="toggle-btn' + (state.isDealer ? ' active' : '') + '" data-dealer="1">亲</div></div>'
      + '<span class="label">和牌方式</span>'
      + '<div class="toggle-row"><div class="toggle-btn' + (!state.isTsumo ? ' active' : '') + '" data-tsumo="0">荣和</div>'
      + '<div class="toggle-btn' + (state.isTsumo ? ' active' : '') + '" data-tsumo="1">自摸</div></div>'
      + '</div>'
      + '<div class="result-box calc-result">'
      + '<div class="calc-head"><span class="calc-condition">' + (r.isDealer ? '亲' : '子') + ' · ' + (r.isTsumo ? '自摸' : '荣和') + '</span>'
      + (r.manganLabel ? '<span class="calc-mangan-badge">' + r.manganLabel + '</span>' : '')
      + '</div>'
      + '<div class="points">' + r.totalPoints + ' 点</div>'
      + '<div class="calc-detail"><span class="calc-base">' + r.han + ' 番 ' + r.fu + ' 符</span>'
      + '<span class="calc-formula">' + esc(r.formula) + '</span>'
      + '<span class="calc-breakdown">' + esc(r.breakdown) + '</span></div>'
      + (!r.isMangan ? '<div class="calc-expand"><span class="expand-title">基本点计算过程：</span><span class="expand-text">' + esc(r.baseFormula) + '</span></div>' : '')
      + '</div></div>';
  }

  function manganTabHtml() {
    return '<div class="tab-content">'
      + '<div class="guide-intro"><span class="intro-title">什么是满贯？</span>'
      + '<span class="intro-text">当番与符的组合使得「基本点」达到或超过 2000 点时，不再按公式计算，而是直接取固定的档位点。具体对应关系如下：</span></div>'
      + '<div class="section-title">📊 满贯档位</div>'
      + '<div class="mangan-cards">' + LIMIT_REFERENCE.map(function (item) {
        return '<div class="mangan-card"><div class="mangan-card-head"><span class="mangan-name">' + esc(item.name) + '</span></div>'
          + '<div class="mangan-card-body">'
          + '<div class="mangan-row"><span class="mangan-key">番数范围</span><span class="mangan-val">' + esc(item.range) + '</span></div>'
          + '<div class="mangan-row"><span class="mangan-key">基本点</span><span class="mangan-val base">' + esc(item.base) + '</span></div>'
          + '<div class="mangan-row"><span class="mangan-key">子荣和</span><span class="mangan-val">' + esc(item.childRon) + '</span></div>'
          + '<div class="mangan-row"><span class="mangan-key">亲荣和</span><span class="mangan-val dealer">' + esc(item.dealerRon) + '</span></div>'
          + '</div></div>';
      }).join('') + '</div>'
      + '<div class="mangan-tip"><span class="tip-icon">💡</span>'
      + '<span class="tip-text">满贯判定不只看番数：4 番 40 符以上、3 番 70 符以上也会进入满贯档位。满贯档确定后，符数不再影响最终点数。</span></div>'
      + '</div>';
  }

  function render() {
    renderTabs();
    $('sgBody').innerHTML = state.currentTab === 'fu' ? fuTabHtml()
      : state.currentTab === 'points' ? pointsTabHtml()
      : manganTabHtml();
  }

  function init() {
    render();
    $('sgTabs').addEventListener('click', function (e) {
      const tab = e.target.closest('.seg-btn[data-tab]');
      if (!tab) return;
      state.currentTab = tab.dataset.tab;
      render();
    });
    $('sgBody').addEventListener('change', function (e) {
      if (e.target.id === 'sgHan') { state.hanIndex = Number(e.target.value); render(); }
      if (e.target.id === 'sgFu') { state.fuIndex = Number(e.target.value); render(); }
    });
    $('sgBody').addEventListener('click', function (e) {
      const dealerBtn = e.target.closest('.toggle-btn[data-dealer]');
      if (dealerBtn) { state.isDealer = dealerBtn.dataset.dealer === '1'; render(); return; }
      const tsumoBtn = e.target.closest('.toggle-btn[data-tsumo]');
      if (tsumoBtn) { state.isTsumo = tsumoBtn.dataset.tsumo === '1'; render(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
