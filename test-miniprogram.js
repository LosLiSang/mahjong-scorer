const assert = require('assert');
const fs = require('fs');
const Logic = require('./miniprogram/utils/mahjong-logic');
const Game = require('./miniprogram/utils/game-engine');
const YakuData = require('./miniprogram/utils/yaku-data');
const TutorialData = require('./miniprogram/utils/tutorial-data');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
global.wx = {
  getStorageSync: () => null,
  setStorageSync: () => {},
  showToast: () => {},
  showModal: ({ success }) => success({ confirm: true })
};
require('./miniprogram/pages/index/index');
assert(pageDefinition, '页面应成功注册');

const page = Object.assign({}, pageDefinition, {
  data: JSON.parse(JSON.stringify(pageDefinition.data)),
  setData(patch, callback) {
    Object.entries(patch).forEach(([path, value]) => {
      const parts = path.split('.');
      let target = this.data;
      while (parts.length > 1) target = target[parts.shift()];
      target[parts[0]] = value;
    });
    if (callback) callback();
  }
});

page.onLoad();
assert.equal(page.data.game.players.length, 4);
assert.equal(page.data.tileRows.length, 4);
assert.equal(page.data.tileRows[0].tiles.length, 9);
assert.equal(page.data.tileRows[3].tiles.length, 7);

const tiles = ['2m','3m','4m','3p','4p','5p','4s','5s','6s','6s','7s','8s','5m','5m'];
const result = Logic.evaluateHand({
  tiles, isOpened:false, isTsumo:true, isRiichi:true,
  winTile:'5m', roundWind:'1z', seatWind:'1z', doraCount:0
});
assert(result.valid, result.error);
const payment = Game.calcWinPayments(page.data.game, 0, result.han, result.fu, true, -1, result.basePoint);
assert.equal(payment.total, 6000, '亲家3番30符自摸应收6000点');

page.openWin();
// 和牌结算按 基本→牌型→宝牌 分步填写，且切换步骤不丢失中间数据
assert.equal(page.data.winStep, 1, '和牌弹窗初始在第 1 步');
page.nextWinStep();
assert.equal(page.data.winStep, 2, '下一步进入第 2 步（牌型）');
page.nextWinStep();
assert.equal(page.data.winStep, 3, '再下一步进入第 3 步（宝牌与确认）');
page.prevWinStep();
assert.equal(page.data.winStep, 2, '上一步回到第 2 步');
page.goWinStep({ currentTarget:{ dataset:{ step:1 } } });
assert.equal(page.data.winStep, 1, '点击步骤条可跳回第 1 步');

tiles.forEach((id) => page.addTile({ currentTarget:{ dataset:{ id } } }));
page.selectWinTile({ currentTarget:{ dataset:{ id:'5m' } } });
page.selectWinType({ currentTarget:{ dataset:{ value:'tsumo' } } });
page.selectRiichiState({ currentTarget:{ dataset:{ value:'riichi' } } });
page.analyzeHand();
assert(page.data.analysisStage === 1);
assert(page.data.analysisResult, page.data.analysisMessage);
assert(page.data.analysisResult.yakuText.includes('立直'));
assert(page.data.analysisResult.scoreText.includes('6000点'));
// 分析后翻/符选择器应继承分析结果（3 翻 30 符 → 索引 2）
assert.equal(page.data.hanIndex, 2, '分析后翻数选择器应继承 3 翻');
assert.equal(page.data.fuIndex, 2, '分析后符数选择器应继承 30 符');

// 和牌弹窗必须给底部操作区预留系统安全区，避免真机底部按钮被遮挡
const pageStyle = fs.readFileSync('./miniprogram/pages/index/index.wxss', 'utf8');
assert(
  /\.modal-actions\s*\{[^}]*padding-bottom\s*:\s*calc\([^)]*env\(safe-area-inset-bottom\)/s.test(pageStyle),
  '和牌弹窗底部操作区应包含 safe-area-inset-bottom'
);

