/**
 * Batch replace hardcoded Tailwind colors with semantic design tokens.
 * Mechanical string replacement — only touches class name strings, no logic.
 */
const fs = require('fs');
const path = require('path');

const REPLACEMENTS = [
  // red → danger
  [/\btext-red-600\b/g, 'text-danger'],
  [/\btext-red-700\b/g, 'text-danger'],
  [/\btext-red-800\b/g, 'text-danger'],
  [/\bbg-red-100\b/g, 'bg-danger/10'],
  [/\bbg-red-50\b/g, 'bg-danger/5'],
  [/\bborder-red-100\b/g, 'border-danger/20'],
  // green → success
  [/\btext-green-600\b/g, 'text-success'],
  [/\btext-green-700\b/g, 'text-success'],
  [/\btext-green-800\b/g, 'text-success'],
  [/\bbg-green-50\b/g, 'bg-success/10'],
  [/\bbg-green-100\b/g, 'bg-success/10'],
  [/\bbg-green-500\b/g, 'bg-success'],
  [/\bborder-green-300\b/g, 'border-success/30'],
  // orange/amber → warning
  [/\btext-orange-600\b/g, 'text-warning'],
  [/\btext-orange-500\b/g, 'text-warning'],
  [/\bbg-orange-100\b/g, 'bg-warning/10'],
  [/\bbg-amber-100\b/g, 'bg-warning/10'],
  [/\btext-amber-700\b/g, 'text-warning'],
  [/\bborder-amber-100\b/g, 'border-warning/20'],
  [/\bborder-amber-200\b/g, 'border-warning/20'],
  // blue → info/primary (non-semantic blue)
  [/\bbg-blue-100\b/g, 'bg-info/10'],
  [/\btext-blue-600\b/g, 'text-primary-700'],
  [/\btext-blue-700\b/g, 'text-primary-700'],
  [/\bhover:bg-blue-200\b/g, 'hover:bg-info/20'],
  [/\bhover:bg-green-200\b/g, 'hover:bg-success/20'],
  // purple/indigo/teal → neutral (decorative)
  [/\bbg-purple-100\b/g, 'bg-gray-100'],
  [/\btext-purple-700\b/g, 'text-ink-2'],
  [/\bbg-indigo-100\b/g, 'bg-gray-100'],
  [/\btext-indigo-700\b/g, 'text-ink-2'],
  [/\bhover:bg-indigo-100\b/g, 'hover:bg-gray-100'],
  [/\bhover:border-indigo-200\b/g, 'hover:border-hairline'],
  [/\bbg-teal-100\b/g, 'bg-gray-100'],
  [/\btext-teal-700\b/g, 'text-ink-2'],
  // gray-200 bg → gray-100 (for meeting phase backgrounds)
  [/\bbg-gray-200\b/g, 'bg-gray-100'],
  // slate → neutral
  [/\bbg-slate-50\b/g, 'bg-gray-50'],
  [/\btext-slate-700\b/g, 'text-ink-2'],
  [/\bborder-slate-200\b/g, 'border-hairline'],
];

function walk(dir) {
  const results = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) results.push(...walk(p));
    else if (/\.(jsx?|js)$/.test(f)) results.push(p);
  }
  return results;
}

let totalChanges = 0;
let filesChanged = 0;
const files = walk(path.join(__dirname, '..', 'client', 'src'));
for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  let changes = 0;
  for (const [re, repl] of REPLACEMENTS) {
    const matches = content.match(re);
    if (matches) {
      changes += matches.length;
      content = content.replace(re, repl);
    }
  }
  if (changes > 0) {
    fs.writeFileSync(f, content, 'utf8');
    filesChanged++;
    totalChanges += changes;
    const rel = path.relative(path.join(__dirname, '..'), f).split(path.sep).join('/');
    console.log('  ' + rel + ': ' + changes + ' replacements');
  }
}
console.log('---');
console.log('Files changed: ' + filesChanged + ', total replacements: ' + totalChanges);
