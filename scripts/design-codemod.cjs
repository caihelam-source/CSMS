/**
 * design-codemod.cjs — CSMS 设计系统全站收口
 * 把散落的 Tailwind 默认色（bg-white / border-gray-* / text-gray-* / 各种品牌色按钮 / 语义徽章色）
 * 机械替换为统一设计令牌（bg-surface / border-hairline / text-ink-* / primary / success / danger / info / warning）。
 * 目的：建立单一色调体系 + 让暗色模式成为可能（所有颜色走 CSS 变量）。
 *
 * 用法：node scripts/design-codemod.cjs
 * 仅处理 client/src 下 .jsx（不含 src.bak / node_modules）。幂等：重复运行安全。
 */
const fs = require('fs')
const path = require('path')

const SRC = path.resolve(__dirname, '..', 'client', 'src')

// [find, replace] —— 长匹配优先（脚本内按长度降序排序，避免 bg-blue-50 误伤 bg-blue-500）
const REPLACEMENTS = [
  // ---- 中性 → 令牌 ----
  ['bg-white', 'bg-surface'],
  ['border-gray-200', 'border-hairline'],
  ['border-gray-300', 'border-hairline'],
  ['border-gray-100', 'border-hairline'],
  ['text-gray-900', 'text-ink'],
  ['text-gray-800', 'text-ink'],
  ['text-gray-700', 'text-ink'],
  ['text-gray-600', 'text-ink-2'],
  ['text-gray-500', 'text-ink-2'],
  ['text-gray-400', 'text-ink-3'],
  ['placeholder-gray-400', 'placeholder-ink-3'],
  ['placeholder-gray-500', 'placeholder-ink-2'],
  ['bg-gray-50', 'bg-canvas'],
  ['hover:bg-gray-50', 'hover:bg-canvas'],
  ['divide-gray-200', 'divide-hairline'],
  ['ring-gray-200', 'ring-hairline'],
  ['stroke-gray-400', 'stroke-ink-3'],

  // ---- 蓝 → primary / info ----
  ['bg-blue-600', 'bg-primary-600'],
  ['bg-blue-500', 'bg-primary-500'],
  ['bg-blue-50', 'bg-info/10'],
  ['text-blue-600', 'text-primary-600'],
  ['text-blue-700', 'text-primary-700'],
  ['text-blue-500', 'text-primary-500'],
  ['text-blue-800', 'text-info'],
  ['text-blue-400', 'text-primary-400'],
  ['hover:bg-blue-700', 'hover:bg-primary-700'],
  ['border-blue-200', 'border-info/20'],
  ['bg-blue-100', 'bg-info/10'],
  ['from-blue-500', 'from-primary-500'],
  ['to-blue-600', 'to-primary-600'],

  // ---- 靛/紫/青绿（装饰色）→ primary / info ----
  ['bg-indigo-600', 'bg-primary-600'],
  ['text-indigo-600', 'text-primary-600'],
  ['bg-indigo-50', 'bg-info/10'],
  ['bg-purple-600', 'bg-primary-600'],
  ['text-purple-600', 'text-info'],
  ['bg-purple-50', 'bg-info/10'],
  ['bg-teal-600', 'bg-primary-600'],
  ['text-teal-600', 'text-info'],
  ['bg-teal-50', 'bg-info/10'],

  // ---- 红 → danger ----
  ['bg-red-600', 'bg-danger'],
  ['bg-red-700', 'bg-danger'],
  ['bg-red-50', 'bg-danger/10'],
  ['bg-red-100', 'bg-danger/10'],
  ['hover:bg-red-700', 'hover:opacity-90'],
  ['text-red-900', 'text-ink'],
  ['text-red-800', 'text-danger'],
  ['text-red-700', 'text-danger'],
  ['text-red-500', 'text-danger'],
  ['text-red-400', 'text-danger'],
  ['border-red-200', 'border-danger/20'],
  ['border-red-300', 'border-danger/20'],

  // ---- 绿 → success ----
  ['bg-green-600', 'bg-success'],
  ['hover:bg-green-700', 'hover:opacity-90'],
  ['text-green-800', 'text-success'],
  ['text-green-700', 'text-success'],
  ['text-green-500', 'text-success'],
  ['bg-green-100', 'bg-success/10'],
  ['border-green-200', 'border-success/20'],

  // ---- 琥珀/橙/黄 → warning ----
  ['bg-amber-50', 'bg-warning/10'],
  ['bg-amber-100', 'bg-warning/10'],
  ['border-amber-200', 'border-warning/20'],
  ['text-amber-900', 'text-ink'],
  ['text-amber-800', 'text-warning'],
  ['text-amber-700', 'text-warning'],
  ['text-amber-600', 'text-warning'],
  ['text-amber-500', 'text-warning'],
  ['bg-orange-100', 'bg-warning/10'],
  ['border-orange-200', 'border-warning/20'],
  ['text-orange-700', 'text-warning'],
  ['bg-yellow-100', 'bg-warning/10'],
  ['border-yellow-200', 'border-warning/20'],
  ['text-yellow-800', 'text-warning'],
  ['text-yellow-700', 'text-warning'],

  // ---- 其他装饰色 → 语义 ----
  ['bg-pink-50', 'bg-danger/10'],
  ['text-pink-600', 'text-danger'],
  ['bg-emerald-50', 'bg-success/10'],
  ['text-emerald-600', 'text-success'],
  ['bg-cyan-50', 'bg-info/10'],
  ['text-cyan-600', 'text-info'],
]

// 长匹配优先
REPLACEMENTS.sort((a, b) => b[0].length - a[0].length)

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (entry.name.endsWith('.jsx')) acc.push(full)
  }
  return acc
}

const files = walk(SRC, [])
let totalChanges = 0
const changed = []

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8')
  let after = before
  let c = 0
  for (const [find, repl] of REPLACEMENTS) {
    if (after.includes(find)) {
      const parts = after.split(find)
      c += parts.length - 1
      after = parts.join(repl)
    }
  }
  if (c > 0) {
    fs.writeFileSync(file, after, 'utf8')
    totalChanges += c
    changed.push(`${path.relative(SRC, file)}: ${c}`)
  }
}

console.log(`Processed ${files.length} .jsx files.`)
console.log(`Total token replacements: ${totalChanges}`)
console.log('Changed files:')
for (const l of changed) console.log('  ' + l)
