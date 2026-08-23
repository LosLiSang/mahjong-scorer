// app.js — 日麻计分器微信小程序
const Config = require('./config');

App({
  globalData: {
    version: '1.1.0',
    cloudConfigured: !!Config.cloudEnvId
  },
  onLaunch() {
    // 云环境未配置时保持纯本地模式，不影响原有积分器。
    if (Config.cloudEnvId && wx.cloud) {
      wx.cloud.init({
        env: Config.cloudEnvId,
        traceUser: true
      });
    }
  }
});
