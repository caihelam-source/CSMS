/**
 * build.cjs — 把 scripts/interactive/app.jsx 打包成浏览器可直接运行的 app.js，
 * 并生成内联了 document.css 的 index.html（交互式文书预览器）。
 *
 * 用法：
 *   cd C:\Users\Vincent\WorkBuddy\Claw && node scripts/interactive/build.cjs
 *
 * 产出：
 *   <OUTPUT_DIR>/app.js     —— react + react-dom/client + SchemaDocRenderer + 9 个 preset 全内联
 *   <OUTPUT_DIR>/index.html —— 内联 document.css 与外壳布局样式，<script src="./app.js">
 *
 * 本脚本是只读构建工具：不修改 preset / 引擎 / 前端组件中的任何一行代码。
 */

'use strict'

const fs = require('fs')
const path = require('path')

/** Claw 项目根目录绝对路径（scripts/interactive → Claw）。 */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

/** 前端依赖目录，供 esbuild 解析 react / react-dom。 */
const CLIENT_NODE_MODULES = path.join(PROJECT_ROOT, 'client', 'node_modules')

/** 打包入口。 */
const ENTRY_FILE = path.join(__dirname, 'app.jsx')

/** 需要内联进 HTML 的正式文书样式表。 */
const CSS_FILE = path.join(PROJECT_ROOT, 'client', 'src', 'schemaDoc', 'document.css')

/** 产出目录。 */
const OUTPUT_DIR = path.resolve(
  'C:/Users/Vincent/WorkBuddy/2026-08-05-13-37-42/outputs/claw-previews/interactive'
)

/** 产出文件。 */
const OUT_JS = path.join(OUTPUT_DIR, 'app.js')
const OUT_HTML = path.join(OUTPUT_DIR, 'index.html')

/** 外壳布局样式（编辑器 UI，与 .doc-* 正式排版完全隔离）。 */
const SHELL_CSS = `
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  background: #eef2f7;
  color: #0f172a;
  font: 14px/1.6 "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}
.ix-app { display: flex; flex-direction: column; height: 100vh; }
.ix-header {
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
.ix-brand { display: flex; flex-direction: column; line-height: 1.35; }
.ix-brand strong { font-size: 15px; letter-spacing: 0.5px; }
.ix-sub { font-size: 12px; color: #94a3b8; }
.ix-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.ix-body { flex: 1; display: flex; min-height: 0; }
.ix-form {
  flex: none;
  width: 480px;
  max-width: 46vw;
  overflow-y: auto;
  background: #ffffff;
  border-right: 1px solid #d8e0ea;
  padding: 0 0 40px;
}
.ix-preview { flex: 1; overflow-y: auto; padding: 24px; min-width: 0; }

/* 模板 tabs */
.tabs {
  position: sticky;
  top: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  z-index: 3;
}
.tab {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab:hover { border-color: #94a3b8; background: #f1f5f9; }
.tab-on { background: #0f172a; border-color: #0f172a; color: #ffffff; font-weight: 600; }

/* 表单头 */
.form-head { padding: 14px 18px 6px; border-bottom: 1px dashed #e2e8f0; }
.form-title { margin: 0 0 4px; font-size: 17px; }
.form-desc { margin: 0 0 6px; font-size: 12.5px; color: #475569; }
.form-meta { margin: 0 0 8px; font-size: 12px; color: #64748b; }
.form-meta code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; }
.errors {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.errors-title { margin: 0 0 4px; font-size: 12.5px; font-weight: 700; color: #9a3412; }
.errors ul { margin: 0; padding-left: 18px; }
.errors li { font-size: 12px; color: #9a3412; }
.ok {
  margin: 0 0 10px;
  font-size: 12px;
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 6px 10px;
}

/* 字段 */
.form-body { padding: 12px 18px; }
.fld { margin-bottom: 16px; }
.fld-label { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 13px; font-weight: 600; }
.req { font-size: 11px; font-weight: 600; color: #b91c1c; background: #fee2e2; border-radius: 4px; padding: 0 5px; }
.fld-type { margin-left: auto; font-size: 11px; color: #94a3b8; font-weight: 400; }
.fld-hint { margin: 5px 0 0; font-size: 11.5px; color: #64748b; }
.fld-empty {
  margin: 0 0 6px;
  font-size: 12px;
  color: #94a3b8;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  padding: 8px 10px;
}
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
.bool { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #334155; }
.chk-box { width: 15px; height: 15px; margin: 3px 0 0; flex: none; accent-color: #0f172a; cursor: pointer; }

/* checklist */
.chk-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
.chk-text { flex: 1; }
.chk-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }

/* objectList */
.objlist-scroll { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
.objlist-table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
.objlist-table th, .objlist-table td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
.objlist-table th { background: #f8fafc; font-size: 12px; white-space: nowrap; }
.objlist-idx { width: 32px; color: #94a3b8; text-align: center; }
.objlist-op { white-space: nowrap; }

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

/* 浮动「新建模板」入口：始终可达，重建不丢 */
.ix-fab {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 11px 16px;
  background: #1f8a4c;
  color: #ffffff;
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  border-radius: 999px;
  box-shadow: 0 6px 18px rgba(31, 138, 76, 0.4);
  transition: all 0.15s ease;
}
.ix-fab:hover { background: #176c3b; box-shadow: 0 8px 22px rgba(31, 138, 76, 0.5); }

@media print {
  .ix-app, .ix-body { display: block !important; height: auto !important; }
  .ix-form, .ix-header { display: none !important; }
  .ix-preview { padding: 0 !important; overflow: visible !important; }
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
 * 用 esbuild 把 app.jsx 打成浏览器 IIFE。
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
 * 组装 index.html：内联 document.css（id="doc-css"，导出功能会读取它）+ 外壳样式。
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
    '<title>Claw 合规文书 · 交互预览器</title>',
    '<!-- 正式文书排版：内联自 client/src/schemaDoc/document.css（导出 HTML 时按 id 读取复用） -->',
    '<style id="doc-css">',
    docCss,
    '</style>',
    '<!-- 编辑器外壳布局 -->',
    '<style id="shell-css">',
    SHELL_CSS,
    '</style>',
    '</head>',
    '<body>',
    '<div id="root"></div>',
    '<a class="ix-fab" href="builder.html">➕ 新建模板（Schema Builder）</a>',
    '<script src="./app.js"></script>',
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

  console.log(`[ok] app.js      ${jsKb.toFixed(1)} KB  → ${OUT_JS}`)
  console.log(`[ok] index.html  ${htmlKb.toFixed(1)} KB  → ${OUT_HTML}`)
  console.log(`[info] jsx 模式：${jsxMode}`)

  const failures = []
  if (jsKb < 50) failures.push(`app.js 体积不足 50KB（实际 ${jsKb.toFixed(1)} KB）`)
  if (!html.includes('.doc-page')) failures.push('index.html 未内联 document.css')
  if (!html.includes('<script src="./app.js"></script>')) failures.push('index.html 缺少 app.js 引用')
  if (!html.includes('<div id="root"></div>')) failures.push('index.html 缺少 #root 挂载点')

  if (failures.length > 0) {
    failures.forEach((item) => console.log(`[fail] ${item}`))
    process.exitCode = 1
    return
  }
  console.log('[pass] 交互式预览器构建完成，可直接用浏览器打开 index.html')
}

main().catch((err) => {
  console.error('[error] 构建失败：', (err && err.stack) || err)
  process.exit(1)
})
