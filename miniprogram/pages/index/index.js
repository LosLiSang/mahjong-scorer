// pages/index/index.js — 日麻计分器（四麻 + 三麻）
const Shared = require('../../utils/shared');
const Logic = require('../../utils/mahjong-logic');
const Game = require('../../utils/game-engine');
const RoomService = require('../../utils/room-service');

const LOCAL_STORAGE_KEY = 'mj_game_v2';
const ACTIVE_ROOM_KEY = 'mj_active_room_v1';
const ROOM_NICKNAME_KEY = 'mj_room_nickname_v1';

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
    showWin: false, winStep: 1,
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
    undoStack: [],
    // realtime room
    roomConfigured: RoomService.isConfigured(),
    room: null,
    roomConnected: false,
    roomOnline: true,
    roomBusy: false,
    roomWritable: false,
    showRoom: false,
    roomPanelMode: 'create',
    roomMode: 4,
    roomNickname: '',
    roomSeatIndex: 0,
    roomSeatOptions: [],
    joinRoomCode: '',
    joinPreview: null,
    joinSeatIndex: -1,
    joinRoomFull: false,
    pendingSharedRoomCode: '',
    lastSeenRoomActionId: '',
    roomActivityViews: []
  },

  onLoad(options) {
    let game;
    try { game = wx.getStorageSync(LOCAL_STORAGE_KEY); } catch(e) {}
    if (!game || !game.players || ![3,4].includes(game.players.length)) {
      game = Game.newGame(4);
    }
    // normalize
    game.playerCount = game.players.length;
    game.mode = game.playerCount === 3 ? 'sanma' : 'yonma';
    if (!game.sanmaTsumoRule) game.sanmaTsumoRule = 'loss';
    if (!game.history) game.history = [];
    this.initGame(game);
    // 预构建牌面数据，保证首次打开结算弹窗前页面状态完整。
    this.setData({ win: defaultWin(game) });
    this.refreshTiles();
    this.initRoomNetworkState();

    let nickname = '';
    let activeRoomCode = '';
    try {
      nickname = wx.getStorageSync(ROOM_NICKNAME_KEY) || '';
      activeRoomCode = wx.getStorageSync(ACTIVE_ROOM_KEY) || '';
    } catch (e) {}
    const sharedCode = RoomService.normalizeCode(options && options.room);
    this.setData({
      roomNickname: nickname,
      pendingSharedRoomCode: sharedCode,
      joinRoomCode: sharedCode || ''
    });

    if (sharedCode) {
      this.setData({ showRoom: true, roomPanelMode: 'join' });
      if (this.data.roomConfigured) this.inspectJoinRoom();
    } else if (activeRoomCode && this.data.roomConfigured) {
      this.resumeRoom(activeRoomCode);
    }
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 0 });
    if (this.data.room && this.data.room.roomCode && this.data.roomConfigured) {
      this.startRoomWatch(this.data.room.roomCode).catch(err => this.roomError(err));
      return;
    }
    if (!this.data.game || !this.data.game.players) return;
    this.saveGame(this.data.game);
  },

  onHide() {
    RoomService.stopWatch();
    if (this.data.room) this.updateRoomWritable({ roomConnected: false });
  },

  onUnload() {
    RoomService.stopWatch();
    if (this._networkHandler && wx.offNetworkStatusChange) {
      wx.offNetworkStatusChange(this._networkHandler);
    }
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
    if (this.data.room) return;
    try { wx.setStorageSync(LOCAL_STORAGE_KEY, game); } catch(e) {}
  },

  initRoomNetworkState() {
    if (wx.getNetworkType) {
      wx.getNetworkType({
        success: res => this.updateRoomWritable({ roomOnline: res.networkType !== 'none' })
      });
    }
    if (wx.onNetworkStatusChange) {
      this._networkHandler = res => {
        this.updateRoomWritable({ roomOnline: !!res.isConnected });
        if (res.isConnected && this.data.room && this.data.room.roomCode) {
          this.startRoomWatch(this.data.room.roomCode).catch(err => this.roomError(err));
        }
      };
      wx.onNetworkStatusChange(this._networkHandler);
    }
  },

  updateRoomWritable(patch) {
    const next = Object.assign({
      room: this.data.room,
      roomConnected: this.data.roomConnected,
      roomOnline: this.data.roomOnline,
      roomBusy: this.data.roomBusy
    }, patch || {});
    next.roomWritable = !!(
      next.room && next.room.status === 'active' &&
      next.roomConnected && next.roomOnline && !next.roomBusy
    );
    this.setData(next);
  },

  roomError(err) {
    wx.showToast({ title: (err && err.message) || '房间操作失败', icon: 'none', duration: 2500 });
  },

  roomSeatOptions(count, seats) {
    const labels = count === 3 ? Game.SEATS_3P : Game.SEATS_4P;
    return labels.map((label, index) => ({
      index,
      label,
      occupied: !!(seats && seats[index] && seats[index].occupied),
      nickname: seats && seats[index] ? seats[index].nickname : `玩家${index + 1}`
    }));
  },

  openRoomPanel() {
    const panelMode = this.data.room ? 'current' : (this.data.pendingSharedRoomCode ? 'join' : 'create');
    const preview = this.data.joinPreview;
    const count = preview ? (preview.mode === 'sanma' ? 3 : 4) : (this.data.roomMode || 4);
    this.setData({
      showRoom: true,
      roomSeatOptions: this.roomSeatOptions(count, preview && preview.seats),
      roomPanelMode: panelMode
    });
  },

  closeRoomPanel() { this.setData({ showRoom: false }); },

  switchRoomPanel(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ roomPanelMode: mode, joinPreview: mode === 'join' ? this.data.joinPreview : null });
  },

  selectRoomMode(e) {
    const count = Number(e.currentTarget.dataset.count) === 3 ? 3 : 4;
    this.setData({
      roomMode: count,
      roomSeatIndex: 0,
      roomSeatOptions: this.roomSeatOptions(count)
    });
  },

  onRoomNicknameInput(e) {
    const roomNickname = e.detail.value;
    this.setData({ roomNickname });
    try { wx.setStorageSync(ROOM_NICKNAME_KEY, roomNickname); } catch (err) {}
  },

  selectRoomSeat(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (e.currentTarget.dataset.join) {
      const option = this.data.roomSeatOptions[index];
      if (option && !option.occupied) this.setData({ joinSeatIndex: index });
      return;
    }
    this.setData({ roomSeatIndex: index });
  },

  onJoinRoomCodeInput(e) {
    this.setData({
      joinRoomCode: RoomService.normalizeCode(e.detail.value),
      joinPreview: null,
      joinSeatIndex: -1,
      joinRoomFull: false
    });
  },

  async createRoom() {
    if (!this.data.roomConfigured) return this.roomError(new Error('请先配置微信云开发环境'));
    if (!this.data.roomNickname.trim()) return this.roomError(new Error('请填写微信昵称'));
    this.updateRoomWritable({ roomBusy: true });
    try {
      const room = await RoomService.create({
        mode: this.data.roomMode,
        seatIndex: this.data.roomSeatIndex,
        nickname: this.data.roomNickname
      });
      try { wx.setStorageSync(ACTIVE_ROOM_KEY, room.roomCode); } catch (e) {}
      this.applyRoom(room, false);
      this.setData({ showRoom: false, roomPanelMode: 'current' });
      await this.startRoomWatch(room.roomCode);
      wx.showToast({ title: `房间 ${room.roomCode}`, icon: 'success' });
    } catch (err) {
      this.roomError(err);
    } finally {
      this.updateRoomWritable({ roomBusy: false });
    }
  },

  async inspectJoinRoom() {
    if (!this.data.roomConfigured) return this.roomError(new Error('请先配置微信云开发环境'));
    const code = RoomService.normalizeCode(this.data.joinRoomCode);
    if (code.length !== 6) return this.roomError(new Error('请输入 6 位房间码'));
    this.updateRoomWritable({ roomBusy: true });
    try {
      const preview = await RoomService.inspect(code);
      const count = preview.mode === 'sanma' ? 3 : 4;
      const options = this.roomSeatOptions(count, preview.seats);
      const firstEmpty = options.find(item => !item.occupied);
      this.setData({
        joinPreview: preview,
        joinRoomCode: preview.roomCode,
        roomSeatOptions: options,
        joinSeatIndex: firstEmpty ? firstEmpty.index : 0,
        joinRoomFull: !firstEmpty
      });
    } catch (err) {
      this.setData({ joinPreview: null, joinSeatIndex: -1, joinRoomFull: false });
      this.roomError(err);
    } finally {
      this.updateRoomWritable({ roomBusy: false });
    }
  },

  async joinRoom() {
    if (!this.data.joinPreview) return this.inspectJoinRoom();
    if (!this.data.roomNickname.trim()) return this.roomError(new Error('请填写微信昵称'));
    if (this.data.joinSeatIndex < 0) return this.roomError(new Error('请选择空座位'));
    this.updateRoomWritable({ roomBusy: true });
    try {
      const room = await RoomService.join({
        roomCode: this.data.joinPreview.roomCode,
        seatIndex: this.data.joinSeatIndex,
        nickname: this.data.roomNickname
      });
      try { wx.setStorageSync(ACTIVE_ROOM_KEY, room.roomCode); } catch (e) {}
      this.applyRoom(room, false);
      this.setData({ showRoom: false, roomPanelMode: 'current', pendingSharedRoomCode: '' });
      await this.startRoomWatch(room.roomCode);
      wx.showToast({ title: '已加入房间', icon: 'success' });
    } catch (err) {
      this.roomError(err);
    } finally {
      this.updateRoomWritable({ roomBusy: false });
    }
  },

  async resumeRoom(roomCode) {
    try {
      await this.startRoomWatch(roomCode);
    } catch (err) {
      this.roomError(err);
    }
  },

  async startRoomWatch(roomCode) {
    if (!this.data.roomOnline || !this.data.roomConfigured) return;
    try {
      await RoomService.watch(roomCode, {
        onChange: room => {
          this.updateRoomWritable({ roomConnected: true });
          this.applyRoom(room, true);
        },
        onRemoved: () => {
          this.leaveRoomLocally(false);
          wx.showToast({ title: '房主已释放你的座位', icon: 'none' });
        },
        onError: err => {
          this.updateRoomWritable({ roomConnected: false });
          if (err.code === 'NOT_ROOM_MEMBER') this.leaveRoomLocally(false);
          else this.roomError(err);
        }
      });
    } catch (err) {
      this.updateRoomWritable({ roomConnected: false });
      throw err;
    }
  },

  formatRoomActionTime(value) {
    const raw = value && value.$date ? value.$date : value;
    const date = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    const pad = number => String(number).padStart(2, '0');
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  applyRoom(room, notify) {
    if (!room || !room.game) return;
    const previousActionId = this.data.lastSeenRoomActionId;
    const action = room.lastAction;
    const rn = Game.roundNames(room.game);
    const roomActivityViews = (room.activity || []).map(item => ({
      id: item.id,
      summary: item.summary,
      operatorNickname: item.operatorNickname,
      timeText: this.formatRoomActionTime(item.createdAt),
      isMine: item.isMine
    }));
    this.updateRoomWritable({
      room,
      game: room.game,
      playerViews: buildPlayerViews(room.game),
      roundName: rn[room.game.roundIndex] || `第${room.game.roundIndex + 1}局`,
      undoStack: [],
      roomActivityViews,
      lastSeenRoomActionId: action && action.id || previousActionId
    });
    if (notify && action && action.id !== previousActionId && previousActionId && !action.isMine) {
      wx.showToast({ title: action.summary || `${action.operatorNickname} 更新了房间`, icon: 'none' });
    }
  },

  leaveRoomLocally(showToast) {
    RoomService.stopWatch();
    try { wx.removeStorageSync(ACTIVE_ROOM_KEY); } catch (e) {}
    let localGame;
    try { localGame = wx.getStorageSync(LOCAL_STORAGE_KEY); } catch (e) {}
    if (!localGame || !localGame.players) localGame = Game.newGame(4);
    this.setData({
      room: null,
      roomConnected: false,
      roomWritable: false,
      showRoom: false,
      joinPreview: null,
      joinRoomFull: false,
      pendingSharedRoomCode: '',
      lastSeenRoomActionId: '',
      roomActivityViews: []
    });
    this.initGame(localGame);
    if (showToast !== false) wx.showToast({ title: '已返回本地计分', icon: 'none' });
  },

  leaveRoom() {
    wx.showModal({
      title: '返回本地计分',
      content: '当前联网房间会断开，但座位仍保留。之后可通过房间码重新进入。',
      success: res => { if (res.confirm) this.leaveRoomLocally(true); }
    });
  },

  copyRoomCode() {
    if (!this.data.room) return;
    wx.setClipboardData({ data: this.data.room.roomCode });
  },

  async releaseRoomSeat(e) {
    if (!this.data.room || !this.data.room.isHost) return;
    const seatIndex = Number(e.currentTarget.dataset.index);
    this.updateRoomWritable({ roomBusy: true });
    try {
      const room = await RoomService.releaseSeat(this.data.room.roomCode, this.data.room.version, seatIndex);
      this.applyRoom(room, false);
    } catch (err) {
      this.roomError(err);
    } finally {
      this.updateRoomWritable({ roomBusy: false });
    }
  },

  endRoom() {
    if (!this.data.room || !this.data.room.isHost) return;
    wx.showModal({
      title: '结束房间',
      content: '结束后房间转为只读，并保留 30 天。',
      success: async res => {
        if (!res.confirm) return;
        this.updateRoomWritable({ roomBusy: true });
        try {
          const room = await RoomService.end(this.data.room.roomCode, this.data.room.version);
          this.applyRoom(room, false);
          this.setData({ showRoom: false });
        } catch (err) {
          this.roomError(err);
        } finally {
          this.updateRoomWritable({ roomBusy: false });
        }
      }
    });
  },

  async submitRoomGame(nextGame, commandType, summary) {
    if (!this.data.roomWritable) throw new Error(this.data.roomOnline ? '正在重新连接房间' : '当前网络不可用，不能提交计分');
    this.updateRoomWritable({ roomBusy: true });
    try {
      const room = await RoomService.command({
        roomCode: this.data.room.roomCode,
        expectedVersion: this.data.room.version,
        commandType,
        summary,
        nextGame
      });
      this.applyRoom(room, false);
      return room;
    } finally {
      this.updateRoomWritable({ roomBusy: false });
    }
  },

  onShareAppMessage() {
    const room = this.data.room;
    if (!room) return { title: '日麻整场计分器', path: '/pages/index/index' };
    return {
      title: `加入日麻房间 ${room.roomCode}`,
      path: `/pages/index/index?room=${room.roomCode}`
    };
  },

  seatsFor(pIdx) {
    const g = this.data.game;
    return Game.seatOf(g, pIdx);
  },

  snapshot() {
    if (this.data.room) return;
    const stack = (this.data.undoStack || []).concat([Shared.clone(this.data.game)]).slice(-30);
    this.setData({ undoStack: stack });
  },

  async undo() {
    if (this.data.room) {
      if (!this.data.roomWritable) return this.roomError(new Error('房间当前不可写入'));
      this.updateRoomWritable({ roomBusy: true });
      try {
        const room = await RoomService.undo(this.data.room.roomCode, this.data.room.version);
        this.applyRoom(room, false);
      } catch (err) {
        this.roomError(err);
      } finally {
        this.updateRoomWritable({ roomBusy: false });
      }
      return;
    }
    const stack = this.data.undoStack.slice();
    if (!stack.length) { wx.showToast({ title: '没有可撤销操作', icon: 'none' }); return; }
    const game = stack.pop();
    const rn = Game.roundNames(game);
    this.setData({ undoStack: stack, game, playerViews: buildPlayerViews(game), roundName: rn[game.roundIndex] || `第${game.roundIndex + 1}局` });
    this.saveGame(game);
  },

  resetGame() {
    if (this.data.room && !this.data.room.isHost) {
      return this.roomError(new Error('只有房主可以重置整场'));
    }
    wx.showModal({ title: '重置整场', content: '所有点数和记录都会清空。', success: async res => {
      if (!res.confirm) return;
      if (this.data.room) {
        this.updateRoomWritable({ roomBusy: true });
        try {
          const room = await RoomService.reset(this.data.room.roomCode, this.data.room.version);
          this.applyRoom(room, false);
        } catch (err) {
          this.roomError(err);
        } finally {
          this.updateRoomWritable({ roomBusy: false });
        }
        return;
      }
      const game = Game.newGame(this.data.game.playerCount || 4);
      this.initGame(game);
    }});
  },

  openPlayerSetup() {
    if (this.data.room) {
      this.openRoomPanel();
      return;
    }
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
    if (this.data.room) {
      this.openRoomPanel();
      return;
    }
    // 点击任意玩家卡片打开设置面板
    this.setData({ showSetup: true, setupMode: this.data.game.playerCount || 4,
      setupNames: this.data.game.players.map(p => p.name) });
  },

  // ===== 和牌面板 =====
  openWin() {
    if (this.data.room && !this.data.roomWritable) return this.roomError(new Error('房间当前不可写入'));
    const g = this.data.game;
    const win = defaultWin(g);
    this.setData({
      showWin: true, winStep: 1, win, hand: [], handHistory: [],
      analysisStage: 0, analysisMessage: '', analysisResult: null,
      melds: [], decompositions: [], decompIndex: 0,
      showDora: false, showUra: false,
      previewTotal: 0, previewBreakdown: '', fuIndex: 2, hanIndex: 2
    });
    this.refreshTiles();
    this.refreshConditions();
  },
  closeWin() { this.setData({ showWin: false, analysisStage: 0, melds: [], decompositions: [] }); },

  // ===== 分步向导 =====
  nextWinStep() { this.setData({ winStep: Math.min(3, this.data.winStep + 1) }); },
  prevWinStep() { this.setData({ winStep: Math.max(1, this.data.winStep - 1) }); },
  goWinStep(e) {
    const step = Number(e.currentTarget.dataset.step);
    this.setData({ winStep: Math.min(3, Math.max(1, step)) });
  },

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
    // 已分析过则按新拔北重算，避免丢弃中间分析结果
    if (this.data.analysisStage) this.analyzeHand();
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
    this.setData({ win });
    this.refreshTiles();
    // 已分析过则按新 dora 重算，避免把中间分析结果丢弃
    if (this.data.analysisStage) this.analyzeHand();
    else this.setData({ analysisResult: null });
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
    // 翻/符选择器继承分析结果，便于在“宝牌”步直接查看或微调
    const hanIndex = Math.max(0, Math.min(HAN_OPTIONS.length - 1, han - 1));
    const fuIdx = FU_OPTIONS.indexOf(fu);
    this.setData({ hanIndex, fuIndex: fuIdx >= 0 ? fuIdx : this.data.fuIndex });
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
  async confirmWin() {
    const win = this.data.win;
    const game = this.data.game;
    const han = this.data.analysisResult ? this.data.analysisResult.han : (win.han || 3);
    const fu = this.data.analysisResult ? this.data.analysisResult.fu : FU_OPTIONS[this.data.fuIndex];
    const baseOverride = this.data.analysisResult ? this.data.analysisResult.raw.basePoint : null;
    const payment = Game.calcWinPayments(game, win.winnerIdx, han, fu, win.isTsumo, win.loserIdx, baseOverride);

    const fullWin = Object.assign({}, win, { han, fu });
    const next = Game.applyWin(game, fullWin, payment);
    if (this.data.room) {
      const winnerName = game.players[win.winnerIdx].name;
      try {
        await this.submitRoomGame(next, 'win', `${winnerName} 完成和牌结算`);
        this.setData({ showWin: false, analysisStage: 0 });
        wx.showToast({ title: `+${payment.total}点`, icon: 'success' });
      } catch (err) {
        this.roomError(err);
      }
      return;
    }

    this.snapshot();
    const rn = Game.roundNames(next);
    this.setData({ game: next, playerViews: buildPlayerViews(next), roundName: rn[next.roundIndex] || `第${next.roundIndex + 1}局`, showWin: false, analysisStage: 0 });
    this.saveGame(next);
    wx.showToast({ title: `+${payment.total}点`, icon: 'success' });
  },

  // ===== 立直 =====
  openRiichi() {
    if (this.data.room && !this.data.roomWritable) return this.roomError(new Error('房间当前不可写入'));
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
  async confirmRiichi() {
    const ids = this.data.riichiSelected.map((v,i) => v ? i : -1).filter(i => i >= 0);
    if (!ids.length) { this.setData({ showRiichi: false }); return; }
    const next = Game.applyRiichi(this.data.game, ids);
    if (this.data.room) {
      try {
        const names = ids.map(id => this.data.game.players[id].name).join('、');
        await this.submitRoomGame(next, 'riichi', `${names} 宣告立直`);
        this.setData({ showRiichi: false });
      } catch (err) {
        this.roomError(err);
      }
      return;
    }
    this.snapshot();
    this.setData({ game: next, playerViews: buildPlayerViews(next), showRiichi: false });
    this.saveGame(next);
  },

  // ===== 流局 =====
  openDraw() {
    if (this.data.room && !this.data.roomWritable) return this.roomError(new Error('房间当前不可写入'));
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
  async confirmDraw() {
    const ids = this.data.tenpaiSelected.map((v,i) => v ? i : -1).filter(i => i >= 0);
    const next = Game.applyDraw(this.data.game, ids);
    if (this.data.room) {
      try {
        await this.submitRoomGame(next, 'draw', `完成流局结算（${ids.length} 人听牌）`);
        this.setData({ showDraw: false });
      } catch (err) {
        this.roomError(err);
      }
      return;
    }
    this.snapshot();
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
