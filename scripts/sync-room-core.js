#!/usr/bin/env node
'use strict';

// 把 packages/room-core/domain.js（真源）同步到云函数目录（上传约束：云函数只能包含自身目录内的文件）。
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'packages', 'room-core', 'domain.js');
const target = path.join(__dirname, '..', 'cloudfunctions', 'mahjong-room', 'domain.js');

fs.copyFileSync(source, target);
console.log('room-core synced -> cloudfunctions/mahjong-room/domain.js');
