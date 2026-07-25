const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('./index.html', 'utf8');

assert(
  /\.hand-area\s*\{[^}]*flex-wrap\s*:\s*nowrap[^}]*overflow\s*:\s*hidden/s.test(html),
  '已选手牌必须保持单行且不溢出容器'
);
assert(
  /\.hand-tile-img\s*\{[^}]*flex\s*:\s*1\s+1\s+0[^}]*min-width\s*:\s*0[^}]*max-width\s*:\s*34px/s.test(html),
  '手牌牌面必须根据数量自动缩小'
);
assert(
  /\.win-tile-picker\s*\{[^}]*flex-wrap\s*:\s*nowrap[^}]*overflow\s*:\s*hidden/s.test(html),
  '最终和牌张候选必须保持单行'
);
assert(
  /\.win-tile-option\s*\{[^}]*flex\s*:\s*1\s+1\s+0[^}]*min-width\s*:\s*0[^}]*max-width\s*:\s*30px/s.test(html),
  '最终和牌张候选必须根据数量自动缩小'
);
assert(
  /\.hand-tile-img\.win-tile\s*\{[^}]*box-shadow/s.test(html),
  '最终和牌张必须在单行布局中保留清晰标记'
);

console.log('hand row layout tests: passed');
