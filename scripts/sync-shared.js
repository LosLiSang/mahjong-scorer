#!/usr/bin/env node
'use strict';

// 把共享代码的真源复制到云函数目录（上传约束：云函数只能包含自身目录内的文件）。
//   packages/room-core/domain.js        → cloudfunctions/mahjong-room/domain.js
//   packages/cloud-response/index.js    → cloudfunctions/<每个云函数>/response.js
// test-room-domain.js / test-cloud-response.js 会校验副本与真源一致。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function syncTargets() {
  const functionRoot = path.join(ROOT, 'cloudfunctions');
  const functions = fs.readdirSync(functionRoot, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  return [
    { source: 'packages/room-core/domain.js', target: 'cloudfunctions/mahjong-room/domain.js' }
  ].concat(functions.map(name => ({
    source: 'packages/cloud-response/index.js',
    target: `cloudfunctions/${name}/response.js`
  })));
}

function syncShared() {
  for (const { source, target } of syncTargets()) {
    fs.copyFileSync(path.join(ROOT, source), path.join(ROOT, target));
    console.log(`synced ${source} -> ${target}`);
  }
}

if (require.main === module) syncShared();

module.exports = { syncTargets, syncShared };
