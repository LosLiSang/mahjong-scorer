const assert = require('assert');
const fs = require('fs');
const Logic = require('./miniprogram/utils/mahjong-logic');
const Game = require('./miniprogram/utils/game-engine');
const YakuData = require('./miniprogram/utils/yaku-data');
const TutorialData = require('./miniprogram/utils/tutorial-data');
const SichuanScore = require('./miniprogram/utils/sichuan-score');
const SichuanRoom = require('./miniprogram/utils/sichuan-room');

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
assert(/open-type="chooseAvatar"[^>]*bindchooseavatar="chooseRoomAvatar"/.test(pageMarkup), '日麻房间应允许用户主动选择头像');
assert(/class="room-player-avatar"/.test(pageMarkup), '日麻联网玩家卡片应显示房间头像');
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
assert.throws(
  () => SichuanRoom.requireSichuanRoom({
    roomCode: 'OLD234',
    game: { players: [{ points: 25000 }, { points: 25000 }, { points: 25000 }, { points: 25000 }] }
  }),
  err => err.code === 'ROOM_PROTOCOL_OUTDATED' && /重新部署 mahjong-room/.test(err.message),
  '旧云函数创建的房间应提示重新部署，而不是笼统提示“不是川麻房间”'
);
assert.equal(
  SichuanRoom.detectRoomGameType({ gameType: 'sichuan' }),
  'sichuan',
  '新版川麻房间应通过 gameType 识别'
);
assert.equal(
  SichuanRoom.detectRoomGameType({ game: { players: [{ score: 0 }, { score: 0 }, { score: 0 }, { score: 0 }] } }),
  'sichuan',
  '视图偶发缺少 gameType 时，可通过川麻 score 结构兼容识别'
);
assert.throws(
  () => SichuanRoom.requireSichuanRoom({ gameType: 'riichi' }),
  err => err.code === 'INVALID_GAME_TYPE' && /日麻房间/.test(err.message),
  '明确的日麻房间仍应提示从日麻页面加入'
);

