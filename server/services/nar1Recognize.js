/**
 * nar1Recognize.js — 调用 Python(pdfplumber) 识别器解析 NAR1 周年申报表
 *
 * 为什么用 Python 而不是纯 JS:
 *   NAR1 的"填写值"（公司名 / BR 号 / 董事姓名 / 股东持股）用的是非嵌入字体 ArialMT，
 *   纯 JS 解析器（pdf-parse / pdfjs-dist）在 Node 下无法完成字体映射，实测整段丢失。
 *   Python + pdfplumber 实测 14 份样本 14/14 准确，故选其为解析引擎。
 *
 * 引擎探测顺序（首个可用者胜）:
 *   process.env.NAR1_PYTHON  >  python3  >  python  >  受管 venv（仅本机开发存在）
 *   判定标准：能执行成功 `import pdfplumber`。
 *
 * 降级：引擎不可用时返回 { ok:false, reason }，由上层给前端明确提示，
 *       不静默失败 —— 避免用户以为识别成功但拿到空数据。
 */
'use strict'

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.join(__dirname, '..', '..')
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'nar1_recognize.py')

// 受管 venv python（仅本机开发存在；Render 上不存在，自然跳过）
const MANAGED_PYTHON = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.workbuddy', 'binaries', 'python', 'envs', 'default',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
)

let engineCache = null // { python, ok, reason, checkedAt }

function candidates() {
  const list = [process.env.NAR1_PYTHON, 'python3', 'python']
  if (MANAGED_PYTHON && fs.existsSync(MANAGED_PYTHON)) list.push(MANAGED_PYTHON)
  return list.filter(Boolean)
}

function run(python, args, timeoutMs) {
  return new Promise((resolve) => {
    let out = ''
    let err = ''
    let done = false
    const finish = (payload) => {
      if (done) return
      done = true
      resolve(payload)
    }
    let child
    try {
      child = spawn(python, args, {
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      })
    } catch (e) {
      finish({ code: -1, stdout: '', stderr: String(e && e.message) })
      return
    }
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* ignore */ }
      finish({ code: -2, stdout: out, stderr: 'timeout' })
    }, timeoutMs)
    child.stdout.on('data', (d) => { out += d.toString('utf8') })
    child.stderr.on('data', (d) => { err += d.toString('utf8') })
    child.on('error', (e) => {
      clearTimeout(timer)
      finish({ code: -1, stdout: out, stderr: String(e && e.message) })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      finish({ code, stdout: out, stderr: err })
    })
  })
}

/**
 * 探测解析引擎是否可用（结果缓存，避免每次请求都 spawn）
 * @returns {Promise<{ok:boolean, python?:string, reason?:string}>}
 */
async function detectEngine(force = false) {
  if (engineCache && !force) return engineCache
  let lastReason = 'no python candidate'
  for (const py of candidates()) {
    const probe = await run(py, ['-c', 'import pdfplumber; print("PDFPLUMBER_OK")'], 20000)
    if (probe.code === 0 && probe.stdout.includes('PDFPLUMBER_OK')) {
      engineCache = { ok: true, python: py, checkedAt: new Date().toISOString() }
      return engineCache
    }
    lastReason = probe.code === -1
      ? `无法执行 ${py}`
      : `${py} 缺少 pdfplumber（${(probe.stderr || '').split('\n')[0] || '未知'}）`
  }
  engineCache = { ok: false, reason: lastReason, checkedAt: new Date().toISOString() }
  return engineCache
}

/**
 * 识别单个 NAR1 PDF
 * @param {string} filePath PDF 绝对路径
 * @returns {Promise<{ok:boolean, result?:object, error?:string, engine?:object}>}
 */
async function recognizeFile(filePath) {
  const engine = await detectEngine()
  if (!engine.ok) {
    return {
      ok: false,
      error: 'NAR1 解析引擎不可用：' + engine.reason,
      hint: '服务端需 python3 + pdfplumber。若在 Render 部署，请确认 buildCommand 已安装依赖；' +
        '或在本机执行识别后上传 JSON。',
      engine,
    }
  }
  const res = await run(engine.python, ['-X', 'utf8', SCRIPT, '--stdout', filePath], 120000)
  if (res.code !== 0) {
    return { ok: false, error: '识别器执行失败', detail: (res.stderr || res.stdout || '').slice(0, 800), engine }
  }
  // stdout 只应有 JSON；若有噪音（警告等）则截取首尾花括号之间
  let raw = (res.stdout || '').trim()
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s === -1 || e === -1) return { ok: false, error: '识别器未返回 JSON', detail: raw.slice(0, 500), engine }
  try {
    const parsed = JSON.parse(raw.slice(s, e + 1))
    const result = Array.isArray(parsed.results) ? parsed.results[0] : null
    if (!result) return { ok: false, error: '识别器未返回结果', engine }
    return { ok: true, result, engine: { ok: true, python: engine.python } }
  } catch (err) {
    return { ok: false, error: '识别结果 JSON 解析失败：' + err.message, detail: raw.slice(0, 500), engine }
  }
}

module.exports = { recognizeFile, detectEngine }
