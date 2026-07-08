#!/usr/bin/env node
/**
 * Claw 一键安装 / 启动 — 跨平台调度器
 * npm run setup 会调用本文件，按操作系统选择 bash 或 cmd 脚本。
 */
const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
const isWin = os.platform() === 'win32';
const script = isWin ? path.join('scripts', 'setup.cmd') : path.join('scripts', 'setup.sh');
const command = isWin ? 'cmd' : 'bash';
const args = isWin ? ['/c', script] : [script];

const res = spawnSync(command, args, { stdio: 'inherit', cwd: root });
process.exit(res.status === null ? 1 : res.status);