// 所有弹窗必须盖住自定义 tabBar，否则房间弹窗底部会被导航栏遮挡
const commonStyle = fs.readFileSync('./miniprogram/utils/common.wxss', 'utf8');
const tabBarStyle = fs.readFileSync('./miniprogram/custom-tab-bar/index.wxss', 'utf8');
const overlayZ = Number((commonStyle.match(/\.overlay\s*\{[^}]*z-index\s*:\s*(\d+)/s) || [])[1]);
const tabBarZ = Number((tabBarStyle.match(/\.tab-bar\s*\{[^}]*z-index\s*:\s*(\d+)/s) || [])[1]);
assert(overlayZ > tabBarZ, `弹窗层级 ${overlayZ} 必须高于底部导航层级 ${tabBarZ}`);

const pageMarkup = fs.readFileSync('./miniprogram/pages/index/index.wxml', 'utf8');
const tutorialMarkup = fs.readFileSync('./miniprogram/pages/tutorial/index.wxml', 'utf8');
assert(/showRoom[^>]*class="[^"]*tab-safe-overlay/.test(pageMarkup), '房间弹窗应使用 tabBar 安全遮罩');
assert(/room-modal[^>]*>\s*<view class="modal-close room-panel-close" bindtap="closeRoomPanel">/s.test(pageMarkup), '房间管理弹窗顶部必须始终提供关闭按钮');
assert(/bindtap="leaveRoom"[^>]*>返回本地计分<\/button>/.test(pageMarkup), '离开联网房间的按钮文案应明确表示返回本地计分');
assert.equal((pageMarkup.match(/class="table-corner corner-/g) || []).length, 4, '日麻牌桌四角应各有一个功能状态');
const sichuanBoardMarkup = fs.readFileSync('./miniprogram/pages/sichuan/index.wxml', 'utf8');
assert.equal((sichuanBoardMarkup.match(/class="table-corner corner-/g) || []).length, 4, '川麻牌桌四角应各有一个功能状态');
assert(/\.table-corner\s*\{/.test(commonStyle), '共享牌桌样式应定义极简四角状态组件');
assert(/\.table-center\s*\{[^}]*top\s*:\s*calc\(50%\s*\+\s*20rpx\)[^}]*width\s*:\s*172rpx[^}]*height\s*:\s*140rpx[^}]*translate3d\(-50%,\s*-50%,\s*0\)/s.test(commonStyle), '共享中心状态框应使用固定尺寸并做视觉居中校正');
assert(/class="room-management-row"[\s\S]*bindtap="leaveRoom"[\s\S]*<\/view>\s*<button class="btn room-panel-dismiss" bindtap="closeRoomPanel">关闭<\/button>/.test(pageMarkup), '房间管理操作应分组排列，关闭按钮应独占一行');
assert(/showLesson[^>]*class="[^"]*tab-safe-overlay/.test(tutorialMarkup), '教学课程弹窗应使用 tabBar 安全遮罩');
assert(
  /\.tab-safe-overlay\s*\{[^}]*bottom\s*:\s*calc\(108rpx\s*\+\s*env\(safe-area-inset-bottom\)\)/s.test(commonStyle),
  'tabBar 页面弹窗底部必须避开自定义导航栏'
);
assert(
  /\.tab-safe-overlay\s*>\s*\.tutorial-modal[^}]*max-height\s*:\s*calc\(100vh\s*-\s*156rpx\s*-\s*env\(safe-area-inset-bottom\)\)/s.test(commonStyle),
  '教学弹窗高度必须限制在导航栏上方的可用区域'
);
const tutorialStyle = fs.readFileSync('./miniprogram/pages/tutorial/index.wxss', 'utf8');
assert(/\.tutorial-modal\s*\{[^}]*overflow\s*:\s*hidden/s.test(tutorialStyle), '教学弹窗应裁切超出安全区域的内容');
assert(/\.lesson-scroll\s*\{[^}]*min-height\s*:\s*0/s.test(tutorialStyle), '课程滚动区必须允许在 flex 容器内收缩');
const sichuanMarkup = fs.readFileSync('./miniprogram/pages/sichuan/index.wxml', 'utf8');
assert(/showWin[\s\S]*?<scroll-view[^>]*class="[^"]*tab-safe-scroll-modal/.test(sichuanMarkup), '川麻长弹窗应使用明确高度的滚动容器');
assert(
  /\.tab-safe-scroll-modal\s*\{[^}]*height\s*:\s*calc\(100vh\s*-\s*156rpx\s*-\s*env\(safe-area-inset-bottom\)\)/s.test(commonStyle),
  '长弹窗必须设置明确高度才能启用 scroll-view 滚动'
);

// 和牌结算最后一页（宝牌）也要能展示牌型分析结果
const step3Block = pageMarkup.match(/<block wx:if="\{\{winStep === 3\}\}">[\s\S]*?<\/block>/);
assert(step3Block && /analysisResult[\s\S]*result-card/.test(step3Block[0]), '和牌结算最后一页应展示牌型分析结果');

// 役种牌例数据完整性：每个例必须是 14 张完成和牌（等待形为 13 张）并带胡牌张
let yakuProblems = [];
(YakuData.YAKU_CATALOG || []).forEach(y => {
  if (typeof y.win !== 'string') yakuProblems.push(`${y.name}: 缺少胡牌张`);
  if (!y.example || !y.example.length) return;
  const ex = YakuData.getYakuExample(y);
  if (y.win === '') { if (ex.hand.length !== 13) yakuProblems.push(`${y.name}: 等待形应为 13 张`); }
  else if (ex.hand.concat([ex.win]).length !== 14) yakuProblems.push(`${y.name}: 应为 14 张完成和牌`);
});
assert.equal(yakuProblems.length, 0, '役种牌例数据应完整（14 张或 13 张等待形 + 胡牌张）：' + yakuProblems.join('；'));

// 教学馆每课都应提供术语释义，且包含开局策略课
let lessonProblems = [];
(TutorialData.MAHJONG_TUTORIAL.lessons || []).forEach(l => {
  if (!l.terms || !l.terms.length) lessonProblems.push(`${l.id}: 缺少术语`);
});
assert.equal(lessonProblems.length, 0, '教学馆每课应提供术语释义：' + lessonProblems.join('；'));
assert(!!TutorialData.getTutorialLesson('strategy'), '教学馆应包含「开局策略」课');

// 教学馆测验应包含「役形判断」题
const quizIds = (TutorialData.MAHJONG_TUTORIAL.quiz || []).map(x => x.id);
const needQuiz = ['q9','q10','q11','q12','q13','q14','q15'];
const missingQuiz = needQuiz.filter(id => !quizIds.includes(id));
assert.equal(missingQuiz.length, 0, '测验应包含役形判断题：' + missingQuiz.join('、'));

page.confirmWin();
assert.equal(page.data.game.players[0].points, 31000);
assert.equal(page.data.game.players[1].points, 23000);
assert.equal(page.data.game.history.length, 1);

// 七对子没有普通面子分解，也必须能完成分析
page.openWin();
const chiitoi = ['1m','1m','2m','2m','3p','3p','4p','4p','5s','5s','6s','6s','7z','7z'];
chiitoi.forEach((id) => page.addTile({ currentTarget:{ dataset:{ id } } }));
page.selectWinTile({ currentTarget:{ dataset:{ id:'7z' } } });
page.selectRiichiState({ currentTarget:{ dataset:{ value:'riichi' } } });
page.analyzeHand();
assert(page.data.analysisResult, page.data.analysisMessage);
assert.equal(page.data.analysisResult.typeName, '七对子');

console.log('mini-program tests: 31 assertions passed');
