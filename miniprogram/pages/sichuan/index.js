// pages/sichuan/index.js — 川麻积分
const {
  SICHUAN_FAN_TYPES, SICHUAN_PENALTY_TYPES, SICHUAN_PLAY_MODES, SICHUAN_GANG_KINDS,
  SICHUAN_BASE_SCORE_OPTIONS, SICHUAN_FAN_CAP_OPTIONS,
  calculateSichuanFan, scoreFromFan, calculateGang, findGangKind, sichuanWonPlayers,
  normalizeSichuanRules, sichuanPlayModeName,
  createSichuanGame, createTransferEntry, applySichuanEntry,
  undoSichuanEntry, setSichuanMissingSuit
} = require('../../utils/sichuan-score');
const { clone, tileSrc, rankPlayers } = require('../../utils/shared');
const RoomService = require('../../utils/room-service');
const SichuanRoom = require('../../utils/sichuan-room');
const Theme = require('../../utils/theme');
const TableView = require('../../utils/table-view');

const ENTRY_TYPE_LABELS = { win: '胡牌', gang: '杠分', penalty: '罚分', manual: '转分', custom: '转分' };

const STORAGE_KEY = 'mj_sichuan_v1';
const ACTIVE_ROOM_KEY = 'mj_sichuan_active_room_v1';
const ROOM_NICKNAME_KEY = 'mj_room_nickname_v1';
const ROOM_AVATAR_KEY = 'mj_room_avatar_v1';
const SEATS = ['东', '南', '西', '北'];
const SUIT_LABELS = { m: '缺万', p: '缺筒', s: '缺索' };
const FAN_CAP_OPTIONS = SICHUAN_FAN_CAP_OPTIONS;
const BASE_SCORE_OPTIONS = SICHUAN_BASE_SCORE_OPTIONS;

// 旧存档 / 旧房间可能没有 rules，统一补齐
function withRules(game) {
  if (!game) return game;
  return Object.assign({}, game, { rules: normalizeSichuanRules(game.rules) });
}

// 第一个仍在场、且不是 exclude 的玩家；没有则返回 -1
function firstActive(exclude, out, count = 4) {
  for (let i = 0; i < count; i++) {
    if (i !== exclude && !out.includes(i)) return i;
  }
  return -1;
}
const BASE_FAN_IDS = new Set(SICHUAN_FAN_TYPES.filter(type => type.group === 'base').map(type => type.id));

function buildFanGroups(selectedIds = []) {
  const selected = new Set(selectedIds);
  const decorate = type => Object.assign({}, type, {
    selected: selected.has(type.id),
    exampleImages: (type.exampleTiles || []).map((id, index) => ({ key: `${id}-${index}`, src: tileSrc(id), isHaku: id === '5z' }))
  });
  const base = SICHUAN_FAN_TYPES.filter(t => t.group === 'base').map(decorate);
  const extra = SICHUAN_FAN_TYPES.filter(t => t.group === 'extra' && t.id !== 'gen').map(decorate);
  return [
    { label: '基础番型（单选）', types: base },
    { label: '额外番型（可多选）', types: extra }
  ];
}

