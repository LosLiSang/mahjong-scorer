const assert = require('assert');
const {
  scoreFromFan,
  createSichuanGame,
  createTransferEntry,
  applySichuanEntry,
  undoSichuanEntry,
  SICHUAN_FAN_TYPES,
  calculateSichuanFan,
  setSichuanMissingSuit,
} = require('./sichuan-score');

assert.equal(scoreFromFan(1, 1, 6), 6, '一番应为 1 倍底分');
assert.equal(scoreFromFan(3, 1, 6), 24, '三番应为 4 倍底分');
assert.equal(scoreFromFan(8, 1, 6), 192, '番数必须按封顶番数计算');
assert.equal(scoreFromFan(3, 2, 6), 48, '根、杠上花等附加番应计入总番');

const game = createSichuanGame(['甲', '乙', '丙', '丁'], 0);
assert.deepEqual(game.players.map(player => player.score), [0, 0, 0, 0]);
assert.deepEqual(game.players.map(player => player.missingSuit), ['', '', '', ''], '新局默认未记录定缺');
setSichuanMissingSuit(game, 0, 'm');
setSichuanMissingSuit(game, 1, 'p');
assert.deepEqual(game.players.map(player => player.missingSuit), ['m', 'p', '', ''], '每位玩家必须能独立记录缺万筒索');
assert.equal(game.history.length, 0);

assert(SICHUAN_FAN_TYPES.some(type => type.id === 'pinghu' && type.fan === 1), '腾讯欢乐口径必须显示平胡1番1倍');
assert(SICHUAN_FAN_TYPES.some(type => type.id === 'qingyise' && type.fan === 3), '腾讯欢乐口径必须显示清一色3番4倍');
assert(SICHUAN_FAN_TYPES.some(type => type.id === 'gang' && type.fan === 1), '附加番型必须包含杠');
assert.deepEqual(
  calculateSichuanFan(['qingyise', 'gangshanghua', 'gen'], 6),
  { fan: 5, label: '清一色 + 杠上花 + 根' },
  '基础番型与附加番型应合计并生成可读标签'
);
assert.equal(calculateSichuanFan(['tianhu', 'gen'], 6).fan, 6, '番数必须受封顶限制');

const ron = createTransferEntry({
  type: 'ron',
  receiver: 0,
  payers: [1],
  amountPerPayer: 8,
  label: '甲 3番点胡乙',
});
applySichuanEntry(game, ron);
assert.deepEqual(game.players.map(player => player.score), [8, -8, 0, 0]);
assert.equal(game.history.length, 1);
assert.equal(game.players.reduce((sum, player) => sum + player.score, 0), 0, '积分转移必须零和');

const tsumo = createTransferEntry({
  type: 'tsumo',
  receiver: 2,
  payers: [0, 1, 3],
  amountPerPayer: 4,
  label: '丙自摸',
});
applySichuanEntry(game, tsumo);
assert.deepEqual(game.players.map(player => player.score), [4, -12, 12, -4]);
assert.equal(game.players.reduce((sum, player) => sum + player.score, 0), 0);

undoSichuanEntry(game);
assert.deepEqual(game.players.map(player => player.score), [8, -8, 0, 0], '撤销必须恢复全部玩家积分');
assert.equal(game.history.length, 1);

const fs = require('fs');
const html = fs.readFileSync('./index.html', 'utf8');
assert(/id="sichuanNavBtn"/.test(html), '顶部必须有川麻积分入口');
assert(/id="sichuanView"/.test(html), '川麻必须使用独立页面');
assert(/<script src="sichuan-score\.js\?v=[^"]+"><\/script>/.test(html), '川麻积分引擎必须是独立版本化脚本');
assert(/id="sichuanPlayers"/.test(html), '川麻页面必须显示四位玩家积分');
assert(/id="sichuanMissingSuitOverlay"/.test(html) && /data-missing-suit="m"/.test(html), '川麻页面必须提供逐人定缺记录');
assert(/class="missing-suit\$\{player\.missingSuit/.test(html), '玩家卡片必须展示当前缺门');
assert(/腾讯\s*\/\s*欢乐四川口径/.test(html), '川麻页面必须明确标注当前规则口径，不得冒充统一川麻规则');
assert(/平胡\s*1\s*番\s*=\s*1\s*倍/.test(html), '页面必须解释腾讯欢乐番数与倍数的对应关系');
assert(/calculateSichuanFan\(/.test(html), '番型选择必须驱动番数和积分计算');
assert(/openSichuanEntry\('win'\)/.test(html), '川麻页面必须提供胡牌积分入口');
assert(/openSichuanEntry\('kong'\)/.test(html), '川麻页面必须提供杠分入口');
assert(/openSichuanEntry\('penalty'\)/.test(html), '川麻页面必须提供花猪、查叫或手动罚分入口');
assert(/function\s+undoSichuanLast/.test(html), '川麻积分必须支持撤销');
assert(/localStorage\.setItem\(SICHUAN_STORAGE_KEY/.test(html) && /mj_sichuan_score_v1/.test(html), '川麻积分必须使用独立存档键');
assert(/const\s+SICHUAN_STORAGE_KEY[\s\S]*let\s+sichuanGame[\s\S]*createSichuanGame/.test(html), '川麻状态必须由独立账本创建，不能复用日麻 game');

console.log('sichuan score tests: passed');
