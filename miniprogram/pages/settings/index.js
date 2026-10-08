// pages/settings/index.js — 设置

const RoomService = require('../../utils/room-service');
const Theme = require('../../utils/theme');
const Recognizer = require('../../utils/recognizer-service');

const ROOM_NICKNAME_KEY = 'mj_room_nickname_v1';
const ROOM_AVATAR_KEY = 'mj_room_avatar_v1';
const ACTIVE_ROOM_KEYS = {
  riichi: 'mj_active_room_v1',
  sichuan: 'mj_sichuan_active_room_v1'
};

Page({
  data: {
    nickname: '',
    avatarFileId: '',
    avatarUploading: false,
    // 只给用户看「能不能联机」，不展示云环境 ID、函数名等部署信息
    roomAvailable: RoomService.isConfigured(),
    activeRiichiRoom: '',
    activeSichuanRoom: '',
    themeStyle: '',
    themeAccentId: Theme.current().accentId,
    themeBgId: Theme.current().bgId,
    themeAccents: Theme.ACCENTS,
    themeBgs: Theme.BACKGROUNDS,
    // 拍照识牌：自定义 OpenAI 兼容模型（留空用云端默认）
    modelBaseUrl: '',
    modelName: '',
    modelApiKey: '',
    modelCustom: false,
    modelPanelOpen: false
  },

  onLoad() {
    this.refreshLocalState();
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    const theme = Theme.current();
    this.setData({
      themeStyle: theme.pageStyle,
      themeAccentId: theme.accentId,
      themeBgId: theme.bgId
    });
    if (tabBar) tabBar.setData({ selected: 3, themeStyle: theme.tabBarStyle });
    this.refreshLocalState();
  },

  pickAccent(e) {
    const theme = Theme.save(e.currentTarget.dataset.id, this.data.themeBgId);
    this.setData({ themeStyle: theme.pageStyle, themeAccentId: theme.accentId });
  },

  pickBackground(e) {
    const theme = Theme.save(this.data.themeAccentId, e.currentTarget.dataset.id);
    this.setData({ themeStyle: theme.pageStyle, themeBgId: theme.bgId });
  },

  refreshLocalState() {
    const read = (key) => {
      try { return wx.getStorageSync(key) || ''; } catch (err) { return ''; }
    };
    this.setData({
      nickname: read(ROOM_NICKNAME_KEY),
      avatarFileId: read(ROOM_AVATAR_KEY),
      activeRiichiRoom: read(ACTIVE_ROOM_KEYS.riichi),
      activeSichuanRoom: read(ACTIVE_ROOM_KEYS.sichuan)
    });
    const model = Recognizer.loadModelConfig();
    this.setData({
      modelBaseUrl: model ? model.baseUrl : '',
      modelName: model ? model.model : '',
      modelApiKey: model ? model.apiKey : '',
      modelCustom: !!model
    });
  },

  onNicknameInput(e) {
    const nickname = e.detail.value;
    this.setData({ nickname });
    try { wx.setStorageSync(ROOM_NICKNAME_KEY, nickname); } catch (err) {}
  },

  async chooseAvatar(e) {
    const filePath = e && e.detail && e.detail.avatarUrl;
    if (!filePath || this.data.avatarUploading) return;
    this.setData({ avatarUploading: true });
    try {
      const avatarFileId = await RoomService.uploadAvatar(filePath);
      this.setData({ avatarFileId });
      try { wx.setStorageSync(ROOM_AVATAR_KEY, avatarFileId); } catch (err) {}
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (err) {
      wx.showToast({ title: err.message || '头像上传失败', icon: 'none' });
    } finally {
      this.setData({ avatarUploading: false });
    }
  },

  toggleModelPanel() { this.setData({ modelPanelOpen: !this.data.modelPanelOpen }); },

  onModelBaseUrlInput(e) { this.setData({ modelBaseUrl: e.detail.value }); },
  onModelNameInput(e) { this.setData({ modelName: e.detail.value }); },
  onModelApiKeyInput(e) { this.setData({ modelApiKey: e.detail.value }); },

  saveModel() {
    const result = Recognizer.saveModelConfig({
      baseUrl: this.data.modelBaseUrl,
      model: this.data.modelName,
      apiKey: this.data.modelApiKey
    });
    if (!result.ok) return wx.showToast({ title: result.message, icon: 'none' });
    this.setData({ modelCustom: !!result.config, modelPanelOpen: false });
    wx.showToast({ title: result.config ? '已使用自定义模型' : '已恢复默认模型', icon: 'success' });
  },

  resetModel() {
    Recognizer.saveModelConfig(null);
    this.setData({ modelBaseUrl: '', modelName: '', modelApiKey: '', modelCustom: false });
    wx.showToast({ title: '已恢复默认模型', icon: 'success' });
  },

  copyContact() {
    wx.setClipboardData({ data: 'lisangcode@outlook.com' });
  }
});
