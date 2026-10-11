#!/usr/bin/env node
'use strict';

// 部署微信云函数（CloudBase CLI）。配置唯一来源：根目录 cloudbaserc.json。
//
//   node scripts/deploy-functions.js                 部署全部云函数
//   node scripts/deploy-functions.js tile-recognizer 只部署指定函数（可多个）
//   node scripts/deploy-functions.js --dry-run       只打印将要执行的命令
//
// 环境 ID：优先取环境变量 ENV_ID，其次取 miniprogram/config.js 的 cloudEnvId。
// 首次使用需先登录：npx -p @cloudbase/cli tcb login

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TCB = ['npx', '-y', '-p', '@cloudbase/cli', 'tcb'];

// 纯函数：根据配置和参数生成部署计划（每个函数的预检与要执行的命令）
function planDeploy(config, { names, envId }) {
  if (!envId) throw new Error('缺少环境 ID：设置 ENV_ID 或 miniprogram/config.js 的 cloudEnvId');
  const all = config.functions || [];
  const wanted = names && names.length ? names : all.map(fn => fn.name);
  const unknown = wanted.filter(name => !all.some(fn => fn.name === name));
  if (unknown.length) throw new Error(`cloudbaserc.json 中没有这些函数：${unknown.join(', ')}`);

  return all.filter(fn => wanted.includes(fn.name)).map(fn => ({
    name: fn.name,
    requiredFiles: fn.name === 'tile-recognizer' ? ['worker.config.json'] : [],
    commands: [['fn', 'deploy', fn.name, '--force', '-e', envId]]
      .concat((fn.triggers || []).map(trigger => ['fn', 'trigger', 'create', fn.name, '--trigger-name', trigger.name, '--cron', trigger.config, '-e', envId]))
  }));
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    names: argv.filter(arg => !arg.startsWith('--'))
  };
}

function readEnvId() {
  if (process.env.ENV_ID) return process.env.ENV_ID;
  try { return require(path.join(ROOT, 'miniprogram', 'config.js')).cloudEnvId; } catch (e) { return ''; }
}

function run(args, dryRun) {
  const command = TCB.concat(args);
  console.log(`$ ${command.join(' ')}`);
  if (dryRun) return true;
  // Windows 下 npx 是 .cmd，需要 shell；含空格的参数（cron）要加引号
  const isWindows = process.platform === 'win32';
  const argv = isWindows ? command.map(arg => (/\s/.test(arg) ? `"${arg}"` : arg)) : command;
  const result = spawnSync(argv[0], argv.slice(1), { cwd: ROOT, stdio: 'inherit', shell: isWindows });
  return result.status === 0;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'cloudbaserc.json'), 'utf8'));
  const plan = planDeploy(config, { names: options.names, envId: readEnvId() });
  const functionRoot = path.join(ROOT, config.functionRoot || 'cloudfunctions');
  // domain.js、response.js 是 packages/ 的同步产物，部署前必须先同步
  if (!options.dryRun) require('./sync-shared').syncShared();

  for (const step of plan) {
    console.log(`\n== ${step.name}`);
    const missing = step.requiredFiles.filter(file => !fs.existsSync(path.join(functionRoot, step.name, file)));
    if (missing.length) throw new Error(`${step.name} 缺少 ${missing.join(', ')}（见同目录 *.example.json）`);
    for (const args of step.commands) {
      // 触发器已存在时 create 会报错，不影响代码部署结果
      const ok = run(args, options.dryRun);
      if (!ok && args[1] === 'deploy') throw new Error(`${step.name} 部署失败`);
      if (!ok) console.warn(`(忽略) ${args.slice(0, 3).join(' ')} 失败，触发器可能已存在`);
    }
  }
  console.log('\n完成。可用 `npx -p @cloudbase/cli tcb fn detail <函数名> -e <环境ID>` 核对超时与触发器。');
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(err.message); process.exit(1); }
}

module.exports = { planDeploy, parseArgs };
