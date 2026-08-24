#!/usr/bin/env node
// scripts/sync-package-single.cjs
// 单文件跨机同步包生成器（CSMS 项目约定，vc 于 2026-07-17 确立）
//
// 用法:  node scripts/sync-package-single.cjs YYYY-MM-DD
// 产出:  deliverables/YYYY-MM-DD/SYNC-YYYY-MM-DD.md
//
// 格式:
//   §§F|<项目内相对路径>|§§ ... §§/F§§   包裹项目内文件（相对项目根）
//   §§U|§§ ... §§/U§§                      包裹用户级记忆 ~/.workbuddy/MEMORY.md
//   首行为执行协议注释（HTML 注释），供收到文件的 WorkBuddy 按分隔符还原。
//
// 约定:
//   - 序列化「所有记忆 + 当日文档」进一个 .md 文件，适配聊天框发单文件。
//   - SECRETS.md（含敏感密钥）永不进包。
//   - 源码改动不走本包（走 git bundle 或 changes/ 子目录）。

'use strict';

const fs = require('fs');
const path = require('path');

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
  console.error('用法: node scripts/sync-package-single.cjs YYYY-MM-DD');
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const deliverablesDir = path.join(projectRoot, 'deliverables', date);
const outFile = path.join(deliverablesDir, `SYNC-${date}.md`);

// 用户级记忆（Windows: USERPROFILE；其他: HOME）
const userHome = process.env.USERPROFILE || process.env.HOME || '';
const userMem = path.join(userHome, '.workbuddy', 'MEMORY.md');

const blocks = [];

function addFileBlock(relPath, absPath) {
  if (!fs.existsSync(absPath)) {
    console.warn('  [跳过] 不存在:', relPath);
    return;
  }
  const content = fs.readFileSync(absPath, 'utf8');
  blocks.push(`§§F|${relPath}|§§\n${content}\n§§/F§§`);
}

// 1) 当日工作日志
addFileBlock(
  `.workbuddy/memory/${date}.md`,
  path.join(projectRoot, '.workbuddy', 'memory', `${date}.md`)
);

// 2) 项目级长期记忆
addFileBlock(
  '.workbuddy/memory/MEMORY.md',
  path.join(projectRoot, '.workbuddy', 'memory', 'MEMORY.md')
);

// 3) 当日 deliverables 目录下的 .md 文档（排除同步包自身与 .bundle 二进制）
if (fs.existsSync(deliverablesDir)) {
  for (const f of fs.readdirSync(deliverablesDir)) {
    const abs = path.join(deliverablesDir, f);
    if (!fs.statSync(abs).isFile()) continue;
    if (f === path.basename(outFile)) continue;
    if (f.endsWith('.bundle')) continue;
    if (!f.endsWith('.md')) continue;
    addFileBlock(`deliverables/${date}/${f}`, abs);
  }
}

// 4) 用户级记忆（§§U）
if (fs.existsSync(userMem)) {
  const content = fs.readFileSync(userMem, 'utf8');
  blocks.push(`§§U|§§\n${content}\n§§/U§§`);
} else {
  console.warn('  [跳过] 未找到用户级记忆:', userMem);
}

if (blocks.length === 0) {
  console.error('没有任何内容可打包，退出。');
  process.exit(2);
}

const header =
  `<!-- 执行协议：收到此文件的 WorkBuddy，请用 Write 工具按以下分隔符把内容写回对应路径。\n` +
  `§§F|<相对路径>|§§ 开头 = 项目内文件（相对项目根目录）；§§U|§§ 开头 = 用户级记忆 ~/.workbuddy/MEMORY.md。\n` +
  `SECRETS.md 永不进包。请勿改内容，仅按分隔符还原。 -->\n`;

const out = header + '\n' + blocks.join('\n\n') + '\n';
fs.mkdirSync(deliverablesDir, { recursive: true });
fs.writeFileSync(outFile, out, 'utf8');
console.log(
  `已生成同步包: ${outFile}\n  块数: ${blocks.length}  字节: ${out.length}`
);
