// js/views/yaku-catalog.js — 役种图鉴（移植自小程序 pages/yaku-catalog）
// 数据：js/data/yaku-data.js（全局 YAKU_CATALOG/filterYakuCatalog/getYakuById/formatYakuHan/getYakuExample）
// 牌图：js/core/tiles.js 的全局 tileImgSrc（空牌回退 Blank）
(function () {
'use strict';
  const CATEGORIES = [
    { key: 'all', label: '全部' },
    { key: '1han', label: '一翻役' },
    { key: '2han', label: '二翻役' },
    { key: '3han', label: '三翻役' },
    { key: '6han', label: '六翻役' },
    { key: 'yakuman', label: '役满' },
  ];
  const CAT_COLORS = { '1han': '#c96442', '2han': '#c99442', '3han': '#c4a242', '6han': '#a45ac4', 'yakuman': '#c4425a' };

  const state = { activeCategory: 'all', list: YAKU_CATALOG.slice() };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function badgeColor(cat) { return CAT_COLORS[cat] || '#c96442'; }
  function truncate(text, len) {
    if (!text) return '';
    return text.length > len ? text.slice(0, len) + '…' : text;
  }
  function formatHan(y) {
    if (!y) return '';
    if (y.category === 'yakuman') return '役满';
    if (y.hanOpen === null) return '门前' + y.hanClosed + '翻 · 副露不可';
    if (y.hanClosed === y.hanOpen) return y.hanClosed + '翻';
    return '门前' + y.hanClosed + '翻 · 副露' + y.hanOpen + '翻';
  }

  function renderChips() {
    $('yakuChips').innerHTML = CATEGORIES.map(function (c) {
      const active = state.activeCategory === c.key;
      const style = active ? ' style="background:' + badgeColor(c.key) + ';border-color:' + badgeColor(c.key) + '"' : '';
      return '<div class="chip' + (active ? ' active' : '') + '" data-key="' + c.key + '"' + style + '>' + c.label + '</div>';
    }).join('');
  }

  function renderGrid() {
    $('yakuGrid').innerHTML = state.list.map(function (y) {
      return '<div class="yaku-card chip-' + esc(y.category) + '" data-id="' + esc(y.id) + '">'
        + '<div class="card-badge" style="background:' + badgeColor(y.category) + '">' + esc(formatHan(y)) + '</div>'
        + '<div class="card-name">' + esc(y.name) + '</div>'
        + '<div class="card-cond">' + esc(truncate(y.condition, 24)) + '</div>'
        + (y.tags && y.tags.length ? '<div class="card-tags">' + y.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '')
        + '</div>';
    }).join('');
    $('yakuEmpty').style.display = state.list.length === 0 ? 'flex' : 'none';
  }

  function openDetail(id) {
    const yaku = getYakuById(id);
    if (!yaku) return;
    const ex = getYakuExample(yaku);
    const exampleHand = ex.hand.map(function (tid) { return { id: tid, src: tileImgSrc(tid) }; });
    let exampleWin = null;
    if (ex.win) exampleWin = { id: ex.win, src: tileImgSrc(ex.win), isBlank: false };
    else if (ex.hand.length) exampleWin = { id: '', src: tileImgSrc('') || 'tiles/Blank.svg', isBlank: true };

    const y = yaku;
    $('yakuDetailBody').innerHTML = ''
      + '<div class="detail-close" id="yakuDetailClose">✕</div>'
      + '<div class="detail-header">'
      +   '<div class="detail-badge" style="background:' + badgeColor(y.category) + '">' + esc(formatHan(y)) + '</div>'
      +   '<div class="detail-name">' + esc(y.name) + '</div>'
      + '</div>'
      + '<div class="detail-section"><div class="detail-section-title">成立条件</div><div class="detail-cond-text">' + esc(y.condition) + '</div></div>'
      + '<div class="detail-section"><div class="detail-section-title">鸣牌限制</div><div class="detail-cond-text">' + esc(y.openPenalty || '—') + '</div></div>'
      + (y.example && y.example.length > 0 && exampleHand.length > 0
        ? '<div class="detail-section"><div class="detail-section-title">牌例</div><div class="example-row">'
          + exampleHand.map(function (t) { return '<img class="example-tile" src="' + t.src + '" alt="' + esc(t.id) + '">'; }).join('')
          + (exampleWin ? '<img class="example-tile example-win-tile' + (exampleWin.isBlank ? ' example-tile-blank' : '') + '" src="' + exampleWin.src + '" alt="胡牌张">' : '')
          + '</div><div class="example-note">右侧描边牌为胡牌张</div></div>'
        : '')
      + (y.pitfall ? '<div class="detail-section"><div class="detail-section-title">⚠ 易错点</div><div class="detail-pitfall">' + esc(y.pitfall) + '</div></div>' : '')
      + (y.tip ? '<div class="detail-section"><div class="detail-section-title">💡 小贴士</div><div class="detail-tip">' + esc(y.tip) + '</div></div>' : '')
      + (y.tags && y.tags.length ? '<div class="detail-section"><div class="detail-tags">' + y.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div></div>' : '');

    $('yakuDetailOverlay').classList.add('active');
  }

  function closeDetail() {
    $('yakuDetailOverlay').classList.remove('active');
  }

  function init() {
    renderChips();
    renderGrid();

    $('yakuChips').addEventListener('click', function (e) {
      const chip = e.target.closest('.chip[data-key]');
      if (!chip) return;
      const key = chip.dataset.key;
      state.activeCategory = key;
      state.list = key === 'all' ? YAKU_CATALOG.slice() : filterYakuCatalog({ category: key });
      renderChips();
      renderGrid();
    });

    $('yakuGrid').addEventListener('click', function (e) {
      const card = e.target.closest('.yaku-card[data-id]');
      if (card) openDetail(card.dataset.id);
    });

    $('yakuDetailOverlay').addEventListener('click', function (e) {
      if (e.target === this || e.target.id === 'yakuDetailClose') closeDetail();
    });

    $('yakuRights').addEventListener('click', function () {
      const email = 'lisangcode@outlook.com';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(function () {
          const el = $('yakuRights').querySelector('.rights-contact');
          const old = el.textContent;
          el.textContent = '邮箱已复制 ✓';
          setTimeout(function () { el.textContent = old; }, 1500);
        }).catch(function () { /* 复制失败静默，联系方式仍可见 */ });
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
