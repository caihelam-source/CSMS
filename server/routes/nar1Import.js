/**
 * routes/nar1Import.js — NAR1 周年申报表批量导入 API
 *
 *   GET  /api/nar1-import/capability   解析引擎可用性（前端据此提示/禁用上传）
 *   POST /api/nar1-import/parse        批量上传 PDF -> 识别 + 冲突检测 + 原件存 R2（不落库）
 *   POST /api/nar1-import/commit       按前端选定的模式逐条落库（skip / create / overwrite）
 *
 * 设计要点：
 *   - parse 不写业务数据，只产出"预览 + 冲突"，用户确认后才 commit（避免误录）
 *   - parse 阶段即把 PDF 原件存入 R2，commit 时只建 Document 记录引用，避免二次上传
 *   - 引擎不可用时返回 503 + 明确 code，前端给出可执行指引，不静默返回空结果
 */
'use strict'

const express = require('express')
const multer = require('multer')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { auth } = require('../middleware/auth')
const { storage: fileStorage } = require('../storage/r2')
const { recognizeFile, detectEngine } = require('../services/nar1Recognize')
const { buildPlan, detectConflicts, commitOne } = require('../services/nar1Import')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 单份 NAR1 通常 <3MB，留足余量
})

// GET /api/nar1-import/capability — 解析引擎可用性（公开探测：登录前即可用，前端据此启用/禁用上传）
router.get('/capability', async (req, res) => {
  try {
    const engine = await detectEngine(true)
    return res.json({
      success: true,
      engine: {
        ok: !!engine.ok,
        python: engine.python ? path.basename(engine.python) : null,
        reason: engine.reason || null,
      },
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
})

// POST /api/nar1-import/parse — 批量解析（不落库）
router.post('/parse', auth, upload.array('files', 20), async (req, res) => {
  const engine = await detectEngine()
  if (!engine.ok) {
    return res.status(503).json({
      success: false,
      code: 'ENGINE_UNAVAILABLE',
      message: 'NAR1 解析引擎不可用：' + (engine.reason || '未知原因'),
      hint: '服务端需 python3 + pdfplumber。Render 部署请确认 buildCommand 已安装该依赖；' +
        '或在本机完成识别后，通过「上传识别 JSON」通道导入。',
    })
  }

  const files = req.files || []
  if (!files.length) return res.status(400).json({ success: false, message: '未收到文件' })

  const results = []
  for (const f of files) {
    const tmp = path.join(os.tmpdir(), `nar1-${crypto.randomUUID()}.pdf`)
    try {
      fs.writeFileSync(tmp, f.buffer)
      const rec = await recognizeFile(tmp)
      if (!rec.ok) {
        results.push({ ok: false, id: crypto.randomUUID(), fileName: f.originalname, error: rec.error, detail: rec.detail })
        continue
      }
      // 原件入库存储（R2 / local），失败不阻断识别流程
      let storage = null
      let storageError = null
      try {
        const saved = await fileStorage.upload(f.buffer, f.originalname, f.mimetype)
        storage = {
          key: saved.key,
          url: saved.url,
          size: saved.size,
          originalName: f.originalname,
          mimeType: f.mimetype,
        }
      } catch (e) {
        storageError = e.message
      }
      const plan = buildPlan(rec.result)
      const { conflicts, hasConflict } = await detectConflicts(plan)
      results.push({
        ok: true,
        id: crypto.randomUUID(),
        fileName: f.originalname,
        plan,
        conflicts,
        hasConflict,
        storage,
        storageError,
        scanned: !!rec.result.scanned,
        needsMultimodal: !!rec.result.needsMultimodal,
        result: rec.result, // commit 时由前端原样回传
      })
    } catch (err) {
      results.push({ ok: false, id: crypto.randomUUID(), fileName: f.originalname, error: err.message })
    } finally {
      fs.promises.unlink(tmp).catch(() => { /* 临时文件清理失败不影响主流程 */ })
    }
  }

  return res.json({ success: true, count: results.length, results })
})

// POST /api/nar1-import/commit — 按模式落库
router.post('/commit', auth, async (req, res) => {
  try {
    const items = Array.isArray(req.body && req.body.items) ? req.body.items : []
    if (!items.length) return res.status(400).json({ success: false, message: '未收到导入项' })

    const results = []
    for (const it of items) {
      if (!it || !it.result) {
        results.push({ ok: false, id: it && it.id, error: '缺少识别结果' })
        continue
      }
      try {
        const r = await commitOne({
          result: it.result,
          mode: it.mode || 'create',
          userId: req.user && req.user._id,
          storage: it.storage || null,
        })
        results.push({ ok: true, id: it.id, fileName: it.fileName, ...r })
      } catch (err) {
        results.push({ ok: false, id: it.id, fileName: it.fileName, error: err.message })
      }
    }
    const skipped = results.filter((r) => r.status === 'skipped').length
    const failed = results.filter((r) => !r.ok).length
    return res.json({
      success: true,
      summary: { total: results.length, imported: results.length - skipped - failed, skipped, failed },
      results,
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