Page({
  copyContact() {
    wx.setClipboardData({
      data: 'lisangcode@outlook.com',
      success: () => wx.showToast({ title: '邮箱已复制', icon: 'success' })
    });
  },


  data: {
    seats: SEATS,
    seatPositions: TableView.seatPositions(4),
    game: createSichuanGame(['玩家一', '玩家二', '玩家三', '玩家四']),
    // Win modal (胡牌)
    showWin: false,
    winReceiver: 0,
    winPayers: [false, false, false, false],
    winPayerCount: 0,
    winFanIds: ['pinghu'],
    winRootCount: 0,
    winFanCap: 6,
    winBaseScore: 1,
    winFanPreview: null,
    fanCapOptions: FAN_CAP_OPTIONS,
    baseScoreOptions: BASE_SCORE_OPTIONS,
    playModes: SICHUAN_PLAY_MODES,
    // 对局规则
    rulesModeName: sichuanPlayModeName('xuezhan'),
    showRules: false,
    rulesDraft: normalizeSichuanRules(),
    rulesEditable: true,
    // Gang modal (杠分)
    showGang: false,
    gangKinds: SICHUAN_GANG_KINDS,
    gangReceiver: 0,
    gangKind: 'ming',
    gangDiscarder: 1,
    gangOut: [false, false, false, false],
    gangPreview: null,
    // Penalty modal (罚分)
    showPenalty: false,
    penaltyPayer: 0,
    penaltyReceivers: [false, true, true, true],
    penaltyReceiverCount: 3,
    penaltyTypeId: 'huazhu',
    penaltyTypes: SICHUAN_PENALTY_TYPES,
    penaltyType: SICHUAN_PENALTY_TYPES[0],
    penaltyAmount: '',
    // Setup modal (单个玩家设置)
    showSetup: false,
    setupPlayerIndex: 0,
    setupName: '',
    setupMissingSuit: '',
    // History
    showHistory: false,
    historyList: [],
    // Fan groups for display
    fanGroups: buildFanGroups(['pinghu']),
    showFanExample: false,
    fanExample: null,
    // Realtime Sichuan room
    roomConfigured: RoomService.isConfigured(),
    room: null,
    roomConnected: false,
    roomOnline: true,
    roomBusy: false,
    roomWritable: false,
    showRoom: false,
    roomPanelMode: 'create',
    roomNickname: '',
    roomAvatarFileId: '',
    roomAvatarUploading: false,
    roomSeatViews: [],
    roomSeatIndex: 0,
    roomSeatOptions: [],
    joinRoomCode: '',
    joinPreview: null,
    joinSeatIndex: -1,
    joinRoomFull: false,
    pendingSharedRoomCode: '',
    lastSeenRoomActionId: '',
    roomActivityViews: [],
    moveSeatChoosing: false,
    moveSeatTarget: -1,
    themeStyle: '',
    ranks: [1, 2, 3, 4],
    lastAmount: '',
    lastDetail: '暂无记录',
    stateText: '待开局',
    centerMain: '待开局',
  },

  onLoad(options) {
    let game;
    try { game = wx.getStorageSync(STORAGE_KEY); } catch (e) {}
    if (!game || !game.players || game.players.length !== 4) {
      game = createSichuanGame(['玩家一', '玩家二', '玩家三', '玩家四']);
    }
    this.initGame(withRules(game));
    this.initRoomNetworkState();

    let nickname = '';
    let avatarFileId = '';
    let activeRoomCode = '';
    try {
      nickname = wx.getStorageSync(ROOM_NICKNAME_KEY) || '';
      avatarFileId = wx.getStorageSync(ROOM_AVATAR_KEY) || '';
      activeRoomCode = wx.getStorageSync(ACTIVE_ROOM_KEY) || '';
    } catch (e) {}
    const sharedCode = RoomService.normalizeCode(options && options.room);
    this.setData({
      roomNickname: nickname,
      roomAvatarFileId: avatarFileId,
      pendingSharedRoomCode: sharedCode,
      joinRoomCode: sharedCode || '',
      roomSeatOptions: this.roomSeatOptions()
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
    const theme = Theme.current();
    this.setData({ themeStyle: theme.pageStyle });
    if (tabBar) tabBar.setData({ selected: 1, themeStyle: theme.tabBarStyle });
    if (this.data.room && this.data.room.roomCode && this.data.roomConfigured) {
      this.startRoomWatch(this.data.room.roomCode).catch(err => this.roomError(err));
      return;
    }
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
    this.updateBoardMeta(game);
    this.setData({ game });
    this.saveGame(game);
  },

  saveGame(game) {
    this.updateBoardMeta(game);
    if (this.data.room) return;
    try { wx.setStorageSync(STORAGE_KEY, game); } catch (e) {}
  },

  // 牌桌四角与中央的派生信息（最近一笔 / 状态 / 领先 / 顺位）
  updateBoardMeta(game) {
    if (!game || !game.players) return;
    const history = game.history || [];
    const ranks = rankPlayers(game.players.map(player => player.score));
    const last = history[history.length - 1];
    let lastAmount = '—';
    let lastDetail = '暂无记录';
    if (last) {
      const receiver = game.players[last.receiver];
      const amount = last.deltas && last.deltas[last.receiver] ? last.deltas[last.receiver] : last.amountPerPayer;
      lastAmount = (amount >= 0 ? '+' : '') + amount;
      lastDetail = `${receiver ? receiver.name : '?'} · ${ENTRY_TYPE_LABELS[last.type] || last.label || '转分'}`;
    }
    const rules = normalizeSichuanRules(game.rules);
    const huCount = history.filter(entry => entry.type === 'win').length;
    // 血战到底：胡 3 家终局；血流成河：可以一直胡，不自动终局
    const ended = rules.mode === 'xuezhan' && huCount >= 3;
    const stateText = history.length === 0
      ? '待开局'
      : (ended ? '终局' : (rules.mode === 'xueliu' ? `已胡 ${huCount} 次` : `已胡 ${huCount} 家`));
    const centerMain = history.length === 0 ? '待开局' : (ended ? '终局' : '进行中');
    this.setData({
      ranks, lastAmount, lastDetail, stateText, centerMain,
      rulesModeName: sichuanPlayModeName(rules.mode)
    });
  },

  // 联机且已入座时，记分弹窗主体默认选自己；本地模式仍为东家
  mySubject() {
    const room = this.data.room;
    return TableView.defaultSubject(room && room.mySeat, 4, 0);
  },

  // ─── Realtime room ───────────────────────────────────

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

  roomSeatOptions(seats) {
    return SEATS.map((label, index) => ({
      index,
      label,
      occupied: !!(seats && seats[index] && seats[index].occupied),
      nickname: seats && seats[index] ? seats[index].nickname : `玩家${index + 1}`
    }));
  },

  openRoomPanel() {
    const panelMode = this.data.room ? 'current' : (this.data.pendingSharedRoomCode ? 'join' : 'create');
    const preview = this.data.joinPreview;
    this.setData({
      showRoom: true,
      roomSeatOptions: this.roomSeatOptions(preview && preview.seats),
      roomPanelMode: panelMode
    });
  },

  closeRoomPanel() { this.setData({ showRoom: false }); },

  switchRoomPanel(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ roomPanelMode: mode, joinPreview: mode === 'join' ? this.data.joinPreview : null });
  },

  onRoomNicknameInput(e) {
    const roomNickname = e.detail.value;
    this.setData({ roomNickname });
    try { wx.setStorageSync(ROOM_NICKNAME_KEY, roomNickname); } catch (err) {}
  },

  async chooseRoomAvatar(e) {
    const filePath = e && e.detail && e.detail.avatarUrl;
    if (!filePath || this.data.roomAvatarUploading) return;
    if (this.data.room && !this.data.roomWritable) {
      return this.roomError(new Error('房间当前不可更新头像'));
    }
    if (this.data.room) this.updateRoomWritable({ roomBusy: true, roomAvatarUploading: true });
    else this.setData({ roomAvatarUploading: true });
    try {
      const avatarFileId = await RoomService.uploadAvatar(filePath);
      this.setData({ roomAvatarFileId: avatarFileId });
      try { wx.setStorageSync(ROOM_AVATAR_KEY, avatarFileId); } catch (err) {}
      if (this.data.room) {
        const room = await RoomService.updateProfile(
          this.data.room.roomCode,
          this.data.room.version,
          avatarFileId
        );
        this.applyRoom(room, false);
      }
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (err) {
      this.roomError(err);
    } finally {
      if (this.data.room) this.updateRoomWritable({ roomBusy: false, roomAvatarUploading: false });
      else this.setData({ roomAvatarUploading: false });
    }
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
        mode: 4,
        gameType: 'sichuan',
        seatIndex: this.data.roomSeatIndex,
        nickname: this.data.roomNickname,
        avatarFileId: this.data.roomAvatarFileId
      });
      SichuanRoom.requireSichuanRoom(room);
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
      SichuanRoom.requireSichuanRoom(preview);
      const options = this.roomSeatOptions(preview.seats);
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
        gameType: 'sichuan',
        seatIndex: this.data.joinSeatIndex,
        nickname: this.data.roomNickname,
        avatarFileId: this.data.roomAvatarFileId
      });
      SichuanRoom.requireSichuanRoom(room);
      try { wx.setStorageSync(ACTIVE_ROOM_KEY, room.roomCode); } catch (e) {}
      this.applyRoom(room, false);
      this.setData({ showRoom: false, roomPanelMode: 'current', pendingSharedRoomCode: '' });
      await this.startRoomWatch(room.roomCode);
      wx.showToast({ title: '已加入川麻房间', icon: 'success' });
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
          try {
            SichuanRoom.requireSichuanRoom(room);
          } catch (err) {
            this.leaveRoomLocally(false);
            return this.roomError(err);
          }
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
    if (!room || SichuanRoom.detectRoomGameType(room) !== 'sichuan' || !room.game) return;
    const previousActionId = this.data.lastSeenRoomActionId;
    const action = room.lastAction;
    const roomActivityViews = (room.activity || []).map(item => ({
      id: item.id,
      summary: item.summary,
      operatorNickname: item.operatorNickname,
      timeText: this.formatRoomActionTime(item.createdAt),
      isMine: item.isMine
    }));
    const roomSeatViews = (room.seats || []).map(seat => ({
      index: seat.index,
      avatarFileId: seat.avatarFileId || '',
      avatarText: String(seat.nickname || '?').slice(0, 1)
    }));
    const mySeat = room.seats && room.seats[room.mySeat];
    const roomAvatarFileId = mySeat && mySeat.avatarFileId || this.data.roomAvatarFileId;
    if (roomAvatarFileId) {
      try { wx.setStorageSync(ROOM_AVATAR_KEY, roomAvatarFileId); } catch (e) {}
    }
    this.updateRoomWritable({
      room,
      game: withRules(room.game),
      seatPositions: TableView.seatPositions(4, room.mySeat),
      roomSeatViews,
      roomAvatarFileId,
      roomActivityViews,
      lastSeenRoomActionId: action && action.id || previousActionId
    });
    this.updateBoardMeta(room.game);
    if (notify && action && action.id !== previousActionId && previousActionId && !action.isMine) {
      wx.showToast({ title: action.summary || `${action.operatorNickname} 更新了房间`, icon: 'none' });
    }
  },

  leaveRoomLocally(showToast) {
    RoomService.stopWatch();
    try { wx.removeStorageSync(ACTIVE_ROOM_KEY); } catch (e) {}
    let localGame;
    try { localGame = wx.getStorageSync(STORAGE_KEY); } catch (e) {}
    if (!localGame || !localGame.players) localGame = createSichuanGame();
    localGame = withRules(localGame);
    this.setData({
      room: null,
      roomConnected: false,
      roomWritable: false,
      showRoom: false,
      joinPreview: null,
      joinRoomFull: false,
      pendingSharedRoomCode: '',
      lastSeenRoomActionId: '',
      roomActivityViews: [],
      roomSeatViews: [],
      seatPositions: TableView.seatPositions(4),
      moveSeatChoosing: false,
      moveSeatTarget: -1
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

  toggleMoveSeat() {
    if (!this.data.room || this.data.room.status !== 'active') return this.roomError(new Error('房间当前不可换座'));
    const choosing = !this.data.moveSeatChoosing;
    this.setData({ moveSeatChoosing: choosing, moveSeatTarget: -1 });
  },

  selectMoveSeatTarget(e) {
    const index = Number(e.currentTarget.dataset.index);
    const seat = this.data.room && this.data.room.seats && this.data.room.seats[index];
    if (!seat || seat.occupied || index === this.data.room.mySeat) return;
    this.setData({ moveSeatTarget: index });
  },

  async confirmMoveSeat() {
    if (!this.data.room || this.data.room.status !== 'active') return this.roomError(new Error('房间当前不可换座'));
    const target = this.data.moveSeatTarget;
    if (target < 0 || target === this.data.room.mySeat) return this.roomError(new Error('请选择空座'));
    this.updateRoomWritable({ roomBusy: true });
    try {
      const room = await RoomService.moveSeat(this.data.room.roomCode, this.data.room.version, target);
      this.applyRoom(room, false);
      this.setData({ moveSeatChoosing: false, moveSeatTarget: -1 });
      wx.showToast({ title: '已换座', icon: 'success' });
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
    if (!room) return { title: '川麻积分器', path: '/pages/sichuan/index' };
    return {
      title: `加入川麻房间 ${room.roomCode}`,
      path: `/pages/sichuan/index?room=${room.roomCode}`
    };
  },

  // ─── 对局规则（玩法 / 底分 / 封顶）──────────────────────

  openRules() {
    const rulesEditable = !this.data.room || !!(this.data.room.isHost && this.data.room.status === 'active');
    this.setData({
      showRules: true,
      rulesEditable,
      rulesDraft: normalizeSichuanRules(this.data.game.rules)
    });
  },

  closeRules() {
    this.setData({ showRules: false });
  },

  setRuleOption(e) {
    if (!this.data.rulesEditable) return;
    const { key, value } = e.currentTarget.dataset;
    const draft = Object.assign({}, this.data.rulesDraft, { [key]: key === 'mode' ? value : Number(value) });
    this.setData({ rulesDraft: normalizeSichuanRules(draft) });
  },

  async confirmRules() {
    if (!this.data.rulesEditable) return this.closeRules();
    const next = clone(this.data.game);
    next.rules = normalizeSichuanRules(this.data.rulesDraft);
    const summary = `${sichuanPlayModeName(next.rules.mode)} · 底分 ${next.rules.baseScore} · 封顶 ${next.rules.fanCap} 番`;
    if (this.data.room) {
      try {
        await this.submitRoomGame(next, 'sichuan-rules', `房主修改规则：${summary}`);
        this.setData({ showRules: false });
      } catch (err) {
        this.roomError(err);
      }
      return;
    }
    this.setData({ game: next, showRules: false });
    this.saveGame(next);
  },

  // ─── Win modal ────────────────────────────────────────

  openWin() {
    if (this.data.room && !this.data.roomWritable) return this.roomError(new Error('房间当前不可写入'));
    const rules = normalizeSichuanRules(this.data.game.rules);
    this.setData({
      showWin: true,
      winReceiver: this.mySubject(),
      winPayers: [false, false, false, false],
      winPayerCount: 0,
      winFanIds: ['pinghu'],
      winRootCount: 0,
      winFanCap: rules.fanCap,
      winBaseScore: rules.baseScore,
      winFanPreview: null,
      fanGroups: buildFanGroups(['pinghu'])
    });
    this.previewWin();
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
    const type = SICHUAN_FAN_TYPES.find(item => item.id === id);
    if (!type || id === 'gen') return;
    let ids = this.data.winFanIds.slice();
    if (type.group === 'base') {
      ids = ids.filter(selectedId => !BASE_FAN_IDS.has(selectedId));
      ids.push(id);
    } else {
      const pos = ids.indexOf(id);
      if (pos >= 0) ids.splice(pos, 1);
      else ids.push(id);
    }
    this.setData({ winFanIds: ids, fanGroups: buildFanGroups(ids) });
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

  async confirmWin() {
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
    if (this.data.room) {
      try {
        await this.submitRoomGame(next, 'sichuan-win', `${game.players[winReceiver].name} 完成胡牌结算`);
        this.setData({ showWin: false });
        wx.showToast({ title: `${SEATS[winReceiver]} +${winFanPreview.total}分`, icon: 'success' });
      } catch (err) {
        this.roomError(err);
      }
      return;
    }
    this.setData({ game: next, showWin: false });
    this.saveGame(next);
    wx.showToast({ title: `${SEATS[winReceiver]} +${winFanPreview.total}分`, icon: 'success' });
  },

  // ─── Gang modal (杠分) ────────────────────────────────

  openGang() {
    if (this.data.room && !this.data.roomWritable) return this.roomError(new Error('房间当前不可写入'));
    // 血战到底：已胡玩家离场，不能杠牌收分，也不付杠分
    const out = sichuanWonPlayers(this.data.game);
    const subject = this.mySubject();
    const gangReceiver = out.includes(subject) ? firstActive(-1, out) : subject;
    this.setData({
      showGang: true,
      gangReceiver,
      gangKind: 'ming',
      gangDiscarder: firstActive(gangReceiver, out),
      gangOut: [0, 1, 2, 3].map(i => out.includes(i))
    });
    this.previewGang();
  },

  closeGang() {
    this.setData({ showGang: false });
  },

  selectGangReceiver(e) {
    const gangReceiver = Number(e.currentTarget.dataset.index);
    if (this.data.gangOut[gangReceiver]) return;
    const patch = { gangReceiver };
    if (this.data.gangDiscarder === gangReceiver) patch.gangDiscarder = firstActive(gangReceiver, sichuanWonPlayers(this.data.game));
    this.setData(patch);
    this.previewGang();
  },

  selectGangKind(e) {
    this.setData({ gangKind: e.currentTarget.dataset.kind });
    this.previewGang();
  },

  selectGangDiscarder(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.gangReceiver || this.data.gangOut[index]) return;
    this.setData({ gangDiscarder: index });
    this.previewGang();
  },

  previewGang() {
    const { game, gangKind, gangReceiver, gangDiscarder } = this.data;
    const rules = normalizeSichuanRules(game.rules);
    const result = calculateGang({
      kind: gangKind,
      receiver: gangReceiver,
      discarder: gangDiscarder,
      baseScore: rules.baseScore,
      outPlayers: sichuanWonPlayers(game)
    });
    if (!result) return this.setData({ gangPreview: null });
    const kind = findGangKind(gangKind);
    const payerText = kind.payerMode === 'single'
      ? `收自 ${SEATS[result.payers[0]]} ${result.amountPerPayer} 分`
      : `${result.amountPerPayer} 分/人 × ${result.payers.length} 人`;
    this.setData({
      gangPreview: Object.assign({}, result, {
        desc: kind.desc,
        text: `${SEATS[gangReceiver]} ${kind.name} · ${payerText}，共 ${result.total} 分`
      })
    });
  },

  async confirmGang() {
    const { game, gangReceiver, gangKind, gangDiscarder } = this.data;
    const rules = normalizeSichuanRules(game.rules);
    const result = calculateGang({
      kind: gangKind,
      receiver: gangReceiver,
      discarder: gangDiscarder,
      baseScore: rules.baseScore,
      outPlayers: sichuanWonPlayers(game)
    });
    if (!result) {
      wx.showToast({ title: gangKind === 'ming' ? '请选择放杠者' : '请选择杠类型', icon: 'none' });
      return;
    }
    const label = result.kind === 'ming'
      ? `${result.kindName} · 收自 ${SEATS[result.payers[0]]} ${result.amountPerPayer}分`
      : `${result.kindName} · ${result.amountPerPayer}分/人`;
    const entry = createTransferEntry({
      type: 'gang',
      gangKind: result.kind,
      receiver: gangReceiver,
      payers: result.payers,
      amountPerPayer: result.amountPerPayer,
      label
    });
    const next = clone(game);
    applySichuanEntry(next, entry);
    const toast = `${SEATS[gangReceiver]} ${result.kindName} +${result.total}分`;
    if (this.data.room) {
      try {
        await this.submitRoomGame(next, 'sichuan-gang', `${game.players[gangReceiver].name} ${result.kindName}`);
        this.setData({ showGang: false });
        wx.showToast({ title: toast, icon: 'success' });
      } catch (err) {
        this.roomError(err);
      }
      return;
    }
    this.setData({ game: next, showGang: false });
    this.saveGame(next);
    wx.showToast({ title: toast, icon: 'success' });
  },

  // ─── Penalty modal (罚分) ─────────────────────────────

  openPenalty() {
    if (this.data.room && !this.data.roomWritable) return this.roomError(new Error('房间当前不可写入'));
    const penaltyPayer = this.mySubject();
    const penaltyReceivers = [true, true, true, true];
    penaltyReceivers[penaltyPayer] = false;
    this.setData({
      showPenalty: true,
      penaltyPayer,
      penaltyReceivers,
      penaltyReceiverCount: 3,
      penaltyTypeId: 'huazhu',
      penaltyType: SICHUAN_PENALTY_TYPES[0],
      penaltyAmount: ''
    });
  },

  closePenalty() {
    this.setData({ showPenalty: false });
  },

  selectPenaltyPayer(e) {
    const penaltyPayer = Number(e.currentTarget.dataset.index);
    const penaltyReceivers = [true, true, true, true];
    penaltyReceivers[penaltyPayer] = false;
    this.setData({ penaltyPayer, penaltyReceivers, penaltyReceiverCount: 3 });
  },

  togglePenaltyReceiver(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.penaltyPayer) return;
    const penaltyReceivers = this.data.penaltyReceivers.slice();
    penaltyReceivers[index] = !penaltyReceivers[index];
    this.setData({
      penaltyReceivers,
      penaltyReceiverCount: penaltyReceivers.filter(Boolean).length
    });
  },

  selectPenaltyType(e) {
    const id = e.currentTarget.dataset.id;
    const penaltyType = SICHUAN_PENALTY_TYPES.find(type => type.id === id) || SICHUAN_PENALTY_TYPES[0];
    this.setData({ penaltyTypeId: penaltyType.id, penaltyType });
  },

  onPenaltyAmountInput(e) {
    this.setData({ penaltyAmount: e.detail.value });
  },

  async confirmPenalty() {
    const {
      game, penaltyPayer, penaltyReceivers, penaltyReceiverCount,
      penaltyAmount, penaltyType
    } = this.data;
    const amount = Math.max(0, Number(penaltyAmount) || 0);
    if (!penaltyReceiverCount) {
      wx.showToast({ title: '请至少选择一个收分玩家', icon: 'none' });
      return;
    }
    if (amount <= 0) {
      wx.showToast({ title: '请输入有效罚分金额', icon: 'none' });
      return;
    }
    const receivers = penaltyReceivers.map((value, index) => value ? index : -1).filter(index => index >= 0);
    const next = clone(game);

    receivers.forEach(receiver => {
      const entry = createTransferEntry({
        type: 'penalty',
        receiver,
        payers: [penaltyPayer],
        amountPerPayer: amount,
        label: `罚分 · ${penaltyType.name} · ${amount}分`
      });
      applySichuanEntry(next, entry);
    });

    if (this.data.room) {
      try {
        await this.submitRoomGame(next, 'sichuan-penalty', `${game.players[penaltyPayer].name} 支付${penaltyType.name}罚分`);
        this.setData({ showPenalty: false });
        wx.showToast({ title: `${SEATS[penaltyPayer]} -${amount * receivers.length}分`, icon: 'none' });
      } catch (err) {
        this.roomError(err);
      }
      return;
    }
    this.setData({ game: next, showPenalty: false });
    this.saveGame(next);
    wx.showToast({ title: `${SEATS[penaltyPayer]} -${amount * receivers.length}分`, icon: 'none' });
  },

  // ─── Setup modal ──────────────────────────────────────

  openPlayerSetup(e) {
    const index = Number(e.currentTarget.dataset.index);
    const player = this.data.game.players[index];
    if (!player) return;
    this.setData({
      showSetup: true,
      setupPlayerIndex: index,
      setupName: player.name,
      setupMissingSuit: player.missingSuit || ''
    });
  },

  closeSetup() {
    this.setData({ showSetup: false });
  },

  onSetupNameInput(e) {
    this.setData({ setupName: e.detail.value });
  },

  setMissingSuit(e) {
    const value = e.currentTarget.dataset.suit;
    this.setData({ setupMissingSuit: value === 'none' ? '' : value });
  },

  async confirmSetup() {
    const index = this.data.setupPlayerIndex;
    const name = this.data.setupName.trim();
    if (!name) {
      wx.showToast({ title: '请填写玩家姓名', icon: 'none' });
      return;
    }
    const next = clone(this.data.game);
    const player = next.players[index];
    if (!player) return;
    if (!this.data.room) player.name = name;
    player.missingSuit = this.data.setupMissingSuit || '';
    if (this.data.room) {
      if (!this.data.roomWritable) return this.roomError(new Error('房间当前不可写入'));
      try {
        await this.submitRoomGame(next, 'sichuan-setup', `更新了${SEATS[index]}家定缺`);
        this.setData({ showSetup: false });
      } catch (err) {
        this.roomError(err);
      }
      return;
    }
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
      else if (entry.type === 'gang') {
        const kind = findGangKind(entry.gangKind);
        if (kind && kind.payerMode === 'single') label = `${r} ${kind.name} · 收自 ${payers} ${a}分`;
        else if (kind) label = `${r} ${kind.name} · ${a}分/人 · 收自 ${payers}`;
        else label = `${r} 杠分 · ${a}分/人 · 收自 ${payers}`;
      }
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

  async undo() {
    const { game } = this.data;
    if (!game.history || !game.history.length) {
      wx.showToast({ title: '没有可撤销的操作', icon: 'none' });
      return;
    }
    if (this.data.room) {
      if (!this.data.roomWritable) return this.roomError(new Error('房间当前不可写入'));
      this.updateRoomWritable({ roomBusy: true });
      try {
        const room = await RoomService.undo(this.data.room.roomCode, this.data.room.version);
        this.applyRoom(room, false);
        wx.showToast({ title: '已撤销', icon: 'success' });
      } catch (err) {
        this.roomError(err);
      } finally {
        this.updateRoomWritable({ roomBusy: false });
      }
      return;
    }
    const next = clone(game);
    undoSichuanEntry(next);
    this.setData({ game: next });
    this.saveGame(next);
    wx.showToast({ title: '已撤销', icon: 'success' });
  },

  resetGame() {
    if (this.data.room && !this.data.room.isHost) {
      return this.roomError(new Error('只有房主可以重置整场'));
    }
    wx.showModal({
      title: '重置整场',
      content: '所有分数和记录都将清空。',
      success: async res => {
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
        // 重置清空分数与记录，但保留本局约定的规则
        const game = createSichuanGame(undefined, 0, this.data.game.rules);
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
