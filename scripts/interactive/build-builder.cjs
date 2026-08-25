/**
 * build-builder.cjs — 把 scripts/interactive/builder.jsx 打包成浏览器可直接运行的 builder.js，
 * 并生成内联了 document.css 的 builder.html（轻量 Schema 编辑器 Builder）。
 *
 * 用法：
 *   cd C:\Users\Vincent\WorkBuddy\Claw && node scripts/interactive/build-builder.cjs
 *
 * 产出：
 *   <OUTPUT_DIR>/builder.js   —— react + react-dom/client + SchemaDocRenderer + 9 个 preset 全内联
 *   <OUTPUT_DIR>/builder.html —— 内联 document.css 与外壳布局样式，<script src="./builder.js">
 *
 * 本脚本是只读构建工具：不修改 preset / 引擎 / 前端组件中的任何一行代码。
 * 配置与 build.cjs 完全对齐（bundle/iife/browser/jsx-automatic 回退 transform、nodePaths→client/node_modules）。
 */

'use strict'

const fs = require('fs')
const path = require('path')

/** Claw 项目根目录绝对路径（scripts/interactive → Claw）。 */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

/** 前端依赖目录，供 esbuild 解析 react / react-dom。 */
const CLIENT_NODE_MODULES = path.join(PROJECT_ROOT, 'client', 'node_modules')

/** 打包入口。 */
const ENTRY_FILE = path.join(__dirname, 'builder.jsx')

/** 需要内联进 HTML 的正式文书样式表。 */
const CSS_FILE = path.join(PROJECT_ROOT, 'client', 'src', 'schemaDoc', 'document.css')

/** 产出目录（与 build.cjs 一致，确保 preview 站点的同源资源在一起）。 */
const OUTPUT_DIR = path.resolve(
  'C:/Users/Vincent/WorkBuddy/2026-08-05-13-37-42/outputs/claw-previews/interactive'
)

/** 产出文件。 */
const OUT_JS = path.join(OUTPUT_DIR, 'builder.js')
const OUT_HTML = path.join(OUTPUT_DIR, 'builder.html')

