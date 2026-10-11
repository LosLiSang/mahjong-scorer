// test-deploy-functions.js — 云函数部署计划（纯函数，不调用 tcb）
const assert = require('assert');
const { planDeploy, parseArgs } = require('./scripts/deploy-functions');
const config = require('./cloudbaserc.json');

// cloudbaserc.json 必须登记全部云函数目录，且关键配置不能丢
const fs = require('fs');
const dirs = fs.readdirSync('cloudfunctions', { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
assert.deepEqual(config.functions.map(fn => fn.name).sort(), dirs, 'cloudbaserc.json 应登记 cloudfunctions/ 下全部函数');
const byName = Object.fromEntries(config.functions.map(fn => [fn.name, fn]));
assert.equal(byName['tile-recognizer'].timeout, 20, '识牌云函数超时须为 20 秒（转发超时 19 秒）');
assert.equal(byName['mahjong-room'].installDependency, true, '房间函数依赖 wx-server-sdk，须云端安装依赖');
assert.deepEqual(byName['mahjong-room-cleanup'].triggers.map(t => t.name), ['daily-room-cleanup']);

const cases = [
  { name: '默认部署全部', args: [], expect: plan => assert.deepEqual(plan.map(s => s.name), ['mahjong-room', 'mahjong-room-cleanup', 'tile-recognizer']) },
  { name: '只部署指定函数', args: ['tile-recognizer'], expect: plan => {
    assert.deepEqual(plan.map(s => s.name), ['tile-recognizer']);
    assert.deepEqual(plan[0].requiredFiles, ['worker.config.json']);
    assert.deepEqual(plan[0].commands, [['fn', 'deploy', 'tile-recognizer', '--force', '-e', 'env-1']]);
  } },
  { name: '房间函数先同步领域代码', args: ['mahjong-room'], expect: plan => assert.equal(plan[0].syncRoomCore, true) },
  { name: '定时函数附带触发器', args: ['mahjong-room-cleanup', '--dry-run'], expect: plan => assert.deepEqual(plan[0].commands[1],
    ['fn', 'trigger', 'create', 'mahjong-room-cleanup', '--trigger-name', 'daily-room-cleanup', '--cron', '0 20 3 * * * *', '-e', 'env-1']) },
  { name: '未知函数', args: ['nope'], error: /没有这些函数/ },
  { name: '缺少环境 ID', args: [], envId: '', error: /缺少环境 ID/ }
];

cases.forEach(c => {
  const options = parseArgs(c.args);
  const run = () => planDeploy(config, { names: options.names, envId: c.envId === undefined ? 'env-1' : c.envId });
  if (c.error) assert.throws(run, c.error, c.name);
  else c.expect(run());
});
assert.equal(parseArgs(['--dry-run']).dryRun, true);

console.log('deploy functions tests passed');
