// pages/scoring-guide/index.js — 算分详解：符数/点数/满贯 + 交互式计算器
const SD = require('../../utils/scoring-guide-data');
const Logic = require('../../utils/mahjong-logic');
const Game = require('../../utils/game-engine');

const ceil100 = Game.ceil100;

const TABS = [
  { key: 'fu', label: '符数' },
  { key: 'points', label: '点数' },
  { key: 'mangan', label: '满贯' }
];

const FU_VALUES = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
const HAN_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// 42→50 符的完整计算示例
const FU_EXAMPLE = {
  desc: '以下是一个典型的门前清荣和手牌（嵌张听牌）的符数计算过程：',
  steps: [
    { label: '副底', fu: 20, note: '所有和牌的起点' },
    { label: '门前荣和', fu: 10, note: '未副露时荣和加 10 符' },
    { label: '雀头（自风）', fu: 2, note: '自风作雀头加 2 符' },
    { label: '嵌张听牌', fu: 2, note: '听牌形为嵌张，加 2 符' },
    { label: '幺九暗刻', fu: 8, note: '幺九牌暗刻加 8 符' }
  ],
  raw: 42,
  rounded: 50
};

Page({
  data: {
    currentTab: 'fu',
    tabs: TABS,
    tabsIndex: { fu: 0, points: 1, mangan: 2 },

    // 符数 Tab
    fuExported: [],     // SD.FU_REFERENCE
    fuExample: null,    // FU_EXAMPLE

    // 点数 Tab — 交互式计算器
    hanValues: HAN_VALUES,
    fuValues: FU_VALUES,
    hanIndex: 2,          // 默认 3 番
    fuIndex: 2,           // 默认 30 符
    isDealer: false,      // 子/亲
    isTsumo: false,       // 荣和/自摸
    calcResult: null,     // 计算结果 { basePoint, totalPoints, formula, breakdown }

    // 满贯 Tab
    limitExported: []     // SD.LIMIT_REFERENCE
  },

  onLoad() {
    this.setData({
      fuExported: SD.FU_REFERENCE,
      limitExported: SD.LIMIT_REFERENCE,
      fuExample: FU_EXAMPLE
    });
    this.calculate();
  },

  // ===== Tab 切换 =====
  onTabTap(e) {
    this.setData({ currentTab: e.currentTarget.dataset.tab });
  },

  // ===== 计算器 =====
  onHanChange(e) {
    this.setData({ hanIndex: Number(e.detail.value) });
    this.calculate();
  },
  onFuChange(e) {
    this.setData({ fuIndex: Number(e.detail.value) });
    this.calculate();
  },
  toggleDealer() {
    this.setData({ isDealer: !this.data.isDealer });
    this.calculate();
  },
  toggleTsumo() {
    this.setData({ isTsumo: !this.data.isTsumo });
    this.calculate();
  },

  calculate() {
    const han = this.data.hanValues[this.data.hanIndex];
    const fu = this.data.fuValues[this.data.fuIndex];
    const isDealer = this.data.isDealer;
    const isTsumo = this.data.isTsumo;

    const basePoint = Logic.calcBasePoint(han, fu);
    const isMangan = han >= 5 || basePoint >= 2000;
    const actualBase = Math.min(basePoint, han >= 13 ? 8000 : han >= 11 ? 6000 : han >= 8 ? 4000 : han >= 6 ? 3000 : 2000);

    let formula, totalPoints, breakdown;

    if (isTsumo) {
      if (isDealer) {
        // 亲自摸：每家付 ceil100(base × 2)
        const perChild = ceil100(actualBase * 2);
        totalPoints = perChild * 3;
        formula = `基本点 ${actualBase} × 2 = ${perChild}（每家）`;
        breakdown = `每家 ${perChild} 点 × 3 人 = ${totalPoints} 点`;
      } else {
        // 子自摸：亲付 ceil100(base × 2)，其他子付 ceil100(base × 1)
        const fromDealer = ceil100(actualBase * 2);
        const fromChild = ceil100(actualBase * 1);
        totalPoints = fromDealer + fromChild * 2;
        formula = `基本点 ${actualBase}`;
        breakdown = `亲付 ${fromDealer} 点 + 子付 ${fromChild} 点 × 2 = ${totalPoints} 点`;
      }
    } else {
      if (isDealer) {
        // 亲荣和：ceil100(base × 6)
        totalPoints = ceil100(actualBase * 6);
        formula = `基本点 ${actualBase} × 6 = ${totalPoints}`;
        breakdown = `放铳者支付 ${totalPoints} 点`;
      } else {
        // 子荣和：ceil100(base × 4)
        totalPoints = ceil100(actualBase * 4);
        formula = `基本点 ${actualBase} × 4 = ${totalPoints}`;
        breakdown = `放铳者支付 ${totalPoints} 点`;
      }
    }

    // 满贯档位名称
    let manganLabel = '';
    if (han >= 13) manganLabel = '役满';
    else if (han >= 11) manganLabel = '三倍满';
    else if (han >= 8) manganLabel = '倍满';
    else if (han >= 6) manganLabel = '跳满';
    else if (han >= 5 || (fu >= 40 && han >= 4) || (fu >= 70 && han >= 3)) manganLabel = '满贯';

    const baseFormula = han < 5
      ? `${fu} × 2^(${han}+2) = ${fu} × 2^${han + 2} = ${fu} × ${Math.pow(2, han + 2)} = ${basePoint}`
      : `满贯档：基本点固定为 ${actualBase}`;

    this.setData({
      calcResult: {
        han, fu, basePoint, actualBase, isMangan, manganLabel,
        formula, totalPoints, breakdown, baseFormula,
        isDealer, isTsumo
      }
    });
  }
});