/** 外壳布局样式（Builder UI，与 .doc-* 正式排版完全隔离）。 */
const SHELL_CSS = `
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  background: #eef2f7;
  color: #0f172a;
  font: 14px/1.6 "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}
.bx-app { display: flex; flex-direction: column; height: 100vh; }
.bx-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 18px;
  background: #0f172a;
  color: #f8fafc;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.25);
  z-index: 5;
}
.ix-brand { display: flex; flex-direction: column; line-height: 1.35; min-width: 0; }
.ix-brand strong { font-size: 15px; letter-spacing: 0.5px; }
.ix-sub { font-size: 12px; color: #94a3b8; }
.ix-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.bx-body { flex: 1; display: flex; min-height: 0; }

/* 左栏：元信息 + 字段 */
.bx-left {
  flex: none;
  width: 360px;
  max-width: 32vw;
  overflow-y: auto;
  background: #ffffff;
  border-right: 1px solid #d8e0ea;
  padding: 0 0 40px;
}
/* 中栏：区块 */
.bx-mid {
  flex: none;
  width: 400px;
  max-width: 34vw;
  overflow-y: auto;
  background: #fbfcfe;
  border-right: 1px solid #d8e0ea;
  padding: 0 0 40px;
}
/* 右栏：实时预览 */
.bx-preview { flex: 1; overflow-y: auto; padding: 18px 24px 40px; min-width: 0; background: #eef2f7; }

/* 区块分组卡片 */
.bld-block { padding: 14px 16px; border-bottom: 1px solid #e2e8f0; }
.bld-block-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.bld-block-head h3 { margin: 0; font-size: 15px; }
.sub { margin: 14px 0 6px; font-size: 13px; color: #334155; }

.lbl { display: block; font-size: 12px; color: #475569; margin: 10px 0 4px; font-weight: 600; }
.fld-hint { margin: 5px 0 0; font-size: 11.5px; color: #64748b; }

.ctl {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 7px 9px;
  font: inherit;
  font-size: 13px;
  color: #0f172a;
  background: #ffffff;
  outline: none;
}
.ctl:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12); }
textarea.ctl { resize: vertical; line-height: 1.65; }
.ctl-sm { padding: 4px 6px; font-size: 12.5px; min-width: 90px; }
.ctl-inline { width: auto; min-width: 200px; }
.two { display: flex; gap: 12px; }
.two > div { flex: 1; min-width: 0; }
.bool { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #334155; margin-top: 6px; }
.chk-box { width: 15px; height: 15px; margin: 3px 0 0; flex: none; accent-color: #0f172a; cursor: pointer; }
.spacer { flex: 1; }

/* 字段卡片 */
.fld-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; background: #f8fafc; }
.fld-card-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.fld-type { font-size: 11px; color: #94a3b8; font-weight: 600; }

/* 区块卡片 */
.bld-secs { margin-top: 4px; }
.bld-secs-nested { margin: 8px 0 4px; padding-left: 10px; border-left: 2px dashed #cbd5e1; }
.sec-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; background: #ffffff; }
.sec-card-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.sec-type { font-size: 12px; font-weight: 700; color: #1f4e79; }
.add-sec { display: flex; align-items: center; gap: 8px; padding-top: 4px; }

/* 信息表 / 签署项 子编辑 */
.row-edit { display: grid; grid-template-columns: 90px 1fr auto auto; gap: 6px; align-items: start; margin-bottom: 6px; }
.sign-edit { display: grid; grid-template-columns: 120px 110px 1fr auto; gap: 6px; align-items: start; margin-bottom: 6px; }
.ins-var { display: flex; gap: 6px; margin-top: 6px; }
.grp { margin-top: 4px; }

.fld-empty {
  margin: 0 0 6px;
  font-size: 12px;
  color: #94a3b8;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  padding: 8px 10px;
}

/* 按钮 */
.btn {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn:hover { background: #f1f5f9; border-color: #94a3b8; }
.btn-primary { background: #2563eb; border-color: #2563eb; color: #ffffff; font-weight: 600; }
.btn-primary:hover { background: #1d4ed8; border-color: #1d4ed8; }
.btn-mini { padding: 3px 9px; font-size: 12px; }
.btn-danger { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
.btn-danger:hover { background: #fee2e2; border-color: #fca5a5; }
.btn-ghost { color: #475569; border-style: dashed; }
.tab-on { background: #0f172a; border-color: #0f172a; color: #ffffff; font-weight: 600; }

/* 预览头 + 校验提示 */
.pv-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.pv-toggle { display: flex; gap: 6px; }
.pv-count { font-size: 12px; color: #64748b; }
.bld-warn {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 14px;
}
.bld-warn-title { margin: 0 0 4px; font-size: 12.5px; font-weight: 700; color: #9a3412; }
.bld-warn ul { margin: 0; padding-left: 18px; }
.bld-warn li { font-size: 12px; color: #9a3412; }

/* Toast */
.bx-toast {
  position: fixed;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  background: #0f172a;
  color: #f8fafc;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.3);
  z-index: 50;
}

@media print {
  .bx-app, .bx-body { display: block !important; height: auto !important; }
  .bx-left, .bx-mid, .bx-header, .pv-head, .bld-warn, .bx-toast { display: none !important; }
  .bx-preview { padding: 0 !important; overflow: visible !important; background: #ffffff !important; }
}
`

/**
 * 加载 esbuild：优先常规解析，失败则回退 client/node_modules 绝对路径。
 * @returns {object} esbuild 模块
 */
function loadEsbuild() {
  try {
    return require('esbuild')
  } catch (err) {
    const fallback = path.join(CLIENT_NODE_MODULES, 'esbuild')
    console.log(`[info] require('esbuild') 失败，回退到 ${fallback}`)
    return require(fallback)
  }
}

/**
 * 用 esbuild 把 builder.jsx 打成浏览器 IIFE。
 * 先试 jsx:'automatic'，若报找不到 react/jsx-runtime 则回退 jsx:'transform'。
 * @param {object} esbuild esbuild 模块
 * @returns {Promise<string>} 实际生效的 jsx 模式
 */
