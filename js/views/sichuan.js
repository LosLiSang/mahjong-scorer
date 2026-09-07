// js/views/sichuan.js — 川麻积分（移植自小程序 pages/sichuan，仅本地积分器）
// 数据：js/data/sichuan-score.js（UMD，全局 SICHUAN_FAN_TYPES/SICHUAN_PENALTY_TYPES/…）
// 说明：联机房间依赖 wx.cloud，不在 H5 范围；本地存档键与小程序同名 'mj_sichuan_v1'。
(function () {
'use strict';
  const STORAGE_KEY = 'mj_sichuan_v1';
  const SEATS = ['东', '南', '西', '北'];
  const FAN_CAP_OPTIONS = [3, 4, 5, 6];
  const BASE_SCORE_OPTIONS = [1, 2, 5, 10];
  const BASE_FAN_IDS = new Set(SICHUAN_FAN_TYPES.filter(function (t) { return t.group === 'base'; }).map(function (t) { return t.id; }));

  const state = {
    game: null,
    // 胡牌
    showWin: false, winReceiver: 0, winPayers: [false, false, false, false], winPayerCount: 0,
    winFanIds: ['pinghu'], winRootCount: 0, winFanCap: 6, winBaseScore: 1, winFanPreview: null,
    fanGroups: [],
    showFanExample: false, fanExample: null,
    // 杠分
    showGang: false, gangReceiver: 0, gangAmount: '',
    // 罚分
    showPenalty: false, penaltyPayer: 0, penaltyReceivers: [false, true, true, true],
    penaltyReceiverCount: 3, penaltyTypeId: 'huazhu', penaltyType: SICHUAN_PENALTY_TYPES[0], penaltyAmount: '',
    // 玩家设置
    showSetup: false, setupPlayerIndex: 0, setupName: '', setupMissingSuit: '',
    // 历史
    showHistory: false, historyList: [],
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function tileSrcH5(id) { return tileImgSrc(id) || 'tiles/Blank.svg'; }

  function buildFanGroups(selectedIds) {
    const selected = new Set(selectedIds || []);
    const decorate = function (type) {
      return Object.assign({}, type, {
        selected: selected.has(type.id),
        exampleImages: (type.exampleTiles || []).map(function (id, index) {
          return { key: id + '-' + index, src: tileSrcH5(id), isHaku: id === '5z' };
        }),
      });
    };
    return [
      { label: '基础番型（单选）', types: SICHUAN_FAN_TYPES.filter(function (t) { return t.group === 'base'; }).map(decorate) },
      { label: '额外番型（可多选）', types: SICHUAN_FAN_TYPES.filter(function (t) { return t.group === 'extra' && t.id !== 'gen'; }).map(decorate) },
    ];
  }

  function loadGame() {
    let game = null;
    try { game = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { game = null; }
    if (!game || !game.players || game.players.length !== 4) {
      game = createSichuanGame(['玩家一', '玩家二', '玩家三', '玩家四']);
    }
    state.game = game;
    saveGame();
  }

  function saveGame() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.game)); } catch (e) { /* 存储不可用时不落盘 */ }
  }

  // ============ 主板渲染 ============
  function renderBoard() {
    const game = state.game;
    const seatClasses = ['dong', 'nan', 'xi', 'bei'];
    $('scBoard').innerHTML = ''
      + ['tl:模式:川麻', 'tr:人数:4 人', 'bl:记录:' + game.history.length + ' 笔', 'br:状态:' + (game.history.length ? '进行中' : '待开局')]
        .map(function (item) {
          const p = item.split(':');
          return '<div class="table-corner corner-' + p[0] + '"><span class="corner-label">' + p[1] + '</span><span class="corner-value">' + p[2] + '</span></div>';
        }).join('')
      + '<div class="table-center sichuan-center">'
      + '<div class="center-kicker">即时结算</div><div class="center-title">川麻积分</div><div class="center-sub">四人零和计分</div></div>'
      + game.players.map(function (player, index) {
        return '<div class="player-card seat-' + seatClasses[index] + ' sichuan-player" data-index="' + index + '">'
          + '<div class="seat-label">' + SEATS[index] + '</div>'
          + '<div class="name">' + esc(player.name) + '</div>'
          + '<div class="points sichuan-points">' + (player.score >= 0 ? '+' : '') + player.score + '</div>'
          + (player.missingSuit
            ? '<div class="missing-badge missing-' + player.missingSuit + '"><span class="missing-prefix">缺</span>'
              + '<span class="missing-suit">' + (player.missingSuit === 'm' ? '万' : player.missingSuit === 'p' ? '筒' : '索') + '</span></div>'
            : '')
          + '</div>';
      }).join('');
    $('scHistoryCount').textContent = '记录（' + game.history.length + '）';
  }

  // ============ 胡牌弹窗 ============
  function openWin() {
    Object.assign(state, {
      showWin: true, winReceiver: 0, winPayers: [false, false, false, false], winPayerCount: 0,
      winFanIds: ['pinghu'], winRootCount: 0, winFanCap: 6, winBaseScore: 1, winFanPreview: null,
      fanGroups: buildFanGroups(['pinghu']),
    });
    renderWinModal();
  }

  function previewWin() {
    const result = calculateSichuanFan(state.winFanIds, state.winFanCap, state.winRootCount);
    const amount = scoreFromFan(result.fan, state.winBaseScore, 1, state.winFanCap);
    state.winFanPreview = {
      fan: result.fan, label: result.label, rootCount: result.rootCount,
      amountPerPayer: amount, total: amount * state.winPayerCount,
    };
  }

  function renderWinModal() {
    const overlay = $('scWinOverlay');
    if (!state.showWin) { overlay.classList.remove('active'); return; }
    if (!state.winFanPreview) previewWin();

    const game = state.game;
    const receiverBtns = game.players.map(function (p, i) {
      return '<div class="seg-btn' + (state.winReceiver === i ? ' active' : '') + '" data-receiver="' + i + '">'
        + SEATS[i] + ' · ' + esc(p.name) + '</div>';
    }).join('');
    const payerBtns = game.players.map(function (p, i) {
      if (i === state.winReceiver) return '';
      return '<div class="seg-btn' + (state.winPayers[i] ? ' active' : '') + '" data-payer="' + i + '">'
        + SEATS[i] + ' · ' + esc(p.name) + '</div>';
    }).join('');
    const fanGroupsHtml = state.fanGroups.map(function (group) {
      return '<div class="fan-group-label">' + esc(group.label) + '</div>'
        + '<div class="fan-chip-grid">' + group.types.map(function (t) {
          return '<div class="seg-btn sch-fan-btn' + (t.selected ? ' active' : '') + '" data-fan="' + t.id + '">'
            + '<span class="fan-name">' + esc(t.name) + '</span><span class="fan-value">' + t.fan + '番</span></div>';
        }).join('') + '</div>';
    }).join('');
    const rootBtns = [0, 1, 2, 3, 4].map(function (n) {
      return '<div class="seg-btn root-btn' + (state.winRootCount === n ? ' active' : '') + '" data-root="' + n + '">' + n + '根</div>';
    }).join('');
    const baseBtns = BASE_SCORE_OPTIONS.map(function (n) {
      return '<div class="seg-btn' + (state.winBaseScore === n ? ' active' : '') + '" data-basescore="' + n + '">' + n + '</div>';
    }).join('');
    const capBtns = FAN_CAP_OPTIONS.map(function (n) {
      return '<div class="seg-btn' + (state.winFanCap === n ? ' active' : '') + '" data-fancap="' + n + '">' + n + '番</div>';
    }).join('');
    const pv = state.winFanPreview;

    $('scWinBody').innerHTML = ''
      + '<div class="modal-title">🀄 胡牌积分</div>'
      + '<div class="label">收分玩家</div><div class="seg-group seg-one-line player-select-row">' + receiverBtns + '</div>'
      + '<div class="label">付款玩家（可多选）</div><div class="seg-group seg-one-line player-select-row">' + payerBtns + '</div>'
      + (state.winPayerCount ? '<div class="payer-count">已选 ' + state.winPayerCount + ' 人</div>' : '')
      + '<div class="label">番型组合</div><div class="fan-help">点击选择，长按查看牌型示例</div>'
      + fanGroupsHtml
      + '<div class="label">根数（四张一样未杠）</div><div class="seg-group root-options">' + rootBtns + '</div>'
      + '<div class="sichuan-opts-row">'
      + '<div style="flex:1"><div class="label">底分</div><div class="seg-group">' + baseBtns + '</div></div>'
      + '<div style="flex:1"><div class="label">封顶</div><div class="seg-group">' + capBtns + '</div></div>'
      + '</div>'
      + (pv ? '<div class="result-box sichuan-result"><div class="detail">' + esc(pv.label) + '</div>'
        + '<div class="points">' + pv.fan + '番</div>'
        + '<div class="detail" style="margin-top:4px">每人 ' + pv.amountPerPayer + ' 分'
        + (state.winPayerCount ? ' · 合计 ' + pv.total + ' 分' : '') + '</div></div>' : '')
      + '<div class="modal-actions"><button class="btn btn-secondary" id="scWinClose">取消</button>'
      + '<button class="btn" id="scWinConfirm">确认结算</button></div>';

    overlay.classList.add('active');
  }

  function toggleWinFan(id) {
    const type = SICHUAN_FAN_TYPES.find(function (item) { return item.id === id; });
    if (!type || id === 'gen') return;
    let ids = state.winFanIds.slice();
    if (type.group === 'base') {
      ids = ids.filter(function (selectedId) { return !BASE_FAN_IDS.has(selectedId); });
      ids.push(id);
    } else {
      const pos = ids.indexOf(id);
      if (pos >= 0) ids.splice(pos, 1); else ids.push(id);
    }
    state.winFanIds = ids;
    state.fanGroups = buildFanGroups(ids);
    previewWin();
    renderWinModal();
  }

  function confirmWin() {
    const pv = state.winFanPreview;
    if (!pv || !pv.amountPerPayer) { alert('请先选择番型'); return; }
    const payerIndices = state.winPayers.map(function (v, i) { return v ? i : -1; }).filter(function (i) { return i >= 0; });
    if (!payerIndices.length) { alert('请至少选择一个付款者'); return; }
    const entry = createTransferEntry({
      type: 'win', receiver: state.winReceiver, payers: payerIndices,
      amountPerPayer: pv.amountPerPayer, label: '胡牌 · ' + pv.label + ' · ' + pv.fan + '番',
    });
    const next = clone(state.game);
    applySichuanEntry(next, entry);
    state.game = next;
    saveGame();
    state.showWin = false;
    renderBoard();
    renderWinModal();
  }

  // ============ 杠分弹窗 ============
  function openGang() {
    Object.assign(state, { showGang: true, gangReceiver: 0, gangAmount: '' });
    renderGangModal();
  }

  function renderGangModal() {
    const overlay = $('scGangOverlay');
    if (!state.showGang) { overlay.classList.remove('active'); return; }
    const amount = Math.max(0, Number(state.gangAmount) || 0);
    $('scGangBody').innerHTML = ''
      + '<div class="modal-title">杠分</div>'
      + '<div class="label">杠牌者</div>'
      + '<div class="seg-group seg-one-line player-select-row">' + state.game.players.map(function (p, i) {
        return '<div class="seg-btn' + (state.gangReceiver === i ? ' active' : '') + '" data-gangreceiver="' + i + '">' + SEATS[i] + ' · ' + esc(p.name) + '</div>';
      }).join('') + '</div>'
      + '<div class="label">每人支付金额</div>'
      + '<input class="sichuan-input" id="scGangAmount" type="number" inputmode="numeric" placeholder="输入金额" value="' + esc(state.gangAmount) + '">'
      + (amount > 0 ? '<div class="settlement-preview">预计收入 ' + amount * 3 + ' 分</div>' : '')
      + '<div class="modal-actions"><button class="btn btn-secondary" id="scGangClose">取消</button>'
      + '<button class="btn" id="scGangConfirm">确认</button></div>';
    overlay.classList.add('active');
  }

  function confirmGang() {
    const amount = Math.max(0, Number(state.gangAmount) || 0);
    if (amount <= 0) { alert('请输入有效金额'); return; }
    const payers = state.game.players.map(function (_, i) { return i; }).filter(function (i) { return i !== state.gangReceiver; });
    const entry = createTransferEntry({
      type: 'gang', receiver: state.gangReceiver, payers,
      amountPerPayer: amount, label: '杠分 · ' + amount + '分/人',
    });
    const next = clone(state.game);
    applySichuanEntry(next, entry);
    state.game = next;
    saveGame();
    state.showGang = false;
    renderBoard();
    renderGangModal();
  }

  // ============ 罚分弹窗 ============
  function openPenalty() {
    Object.assign(state, {
      showPenalty: true, penaltyPayer: 0, penaltyReceivers: [false, true, true, true],
      penaltyReceiverCount: 3, penaltyTypeId: 'huazhu', penaltyType: SICHUAN_PENALTY_TYPES[0], penaltyAmount: '',
    });
    renderPenaltyModal();
  }

  function renderPenaltyModal() {
    const overlay = $('scPenaltyOverlay');
    if (!state.showPenalty) { overlay.classList.remove('active'); return; }
    const amount = Math.max(0, Number(state.penaltyAmount) || 0);
    const t = state.penaltyType;
    $('scPenaltyBody').innerHTML = ''
      + '<div class="modal-close" id="scPenaltyClose">✕</div>'
      + '<div class="modal-title">罚分</div>'
      + '<div class="label">谁送分</div>'
      + '<div class="seg-group seg-one-line player-select-row">' + state.game.players.map(function (p, i) {
        return '<div class="seg-btn' + (state.penaltyPayer === i ? ' active' : '') + '" data-penpayer="' + i + '">' + SEATS[i] + ' · ' + esc(p.name) + '</div>';
      }).join('') + '</div>'
      + '<div class="label">谁收分（可多选）</div>'
      + '<div class="seg-group seg-one-line player-select-row">' + state.game.players.map(function (p, i) {
        if (i === state.penaltyPayer) return '';
        return '<div class="seg-btn' + (state.penaltyReceivers[i] ? ' active' : '') + '" data-penreceiver="' + i + '">' + SEATS[i] + ' · ' + esc(p.name) + '</div>';
      }).join('') + '</div>'
      + '<div class="label">罚分情况</div>'
      + '<div class="penalty-type-grid">' + SICHUAN_PENALTY_TYPES.map(function (type) {
        return '<div class="seg-btn penalty-type-btn' + (state.penaltyTypeId === type.id ? ' active' : '') + '" data-pentype="' + type.id + '">' + esc(type.name) + '</div>';
      }).join('') + '</div>'
      + '<div class="penalty-rule-card">'
      + '<div class="penalty-rule-title">' + esc(t.name) + '：什么时候罚</div>'
      + '<div class="penalty-rule-text">' + esc(t.situation) + '</div>'
      + '<div class="penalty-rule-title">如何罚</div>'
      + '<div class="penalty-rule-text">' + esc(t.rule) + '</div>'
      + '<div class="penalty-rule-note">川麻地区规则差异较大，实际金额以开局约定为准。</div></div>'
      + '<div class="label">每位收分玩家获得</div>'
      + '<input class="sichuan-input" id="scPenaltyAmount" type="number" inputmode="numeric" placeholder="输入罚分金额" value="' + esc(state.penaltyAmount) + '">'
      + (state.penaltyAmount && state.penaltyReceiverCount ? '<div class="settlement-preview">' + esc(state.penaltyPayer >= 0 ? SEATS[state.penaltyPayer] : '') + ' 共支付 ' + amount * state.penaltyReceiverCount + ' 分</div>' : '')
      + '<div class="modal-actions"><button class="btn btn-secondary" id="scPenaltyCancel">取消</button>'
      + '<button class="btn" id="scPenaltyConfirm">确认罚分</button></div>';
    overlay.classList.add('active');
  }

  function confirmPenalty() {
    const amount = Math.max(0, Number(state.penaltyAmount) || 0);
    if (!state.penaltyReceiverCount) { alert('请至少选择一个收分玩家'); return; }
    if (amount <= 0) { alert('请输入有效罚分金额'); return; }
    const receivers = state.penaltyReceivers.map(function (v, i) { return v ? i : -1; }).filter(function (i) { return i >= 0; });
    const next = clone(state.game);
    receivers.forEach(function (receiver) {
      const entry = createTransferEntry({
        type: 'penalty', receiver, payers: [state.penaltyPayer],
        amountPerPayer: amount, label: '罚分 · ' + state.penaltyType.name + ' · ' + amount + '分',
      });
      applySichuanEntry(next, entry);
    });
    state.game = next;
    saveGame();
    state.showPenalty = false;
    renderBoard();
    renderPenaltyModal();
  }

  // ============ 玩家设置弹窗 ============
  function openSetup(index) {
    const player = state.game.players[index];
    if (!player) return;
    Object.assign(state, {
      showSetup: true, setupPlayerIndex: index, setupName: player.name, setupMissingSuit: player.missingSuit || '',
    });
    renderSetupModal();
  }

  function renderSetupModal() {
    const overlay = $('scSetupOverlay');
    if (!state.showSetup) { overlay.classList.remove('active'); return; }
    $('scSetupBody').innerHTML = ''
      + '<div class="modal-title">设置' + SEATS[state.setupPlayerIndex] + '家</div>'
      + '<div class="label">玩家姓名</div>'
      + '<input class="setup-name-input sichuan-serif-input" id="scSetupName" maxlength="12" placeholder="玩家姓名" value="' + esc(state.setupName) + '">'
      + '<div class="label">定缺</div>'
      + '<div class="seg-group seg-one-line setup-suit-options">'
      + [['none', '未定'], ['m', '缺万'], ['p', '缺筒'], ['s', '缺索']].map(function (pair) {
        const value = pair[0] === 'none' ? '' : pair[0];
        return '<div class="seg-btn' + (state.setupMissingSuit === value ? ' active' : '') + '" data-suit="' + pair[0] + '">' + pair[1] + '</div>';
      }).join('') + '</div>'
      + '<div class="modal-actions setup-modal-actions">'
      + '<button class="btn btn-secondary" id="scSetupClose">取消</button>'
      + '<button class="btn" id="scSetupConfirm">保存</button></div>';
    overlay.classList.add('active');
  }

  function confirmSetup() {
    const index = state.setupPlayerIndex;
    const name = state.setupName.trim();
    if (!name) { alert('请填写玩家姓名'); return; }
    const next = clone(state.game);
    const player = next.players[index];
    if (!player) return;
    player.name = name;
    player.missingSuit = state.setupMissingSuit || '';
    state.game = next;
    saveGame();
    state.showSetup = false;
    renderBoard();
    renderSetupModal();
  }

  // ============ 历史弹窗 ============
  function openHistory() {
    const game = state.game;
    state.historyList = (game.history || []).map(function (entry, idx) {
      const r = SEATS[entry.receiver] || '?';
      const payers = (entry.payers || []).map(function (i) { return SEATS[i] || '?'; }).join('、');
      const a = entry.amountPerPayer || 0;
      const total = (entry.deltas || []).filter(function (d) { return d > 0; }).reduce(function (s, d) { return s + d; }, 0);
      let label = '';
      if (entry.type === 'win') label = r + ' 胡牌 [' + entry.label + '] · ' + a + '分/人 · 收自 ' + payers;
      else if (entry.type === 'gang') label = r + ' 杠分 · ' + a + '分/人 · 收自 ' + payers;
      else if (entry.type === 'penalty') label = r + ' 收罚分 · ' + a + '分 · 来自 ' + payers;
      else label = r + ' · ' + a + '分/人 · ' + payers;
      return {
        index: game.history.length - idx,
        type: entry.type === 'win' ? '胡' : entry.type === 'gang' ? '杠' : '罚',
        amount: total, label,
      };
    });
    state.showHistory = true;
    renderHistoryModal();
  }

  function renderHistoryModal() {
    const overlay = $('scHistoryOverlay');
    if (!state.showHistory) { overlay.classList.remove('active'); return; }
    const items = state.historyList;
    $('scHistoryBody').innerHTML = ''
      + '<div class="modal-close" id="scHistoryClose">✕</div>'
      + '<div class="modal-title">对局记录</div>'
      + (items.length
        ? items.map(function (item) {
          return '<div class="history-item"><span class="history-type type-' + esc(item.type) + '">' + esc(item.type) + '</span>'
            + '#' + item.index + ' · ' + esc(item.label) + ' · <b>' + (item.amount > 0 ? '+' : '') + item.amount + '</b></div>';
        }).join('')
        : '<div class="history-item">暂无记录</div>')
      + '<div class="modal-actions"><button class="btn btn-secondary" id="scHistoryCloseBtn">关闭</button></div>';
    overlay.classList.add('active');
  }

  // ============ 撤销 / 重置 ============
  function undo() {
    if (!state.game.history || !state.game.history.length) { alert('没有可撤销的操作'); return; }
    const next = clone(state.game);
    undoSichuanEntry(next);
    state.game = next;
    saveGame();
    renderBoard();
  }

  function resetGame() {
    if (!confirm('重置整场：所有分数和记录都将清空。确定？')) return;
    state.game = createSichuanGame();
    saveGame();
    renderBoard();
  }

  // ============ 长按查看番型示例 ============
  let longPressFired = false;
  function bindLongPress(el, handler) {
    let timer = null;
    el.addEventListener('touchstart', function (e) {
      const target = e.target.closest('[data-fan]');
      if (!target) return;
      timer = setTimeout(function () { longPressFired = true; handler(target.dataset.fan); }, 500);
    }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function (evt) {
      el.addEventListener(evt, function () { if (timer) { clearTimeout(timer); timer = null; } }, { passive: true });
    });
    el.addEventListener('contextmenu', function (e) {
      const target = e.target.closest('[data-fan]');
      if (!target) return;
      e.preventDefault();
      handler(target.dataset.fan);
    });
  }

  function showFanExample(id) {
    let target = null;
    state.fanGroups.some(function (group) {
      target = group.types.find(function (type) { return type.id === id; }) || null;
      return !!target;
    });
    if (!target) return;
    state.fanExample = target;
    state.showFanExample = true;
    const t = target;
    $('scFanExampleBody').innerHTML = ''
      + '<div class="modal-title">' + esc(t.name) + ' · ' + t.fan + '番</div>'
      + '<div class="fan-example-text">' + esc(t.exampleText) + '</div>'
      + (t.exampleImages && t.exampleImages.length
        ? '<div class="fan-example-tiles">' + t.exampleImages.map(function (img) {
          return '<img class="fan-example-tile' + (img.isHaku ? ' haku-tile' : '') + '" src="' + img.src + '" alt="">';
        }).join('') + '</div>'
        : '<div class="fan-example-note">这是和牌时机或附加条件，不对应固定手牌结构。</div>')
      + '<button class="btn btn-secondary fan-example-close" id="scFanExampleClose">知道了</button>';
    $('scFanExampleOverlay').classList.add('active');
  }

  function closeFanExample() {
    state.showFanExample = false;
    state.fanExample = null;
    $('scFanExampleOverlay').classList.remove('active');
  }

  // ============ 事件 ============
  function init() {
    loadGame();
    renderBoard();

    $('scBoard').addEventListener('click', function (e) {
      const card = e.target.closest('.player-card[data-index]');
      if (card) openSetup(Number(card.dataset.index));
    });
    $('scOpenWin').addEventListener('click', openWin);
    $('scOpenGang').addEventListener('click', openGang);
    $('scOpenPenalty').addEventListener('click', openPenalty);
    $('scUndo').addEventListener('click', undo);
    $('scHistory').addEventListener('click', openHistory);
    $('scReset').addEventListener('click', resetGame);

    // 胡牌弹窗（事件委托）
    $('scWinBody').addEventListener('click', function (e) {
      const receiver = e.target.closest('[data-receiver]');
      if (receiver) {
        state.winReceiver = Number(receiver.dataset.receiver);
        state.winPayers = [false, false, false, false];
        state.winPayerCount = 0;
        previewWin(); renderWinModal(); return;
      }
      const payer = e.target.closest('[data-payer]');
      if (payer) {
        const idx = Number(payer.dataset.payer);
        if (idx === state.winReceiver) return;
        state.winPayers[idx] = !state.winPayers[idx];
        state.winPayerCount = state.winPayers.filter(Boolean).length;
        previewWin(); renderWinModal(); return;
      }
      const fan = e.target.closest('[data-fan]');
      if (fan) {
        if (longPressFired) { longPressFired = false; return; } // 长按已弹出示例，忽略其后续 click
        toggleWinFan(fan.dataset.fan); return;
      }
      const root = e.target.closest('[data-root]');
      if (root) { state.winRootCount = Number(root.dataset.root); previewWin(); renderWinModal(); return; }
      const base = e.target.closest('[data-basescore]');
      if (base) { state.winBaseScore = Number(base.dataset.basescore); previewWin(); renderWinModal(); return; }
      const cap = e.target.closest('[data-fancap]');
      if (cap) { state.winFanCap = Number(cap.dataset.fancap); previewWin(); renderWinModal(); return; }
      if (e.target.id === 'scWinClose') { state.showWin = false; renderWinModal(); return; }
      if (e.target.id === 'scWinConfirm') confirmWin();
    });
    bindLongPress($('scWinBody'), showFanExample);

    // 杠分弹窗
    $('scGangBody').addEventListener('click', function (e) {
      const receiver = e.target.closest('[data-gangreceiver]');
      if (receiver) { state.gangReceiver = Number(receiver.dataset.gangreceiver); renderGangModal(); return; }
      if (e.target.id === 'scGangClose') { state.showGang = false; renderGangModal(); return; }
      if (e.target.id === 'scGangConfirm') confirmGang();
    });
    $('scGangBody').addEventListener('input', function (e) {
      if (e.target.id === 'scGangAmount') { state.gangAmount = e.target.value; renderGangModal(); }
    });

    // 罚分弹窗
    $('scPenaltyBody').addEventListener('click', function (e) {
      if (e.target.id === 'scPenaltyClose' || e.target.id === 'scPenaltyCancel') { state.showPenalty = false; renderPenaltyModal(); return; }
      const payer = e.target.closest('[data-penpayer]');
      if (payer) {
        const idx = Number(payer.dataset.penpayer);
        state.penaltyPayer = idx;
        state.penaltyReceivers = [true, true, true, true];
        state.penaltyReceivers[idx] = false;
        state.penaltyReceiverCount = 3;
        renderPenaltyModal(); return;
      }
      const receiver = e.target.closest('[data-penreceiver]');
      if (receiver) {
        const idx = Number(receiver.dataset.penreceiver);
        if (idx === state.penaltyPayer) return;
        state.penaltyReceivers[idx] = !state.penaltyReceivers[idx];
        state.penaltyReceiverCount = state.penaltyReceivers.filter(Boolean).length;
        renderPenaltyModal(); return;
      }
      const type = e.target.closest('[data-pentype]');
      if (type) {
        state.penaltyType = SICHUAN_PENALTY_TYPES.find(function (t) { return t.id === type.dataset.pentype; }) || SICHUAN_PENALTY_TYPES[0];
        state.penaltyTypeId = state.penaltyType.id;
        renderPenaltyModal(); return;
      }
      if (e.target.id === 'scPenaltyConfirm') confirmPenalty();
    });
    $('scPenaltyBody').addEventListener('input', function (e) {
      if (e.target.id === 'scPenaltyAmount') { state.penaltyAmount = e.target.value; renderPenaltyModal(); }
    });

    // 玩家设置弹窗
    $('scSetupBody').addEventListener('click', function (e) {
      const suit = e.target.closest('[data-suit]');
      if (suit) {
        state.setupMissingSuit = suit.dataset.suit === 'none' ? '' : suit.dataset.suit;
        renderSetupModal(); return;
      }
      if (e.target.id === 'scSetupClose') { state.showSetup = false; renderSetupModal(); return; }
      if (e.target.id === 'scSetupConfirm') {
        state.setupName = $('scSetupName').value;
        confirmSetup();
      }
    });
    $('scSetupBody').addEventListener('input', function (e) {
      if (e.target.id === 'scSetupName') state.setupName = e.target.value;
    });

    // 历史/番型示例
    $('scHistoryBody').addEventListener('click', function (e) {
      if (e.target.id === 'scHistoryClose' || e.target.id === 'scHistoryCloseBtn') { state.showHistory = false; renderHistoryModal(); }
    });
    $('scFanExampleBody').addEventListener('click', function (e) {
      if (e.target.id === 'scFanExampleClose') closeFanExample();
    });
    $('scFanExampleOverlay').addEventListener('click', function (e) {
      if (e.target === this) closeFanExample();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
