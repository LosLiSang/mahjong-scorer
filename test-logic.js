// test-logic.js — 验证 mahjong-logic.js 的核心逻辑
// 用法: node test-logic.js

const {
  countTiles, decompose, calcBasePoint, evaluateHand, isYaochuu,
} = require('./mahjong-logic');

let pass = 0, fail = 0;

function test(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
  }
}

console.log('=== 点数基础公式 ===');
// 基本点 = 符 × 2^(番+2)，满贯及以上按档位封顶
test('1翻30符', calcBasePoint(1, 30), 240);
test('2翻30符', calcBasePoint(2, 30), 480);
test('3翻30符', calcBasePoint(3, 30), 960);
test('4翻30符', calcBasePoint(4, 30), 1920);
test('4翻60符（满贯封顶）', calcBasePoint(4, 60), 2000);
test('5翻(满贯)', calcBasePoint(5, 30), 2000);
test('6翻(跳满)', calcBasePoint(6, 30), 3000);
test('8翻(倍满)', calcBasePoint(8, 30), 4000);
test('11翻(三倍满)', calcBasePoint(11, 30), 6000);
test('13翻(役满)', calcBasePoint(13, 30), 8000);

console.log('\n=== 基本和牌判定 ===');
// 平和：123m 456p 789s 11m 23s → 和1m？不，重新设计
// 标准平和手：123m 456m 789p 12s 3s（两面听3s/6s... 简化）
// 用：123m 456p 789s 12s 3s（听1s/4s 两面）
{
  const tiles = ['1m','2m','3m','4p','5p','6p','7s','8s','9s','1s','2s','3s','5m','5m'];
  // 这手牌：123m + 123s + 456p + 789s + 55m → 14张但面子分解
  const result = evaluateHand({
    tiles, isOpened: false, isTsumo: true, isRiichi: false,
    winTile: '5m', roundWind: '1z', seatWind: '2z',
  });
  test('标准手合法（4面子+雀头）', result.valid, true);
}

console.log('\n=== 七对子 ===');
{
  // 11m 22m 33p 44p 55s 66s 77z
  const tiles = ['1m','1m','2m','2m','3p','3p','4p','4p','5s','5s','6s','6s','7z','7z'];
  const result = evaluateHand({
    tiles, isOpened: false, isTsumo: false, isRiichi: true,
    winTile: '7z', roundWind: '1z', seatWind: '2z',
  });
  test('七对子成立', result.valid, true);
  if (result.valid) {
    const hasChiitoi = result.yaku.some(y => y.name === '七对子');
    test('七对子役被识别', hasChiitoi, true);
  }
}

console.log('\n=== 断幺九 ===');
{
  // 234m 234m 456p 678p 55s 全中张（无1/9/字）
  const tiles = ['2m','3m','4m','2m','3m','4m','4p','5p','6p','6p','7p','8p','5s','5s'];
  const result = evaluateHand({
    tiles, isOpened: false, isTsumo: false, isRiichi: false,
    winTile: '5s', roundWind: '1z', seatWind: '2z',
  });
  test('断幺九手合法', result.valid, true);
  if (result.valid) {
    test('断幺九役被识别', result.yaku.some(y => y.name === '断幺九'), true);
  }
}

console.log('\n=== 清一色 ===');
{
  // 123m 456m 789m 123m 55m
  const tiles = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1m','2m','3m','5m','5m'];
  const result = evaluateHand({
    tiles, isOpened: false, isTsumo: false, isRiichi: false,
    winTile: '5m', roundWind: '1z', seatWind: '2z',
  });
  test('清一色手合法', result.valid, true);
  if (result.valid) {
    test('清一色役被识别', result.yaku.some(y => y.name === '清一色'), true);
  }
}

console.log('\n=== 役满：大三元 ===');
{
  // 中中中 白白白 發發發 12m 3m（雀头另算）
  // 需要 4面子+雀头：白白白 發發發 中中中 + 123m + 99p
  const tiles = ['5z','5z','5z','6z','6z','6z','7z','7z','7z','1m','2m','3m','9p','9p'];
  const result = evaluateHand({
    tiles, isOpened: false, isTsumo: false, isRiichi: false,
    winTile: '9p', roundWind: '1z', seatWind: '2z',
  });
  test('大三元手合法', result.valid, true);
  if (result.valid) {
    test('大三元役满被识别', result.isYakuman, true);
    test('大三元是役满', result.yaku.some(y => y.name === '大三元'), true);
  }
}

console.log('\n=== 役满：字一色 ===');
{
  // 111z 222z 333z 555z 77z
  const tiles = ['1z','1z','1z','2z','2z','2z','3z','3z','3z','5z','5z','5z','7z','7z'];
  const result = evaluateHand({
    tiles, isOpened: false, isTsumo: false, isRiichi: false,
    winTile: '7z', roundWind: '1z', seatWind: '2z',
  });
  test('字一色手合法', result.valid, true);
  if (result.valid) {
    test('字一色役满被识别', result.isYakuman, true);
  }
}

