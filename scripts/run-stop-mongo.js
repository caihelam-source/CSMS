#!/usr/bin/env node
/**
 * Claw 停止本地 MongoDB — 跨平台调度器 (npm run mongo:stop)
 */
const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
const isWin = os.platform() === 'win32';
const script = isWin ? path.join('scripts', 'stop-mongo.cmd') : path.join('scripts', 'stop-mongo.sh');
const command = isWin ? 'cmd' : 'bash';
const args = isWin ? ['/c', script] : [script];

const res = spawnSync(command, args, { stdio: 'inherit', cwd: root });
process.exit(res.status === null ? 0 : res.status);
