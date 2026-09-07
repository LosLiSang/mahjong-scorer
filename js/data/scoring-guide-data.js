// scoring-guide-data.js — 符数、点数与满贯档位的教学数据
// 只保存解释和示例；实际点数由 mahjong-logic.js 计算。

const FU_REFERENCE = [
  { title: '副底', value: '20 符', detail: '普通和牌从 20 符开始。它不是奖励，而是计算的起点。' },
  { title: '门前荣和', value: '+10 符', detail: '全程没有吃、碰、明杠，最后荣和时加 10 符。' },
  { title: '自摸', value: '+2 符', detail: '一般自摸加 2 符；平和自摸按特殊规则固定为 20 符。' },
  { title: '雀头', value: '+2 / +4 符', detail: '三元牌、场风或自风作雀头各加 2 符；场风与自风重合时常按 4 符计算。' },
  { title: '等待形', value: '+2 符', detail: '嵌张、边张、单骑加 2 符；两面与双碰本身不加等待符。' },
  { title: '刻子', value: '2～8 符', detail: '中张明刻 2、暗刻 4；幺九/字牌明刻 4、暗刻 8。' },
  { title: '杠子', value: '8～32 符', detail: '中张明杠 8、暗杠 16；幺九/字牌明杠 16、暗杠 32。' },
  { title: '进位', value: '向上切十位', detail: '合计不是整十时一律向上进位，例如 32→40 符、42→50 符。' },
  { title: '特殊牌型', value: '固定符', detail: '七对子固定 25 符；平和自摸 20 符；平和荣和 30 符。' },
];

const LIMIT_REFERENCE = [
  { name: '满贯', range: '5 番；或 4 番 40 符以上；或 3 番 70 符以上', base: 2000, childRon: 8000, dealerRon: 12000 },
  { name: '跳满', range: '6～7 番', base: 3000, childRon: 12000, dealerRon: 18000 },
  { name: '倍满', range: '8～10 番', base: 4000, childRon: 16000, dealerRon: 24000 },
  { name: '三倍满', range: '11～12 番', base: 6000, childRon: 24000, dealerRon: 36000 },
  { name: '役满', range: '役满役；本工具的手动入口也以 13 番+ 表示', base: 8000, childRon: 32000, dealerRon: 48000 },
];

function roundFu(rawFu) {
  return Math.ceil(rawFu / 10) * 10;
}

function calculateFuExample(options = {}) {
  if (options.isChiitoi) {
    return { rawFu: 25, roundedFu: 25, steps: [{ label: '七对子', fu: 25, note: '固定 25 符，不进位' }] };
  }
  if (options.isPinfu) {
    const fu = options.tsumo ? 20 : 30;
    return { rawFu: fu, roundedFu: fu, steps: [{ label: options.tsumo ? '平和自摸' : '平和荣和', fu, note: '特殊固定值' }] };
  }

  const steps = [{ label: '副底', fu: 20, note: '普通和牌起点' }];
  if (options.closedRon) steps.push({ label: '门前荣和', fu: 10 });
  if (options.tsumo) steps.push({ label: '自摸', fu: 2 });
  if (options.pairFu) steps.push({ label: '雀头', fu: Number(options.pairFu) });
  if (options.waitFu) steps.push({ label: '等待形', fu: Number(options.waitFu) });
  if (options.mentsuFu) steps.push({ label: '刻子 / 杠子', fu: Number(options.mentsuFu) });

  const rawFu = steps.reduce((sum, step) => sum + step.fu, 0);
  return { rawFu, roundedFu: roundFu(rawFu), steps };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FU_REFERENCE, LIMIT_REFERENCE, roundFu, calculateFuExample };
}
