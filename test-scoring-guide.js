const assert = require('assert');
const {
  calcBasePoint,
  getLimitName,
  calcPointPayments,
  calcDrawDeltas,
} = require('./mahjong-logic');
const {
  FU_REFERENCE,
  LIMIT_REFERENCE,
  calculateFuExample,
} = require('./scoring-guide-data');

assert(FU_REFERENCE.length >= 8, '符数详解至少覆盖 8 类加符来源');
assert(LIMIT_REFERENCE.length >= 5, '满贯档位至少覆盖满贯到役满');

const fuExample = calculateFuExample({
  closedRon: true,
  tsumo: false,
  pairFu: 2,
  waitFu: 2,
  mentsuFu: 8,
});
assert.equal(fuExample.rawFu, 42, '符数原始合计应正确');
assert.equal(fuExample.roundedFu, 50, '普通牌型符数应向上切到十位');
assert(fuExample.steps.some(step => step.label === '副底'), '计算过程必须显示副底');

assert.equal(getLimitName(4, 30), '', '4番30符未达到满贯');
assert.equal(getLimitName(4, 40), '满贯', '4番40符达到满贯');
assert.equal(getLimitName(5, 20), '满贯');
assert.equal(getLimitName(6, 30), '跳满');
assert.equal(getLimitName(8, 30), '倍满');
assert.equal(getLimitName(11, 30), '三倍满');
assert.equal(getLimitName(13, 30), '役满');

assert.deepEqual(
  calcPointPayments(3, 40, { isDealer: false, isTsumo: false }),
  { basePoint: 1280, limitName: '', total: 5200, payments: [{ label: '放铳者支付', amount: 5200 }] },
  '子家 3番40符荣和应为 5200'
);
assert.deepEqual(
  calcPointPayments(3, 40, { isDealer: true, isTsumo: true }),
  {
    basePoint: 1280,
    limitName: '',
    total: 7800,
    payments: [{ label: '三家各付', amount: 2600, count: 3 }],
  },
  '亲家 3番40符自摸应为 2600 all'
);
assert.deepEqual(
  calcPointPayments(5, 30, { isDealer: false, isTsumo: true }),
  {
    basePoint: 2000,
    limitName: '满贯',
    total: 8000,
    payments: [
      { label: '亲家支付', amount: 4000 },
      { label: '其余两家各付', amount: 2000, count: 2 },
    ],
  },
  '子家满贯自摸应为 4000/2000'
);

assert.deepEqual(
  calcDrawDeltas(new Set([0])),
  [3000, -1000, -1000, -1000],
  '一人听牌时听牌者收 3000，其余三家各付 1000'
);
assert.deepEqual(
  calcDrawDeltas(new Set([0, 2])),
  [1000, -1000, 1000, -1000],
  '两人听牌时平分两名不听者各付的 1000 点'
);
assert.deepEqual(
  calcDrawDeltas(new Set([0, 1, 2])),
  [400, 300, 300, -1000],
  '三人听牌时按百点单位尽量平分唯一不听者的 1000 点'
);
assert.deepEqual(calcDrawDeltas(new Set()), [0, 0, 0, 0], '无人听牌不交换点数');
assert.deepEqual(calcDrawDeltas(new Set([0, 1, 2, 3])), [0, 0, 0, 0], '四人听牌不交换点数');

