// pages/sichuan/index.js — 川麻积分
const {
  SICHUAN_FAN_TYPES, calculateSichuanFan, scoreFromFan,
  createSichuanGame, createTransferEntry, applySichuanEntry,
  undoSichuanEntry, setSichuanMissingSuit
} = require('../../utils/sichuan-score');
const { clone, tileSrc } = require('../../utils/shared');

const STORAGE_KEY = 'mj_sichuan_v1';
const SEATS = ['东', '南', '西', '北'];
const SUIT_LABELS = { m: '缺万', p: '缺筒', s: '缺索' };
const FAN_CAP_OPTIONS = [3, 4, 5, 6];
const BASE_SCORE_OPTIONS = [1, 2, 5, 10];

function buildFanGroups() {
  const decorate = type => Object.assign({}, type, {
    exampleImages: (type.exampleTiles || []).map((id, index) => ({ key: `${id}-${index}`, src: tileSrc(id), isHaku: id === '5z' }))
  });
  const base = SICHUAN_FAN_TYPES.filter(t => t.group === 'base').map(decorate);
  const extra = SICHUAN_FAN_TYPES.filter(t => t.group === 'extra').map(decorate);
  return [
    { label: '基础番型', types: base },
    { label: '额外番型', types: extra }
  ];
}

