const Logic = require('../../utils/mahjong-logic');
const Game = require('../../utils/game-engine');

const TILE_FILES = {
  '1m':'Man1','2m':'Man2','3m':'Man3','4m':'Man4','5m':'Man5','6m':'Man6','7m':'Man7','8m':'Man8','9m':'Man9',
  '1p':'Pin1','2p':'Pin2','3p':'Pin3','4p':'Pin4','5p':'Pin5','6p':'Pin6','7p':'Pin7','8p':'Pin8','9p':'Pin9',
  '1s':'Sou1','2s':'Sou2','3s':'Sou3','4s':'Sou4','5s':'Sou5','6s':'Sou6','7s':'Sou7','8s':'Sou8','9s':'Sou9',
  '1z':'Ton','2z':'Nan','3z':'Shaa','4z':'Pei','5z':'Haku','6z':'Hatsu','7z':'Chun'
};
const TILE_NAMES = {
  '1z':'东','2z':'南','3z':'西','4z':'北','5z':'白','6z':'发','7z':'中'
};
const ALL_TILES = Object.keys(TILE_FILES);
const MODES = {
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

function tileSrc(id) { return `/assets/tiles/${TILE_FILES[id]}.svg`; }
function tileName(id) {
  if (!id) return '未选择';
  if (id.endsWith('z')) return TILE_NAMES[id];
  return `${id[0]}${id[1] === 'm' ? '万' : id[1] === 'p' ? '筒' : '索'}`;
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function unique(arr) { return [...new Set(arr)]; }
function compareTile(a, b) { return ALL_TILES.indexOf(a) - ALL_TILES.indexOf(b); }
function nextDora(id) {
  if (id.endsWith('z')) {
    const winds = ['1z','2z','3z','4z'];
    const dragons = ['5z','6z','7z'];
    const group = winds.includes(id) ? winds : dragons;
    return group[(group.indexOf(id) + 1) % group.length];
  }
  return `${parseInt(id, 10) % 9 + 1}${id[1]}`;
}
function emptyConditions() {
  return { isIppatsu:false, isLastTileTsumo:false, isLastTileRon:false, isRobbingKan:false, isWinFromDeadWall:false };
}
function defaultWin(game) {
  const winnerIdx = game.dealerIndex;
  return {
    winnerIdx, loserIdx: (winnerIdx + 1) % 4, isTsumo:false, winTile:null,
    riichiState: game.players[winnerIdx].riichi ? 'riichi' : 'none',
    doraIndicators:[], uraDoraIndicators:[], conditions:emptyConditions()
  };
}

Page({
  data: {
    seats: Game.SEATS,
    game: Game.newGame(),
    historyTop:[],
    roundName: Game.ROUND_NAMES[0],
    showWin:false, showRiichiModal:false, showDrawModal:false,
    showDora:false, showUra:false,
    hand:[], handDisplay:[], handHistory:[], winTileOptions:[], winTileName:'未选择',
    tileRows:[], doraTiles:[], uraTiles:[],
    win: defaultWin(Game.newGame()),
    analysisStage:0, analysisMessage:'', analysisResult:null,
    melds:[], decompositions:[], decompIndex:0,
    conditions:[],
    riichiSelected:[false,false,false,false], tenpaiSelected:[false,false,false,false],
    undoStack:[]
  },

  onLoad() {
    let game;
    try { game = wx.getStorageSync('mj_game_mini'); } catch (e) {}
    if (!game || !game.players) game = Game.newGame();
    this.setData({ game, historyTop:game.history.slice(0, 5), roundName: Game.ROUND_NAMES[game.roundIndex] || `第${game.roundIndex + 1}` });
    this.refreshTiles();
  },

  saveGame(game) {
    try { wx.setStorageSync('mj_game_mini', game); } catch (e) {}
  },
  setGame(game) {
    this.setData({ game, historyTop:game.history.slice(0, 5), roundName: Game.ROUND_NAMES[game.roundIndex] || `第${game.roundIndex + 1}` });
    this.saveGame(game);
  },
  snapshot() {
    const stack = this.data.undoStack.concat([clone(this.data.game)]).slice(-20);
    this.setData({ undoStack: stack });
  },
  undo() {
    const stack = this.data.undoStack.slice();
    if (!stack.length) return wx.showToast({ title:'没有可撤销操作', icon:'none' });
    const game = stack.pop();
    this.setData({ undoStack: stack });
    this.setGame(game);
  },
  resetGame() {
    wx.showModal({ title:'重置整场', content:'所有点数和记录都会清空。', success:({confirm}) => {
      if (!confirm) return;
      this.snapshot();
      this.setGame(Game.newGame());
    }});
  },

  openWin() {
    const win = defaultWin(this.data.game);
    this.setData({
      showWin:true, win, hand:[], handHistory:[], analysisStage:0,
      analysisMessage:'', analysisResult:null, melds:[], decompositions:[], decompIndex:0,
      showDora:false, showUra:false
    });
    this.refreshTiles();
  },
  closeWin() { this.setData({ showWin:false }); },
  selectWinner(e) {
    const winnerIdx = Number(e.currentTarget.dataset.index);
    const win = clone(this.data.win);
    win.winnerIdx = winnerIdx;
    if (win.loserIdx === winnerIdx) win.loserIdx = (winnerIdx + 1) % 4;
    win.riichiState = this.data.game.players[winnerIdx].riichi ? 'riichi' : 'none';
    win.conditions.isIppatsu = false;
    this.setData({ win, analysisResult:null, analysisMessage:'和牌者已修改，请重新分析' });
    this.refreshConditions();
  },
  selectLoser(e) { this.setData({ 'win.loserIdx':Number(e.currentTarget.dataset.index), analysisResult:null }); },
  selectWinType(e) {
    const isTsumo = e.currentTarget.dataset.value === 'tsumo';
    const conditions = clone(this.data.win.conditions);
    if (isTsumo) { conditions.isLastTileRon = false; conditions.isRobbingKan = false; }
    else { conditions.isLastTileTsumo = false; conditions.isWinFromDeadWall = false; }
    this.setData({ 'win.isTsumo':isTsumo, 'win.conditions':conditions, analysisResult:null, analysisMessage:this.data.analysisStage ? '和牌方式已修改，请重新分析' : '' });
    this.refreshConditions();
  },
  selectRiichiState(e) {
    const value = e.currentTarget.dataset.value;
    const conditions = clone(this.data.win.conditions);
    if (value === 'none') conditions.isIppatsu = false;
    this.setData({ 'win.riichiState':value, 'win.conditions':conditions, analysisResult:null, analysisMessage:this.data.analysisStage ? '立直状态已修改，请重新分析' : '' });
    this.refreshTiles(); this.refreshConditions();
  },

  addTile(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.hand.filter(t => t === id).length >= 4) return;
    const hand = this.data.hand.concat(id).sort(compareTile);
    this.setData({ hand, handHistory:this.data.handHistory.concat(id) });
    this.invalidateAnalysis(); this.refreshTiles();
  },
  removeTile(e) {
    const index = Number(e.currentTarget.dataset.index);
    const hand = this.data.hand.slice();
    hand.splice(index, 1);
    const win = clone(this.data.win);
    if (win.winTile && !hand.includes(win.winTile)) win.winTile = null;
    this.setData({ hand, win });
    this.invalidateAnalysis(); this.refreshTiles();
  },
  clearHand() {
    this.setData({ hand:[], handHistory:[], 'win.winTile':null });
    this.invalidateAnalysis(); this.refreshTiles();
  },
  undoTile() {
    const history = this.data.handHistory.slice();
    const id = history.pop();
    if (!id) return;
    const hand = this.data.hand.slice();
    const index = hand.lastIndexOf(id);
    if (index >= 0) hand.splice(index, 1);
    const win = clone(this.data.win);
    if (win.winTile && !hand.includes(win.winTile)) win.winTile = null;
    this.setData({ hand, handHistory:history, win });
    this.invalidateAnalysis(); this.refreshTiles();
  },
  selectWinTile(e) {
    this.setData({ 'win.winTile':e.currentTarget.dataset.id });
    this.invalidateAnalysis(); this.refreshTiles();
  },
  invalidateAnalysis() {
    this.setData({ analysisStage:0, analysisResult:null, analysisMessage:'', melds:[], decompositions:[], decompIndex:0 });
  },

  toggleFold(e) { const key = e.currentTarget.dataset.key; this.setData({ [key]:!this.data[key] }); },
  toggleDora(e) {
    const id = e.currentTarget.dataset.id;
    const field = e.currentTarget.dataset.kind === 'dora' ? 'doraIndicators' : 'uraDoraIndicators';
    const arr = this.data.win[field].slice();
    const index = arr.indexOf(id);
    if (index >= 0) arr.splice(index, 1); else arr.push(id);
    this.setData({ [`win.${field}`]:arr, analysisResult:null });
    this.refreshTiles();
  },

  buildDecompositions() {
    const counts = Logic.countTiles(this.data.hand);
    const kanIds = new Set(Object.keys(counts).filter(id => counts[id] === 4));
    return Logic.decompose(counts, new Set(), kanIds);
  },
  buildMelds(decomp) {
    return decomp.mentsus.map((m) => {
      const baseType = m.type === 'kantsu' ? 'koutsu' : m.type;
      const mode = m.type === 'kantsu' ? 'ankan' : baseType === 'shuntsu' ? 'closed' : 'ankou';
      return this.decorateMeld({ tiles:m.type === 'kantsu' ? m.tiles.slice(0, 3) : m.tiles.slice(), baseType, mode });
    });
  },
  decorateMeld(meld) {
    const isKan = meld.mode === 'ankan' || meld.mode === 'minkan';
    const ids = isKan ? meld.tiles.concat(meld.tiles[0]) : meld.tiles;
    return Object.assign({}, meld, {
      modes: MODES[meld.baseType],
      displayTiles:ids.map((id, idx) => ({ key:`${id}-${idx}`, id, src:tileSrc(id), isHaku:id === '5z' }))
    });
  },
  setMeldMode(e) {
    const index = Number(e.currentTarget.dataset.index);
    const melds = clone(this.data.melds);
    melds[index].mode = e.currentTarget.dataset.mode;
    melds[index] = this.decorateMeld(melds[index]);
    this.setData({ melds, analysisResult:null, analysisMessage:'面子状态已修改，请重新分析' });
  },
  toggleCondition(e) {
    const key = e.currentTarget.dataset.key;
    const item = this.data.conditions.find(c => c.key === key);
    if (!item || item.disabled) return;
    const c = clone(this.data.win.conditions);
    const next = !c[key];
    if (key === 'isLastTileTsumo' && next) c.isLastTileRon = false;
    if (key === 'isLastTileRon' && next) c.isLastTileTsumo = false;
    if (key === 'isRobbingKan' && next) c.isWinFromDeadWall = false;
    if (key === 'isWinFromDeadWall' && next) c.isRobbingKan = false;
    c[key] = next;
    this.setData({ 'win.conditions':c, analysisResult:null, analysisMessage:'特殊条件已修改，请重新分析' });
    this.refreshConditions();
  },

  getOpenMelds() {
    return this.data.melds.filter(m => m.mode === 'open' || m.mode === 'minkou' || m.mode === 'minkan').map(m => ({
      type:m.mode === 'minkan' ? 'kantsu' : m.baseType,
      tiles:m.mode === 'minkan' ? [m.tiles[0],m.tiles[0],m.tiles[0],m.tiles[0]] : m.tiles.slice(),
      open:true
    }));
  },
  getClosedKans() { return this.data.melds.filter(m => m.mode === 'ankan').map(m => m.tiles[0]); },
  countDora() {
    let count = 0;
    this.data.win.doraIndicators.forEach(ind => { const d = nextDora(ind); count += this.data.hand.filter(t => t === d).length; });
    if (this.data.win.riichiState !== 'none') this.data.win.uraDoraIndicators.forEach(ind => { const d = nextDora(ind); count += this.data.hand.filter(t => t === d).length; });
    return count;
  },
  analysisParams() {
    const openMentsus = this.getOpenMelds();
    const c = this.data.win.conditions;
    return {
      tiles:this.data.hand.slice(), isOpened:openMentsus.length > 0, openMentsus,
      closedKantsus:this.getClosedKans(), isTsumo:this.data.win.isTsumo,
      isRiichi:this.data.win.riichiState === 'riichi', isDoubleRiichi:this.data.win.riichiState === 'double',
      isIppatsu:c.isIppatsu, isRobbingKan:c.isRobbingKan, isWinFromDeadWall:c.isWinFromDeadWall,
      isLastTile:this.data.win.isTsumo ? c.isLastTileTsumo : c.isLastTileRon,
      winTile:this.data.win.winTile,
      roundWind:['1z','2z','3z','4z'][Math.floor(this.data.game.roundIndex / 4) % 4],
      seatWind:['1z','2z','3z','4z'][this.data.win.winnerIdx], doraCount:this.countDora(), akadoraCount:0
    };
  },
  analyzeHand() {
    const hand = this.data.hand;
    if (hand.length < 14 || hand.length > 18) return this.setData({ analysisMessage:'请先选好 14-18 张牌；每有一个杠，就比14张多一张。', analysisResult:null });
    if (!this.data.win.winTile) return this.setData({ analysisMessage:'请先选择最终和牌张。', analysisResult:null });

    let decompositions = this.data.decompositions;
    let melds = this.data.melds;
    if (!this.data.analysisStage) {
      decompositions = this.buildDecompositions();
      // 七对子与国士无双没有普通面子分解，仍交给核心引擎继续判定
      melds = decompositions.length ? this.buildMelds(decompositions[0]) : [];
      this.setData({ analysisStage:1, decompositions, melds }, () => {
        this.refreshConditions();
        this.analyzeHand();
      });
      return;
    }
    const result = Logic.evaluateHand(this.analysisParams());
    if (!result.valid) return this.setData({ analysisMessage:`暂时无法成立和牌：${result.error || '没有役' }。请修正面子、和牌张或特殊条件后重新分析。`, analysisResult:null });

    const han = result.isYakuman ? 13 : result.han;
    const fu = result.fu || 30;
    const payment = Game.calcWinPayments(this.data.game, this.data.win.winnerIdx, han, fu, this.data.win.isTsumo, this.data.win.loserIdx, result.basePoint);
    const waitNames = { ryanmen:'两面', kanchan:'嵌张', penchan:'边张', tanki:'单骑', shanpon:'双碰' };
    const conditionNames = [];
    if (this.data.win.riichiState === 'riichi') conditionNames.push('立直');
    if (this.data.win.riichiState === 'double') conditionNames.push('两立直');
    CONDITION_DEFS.forEach(d => { if (this.data.win.conditions[d.key]) conditionNames.push(d.label); });
    const analysisResult = {
      title:'牌型分析结果',
      typeName:result.type === 'chiitoi' ? '七对子' : result.type === 'kokushi' ? '国士无双' : '四面子一雀头',
      waitName:waitNames[result.waitType] || '—',
      closedName:this.getOpenMelds().length ? '副露' : '门前',
      conditionText:conditionNames.join('、') || '无特殊条件',
      yakuText:result.yaku.map(y => y.yakuman ? `${y.name}（${y.yakuman}倍役满）` : `${y.name}${y.han ? ` ${y.han}番` : ''}`).join('、'),
      doraCount:this.countDora(), scoreText:result.isYakuman ? `${result.yakumanCount || 1}倍役满 · ${payment.total}点` : `${result.han}番 ${result.fu}符 · ${payment.total}点`,
      payments:payment.payments.map(p => `${Game.SEATS[p.from]} → ${Game.SEATS[p.to]}：${p.amount}`),
      raw:result, payment, han, fu
    };
    this.setData({ analysisMessage:'分析完成。修改条件后可重新分析。', analysisResult });
  },
  confirmWin() {
    const a = this.data.analysisResult;
    if (!a) return;
    this.snapshot();
    const win = Object.assign({}, this.data.win, { han:a.han, fu:a.fu });
    const game = Game.applyWin(this.data.game, win, a.payment);
    this.setGame(game);
    this.setData({ showWin:false });
    wx.showToast({ title:`+${a.payment.total}点`, icon:'success' });
  },

  openRiichi() { this.setData({ showRiichiModal:true, riichiSelected:[false,false,false,false] }); },
  closeRiichi() { this.setData({ showRiichiModal:false }); },
  toggleRiichiPlayer(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (this.data.game.players[i].riichi) return;
    const selected = this.data.riichiSelected.slice(); selected[i] = !selected[i]; this.setData({ riichiSelected:selected });
  },
  confirmRiichi() {
    const ids = this.data.riichiSelected.map((v,i) => v ? i : -1).filter(i => i >= 0);
    if (!ids.length) return this.setData({ showRiichiModal:false });
    this.snapshot(); this.setGame(Game.applyRiichi(this.data.game, ids)); this.setData({ showRiichiModal:false });
  },
  openDraw() { this.setData({ showDrawModal:true, tenpaiSelected:[false,false,false,false] }); },
  closeDraw() { this.setData({ showDrawModal:false }); },
  toggleTenpai(e) { const i=Number(e.currentTarget.dataset.index); const a=this.data.tenpaiSelected.slice(); a[i]=!a[i]; this.setData({tenpaiSelected:a}); },
  confirmDraw() {
    const ids=this.data.tenpaiSelected.map((v,i)=>v?i:-1).filter(i=>i>=0);
    this.snapshot(); this.setGame(Game.applyDraw(this.data.game,ids)); this.setData({showDrawModal:false});
  },

  refreshConditions() {
    const c = this.data.win.conditions;
    const hasRiichi = this.data.win.riichiState !== 'none';
    const conditions = CONDITION_DEFS.map(d => {
      const needsTsumo = d.key === 'isLastTileTsumo' || d.key === 'isWinFromDeadWall';
      const needsRon = d.key === 'isLastTileRon' || d.key === 'isRobbingKan';
      const disabled = (needsTsumo && !this.data.win.isTsumo) || (needsRon && this.data.win.isTsumo) || (d.key === 'isIppatsu' && !hasRiichi);
      return Object.assign({}, d, { active:!!c[d.key] && !disabled, disabled });
    });
    this.setData({ conditions });
  },
  refreshTiles() {
    const counts = {};
    this.data.hand.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const decorate = id => ({ id, name:tileName(id), src:tileSrc(id), count:counts[id] || 0, disabled:(counts[id] || 0) >= 4, isHaku:id === '5z' });
    const tileRows = [
      { label:'万', tiles:ALL_TILES.filter(id => id.endsWith('m')).map(decorate) },
      { label:'筒', tiles:ALL_TILES.filter(id => id.endsWith('p')).map(decorate) },
      { label:'索', tiles:ALL_TILES.filter(id => id.endsWith('s')).map(decorate) },
      { label:'字', tiles:ALL_TILES.filter(id => id.endsWith('z')).map(decorate) }
    ];
    const handDisplay = this.data.hand.map((id,index) => ({ key:`${id}-${index}`, id, src:tileSrc(id), isHaku:id === '5z', isWinTile:id === this.data.win.winTile && this.data.hand.lastIndexOf(id) === index }));
    const winTileOptions = unique(this.data.hand).map(decorate);
    const doraTiles = ALL_TILES.map(id => Object.assign(decorate(id), { selected:this.data.win.doraIndicators.includes(id) }));
    const uraTiles = ALL_TILES.map(id => Object.assign(decorate(id), { selected:this.data.win.uraDoraIndicators.includes(id) }));
    this.setData({ tileRows, handDisplay, winTileOptions, winTileName:tileName(this.data.win.winTile), doraTiles, uraTiles });
  }
});
