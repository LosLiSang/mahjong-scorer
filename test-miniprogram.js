const assert = require('assert');
const fs = require('fs');
const Logic = require('./miniprogram/utils/mahjong-logic');
const Game = require('./miniprogram/utils/game-engine');

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
tiles.forEach((id) => page.addTile({ currentTarget:{ dataset:{ id } } }));
page.selectWinTile({ currentTarget:{ dataset:{ id:'5m' } } });
page.selectWinType({ currentTarget:{ dataset:{ value:'tsumo' } } });
page.selectRiichiState({ currentTarget:{ dataset:{ value:'riichi' } } });
page.analyzeHand();
assert(page.data.analysisStage === 1);
assert(page.data.analysisResult, page.data.analysisMessage);
assert(page.data.analysisResult.yakuText.includes('立直'));
assert(page.data.analysisResult.scoreText.includes('6000点'));

// 和牌弹窗必须给底部操作区预留系统安全区，避免真机底部按钮被遮挡
const pageStyle = fs.readFileSync('./miniprogram/pages/index/index.wxss', 'utf8');
assert(
  /\.modal-actions\s*\{[^}]*padding-bottom\s*:\s*calc\([^)]*env\(safe-area-inset-bottom\)/s.test(pageStyle),
  '和牌弹窗底部操作区应包含 safe-area-inset-bottom'
);

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

console.log('mini-program tests: 19 assertions passed');
