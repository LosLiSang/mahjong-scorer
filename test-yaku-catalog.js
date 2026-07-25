const assert = require('assert');
const { YAKU_CATALOG, filterYakuCatalog, getYakuById, formatYakuHan } = require('./yaku-data');

assert(YAKU_CATALOG.length >= 35, '图鉴应覆盖至少 35 个常见役种');

const requiredNames = [
  '立直', '平和', '断幺九', '七对子', '小三元', '混老头',
  '混一色', '清一色', '国士无双', '四暗刻', '大三元', '九莲宝灯',
];
for (const name of requiredNames) {
  assert(YAKU_CATALOG.some(yaku => yaku.name === name), `图鉴缺少 ${name}`);
}

for (const yaku of YAKU_CATALOG) {
  assert(yaku.id && yaku.name && yaku.category, '役种必须有 id/name/category');
  assert(yaku.condition && yaku.pitfall, `${yaku.name} 必须有成立条件和易错点`);
  const hasExample = Array.isArray(yaku.example) && yaku.example.length > 0;
  const luckYaku = ['天和','地和','四杠子'].includes(yaku.name);
  if (!hasExample && !luckYaku) assert.fail(`${yaku.name} 必须有牌例`);
  assert(yaku.hanClosed !== undefined, `${yaku.name} 必须声明门前番数或役满`);
}

const shousangen = YAKU_CATALOG.find(yaku => yaku.name === '小三元');
assert.equal(shousangen.hanClosed, 2);
assert.equal(shousangen.hanOpen, 2);

assert(filterYakuCatalog({ category: 'yakuman' }).every(yaku => yaku.category === 'yakuman'));
assert(filterYakuCatalog({ query: '三元' }).some(yaku => yaku.name === '小三元'));
assert.equal(getYakuById('riichi').name, '立直');
assert.equal(getYakuById('missing'), null);
assert.equal(formatYakuHan(getYakuById('riichi')), '门前1翻 · 副露不可');
assert.equal(formatYakuHan(getYakuById('tanyao')), '1翻');
assert.equal(formatYakuHan(getYakuById('sanshoku')), '门前2翻 · 副露1翻');
assert.equal(formatYakuHan(getYakuById('daisangen')), '役满');

console.log('yaku catalog tests: passed');