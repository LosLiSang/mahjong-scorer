const assert = require('assert');
const {
  calcBasePoint,
  getLimitName,
  calcPointPayments,
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

const fs = require('fs');
const html = fs.readFileSync('./index.html', 'utf8');
assert(/id="scoringGuideOverlay"/.test(html), '应提供独立的算分教学页面');
assert(/openScoringGuide\('fu'\)/.test(html), '教学首页应有符数详解入口');
assert(/openScoringGuide\('points'\)/.test(html), '教学首页应有点数计算入口');
assert(/openScoringGuide\('limits'\)/.test(html), '教学首页应有满贯档位入口');
assert(/id="yakuCatalogCloseBottom"/.test(html), '役种图鉴底部必须提供可见退出按钮');
assert(/onclick="handleOverlayClick\(event, 'yakuCatalogOverlay'\)"/.test(html), '点击图鉴遮罩应能退出');

console.log('scoring guide tests: passed');