async function bundleApp(esbuild) {
  /**
   * 执行一次构建。
   * @param {'automatic'|'transform'} jsxMode JSX 转换模式
   * @returns {Promise<void>}
   */
  async function build(jsxMode) {
    await esbuild.build({
      entryPoints: [ENTRY_FILE],
      outfile: OUT_JS,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: ['es2019'],
      write: true,
      logLevel: 'silent',
      loader: { '.js': 'jsx', '.css': 'empty' },
      jsx: jsxMode,
      define: { 'process.env.NODE_ENV': '"production"' },
      nodePaths: [CLIENT_NODE_MODULES],
      absWorkingDir: PROJECT_ROOT,
    })
  }

  try {
    await build('automatic')
    console.log("[ok] esbuild 打包完成（jsx:'automatic'）")
    return 'automatic'
  } catch (err) {
    const message = String((err && err.message) || err)
    if (!message.includes('jsx-runtime')) throw err
    console.log("[warn] 未解析到 react/jsx-runtime，回退 jsx:'transform'")
    await build('transform')
    console.log("[ok] esbuild 打包完成（jsx:'transform'）")
    return 'transform'
  }
}

/**
 * 组装 builder.html：内联 document.css（id="doc-css"）+ 外壳样式 + #builder-root 挂载点。
 * 注意：使用 #builder-root 而非 #root，避免任何潜在副作用冲突。
 * @param {string} docCss document.css 全文
 * @returns {string} HTML 全文
 */
function buildHtml(docCss) {
  return [
    '<!doctype html>',
    '<html lang="zh">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>合规模板 Builder · Claw</title>',
    '<!-- 顶部返回链接（指向预览站点的交互预览器与总目录） -->',
    '<style id="topbar-css">',
    '.bx-topbar { position: fixed; top: 0; right: 0; z-index: 999; display: flex; gap: 8px; padding: 8px 12px; }',
    '.bx-topbar a { font-size: 12px; color: #334155; text-decoration: none; background: rgba(255,255,255,0.92); border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 10px; }',
    '.bx-topbar a:hover { background: #f1f5f9; }',
    '</style>',
    '<!-- 正式文书排版：内联自 client/src/schemaDoc/document.css -->',
    '<style id="doc-css">',
    docCss,
    '</style>',
    '<!-- 编辑器外壳布局 -->',
    '<style id="shell-css">',
    SHELL_CSS,
    '</style>',
    '</head>',
    '<body>',
    '<div class="bx-topbar no-print">',
    '<a href="./index.html">⬅ 交互预览器</a>',
    '<a href="../index.html">📑 模板总目录</a>',
    '</div>',
    '<div id="builder-root"></div>',
    '<script src="./builder.js"></script>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

/**
 * 主流程。
 * @returns {Promise<void>}
 */
async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const esbuild = loadEsbuild()
  const jsxMode = await bundleApp(esbuild)

  const docCss = fs.readFileSync(CSS_FILE, 'utf8')
  const html = buildHtml(docCss)
  fs.writeFileSync(OUT_HTML, html, 'utf8')

  const jsKb = fs.statSync(OUT_JS).size / 1024
  const htmlKb = Buffer.byteLength(html, 'utf8') / 1024

  console.log(`[ok] builder.js   ${jsKb.toFixed(1)} KB  → ${OUT_JS}`)
  console.log(`[ok] builder.html ${htmlKb.toFixed(1)} KB  → ${OUT_HTML}`)
  console.log(`[info] jsx 模式：${jsxMode}`)

  const failures = []
  if (jsKb < 50) failures.push(`builder.js 体积不足 50KB（实际 ${jsKb.toFixed(1)} KB）`)
  if (!html.includes('.doc-page')) failures.push('builder.html 未内联 document.css')
  if (!html.includes('<script src="./builder.js"></script>')) failures.push('builder.html 缺少 builder.js 引用')
  if (!html.includes('<div id="builder-root"></div>')) failures.push('builder.html 缺少 #builder-root 挂载点')

  if (failures.length > 0) {
    failures.forEach((item) => console.log(`[fail] ${item}`))
    process.exitCode = 1
    return
  }
  console.log('[pass] Schema Builder 构建完成，可直接用浏览器打开 builder.html')
}

main().catch((err) => {
  console.error('[error] 构建失败：', (err && err.stack) || err)
  process.exit(1)
})
