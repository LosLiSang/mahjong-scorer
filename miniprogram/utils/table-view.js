// table-view.js — 牌桌「以自己为视角」的纯展示映射（不改动任何座位索引）

const POSITIONS_4P = ['bottom', 'right', 'top', 'left'];
// 三麻：自己在下，下家在右，上家在左，上方留空
const POSITIONS_3P = ['bottom', 'right', 'left'];

function validSeat(seat, playerCount) {
  return Number.isInteger(seat) && seat >= 0 && seat < playerCount;
}

// 返回每个真实座位 index 对应的展示位置；未入座 / 本地模式回退为东家在下
function seatPositions(playerCount, mySeat) {
  const count = playerCount === 3 ? 3 : 4;
  const order = count === 3 ? POSITIONS_3P : POSITIONS_4P;
  const me = validSeat(mySeat, count) ? mySeat : 0;
  return Array.from({ length: count }, (_, index) => order[(index - me + count) % count]);
}

// 记分弹窗的默认主体：联机且已入座时选自己（跳过不可选的座位），否则用 fallback
function defaultSubject(mySeat, playerCount, fallback, isSelectable) {
  if (!validSeat(mySeat, playerCount === 3 ? 3 : 4)) return fallback;
  if (isSelectable && !isSelectable(mySeat)) return fallback;
  return mySeat;
}

module.exports = { seatPositions, defaultSubject };