console.log('\n=== 无役情况 ===');
{
  // 13张乱搭，不和牌形
  const tiles = ['1m','2m','3m','4p','7p','9p','1s','3s','5s','7s','1z','3z','5z','7z'];
  const result = evaluateHand({
    tiles, isOpened: false, isTsumo: false, isRiichi: false,
    winTile: '7z', roundWind: '1z', seatWind: '2z',
  });
  test('无和牌形返回 invalid', result.valid, false);
}

console.log('\n=== 分解算法 ===');
{
  const counts = countTiles(['1m','2m','3m','4m','5m','6m','7m','8m','9m','1m','2m','3m','5m','5m']);
  const decomps = decompose(counts);
  test('清一色有多种分解', decomps.length > 0, true);
}

console.log('\n=== 特殊和牌条件 ===');
{
  const tiles = ['1m','2m','3m','4p','5p','6p','7s','8s','9s','2s','3s','4s','5m','5m'];
  const common = {
    tiles, isOpened: false, winTile: '1m', roundWind: '1z', seatWind: '2z', doraCount: 0,
  };
  const haitei = evaluateHand({ ...common, isTsumo: true, isLastTile: true });
  test('海底摸月识别', haitei.valid && haitei.yaku.some(y => y.name === '海底摸月'), true);
  const houtei = evaluateHand({ ...common, isTsumo: false, isLastTile: true });
  test('河底捞鱼识别', houtei.valid && houtei.yaku.some(y => y.name === '河底捞鱼'), true);
  const chankan = evaluateHand({ ...common, isTsumo: false, isRobbingKan: true });
  test('抢杠识别', chankan.valid && chankan.yaku.some(y => y.name === '枪杠'), true);
  const rinshan = evaluateHand({ ...common, isTsumo: true, isWinFromDeadWall: true });
  test('岭上开花识别', rinshan.valid && rinshan.yaku.some(y => y.name === '岭上开花'), true);
}

console.log('\n=== 最终和牌张影响 ===');
{
  const tiles = ['1m','1m','1m','2p','2p','2p','3s','3s','3s','5z','5z','5z','7z','7z'];
  const common = {
    tiles, isOpened: false, roundWind: '1z', seatWind: '2z', doraCount: 0,
  };
  const single = evaluateHand({ ...common, isTsumo: true, winTile: '7z' });
  test('四暗刻单骑按最终和牌张识别', single.valid && single.yaku.some(y => y.name === '四暗刻单骑'), true);
  const normal = evaluateHand({ ...common, isTsumo: true, winTile: '1m' });
  test('非单骑时识别普通四暗刻', normal.valid && normal.yaku.some(y => y.name === '四暗刻'), true);
  const ron = evaluateHand({ ...common, isTsumo: false, winTile: '1m' });
  test('荣和补刻不算四暗刻', ron.valid && !ron.yaku.some(y => y.name.startsWith('四暗刻')), true);
}

console.log('\n=== 立直状态 ===');
{
  const tiles = ['1m','2m','3m','4p','5p','6p','7s','8s','9s','2s','3s','4s','5m','5m'];
  const common = {
    tiles, isOpened: false, isTsumo: false, winTile: '1m', roundWind: '1z', seatWind: '2z', doraCount: 0,
  };
  const riichi = evaluateHand({ ...common, isRiichi: true });
  test('结算立直选项计入立直', riichi.valid && riichi.yaku.some(y => y.name === '立直'), true);
  const doubleRiichi = evaluateHand({ ...common, isDoubleRiichi: true });
  test('结算两立直选项计入两立直', doubleRiichi.valid && doubleRiichi.yaku.some(y => y.name === '两立直'), true);
  const noRiichiIppatsu = evaluateHand({ ...common, isIppatsu: true });
  test('未立直不能单独取得一发', !noRiichiIppatsu.valid || !noRiichiIppatsu.yaku.some(y => y.name === '一发'), true);
}

console.log('\n=== 二翻役回归 ===');
{
  const shousangenTiles = ['5z','5z','5z','6z','6z','6z','7z','7z','1m','2m','3m','7p','8p','9p'];
  const shousangen = evaluateHand({
    tiles: shousangenTiles, isOpened: false, isTsumo: false, isRiichi: false,
    winTile: '7z', roundWind: '1z', seatWind: '2z', doraCount: 0,
  });
  test('小三元不是役满', shousangen.valid && !shousangen.isYakuman, true);
  test('小三元按2翻役识别', shousangen.valid && shousangen.yaku.some(y => y.name === '小三元' && y.han === 2), true);

  const honroutouTiles = ['1m','1m','1m','9m','9m','9m','1p','1p','1p','9s','9s','9s','1z','1z'];
  const honroutou = evaluateHand({
    tiles: honroutouTiles, isOpened: true,
    openMentsus: [{type:'koutsu', tiles:['1m','1m','1m'], open:true}],
    isTsumo: false, isRiichi: false,
    winTile: '1z', roundWind: '2z', seatWind: '3z', doraCount: 0,
  });
  test('混老头被识别', honroutou.valid && honroutou.yaku.some(y => y.name === '混老头' && y.han === 2), true);
}

console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
