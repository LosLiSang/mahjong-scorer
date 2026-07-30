// pages/index/index.js — 日麻计分器（四麻 + 三麻）
const Shared = require('../../utils/shared');
const Logic = require('../../utils/mahjong-logic');
const Game = require('../../utils/game-engine');

const MELD_MODES = {
  shuntsu: [{ key:'closed', label:'门前' }, { key:'open', label:'副露' }],
  koutsu: [
    { key:'ankou', label:'暗刻' }, { key:'minkou', label:'明刻' },
    { key:'ankan', label:'暗杠' }, { key:'minkan', label:'明杠' }
  ]
};

const CONDITION_DEFS = [
  { key:'isIppatsu', label:'一发' },
  { key:'isLastTileTsumo', label:'海底摸月' },
  { key:'isLastTileRon', label:'河底捞鱼' },
  { key:'isRobbingKan', label:'抢杠' },
  { key:'isWinFromDeadWall', label:'岭上开花' }
];

const FU_OPTIONS = [20,25,30,40,50,60,70,80,90,100,110];
const HAN_OPTIONS = Array.from({ length: 13 }, (_, i) => ({ value: i + 1, label: `${i + 1}翻` }));

function buildPlayerViews(game) {
  const classMap = { '东': 'dong', '南': 'nan', '西': 'xi', '北': 'bei' };
  return game.players.map((player, index) => {
    const seat = Game.seatOf(game, index);
    return Object.assign({}, player, { index, seat, seatClass: classMap[seat] });
  });
}

function defaultWin(game) {
  const winnerIdx = game.dealerIndex;
  const count = game.playerCount || 4;
  return {
    winnerIdx, loserIdx: (winnerIdx + 1) % count, isTsumo: false,
    winTile: null, han: 3, fu: 30,
    riichiState: game.players[winnerIdx].riichi ? 'riichi' : 'none',
    doraIndicators: [], uraDoraIndicators: [],
    conditions: Shared.emptyConditions(),
    northCount: 0
  };
}