const fs = require('fs');
const html = fs.readFileSync('./index.html', 'utf8');
assert(/<script src="mahjong-logic\.js\?v=[^"]+"><\/script>/.test(html), '核心逻辑脚本必须带发布版本，避免手机缓存新旧代码混用');
assert(/<script src="scoring-guide-data\.js\?v=[^"]+"><\/script>/.test(html), '算分教学数据必须带发布版本');
assert(/function\s+seatOf\(playerIndex/.test(html), '玩家方位必须随庄家轮转动态计算');
assert(/const\s+seat\s*=\s*seatOf\(i\)/.test(html), '玩家卡片必须使用动态座风');
assert(/winnerName: winner\.name/.test(html), '和牌历史必须保存当时的玩家姓名');
assert(/const\s+tenpaiPlayers\s*=\s*\[\.\.\.tenpai\]\.map/.test(html), '流局历史必须在轮庄前冻结当时的座风与姓名');
assert(/function\s+previewDraw/.test(html), '流局弹窗必须实时预览听牌罚符');
assert(/btn\.onclick\s*=\s*\(\)\s*=>\s*\{[\s\S]*previewDraw\(\)/s.test(html), '切换听牌玩家后必须立即刷新流局点数预览');
assert(/calcDrawDeltas\(tenpai\)/.test(html), '流局预览和结算必须共用统一算法');
assert(/id="playerSetupOverlay"/.test(html), '新对局必须提供玩家姓名设置弹窗');
assert(/id="playerName0"/.test(html) && /id="playerName3"/.test(html), '姓名设置必须包含四位玩家');
assert(/function\s+confirmPlayerSetup/.test(html), '必须提供确认玩家姓名的流程');
assert(!/if\s*\(!hasPlayerNames\(\)\)\s*openPlayerSetup/.test(html), '首次进入必须使用默认姓名，不能强制弹出姓名设置');
assert(/class="name name-edit"/.test(html) && /onclick="openPlayerSetup/.test(html), '玩家姓名必须可以从玩家卡片点击修改');
assert(/game\.players\[winState\.winnerIdx\]\.points\s*\+=\s*result\.stickBonus/.test(html), '和牌者必须实际获得全部立直供托');
assert(/function\s+clearRoundRiichi/.test(html), '每局结算后必须统一清除本局立直状态');
assert(/function\s+confirmWin[\s\S]*clearRoundRiichi\(\)/s.test(html), '和牌结算后必须清除立直状态');
assert(/function\s+confirmDraw[\s\S]*clearRoundRiichi\(\)/s.test(html), '流局后必须清除立直状态但保留供托');
assert(/game\.honba\+\+;[\s\S]*if\s*\(dealerTenpai\)/s.test(html), '荒牌流局必须先增加一本场，再判断庄家是否连庄');
assert(/const\s+drawRound\s*=\s*ROUND_NAMES\[game\.roundIndex\]/.test(html), '流局历史必须记录结算前的局数');
assert(/function\s+playerLabel\(playerIndex\)[\s\S]*seatOf\(playerIndex\)[\s\S]*game\.players\[playerIndex\]\.name/s.test(html), '玩家选择项必须同时显示动态方位和姓名');

assert(/id="scoringGuideOverlay"/.test(html), '应提供独立的算分教学页面');
assert(/<button[^>]*class="scoring-guide-btn"[^>]*data-guide="fu"[^>]*onclick="openScoringGuide\('fu'\)"/.test(html), '符数入口必须直接绑定打开动作');
assert(/<button[^>]*class="scoring-guide-btn"[^>]*data-guide="points"[^>]*onclick="openScoringGuide\('points'\)"/.test(html), '算分方法入口必须直接绑定打开动作');
assert(/<button[^>]*class="scoring-guide-btn"[^>]*data-guide="limits"[^>]*onclick="openScoringGuide\('limits'\)"/.test(html), '满贯入口必须直接绑定打开动作');
assert(/\.scoring-guide-btn\s*>\s*\*\s*\{[^}]*pointer-events\s*:\s*none/s.test(html), '点击“点”等内部文字时事件必须落到按钮本体');
assert(/id="yakuCatalogCloseBottom"/.test(html), '役种图鉴底部必须提供可见退出按钮');
assert(/onclick="handleOverlayClick\(event, 'yakuCatalogOverlay'\)"/.test(html), '点击图鉴遮罩应能退出');

console.log('scoring guide tests: passed');