const sichuanMarkup = fs.readFileSync('./miniprogram/pages/sichuan/index.wxml', 'utf8');
const sichuanStyle = fs.readFileSync('./miniprogram/pages/sichuan/index.wxss', 'utf8');
assert(/showWin[\s\S]*?<scroll-view[^>]*class="[^"]*tab-safe-scroll-modal/.test(sichuanMarkup), '川麻长弹窗应使用明确高度的滚动容器');
assert(/class="room-banner[^"]*" bindtap="openRoomPanel"/.test(sichuanMarkup), '川麻计分页应提供联机房间入口');
assert(/showRoom[^>]*class="[^"]*tab-safe-overlay/.test(sichuanMarkup), '川麻房间弹窗应使用 tabBar 安全遮罩');
assert(/open-type="chooseAvatar"[^>]*bindchooseavatar="chooseRoomAvatar"/.test(sichuanMarkup), '川麻房间应允许用户主动选择头像');
assert(/class="room-player-avatar"/.test(sichuanMarkup), '川麻联网玩家卡片应显示房间头像');
assert(/\.room-player-avatar\s*\{/.test(commonStyle), '共享样式应定义玩家卡片头像');
const sichuanPageScript = fs.readFileSync('./miniprogram/pages/sichuan/index.js', 'utf8');
assert(/gameType:\s*'sichuan'/.test(sichuanPageScript), '创建川麻房间时应声明 Sichuan gameType');
assert(/RoomService\.create\([\s\S]*?SichuanRoom\.requireSichuanRoom\(room\)/.test(sichuanPageScript), '创建川麻房间后应立即验证云函数协议');
assert(/class="table-board sichuan-board">/.test(sichuanMarkup), '川麻牌桌背景本身不应打开设置');
assert(/class="player-card seat-\{\{seatClasses\[index\]\}\} sichuan-player"[\s\S]*bindtap="openPlayerSetup"/.test(sichuanMarkup), '只有四个玩家卡片应作为设置入口');
assert(!/bindtap="openSetup"/.test(sichuanMarkup), '川麻页面不应保留整张牌桌或独立设置按钮入口');
assert(/setupPlayerIndex[\s\S]*setupName[\s\S]*setupMissingSuit/.test(sichuanMarkup), '设置弹窗应只编辑当前点击的单个玩家');
assert(/class="btn-row sichuan-score-actions"[\s\S]*openWin[\s\S]*openGang[\s\S]*openPenalty[\s\S]*<\/view>/.test(sichuanMarkup), '胡牌、杠分、罚分三个主按钮应在同一行');
assert(/杠牌者[\s\S]*seg-group seg-one-line player-select-row/.test(sichuanMarkup), '杠牌者四个座位应排成一行');
assert(/谁送分[\s\S]*谁收分（可多选）[\s\S]*罚分情况/.test(sichuanMarkup), '罚分应先选择送分方、收分方，再选择罚分情况');
assert(/查花猪[\s\S]*查大叫[\s\S]*退税[\s\S]*诈和/.test(JSON.stringify(SichuanScore.SICHUAN_PENALTY_TYPES)), '罚分说明应覆盖常见川麻罚分情况');
assert(/\.fan-chip-grid\s*\{[^}]*repeat\(2/.test(sichuanStyle), '川麻番型应以两列网格展示');
assert(/\.sch-fan-btn\s*\{[^}]*min-height\s*:\s*56rpx[^}]*box-sizing\s*:\s*border-box/s.test(sichuanStyle), '番型按钮应使用紧凑高度并避免宽度溢出挤掉间距');
assert(/\.fan-chip-grid\s*\{[^}]*gap\s*:\s*8rpx/.test(sichuanStyle), '番型网格应保留清晰但紧凑的按钮间距');
assert(/font-family:\s*SimSun[^;]*serif\s*!important/.test(sichuanStyle), '川麻输入框应强制使用衬线字体');
assert(/\.modal \.btn\s*\{[^}]*padding\s*:\s*17rpx 20rpx[^}]*font-size\s*:\s*24rpx/s.test(sichuanStyle), '川麻弹窗按钮应使用紧凑尺寸');
assert(!/winFanIds\.indexOf/.test(sichuanMarkup), 'WXML 中不能调用 Array.indexOf 判断番型选中状态');
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

// 教学馆每课都应提供术语与章末小测，答对小测才标记学会
let lessonProblems = [];
(TutorialData.MAHJONG_TUTORIAL.lessons || []).forEach(l => {
  if (!l.terms || !l.terms.length) lessonProblems.push(`${l.id}: 缺少术语`);
  if (!l.checkQuestionId || !TutorialData.getTutorialQuestion(l.checkQuestionId)) {
    lessonProblems.push(`${l.id}: 缺少有效的章末小测`);
  }
});
assert.equal(lessonProblems.length, 0, '教学馆课程数据应完整：' + lessonProblems.join('；'));
assert(!!TutorialData.getTutorialLesson('strategy'), '教学馆应包含「开局策略」课');
assert(/bindtap="submitLessonCheck"/.test(tutorialMarkup), '课程结尾应提供章末小测提交入口');
assert(/lesson-status-badge/.test(tutorialMarkup), '每章课程卡片应显示明确的学习状态标签');
assert(/已学会[\s\S]*未学会/.test(tutorialMarkup), '课程状态应区分已学会与未学会');
assert(/item\.learned/.test(tutorialMarkup), '课程卡片应读取预计算的 learned 状态');
assert(!/progress\.indexOf/.test(tutorialMarkup), 'WXML 中不能调用 Array.indexOf 判断课程状态');
assert(!/bindtap="completeLesson"/.test(tutorialMarkup), '不应再用手动按钮直接标记学完');

// 原入门测验应改为多个主题的专项训练，其中保留完整的役形判断题
const trainingTopics = TutorialData.MAHJONG_TUTORIAL.trainingTopics || [];
assert(trainingTopics.length >= 3, '教学馆应提供多个专项训练主题');
const trainingProblems = [];
trainingTopics.forEach(topic => {
  const resolved = TutorialData.getTrainingTopic(topic.id);
  if (!resolved || !resolved.questions.length) trainingProblems.push(`${topic.id}: 没有题目`);
  if (resolved && resolved.questions.length !== topic.questionIds.length) trainingProblems.push(`${topic.id}: 存在无效题号`);
});
assert.equal(trainingProblems.length, 0, '专项训练数据应完整：' + trainingProblems.join('；'));
const yakuTraining = TutorialData.getTrainingTopic('yaku-shapes');
const yakuQuizIds = (yakuTraining && yakuTraining.questions || []).map(x => x.id);
const needQuiz = ['q9','q10','q11','q12','q13','q14','q15'];
const missingQuiz = needQuiz.filter(id => !yakuQuizIds.includes(id));
assert.equal(missingQuiz.length, 0, '役形判断专项应包含全部判断题：' + missingQuiz.join('、'));
assert(/bindtap="openTraining"/.test(tutorialMarkup), '教学馆应按主题展示专项训练入口');
assert(!/入门测验/.test(tutorialMarkup), '页面不应再显示单一的入门测验入口');
const perfectYakuAnswers = yakuTraining.questions.map(question => question.answer);
const yakuGrade = TutorialData.gradeTrainingTopic('yaku-shapes', perfectYakuAnswers);
assert.equal(yakuGrade.score, yakuGrade.total, '专项训练评分应能正确判定满分');

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

// 章末小测：答错不标记，答对后持久化「已学会」；专项训练按主题载入
let tutorialPageDefinition = null;
let storedTutorialProgress = ['tiles'];
global.Page = (definition) => { tutorialPageDefinition = definition; };
global.wx = {
  getStorageSync: () => storedTutorialProgress,
  setStorageSync: (_key, value) => { storedTutorialProgress = value.slice(); },
  showToast: () => {},
  setClipboardData: () => {},
  navigateTo: () => {},
};
require('./miniprogram/pages/tutorial/index');
assert(tutorialPageDefinition, '教学馆页面应成功注册');
const tutorialPage = Object.assign({}, tutorialPageDefinition, {
  data: JSON.parse(JSON.stringify(tutorialPageDefinition.data)),
  setData(patch) { Object.assign(this.data, patch); },
});
tutorialPage.onLoad();
tutorialPage.onShow();
assert.equal(
  tutorialPage.data.lessons.find(lesson => lesson.id === 'tiles').learned,
  true,
  '读取历史进度后，对应课程卡片应自动显示已学会'
);
assert.equal(
  tutorialPage.data.lessons.find(lesson => lesson.id === 'turn').learned,
  false,
  '没有完成记录的课程卡片应显示未学会'
);
tutorialPage.openLesson({ currentTarget: { dataset: { id: 'turn' } } });
const lessonCheck = tutorialPage.data.activeLesson.check;
const wrongAnswer = (lessonCheck.answer + 1) % lessonCheck.options.length;
tutorialPage.selectLessonCheckOption({ currentTarget: { dataset: { answer: wrongAnswer } } });
tutorialPage.submitLessonCheck();
assert(!storedTutorialProgress.includes('turn'), '章末小测答错时不能标记已学会');
tutorialPage.retryLessonCheck();
tutorialPage.selectLessonCheckOption({ currentTarget: { dataset: { answer: lessonCheck.answer } } });
tutorialPage.submitLessonCheck();
assert(storedTutorialProgress.includes('turn'), '章末小测答对后应持久化已学会状态');
assert(tutorialPage.data.activeLessonLearned, '答对后当前课程应立即显示已学会');
assert.equal(
  tutorialPage.data.lessons.find(lesson => lesson.id === 'turn').learned,
  true,
  '答对后课程列表中的状态标签应立即更新为已学会'
);
tutorialPage.openTraining({ currentTarget: { dataset: { id: 'yaku-shapes' } } });
assert.equal(tutorialPage.data.quizQuestions.length, 7, '役形判断专项应载入 7 道题');

// 川麻交互：番型选中状态预计算；罚分按送分方、收分方和类型结算
let sichuanPageDefinition = null;
const sichuanStore = {};
global.Page = (definition) => { sichuanPageDefinition = definition; };
global.wx = {
  getStorageSync: key => sichuanStore[key] || null,
  setStorageSync: (key, value) => { sichuanStore[key] = JSON.parse(JSON.stringify(value)); },
  removeStorageSync: key => { delete sichuanStore[key]; },
  showToast: () => {},
  showModal: ({ success }) => success({ confirm: true }),
  setClipboardData: () => {},
  navigateTo: () => {},
};
require('./miniprogram/pages/sichuan/index');
assert(sichuanPageDefinition, '川麻页面应成功注册');
const sichuanPage = Object.assign({}, sichuanPageDefinition, {
  data: JSON.parse(JSON.stringify(sichuanPageDefinition.data)),
  setData(patch) { Object.assign(this.data, patch); },
});
sichuanPage.onLoad({});
sichuanPage.openWin();
assert.deepEqual(sichuanPage.data.winFanIds, ['pinghu'], '胡牌面板默认明确选择平胡');
sichuanPage.toggleWinFan({ currentTarget: { dataset: { id: 'qingyise' } } });
assert.deepEqual(sichuanPage.data.winFanIds, ['qingyise'], '选择新的基础番型时应替换原基础番型');
sichuanPage.toggleWinFan({ currentTarget: { dataset: { id: 'zimo' } } });
assert.deepEqual(sichuanPage.data.winFanIds, ['qingyise', 'zimo'], '额外番型应在基础番型上继续多选');
const selectedBaseFans = sichuanPage.data.fanGroups
  .flatMap(group => group.types)
  .filter(type => type.group === 'base' && type.selected);
assert.equal(selectedBaseFans.length, 1, '番型网格中只能有一个基础番型处于选中状态');
const guardedFan = SichuanScore.calculateSichuanFan(['qingyise', 'duiduihu', 'zimo'], 6, 0);
assert.equal(guardedFan.fan, 3, '计分逻辑层应只采用最后一个基础番型，再叠加额外番型');
assert(!guardedFan.label.includes('清一色'), '被替换的基础番型不能出现在计分标签中');
sichuanPage.closeWin();
sichuanPage.openPenalty();
sichuanPage.selectPenaltyPayer({ currentTarget: { dataset: { index: 2 } } });
assert.deepEqual(sichuanPage.data.penaltyReceivers, [true, true, false, true], '切换送分方后默认由其余三家收分');
sichuanPage.togglePenaltyReceiver({ currentTarget: { dataset: { index: 0 } } });
sichuanPage.selectPenaltyType({ currentTarget: { dataset: { id: 'dajiao' } } });
sichuanPage.onPenaltyAmountInput({ detail: { value: '3' } });
sichuanPage.confirmPenalty();
assert.equal(sichuanPage.data.penaltyType.name, '查大叫');
assert.deepEqual(sichuanPage.data.game.players.map(player => player.score), [0, 3, -6, 3], '罚分应按所选送分方和收分方保持零和结算');
sichuanPage.openPlayerSetup({ currentTarget: { dataset: { index: 2 } } });
assert.equal(sichuanPage.data.setupPlayerIndex, 2, '点击西家卡片应只打开西家设置');
assert.equal(sichuanPage.data.setupName, '玩家三');
sichuanPage.onSetupNameInput({ detail: { value: '西家新名' } });
sichuanPage.setMissingSuit({ currentTarget: { dataset: { suit: 'p' } } });
sichuanPage.confirmSetup();
assert.equal(sichuanPage.data.game.players[2].name, '西家新名');
assert.equal(sichuanPage.data.game.players[2].missingSuit, 'p');
assert.equal(sichuanPage.data.game.players[1].name, '玩家二', '单玩家设置不能修改其他座位');
const roomGame = SichuanScore.createSichuanGame(['甲', '乙', '丙', '丁']);
const sichuanRoomView = {
  roomCode: 'SCMJ24', gameType: 'sichuan', status: 'active', version: 2,
  isHost: true, mySeat: 0,
  seats: roomGame.players.map((player, index) => ({
    index,
    nickname: player.name,
    avatarFileId: index === 0 ? 'cloud://test-env/avatar-a.jpg' : '',
    occupied: true,
    isMe: index === 0
  })),
  game: roomGame, lastAction: null, activity: []
};
sichuanPage.applyRoom(sichuanRoomView, false);
sichuanPage.updateRoomWritable({ roomConnected: true, roomOnline: true, roomBusy: false });
assert.equal(sichuanPage.data.roomWritable, true, '川麻房间连接后应允许提交实时计分');
assert.equal(sichuanPage.data.game.players[0].name, '甲', '川麻房间状态应替换本地牌桌数据');
assert.equal(sichuanPage.data.roomSeatViews[0].avatarFileId, 'cloud://test-env/avatar-a.jpg', '川麻玩家卡片应取得对应座位头像');
assert.equal(sichuanPage.data.roomSeatViews[1].avatarText, '乙', '未选择头像的玩家应使用昵称首字占位');
assert(sichuanPage.onShareAppMessage().path.includes('/pages/sichuan/index?room=SCMJ24'), '川麻房间分享应返回川麻页面路径');

// 换座：成员可把自己从当前座位移到空座，且只能选空座，未选目标时不允许提交
const moveView = {
  roomCode: 'SCMJ24', gameType: 'sichuan', status: 'active', version: 3,
  isHost: true, mySeat: 0,
  seats: [
    { index: 0, nickname: '甲', avatarFileId: '', occupied: true, isMe: true },
    { index: 1, nickname: '玩家二', avatarFileId: '', occupied: false, isMe: false },
    { index: 2, nickname: '丙', avatarFileId: '', occupied: true, isMe: false },
    { index: 3, nickname: '丁', avatarFileId: '', occupied: true, isMe: false }
  ],
  game: { version: 1, players: [
    { name: '甲', score: 0, missingSuit: '' },
    { name: '玩家二', score: 0, missingSuit: '' },
    { name: '丙', score: 0, missingSuit: '' },
    { name: '丁', score: 0, missingSuit: '' }
  ], history: [] },
  lastAction: null, activity: []
};
sichuanPage.applyRoom(moveView, false);
sichuanPage.updateRoomWritable({ roomConnected: true, roomOnline: true, roomBusy: false });
sichuanPage.toggleMoveSeat();
assert.equal(sichuanPage.data.moveSeatChoosing, true, '点击换座应进入选择目标座模式');
sichuanPage.toggleMoveSeat();
assert.equal(sichuanPage.data.moveSeatChoosing, false, '再次点击应退出换座');
sichuanPage.toggleMoveSeat();
sichuanPage.selectMoveSeatTarget({ currentTarget: { dataset: { index: 2 } } });
assert.equal(sichuanPage.data.moveSeatTarget, -1, '不能选中已坐人的座位');
sichuanPage.selectMoveSeatTarget({ currentTarget: { dataset: { index: 0 } } });
assert.equal(sichuanPage.data.moveSeatTarget, -1, '不能停留或回到自己当前座位');
sichuanPage.selectMoveSeatTarget({ currentTarget: { dataset: { index: 1 } } });
assert.equal(sichuanPage.data.moveSeatTarget, 1, '可选中空座作为目标');
assert.equal(sichuanPage.data.game.players[0].name, '甲', '未换座前座位玩家仍为甲');
sichuanPage.setData({ moveSeatTarget: -1 });
sichuanPage.confirmMoveSeat();
assert.equal(sichuanPage.data.moveSeatChoosing, true, '未选目标确认时应留在换座模式');

// 日麻页面换座接线：成员移到空座，目标仅限空座
const riichiMoveView = {
  roomCode: 'ABC234', status: 'active', mode: 'yonma', version: 3,
  isHost: true, mySeat: 0,
  seats: [
    { index: 0, nickname: '房主', occupied: true, isMe: true },
    { index: 1, nickname: '玩家二', occupied: false, isMe: false },
    { index: 2, nickname: '玩家三', occupied: true, isMe: false },
    { index: 3, nickname: '玩家四', occupied: true, isMe: false }
  ],
  game: Game.newGame(4), lastAction: null, activity: []
};
page.setData({ room: riichiMoveView, roomWritable: true });
page.toggleMoveSeat();
assert.equal(page.data.moveSeatChoosing, true, '日麻点击换座应进入选择模式');
page.selectMoveSeatTarget({ currentTarget: { dataset: { index: 2 } } });
assert.equal(page.data.moveSeatTarget, -1, '日麻不能选中已坐人的座位');
page.selectMoveSeatTarget({ currentTarget: { dataset: { index: 1 } } });
assert.equal(page.data.moveSeatTarget, 1, '日麻可选中空座作为目标');

console.log('mini-program tests passed');