Page({
  copyContact() {
    wx.setClipboardData({
      data: 'lisangcode@outlook.com',
      success: () => wx.showToast({ title: '邮箱已复制', icon: 'success' })
    });
  },


  data: {
    seats: { 3: Game.SEATS_3P, 4: Game.SEATS_4P },
    game: Game.newGame(4),
    playerViews: buildPlayerViews(Game.newGame(4)),
    roundName: '',
    // win modal
    showWin: false,
    hand: [], handDisplay: [], handHistory: [], win: null,
    winTileOptions: [], winTileName: '未选择',
    tileRows: [], doraTiles: [], uraTiles: [],
    showDora: false, showUra: false,
    // analysis
    analysisStage: 0, analysisMessage: '', analysisResult: null,
    melds: [], decompositions: [], decompIndex: 0,
    conditions: [],
    // preview
    previewTotal: 0, previewBreakdown: '',
    fuOptions: FU_OPTIONS.map(f => ({ value: f, label: f + '符' })),
    fuIndex: 2, // 30符
    hanOptions: HAN_OPTIONS,
    hanIndex: 2, // 3翻
    // modals
    showRiichi: false, riichiSelected: [],
    showDraw: false, tenpaiSelected: [],
    showHistory: false,
    showSetup: false, setupMode: 4, setupNames: ['','','',''],
    undoStack: []
  },

  onLoad() {
    let game;
    try { game = wx.getStorageSync('mj_game_v2'); } catch(e) {}
    if (!game || !game.players || ![3,4].includes(game.players.length)) {
      game = Game.newGame(4);
    }
    // normalize
    game.playerCount = game.players.length;
    game.mode = game.playerCount === 3 ? 'sanma' : 'yonma';
    if (!game.sanmaTsumoRule) game.sanmaTsumoRule = 'loss';
    if (!game.history) game.history = [];
    this.initGame(game);
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 0 });
    // tabBar 切回时重新从 storage 加载，确保数据同步
    if (!this.data.game || !this.data.game.players) return;
    this.saveGame(this.data.game);
  },

  initGame(game) {
    const rn = Game.roundNames(game);
    this.setData({
      game,
      playerViews: buildPlayerViews(game),
      roundName: rn[game.roundIndex] || `第${game.roundIndex + 1}局`,
      undoStack: []
    });
    this.saveGame(game);
  },

  saveGame(game) {
    try { wx.setStorageSync('mj_game_v2', game); } catch(e) {}
  },

  seatsFor(pIdx) {
    const g = this.data.game;
    return Game.seatOf(g, pIdx);
  },

  snapshot() {
    const stack = (this.data.undoStack || []).concat([Shared.clone(this.data.game)]).slice(-30);
    this.setData({ undoStack: stack });
  },

  undo() {
    const stack = this.data.undoStack.slice();
    if (!stack.length) { wx.showToast({ title: '没有可撤销操作', icon: 'none' }); return; }
    const game = stack.pop();
    const rn = Game.roundNames(game);
    this.setData({ undoStack: stack, game, playerViews: buildPlayerViews(game), roundName: rn[game.roundIndex] || `第${game.roundIndex + 1}局` });
    this.saveGame(game);
  },

  resetGame() {
    wx.showModal({ title: '重置整场', content: '所有点数和记录都会清空。', success: res => {
      if (!res.confirm) return;
      const game = Game.newGame(this.data.game.playerCount || 4);
      this.initGame(game);
    }});
  },

  openPlayerSetup() {
    const g = this.data.game;
    const names = g.players.map(p => p.name);
    this.setData({ showSetup: true, setupMode: g.playerCount || 4, setupNames: names.concat(['','','','']).slice(0,4) });
  },
  closeSetup() { this.setData({ showSetup: false }); },
  selectPlayerCount(e) {
    const count = Number(e.currentTarget.dataset.count);
    this.setData({ setupMode: count });
  },
  onSetupNameInput(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const names = this.data.setupNames.slice();
    names[idx] = e.detail.value;
    this.setData({ setupNames: names });
  },
  confirmSetup() {
    const count = this.data.setupMode;
    const names = this.data.setupNames.slice(0, count).map(n => n.trim());
    if (names.some(n => !n)) {
      wx.showToast({ title: '请填写所有玩家姓名', icon: 'none' });
      return;
    }
    const game = Game.newGame(count);
    game.players.forEach((p, i) => { p.name = names[i] || '玩家'; });

    // 保留旧存档的名字（如果存在的话，且模式不变）
    const old = this.data.game;
    if (old && old.playerCount === count) {
      game.honba = old.honba;
      game.roundIndex = old.roundIndex;
      game.dealerIndex = old.dealerIndex;
      game.riichiSticks = old.riichiSticks;
      game.history = old.history;
      game.players.forEach((p, i) => {
        p.name = names[i];
        p.points = old.players[i] ? old.players[i].points : p.points;
        p.riichi = old.players[i] ? old.players[i].riichi : false;
      });
    }
    this.setData({ showSetup: false });
    this.initGame(game);
  },

  onPlayerTap(e) {
    // 点击任意玩家卡片打开设置面板
    this.setData({ showSetup: true, setupMode: this.data.game.playerCount || 4,
      setupNames: this.data.game.players.map(p => p.name) });
  },

  // ===== 和牌面板 =====
  openWin() {
    const g = this.data.game;
    const win = defaultWin(g);
    this.setData({
      showWin: true, win, hand: [], handHistory: [],
      analysisStage: 0, analysisMessage: '', analysisResult: null,
      melds: [], decompositions: [], decompIndex: 0,
      showDora: false, showUra: false,
      previewTotal: 0, previewBreakdown: '', fuIndex: 2, hanIndex: 2
    });
    this.refreshTiles();
    this.refreshConditions();
  },
  closeWin() { this.setData({ showWin: false, analysisStage: 0, melds: [], decompositions: [] }); },

  selectWinner(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const win = Shared.clone(this.data.win);
    win.winnerIdx = idx;
    if (win.loserIdx === idx) win.loserIdx = (idx + 1) % (this.data.game.playerCount || 4);
    win.riichiState = this.data.game.players[idx].riichi ? 'riichi' : 'none';
    win.conditions.isIppatsu = false;
    this.setData({ win, analysisStage: 0, analysisResult: null, analysisMessage: '和牌者已修改，请重新分析' });
    this.refreshConditions();
    this.previewWinCalc();
  },
  selectLoser(e) {
    const win = Shared.clone(this.data.win);
    win.loserIdx = Number(e.currentTarget.dataset.index);
    this.setData({ win, analysisResult: null });
    this.previewWinCalc();
  },
  selectWinType(e) {
    const isTsumo = e.currentTarget.dataset.value === 'tsumo';
    const win = Shared.clone(this.data.win);
    win.isTsumo = isTsumo;
    if (isTsumo) { win.conditions.isLastTileRon = false; win.conditions.isRobbingKan = false; }
    else { win.conditions.isLastTileTsumo = false; win.conditions.isWinFromDeadWall = false; }
    this.setData({ win, analysisResult: null, analysisMessage: this.data.analysisStage ? '和牌方式已修改，请重新分析' : '' });
    this.refreshConditions();
    this.previewWinCalc();
  },
  selectRiichiState(e) {
    const value = e.currentTarget.dataset.value;
    const win = Shared.clone(this.data.win);
    win.riichiState = value;
    if (value === 'none') win.conditions.isIppatsu = false;
    this.setData({ win, analysisResult: null, analysisMessage: this.data.analysisStage ? '立直状态已修改，请重新分析' : '' });
    this.refreshConditions();
  },
  selectNorthCount(e) {
    const count = Number(e.currentTarget.dataset.count);
    const win = Shared.clone(this.data.win);
    win.northCount = count;
    this.setData({ win });
  },

  // ===== 选牌 =====
  addTile(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.hand.filter(t => t === id).length >= 4) return;
    const hand = this.data.hand.concat(id).sort(Shared.compareTile);
    this.setData({ hand, handHistory: this.data.handHistory.concat(id) });
    this.invalidateAnalysis();
    this.refreshTiles();
    this.previewWinCalc();
  },
  removeTile(e) {
    const index = Number(e.currentTarget.dataset.index);
    const hand = this.data.hand.slice();
    hand.splice(index, 1);
    const win = Shared.clone(this.data.win);
    if (win.winTile && !hand.includes(win.winTile)) win.winTile = null;
    this.setData({ hand, win });
    this.invalidateAnalysis();
    this.refreshTiles();
    this.previewWinCalc();
  },
  clearHand() {
    this.setData({ hand: [], handHistory: [], 'win.winTile': null, previewTotal: 0, previewBreakdown: '' });
    this.invalidateAnalysis();
    this.refreshTiles();
  },
  undoTile() {
    const history = this.data.handHistory.slice();
    const id = history.pop();
    if (!id) return;
    const hand = this.data.hand.slice();
    const index = hand.lastIndexOf(id);
    if (index >= 0) hand.splice(index, 1);
    const win = Shared.clone(this.data.win);
    if (win.winTile && !hand.includes(win.winTile)) win.winTile = null;
    this.setData({ hand, handHistory: history, win });
    this.invalidateAnalysis();
    this.refreshTiles();
    this.previewWinCalc();
  },
  selectWinTile(e) {
    const win = Shared.clone(this.data.win);
    win.winTile = e.currentTarget.dataset.id;
    this.setData({ win });
    this.invalidateAnalysis();
    this.refreshTiles();
    this.previewWinCalc();
  },

  // ===== 宝牌 =====
  toggleFold(e) { const key = e.currentTarget.dataset.key; this.setData({ [key]: !this.data[key] }); },
  toggleDora(e) {
    const id = e.currentTarget.dataset.id;
    const field = e.currentTarget.dataset.kind === 'dora' ? 'doraIndicators' : 'uraDoraIndicators';
    const win = Shared.clone(this.data.win);
    const arr = win[field].slice();
    const idx = arr.indexOf(id);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(id);
    win[field] = arr;
    this.setData({ win, analysisResult: null });
    this.refreshTiles();
  },

  // ===== 分析 =====
  invalidateAnalysis() {
    this.setData({ analysisStage: 0, analysisResult: null, analysisMessage: '', melds: [], decompositions: [], decompIndex: 0 });
  },

  buildDecompositions() {
    const counts = Logic.countTiles(this.data.hand);
    const kanIds = new Set(Object.keys(counts).filter(id => counts[id] === 4));
    return Logic.decompose(counts, new Set(), kanIds);
  },

  buildMelds(decomp) {
    return decomp.mentsus.map(m => {
      const baseType = m.type === 'kantsu' ? 'koutsu' : m.type;
      const mode = m.type === 'kantsu' ? 'ankan' : baseType === 'shuntsu' ? 'closed' : 'ankou';
      return this.decorateMeld({ tiles: m.type === 'kantsu' ? m.tiles.slice(0,3) : m.tiles.slice(), baseType, mode });
    });
  },

  decorateMeld(meld) {
    const isKan = meld.mode === 'ankan' || meld.mode === 'minkan';
    const ids = isKan ? meld.tiles.concat(meld.tiles[0]) : meld.tiles;
    return Object.assign({}, meld, {
      modes: MELD_MODES[meld.baseType],
      displayTiles: ids.map((id, idx) => ({
        key: `${id}-${idx}`, id, src: Shared.tileSrc(id), isHaku: id === '5z'
      }))
    });
  },

  setMeldMode(e) {
    const idx = Number(e.currentTarget.dataset.meldIdx);
    const melds = Shared.clone(this.data.melds);
    if (idx >= melds.length) return;
    melds[idx].mode = e.currentTarget.dataset.mode;
    melds[idx] = this.decorateMeld(melds[idx]);
    this.setData({ melds, analysisResult: null, analysisMessage: '面子状态已修改，请重新分析' });
  },

  getOpenMelds() {
    return this.data.melds.filter(m => m.mode === 'open' || m.mode === 'minkou' || m.mode === 'minkan').map(m => ({
      type: m.mode === 'minkan' ? 'kantsu' : m.baseType,
      tiles: m.mode === 'minkan' ? [m.tiles[0],m.tiles[0],m.tiles[0],m.tiles[0]] : m.tiles.slice(),
      open: true
    }));
  },

  getClosedKans() {
    return this.data.melds.filter(m => m.mode === 'ankan').map(m => m.tiles[0]);
  },

  countDora() {
    let count = 0;
    // 手牌中的 dora
    this.data.win.doraIndicators.forEach(ind => {
      const d = Shared.nextDora(ind);
      count += this.data.hand.filter(t => t === d).length;
    });
    // 副露面子中的 dora
    this.data.melds.forEach(m => {
      const tiles = m.tiles || [];
      this.data.win.doraIndicators.forEach(ind => {
        const d = Shared.nextDora(ind);
        count += tiles.filter(t => t === d).length;
      });
    });
    if (this.data.win.riichiState !== 'none') {
      this.data.win.uraDoraIndicators.forEach(ind => {
        const d = Shared.nextDora(ind);
        count += this.data.hand.filter(t => t === d).length;
      });
      this.data.melds.forEach(m => {
        const tiles = m.tiles || [];
        this.data.win.uraDoraIndicators.forEach(ind => {
          const d = Shared.nextDora(ind);
          count += tiles.filter(t => t === d).length;
        });
      });
    }
    return count;
  },

  analysisParams() {
    const openMentsus = this.getOpenMelds();
    const c = this.data.win.conditions;
    const g = this.data.game;
    return {
      tiles: this.data.hand.slice(),
      isOpened: openMentsus.length > 0,
      openMentsus,
      closedKantsus: this.getClosedKans(),
      isTsumo: this.data.win.isTsumo,
      isRiichi: this.data.win.riichiState === 'riichi',
      isDoubleRiichi: this.data.win.riichiState === 'double',
      isIppatsu: c.isIppatsu, isRobbingKan: c.isRobbingKan,
      isWinFromDeadWall: c.isWinFromDeadWall,
      isLastTile: this.data.win.isTsumo ? c.isLastTileTsumo : c.isLastTileRon,
      winTile: this.data.win.winTile,
      roundWind: Game.roundWindTile(g),
      seatWind: Game.seatWindTile(g, this.data.win.winnerIdx),
      doraCount: this.countDora(),
      akadoraCount: 0,
      northCount: this.data.win.northCount || 0
    };
  },

  analyzeHand() {
    const hand = this.data.hand;
    if (hand.length < 14 || hand.length > 18) {
      return this.setData({ analysisMessage: '请先选好 14-18 张牌。', analysisResult: null });
    }
    if (!this.data.win.winTile) {
      return this.setData({ analysisMessage: '请先选择最终和牌张。', analysisResult: null });
    }

    let decompositions = this.data.decompositions;
    let melds = this.data.melds;
    if (!this.data.analysisStage) {
      decompositions = this.buildDecompositions();
      melds = decompositions.length ? this.buildMelds(decompositions[0]) : [];
      this.setData({ analysisStage: 1, decompositions, melds }, () => {
        this.refreshConditions();
        this.analyzeHand();
      });
      return;
    }

    const result = Logic.evaluateHand(this.analysisParams());
    if (!result.valid) {
      return this.setData({
        analysisMessage: `无法成立和牌：${result.error || '没有役'}。请修正后重新分析。`,
        analysisResult: null
      });
    }

    const han = result.isYakuman ? 13 : result.han;
    const fu = result.fu || 30;
    const payment = Game.calcWinPayments(
      this.data.game, this.data.win.winnerIdx, han, fu,
      this.data.win.isTsumo, this.data.win.loserIdx, result.basePoint
    );

    const waitNames = { ryanmen: '两面', kanchan: '嵌张', penchan: '边张', tanki: '单骑', shanpon: '双碰' };
    const condNames = [];
    if (this.data.win.riichiState === 'riichi') condNames.push('立直');
    if (this.data.win.riichiState === 'double') condNames.push('两立直');
    CONDITION_DEFS.forEach(d => { if (this.data.win.conditions[d.key]) condNames.push(d.label); });

    const seats = this.data.game.playerCount === 3 ? Game.SEATS_3P : Game.SEATS_4P; // display labels
    const ar = {
      title: '牌型分析结果',
      typeName: result.type === 'chiitoi' ? '七对子' : result.type === 'kokushi' ? '国士无双' : '四面子一雀头',
      waitName: waitNames[result.waitType] || '—',
      closedName: this.getOpenMelds().length ? '副露' : '门前',
      conditionText: condNames.join('、') || '无特殊条件',
      yakuText: result.yaku.map(y => y.yakuman ? `${y.name}（${y.yakuman}倍役满）` : `${y.name} ${y.han || ''}番`).join('、'),
      doraCount: this.countDora(),
      scoreText: result.isYakuman ? `${result.yakumanCount || 1}倍役满 · ${payment.total}点` : `${han}番 ${fu}符 · ${payment.total}点`,
      payments: payment.payments.map(p => `${seats[p.from]} → ${seats[p.to]}：${p.amount}`),
      raw: result, payment, han, fu
    };
    this.setData({ analysisMessage: '分析完成。可调整后重新分析。', analysisResult: ar });
    this.previewWinCalc();
  },

  // ===== 条件 =====
  toggleCondition(e) {
    const key = e.currentTarget.dataset.key;
    const item = this.data.conditions.find(c => c.key === key);
    if (!item || item.disabled) return;
    const win = Shared.clone(this.data.win);
    const c = win.conditions;
    const next = !c[key];
    if (key === 'isLastTileTsumo' && next) c.isLastTileRon = false;
    if (key === 'isLastTileRon' && next) c.isLastTileTsumo = false;
    if (key === 'isRobbingKan' && next) c.isWinFromDeadWall = false;
    if (key === 'isWinFromDeadWall' && next) c.isRobbingKan = false;
    c[key] = next;
    this.setData({ win, analysisResult: null, analysisMessage: '条件已修改，请重新分析' });
    this.refreshConditions();
  },

  selectManualHan(e) {
    const win = Shared.clone(this.data.win);
    const hanIndex = Number(e.detail.value);
    win.han = this.data.hanOptions[hanIndex].value;
    this.setData({ win, hanIndex, analysisResult: null, analysisMessage: '已切换为手动翻符' });
    this.previewWinCalc();
  },
  selectFu(e) {
    this.setData({ fuIndex: Number(e.detail.value), analysisResult: null, analysisMessage: '已切换为手动翻符' });
    this.previewWinCalc();
  },

  // ===== 预览 =====
  previewWinCalc() {
    const win = this.data.win;
    const game = this.data.game;
    if (!win || !game) return;
    // 优先使用分析结果；无分析结果时用手动值
    const han = this.data.analysisResult ? this.data.analysisResult.han : (win.han || 3);
    const fu = this.data.analysisResult ? this.data.analysisResult.fu : (FU_OPTIONS[this.data.fuIndex] || 30);
    const baseOverride = this.data.analysisResult ? this.data.analysisResult.raw.basePoint : null;
    const payment = Game.calcWinPayments(game, win.winnerIdx, han, fu, win.isTsumo, win.loserIdx, baseOverride);
    const seats = this.data.game.playerCount === 3 ? Game.SEATS_3P : Game.SEATS_4P;
    this.setData({
      previewTotal: payment.total,
      previewBreakdown: payment.payments.map(p => `${seats[p.from]}→${seats[p.to]} ${p.amount}`).join('  ')
    });
  },

  // ===== 确认 =====
  confirmWin() {
    const win = this.data.win;
    const game = this.data.game;
    const han = this.data.analysisResult ? this.data.analysisResult.han : (win.han || 3);
    const fu = this.data.analysisResult ? this.data.analysisResult.fu : FU_OPTIONS[this.data.fuIndex];
    const baseOverride = this.data.analysisResult ? this.data.analysisResult.raw.basePoint : null;
    const payment = Game.calcWinPayments(game, win.winnerIdx, han, fu, win.isTsumo, win.loserIdx, baseOverride);

    this.snapshot();
    const fullWin = Object.assign({}, win, { han, fu });
    const next = Game.applyWin(game, fullWin, payment);
    const rn = Game.roundNames(next);
    this.setData({ game: next, playerViews: buildPlayerViews(next), roundName: rn[next.roundIndex] || `第${next.roundIndex + 1}局`, showWin: false, analysisStage: 0 });
    this.saveGame(next);
    wx.showToast({ title: `+${payment.total}点`, icon: 'success' });
  },

  // ===== 立直 =====
  openRiichi() {
    this.setData({ showRiichi: true, riichiSelected: new Array(this.data.game.playerCount || 4).fill(false) });
  },
  closeRiichi() { this.setData({ showRiichi: false }); },
  toggleRiichiPlayer(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (this.data.game.players[i].riichi) return;
    const sel = this.data.riichiSelected.slice();
    sel[i] = !sel[i];
    this.setData({ riichiSelected: sel });
  },
  confirmRiichi() {
    const ids = this.data.riichiSelected.map((v,i) => v ? i : -1).filter(i => i >= 0);
    if (!ids.length) { this.setData({ showRiichi: false }); return; }
    this.snapshot();
    const next = Game.applyRiichi(this.data.game, ids);
    this.setData({ game: next, playerViews: buildPlayerViews(next), showRiichi: false });
    this.saveGame(next);
  },

  // ===== 流局 =====
  openDraw() {
    const count = this.data.game.playerCount || 4;
    this.setData({ showDraw: true, tenpaiSelected: new Array(count).fill(false) });
  },
  closeDraw() { this.setData({ showDraw: false }); },
  toggleTenpai(e) {
    const i = Number(e.currentTarget.dataset.index);
    const a = this.data.tenpaiSelected.slice();
    a[i] = !a[i];
    this.setData({ tenpaiSelected: a });
  },
  confirmDraw() {
    const ids = this.data.tenpaiSelected.map((v,i) => v ? i : -1).filter(i => i >= 0);
    this.snapshot();
    const next = Game.applyDraw(this.data.game, ids);
    const rn = Game.roundNames(next);
    this.setData({ game: next, playerViews: buildPlayerViews(next), roundName: rn[next.roundIndex] || `第${next.roundIndex + 1}局`, showDraw: false });
    this.saveGame(next);
  },

  // ===== 历史 =====
  showHistory() { this.setData({ showHistory: true }); },
  closeHistory() { this.setData({ showHistory: false }); },
  handleOverlayTap(e) {
    if (e.target === e.currentTarget) {
      const id = e.currentTarget.dataset.id;
      this.setData({ [id]: false });
    }
  },

  // ===== 刷新 =====
  refreshConditions() {
    const w = this.data.win;
    if (!w) return;
    const c = w.conditions;
    const hasRiichi = w.riichiState !== 'none';
    const conds = CONDITION_DEFS.map(d => {
      const needsTsumo = d.key === 'isLastTileTsumo' || d.key === 'isWinFromDeadWall';
      const needsRon = d.key === 'isLastTileRon' || d.key === 'isRobbingKan';
      const disabled = (needsTsumo && !w.isTsumo) || (needsRon && w.isTsumo) || (d.key === 'isIppatsu' && !hasRiichi);
      return Object.assign({}, d, { active: !!c[d.key] && !disabled, disabled });
    });
    this.setData({ conditions: conds });
  },

  refreshTiles() {
    const counts = {};
    this.data.hand.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const decorate = id => ({
      id, name: Shared.tileShortName(id), src: Shared.tileSrc(id),
      count: counts[id] || 0, disabled: (counts[id] || 0) >= 4, isHaku: id === '5z'
    });
    const tileRows = [
      { label: '万', tiles: Shared.ALL_TILES.filter(id => id.endsWith('m')).map(decorate) },
      { label: '筒', tiles: Shared.ALL_TILES.filter(id => id.endsWith('p')).map(decorate) },
      { label: '索', tiles: Shared.ALL_TILES.filter(id => id.endsWith('s')).map(decorate) },
      { label: '字', tiles: Shared.ALL_TILES.filter(id => id.endsWith('z')).map(decorate) }
    ];

    const hand = this.data.hand;
    const handDisplay = hand.map((id, index) => ({
      key: `${id}-${index}`, id, src: Shared.tileSrc(id),
      isHaku: id === '5z',
      isWinTile: id === this.data.win.winTile && hand.lastIndexOf(id) === index
    }));

    const winTileOptions = Shared.unique(hand).map(decorate);
    const doraTiles = Shared.ALL_TILES.map(id => Object.assign(decorate(id), { selected: (this.data.win.doraIndicators || []).includes(id) }));
    const uraTiles = Shared.ALL_TILES.map(id => Object.assign(decorate(id), { selected: (this.data.win.uraDoraIndicators || []).includes(id) }));

    this.setData({
      tileRows, handDisplay, winTileOptions,
      winTileName: Shared.tileShortName(this.data.win.winTile),
      doraTiles, uraTiles
    });
  }
});