Page({
  data: {
    seats: SEATS,
    seatClasses: ['dong', 'nan', 'xi', 'bei'],
    game: createSichuanGame(['玩家一', '玩家二', '玩家三', '玩家四']),
    // Win modal (胡牌)
    showWin: false,
    winReceiver: 0,
    winPayers: [false, false, false, false],
    winPayerCount: 0,
    winFanIds: [],
    winRootCount: 0,
    winFanCap: 6,
    winBaseScore: 1,
    winFanPreview: null,
    fanCapOptions: FAN_CAP_OPTIONS,
    baseScoreOptions: BASE_SCORE_OPTIONS,
    // Gang modal (杠分)
    showGang: false,
    gangReceiver: 0,
    gangAmount: '',
    // Penalty modal (罚分)
    showPenalty: false,
    penaltyPlayer: 0,
    penaltyAmount: '',
    // Setup modal (设置)
    showSetup: false,
    setupNames: ['', '', '', ''],
    setupMissingSuits: ['', '', '', ''],
    // History
    showHistory: false,
    historyList: [],
    // Fan groups for display
    fanGroups: buildFanGroups(),
    showFanExample: false,
    fanExample: null
  },

  onLoad() {
    let game;
    try { game = wx.getStorageSync(STORAGE_KEY); } catch (e) {}
    if (!game || !game.players || game.players.length !== 4) {
      game = createSichuanGame(['玩家一', '玩家二', '玩家三', '玩家四']);
    }
    this.initGame(game);
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 2 });
    // tabBar 切回时同步数据
    this.saveGame(this.data.game);
  },

  initGame(game) {
    this.setData({ game });
    this.saveGame(game);
  },

  saveGame(game) {
    try { wx.setStorageSync(STORAGE_KEY, game); } catch (e) {}
  },

  // ─── Win modal ────────────────────────────────────────

  openWin() {
    this.setData({
      showWin: true,
      winReceiver: 0,
      winPayers: [false, false, false, false],
      winPayerCount: 0,
      winFanIds: [],
      winRootCount: 0,
      winFanCap: 6,
      winBaseScore: 1,
      winFanPreview: null
    });
  },

  closeWin() {
    this.setData({ showWin: false });
  },

  selectWinReceiver(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const payers = [false, false, false, false];
    this.setData({ winReceiver: idx, winPayers: payers, winPayerCount: 0 });
    this.previewWin();
  },

  toggleWinPayer(e) {
    const idx = Number(e.currentTarget.dataset.index);
    if (idx === this.data.winReceiver) return;
    const payers = this.data.winPayers.slice();
    payers[idx] = !payers[idx];
    const count = payers.filter(Boolean).length;
    this.setData({ winPayers: payers, winPayerCount: count });
    this.previewWin();
  },

  toggleWinFan(e) {
    const id = e.currentTarget.dataset.id;
    const ids = this.data.winFanIds.slice();
    const pos = ids.indexOf(id);
    if (pos >= 0) ids.splice(pos, 1);
    else ids.push(id);
    this.setData({ winFanIds: ids });
    this.previewWin();
  },

  showFanExample(e) {
    const id = e.currentTarget.dataset.id;
    let target = null;
    this.data.fanGroups.some(group => {
      target = group.types.find(type => type.id === id) || null;
      return !!target;
    });
    if (target) this.setData({ showFanExample: true, fanExample: target });
  },

  closeFanExample() {
    this.setData({ showFanExample: false, fanExample: null });
  },

  noop() {},

  setWinRootCount(e) {
    const v = Number(e.currentTarget.dataset.value);
    this.setData({ winRootCount: v });
    this.previewWin();
  },

  setWinFanCap(e) {
    const v = Number(e.currentTarget.dataset.value);
    this.setData({ winFanCap: v });
    this.previewWin();
  },

  setWinBaseScore(e) {
    const v = Number(e.currentTarget.dataset.value);
    this.setData({ winBaseScore: v });
    this.previewWin();
  },

  previewWin() {
    const { winFanIds, winRootCount, winFanCap, winBaseScore } = this.data;
    const result = calculateSichuanFan(winFanIds, winFanCap, winRootCount);
    const amount = scoreFromFan(result.fan, winBaseScore, 1, winFanCap);
    this.setData({
      winFanPreview: {
        fan: result.fan,
        label: result.label,
        rootCount: result.rootCount,
        amountPerPayer: amount,
        total: amount * this.data.winPayerCount
      }
    });
  },

  confirmWin() {
    const { game, winReceiver, winPayers, winFanPreview, winFanCap, winBaseScore } = this.data;
    if (!winFanPreview || !winFanPreview.amountPerPayer) {
      wx.showToast({ title: '请先选择番型', icon: 'none' });
      return;
    }
    const payerIndices = winPayers.map((v, i) => v ? i : -1).filter(i => i >= 0);
    if (!payerIndices.length) {
      wx.showToast({ title: '请至少选择一个付款者', icon: 'none' });
      return;
    }
    const entry = createTransferEntry({
      type: 'win',
      receiver: winReceiver,
      payers: payerIndices,
      amountPerPayer: winFanPreview.amountPerPayer,
      label: `胡牌 · ${winFanPreview.label} · ${winFanPreview.fan}番`
    });
    const next = clone(game);
    applySichuanEntry(next, entry);
    this.setData({ game: next, showWin: false });
    this.saveGame(next);
    wx.showToast({
      title: `${SEATS[winReceiver]} +${winFanPreview.total}分`,
      icon: 'success'
    });
  },

  // ─── Gang modal (杠分) ────────────────────────────────

  openGang() {
    this.setData({ showGang: true, gangReceiver: 0, gangAmount: '' });
  },

  closeGang() {
    this.setData({ showGang: false });
  },

  selectGangReceiver(e) {
    this.setData({ gangReceiver: Number(e.currentTarget.dataset.index) });
  },

  onGangAmountInput(e) {
    this.setData({ gangAmount: e.detail.value });
  },

  confirmGang() {
    const { game, gangReceiver, gangAmount } = this.data;
    const amount = Math.max(0, Number(gangAmount) || 0);
    if (amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }
    const payers = game.players.map((_, i) => i).filter(i => i !== gangReceiver);
    const entry = createTransferEntry({
      type: 'gang',
      receiver: gangReceiver,
      payers,
      amountPerPayer: amount,
      label: `杠分 · ${amount}分/人`
    });
    const next = clone(game);
    applySichuanEntry(next, entry);
    this.setData({ game: next, showGang: false });
    this.saveGame(next);
    wx.showToast({
      title: `${SEATS[gangReceiver]} +${amount * payers.length}分`,
      icon: 'success'
    });
  },

  // ─── Penalty modal (罚分) ─────────────────────────────

  openPenalty() {
    this.setData({ showPenalty: true, penaltyPlayer: 0, penaltyAmount: '' });
  },

  closePenalty() {
    this.setData({ showPenalty: false });
  },

  selectPenaltyPlayer(e) {
    this.setData({ penaltyPlayer: Number(e.currentTarget.dataset.index) });
  },

  onPenaltyAmountInput(e) {
    this.setData({ penaltyAmount: e.detail.value });
  },

  confirmPenalty() {
    const { game, penaltyPlayer, penaltyAmount } = this.data;
    const amount = Math.max(0, Number(penaltyAmount) || 0);
    if (amount <= 0) {
      wx.showToast({ title: '请输入有效罚分金额', icon: 'none' });
      return;
    }
    // Penalized player pays amount to each of the other 3 players
    const receivers = game.players.map((_, i) => i).filter(i => i !== penaltyPlayer);
    const next = clone(game);

    receivers.forEach(receiver => {
      const entry = createTransferEntry({
        type: 'penalty',
        receiver,
        payers: [penaltyPlayer],
        amountPerPayer: amount,
        label: `罚分 · ${amount}分`
      });
      applySichuanEntry(next, entry);
    });

    this.setData({ game: next, showPenalty: false });
    this.saveGame(next);
    wx.showToast({
      title: `${SEATS[penaltyPlayer]} -${amount * 3}分`,
      icon: 'none'
    });
  },

  // ─── Setup modal ──────────────────────────────────────

  openSetup() {
    const g = this.data.game;
    const names = g.players.map(p => p.name);
    const suits = g.players.map(p => p.missingSuit || '');
    this.setData({
      showSetup: true,
      setupNames: names.concat(['', '', '', '']).slice(0, 4),
      setupMissingSuits: suits.concat(['', '', '', '']).slice(0, 4)
    });
  },

  closeSetup() {
    this.setData({ showSetup: false });
  },

  onSetupNameInput(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const names = this.data.setupNames.slice();
    names[idx] = e.detail.value;
    this.setData({ setupNames: names });
  },

  setMissingSuit(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const suit = e.currentTarget.dataset.suit;
    const suits = this.data.setupMissingSuits.slice();
    suits[idx] = suits[idx] === suit ? '' : suit;
    this.setData({ setupMissingSuits: suits });
  },

  confirmSetup() {
    const names = this.data.setupNames.map(n => n.trim());
    if (names.some(n => !n)) {
      wx.showToast({ title: '请填写所有玩家姓名', icon: 'none' });
      return;
    }
    const next = clone(this.data.game);
    next.players.forEach((p, i) => {
      p.name = names[i] || '玩家';
      p.missingSuit = this.data.setupMissingSuits[i] || '';
    });
    this.setData({ game: next, showSetup: false });
    this.saveGame(next);
  },

  // ─── History ──────────────────────────────────────────

  openHistory() {
    const game = this.data.game;
    const items = (game.history || []).map((entry, idx) => {
      const r = SEATS[entry.receiver] || '?';
      const payers = (entry.payers || []).map(i => SEATS[i] || '?').join('、');
      const a = entry.amountPerPayer || 0;
      const total = (entry.deltas || []).filter(d => d > 0).reduce((s, d) => s + d, 0);
      let label = '';
      if (entry.type === 'win') label = `${r} 胡牌 [${entry.label}] · ${a}分/人 · 收自 ${payers}`;
      else if (entry.type === 'gang') label = `${r} 杠分 · ${a}分/人 · 收自 ${payers}`;
      else if (entry.type === 'penalty') label = `${r} 收罚分 · ${a}分 · 来自 ${payers}`;
      else label = `${r} · ${a}分/人 · ${payers}`;
      return {
        index: game.history.length - idx,
        type: entry.type === 'win' ? '胡' : entry.type === 'gang' ? '杠' : '罚',
        receiver: r,
        receiverName: game.players[entry.receiver] ? game.players[entry.receiver].name : '?',
        amount: total,
        label
      };
    });
    this.setData({ showHistory: true, historyList: items });
  },

  closeHistory() {
    this.setData({ showHistory: false });
  },

  // ─── Toolbar ──────────────────────────────────────────

  undo() {
    const { game } = this.data;
    if (!game.history || !game.history.length) {
      wx.showToast({ title: '没有可撤销的操作', icon: 'none' });
      return;
    }
    const next = clone(game);
    undoSichuanEntry(next);
    this.setData({ game: next });
    this.saveGame(next);
    wx.showToast({ title: '已撤销', icon: 'success' });
  },

  resetGame() {
    wx.showModal({
      title: '重置整场',
      content: '所有分数和记录都将清空。',
      success: res => {
        if (!res.confirm) return;
        const game = createSichuanGame();
        this.initGame(game);
      }
    });
  },

  // ─── Overlay tap ──────────────────────────────────────

  handleOverlayTap(e) {
    if (e.target === e.currentTarget) {
      const id = e.currentTarget.dataset.id;
      if (id) this.setData({ [id]: false });
    }
  },
});
