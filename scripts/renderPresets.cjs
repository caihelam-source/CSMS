/**
 * renderPresets.cjs — 把 9 个合规文档预设渲染成独立静态 HTML 预览文件。
 *
 * 用法：
 *   cd C:\Users\Vincent\WorkBuddy\Claw && node scripts/renderPresets.cjs
 *
 * 流程：
 *   1. 用 esbuild 把 scripts/renderEntry.jsx 打包成一段自包含的 CJS 源码字符串
 *      （react / react-dom/server / SchemaDocRenderer / 9 个 preset 全部内联）。
 *   2. 用 Module._compile 在内存里求值该字符串，拿到导出。
 *   3. 逐个预设做 renderToStaticMarkup SSR，内联 document.css 生成完整 HTML。
 *
 * 本脚本是只读预览工具：不修改 preset / 引擎 / 前端组件中的任何一行代码。
 */

'use strict'

const fs = require('fs')
const path = require('path')
const Module = require('module')

/** Claw 项目根目录绝对路径。 */
const PROJECT_ROOT = path.resolve(__dirname, '..')

/** 前端依赖目录，供 esbuild 解析 react / react-dom。 */
const CLIENT_NODE_MODULES = path.join(PROJECT_ROOT, 'client', 'node_modules')

/** 打包入口。 */
const ENTRY_FILE = path.join(__dirname, 'renderEntry.jsx')

/** 需要内联进 HTML 的样式表。 */
const CSS_FILE = path.join(
  PROJECT_ROOT,
  'client',
  'src',
  'schemaDoc',
  'document.css'
)

/** HTML 产出目录。 */
const OUTPUT_DIR = path.resolve(
  'C:/Users/Vincent/WorkBuddy/2026-08-05-13-37-42/outputs/claw-previews'
)

/** 期望生成的 presetKey 清单，用于收尾校验。 */
const EXPECTED_KEYS = [
  'director-confirmation',
  'du004g-undertaking',
  'department-self-assessment',
  'internal-control-report',
  'board-resolution',
  'project-charter',
  'director-resignation',
  'director-consent-to-act',
  'director-code-compliance-confirmation',
]

/**
 * 加载 esbuild：优先走常规解析，失败则回退到 client/node_modules 绝对路径。
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
 * 用 esbuild 把入口打包成 CJS 源码字符串。
 * 先尝试 jsx:'automatic'，若报找不到 react/jsx-runtime 则回退 jsx:'transform'。
 * @param {object} esbuild esbuild 模块
 * @returns {Promise<string>} 打包后的 CJS 源码
 */
async function bundleEntry(esbuild) {
  /**
   * 执行一次构建。
   * @param {'automatic'|'transform'} jsxMode JSX 转换模式
   * @returns {Promise<string>} 构建产物
   */
  async function build(jsxMode) {
    const result = await esbuild.build({
      entryPoints: [ENTRY_FILE],
      bundle: true,
      format: 'cjs',
      platform: 'node',
      target: 'node18',
      write: false,
      logLevel: 'silent',
      loader: { '.js': 'jsx', '.css': 'empty' },
      jsx: jsxMode,
      define: { 'process.env.NODE_ENV': '"production"' },
      nodePaths: [CLIENT_NODE_MODULES],
      absWorkingDir: PROJECT_ROOT,
    })
    return result.outputFiles[0].text
  }

  try {
    const code = await build('automatic')
    console.log("[ok] esbuild 打包完成（jsx:'automatic'）")
    return code
  } catch (err) {
    const message = String((err && err.message) || err)
    if (!message.includes('jsx-runtime')) throw err
    console.log("[warn] 未解析到 react/jsx-runtime，回退 jsx:'transform'")
    const code = await build('transform')
    console.log("[ok] esbuild 打包完成（jsx:'transform'）")
    return code
  }
}

/**
 * 在内存中求值打包产物，返回其导出对象。
 * @param {string} code CJS 源码
 * @returns {object} 模块导出
 */
function evaluateBundle(code) {
  const virtualPath = path.join(__dirname, '__renderEntry.bundle.cjs')
  const mod = new Module(virtualPath, null)
  mod.filename = virtualPath
  mod.paths = Module._nodeModulePaths(__dirname)
  mod._compile(code, virtualPath)
  return mod.exports
}

/**
 * 组装完整 HTML 文档。
 * 注意：SchemaDocRenderer 内部的 DocShell 已经输出 <article class="doc">，
 * 外层再包一层会造成 .doc 嵌套并污染排版，因此这里直接放入 markup。
 * @param {string} key presetKey
 * @param {string} css 内联样式
 * @param {string} markup SSR 静态标记
 * @returns {string} HTML 全文
 */
function buildHtml(key, css, markup) {
  return [
    '<!doctype html>',
    '<html lang="zh">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${key}</title>`,
    '<style>',
    css,
    '</style>',
    '</head>',
    '<body>',
    markup,
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
  const esbuild = loadEsbuild()
  const code = await bundleEntry(esbuild)
  const bundle = evaluateBundle(code)

  const { React, renderToStaticMarkup, SchemaDocRenderer, presets } = bundle
  if (!React || !renderToStaticMarkup || !SchemaDocRenderer) {
    throw new Error('打包产物缺少 React / renderToStaticMarkup / SchemaDocRenderer 导出')
  }
  if (!Array.isArray(presets) || presets.length === 0) {
    throw new Error('打包产物中的 presets 为空')
  }

  const css = fs.readFileSync(CSS_FILE, 'utf8')
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const generated = []
  for (const preset of presets) {
    const { key, docSchema, sampleData } = preset
    const markup = renderToStaticMarkup(
      React.createElement(SchemaDocRenderer, {
        docSchema,
        data: sampleData,
        mode: 'preview',
      })
    )
    const html = buildHtml(key, css, markup)
    const outFile = path.join(OUTPUT_DIR, `${key}.html`)
    fs.writeFileSync(outFile, html, 'utf8')

    const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)
    generated.push({ key, file: outFile, sizeKb: Number(sizeKb) })
    console.log(`[ok] ${key}.html  ${sizeKb} KB`)
  }

  const missing = EXPECTED_KEYS.filter(
    (key) => !generated.some((item) => item.key === key)
  )
  const tooSmall = generated.filter((item) => item.sizeKb < 5)

  console.log(`\n[done] 共生成 ${generated.length} 个 HTML → ${OUTPUT_DIR}`)
  if (missing.length > 0) {
    console.log(`[fail] 缺失 presetKey: ${missing.join(', ')}`)
    process.exitCode = 1
  }
  if (tooSmall.length > 0) {
    console.log(`[fail] 体积不足 5KB: ${tooSmall.map((i) => i.key).join(', ')}`)
    process.exitCode = 1
  }
  if (missing.length === 0 && tooSmall.length === 0) {
    console.log(`[pass] ${EXPECTED_KEYS.length} 个预设齐全，且均大于 5KB`)
  }
}

main().catch((err) => {
  console.error('[error] 渲染失败：', (err && err.stack) || err)
  process.exit(1)
})
