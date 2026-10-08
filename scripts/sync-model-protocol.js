#!/usr/bin/env node
'use strict';

// 把 miniprogram/utils/model-protocol.js（真源）同步到识牌云函数目录（云函数只能包含自身目录内的文件）。
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'miniprogram', 'utils', 'model-protocol.js');
const target = path.join(__dirname, '..', 'cloudfunctions', 'tile-recognizer', 'model-protocol.js');

fs.copyFileSync(source, target);
console.log('model-protocol synced -> cloudfunctions/tile-recognizer/model-protocol.js');
