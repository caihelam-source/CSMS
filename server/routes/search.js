const express = require('express')
const router = express.Router()
const Company = require('../models/Company')
const Personnel = require('../models/Personnel')
const Document = require('../models/Document')
const Meeting = require('../models/Meeting')
const Task = require('../models/Task')
const ComplianceReminder = require('../models/ComplianceReminder')
const { auth } = require('../middleware/auth')

// 跨实体结构化全局搜索：公司 / 人员 / 文件 / 会议 / 任务 / 合规提醒。
// 归一成 { type, id, title, subtitle, link, score } 形状，前端按 type 分组展示并跳转。
//
// 搜索增强（中文稳健）：采用"正则子串匹配 + 相关度打分排序"为主路径。
// 不再优先 MongoDB $text —— $text 依赖词边界分词，对中文（CJK 无空格）分词极弱，
// 反而会在生产环境（索引已建）漏掉本该命中的中文结果。正则子串对中文/拉丁都友好，
// 配合打分（exact>prefix>boundary>substring）给出合理的相关度排序，且不挑语言。
const ENTITIES = [
  {
    type: 'company',
    model: Company,
    fields: ['name', 'nameChinese', 'stockCode', 'registrationNumber'],
    map: (d) => ({
      type: 'company',
      id: String(d._id),
      title: d.name || d.nameChinese || '(unnamed)',
      subtitle: [d.registrationNumber, d.type].filter(Boolean).join(' · '),
      link: `/companies/${d._id}`,
    }),
  },
  {
    type: 'personnel',
    model: Personnel,
    fields: ['name', 'nameChinese', 'idNumber', 'email', 'nric'],
    map: (d) => ({
      type: 'personnel',
      id: String(d._id),
      title: d.name || d.nameChinese || '(unnamed)',
      subtitle: [d.email, d.nationality].filter(Boolean).join(' · '),
      link: `/personnel/${d._id}`,
    }),
  },
  {
    type: 'document',
    model: Document,
    fields: ['title', 'docNumber', 'description', 'tags', 'keywords'],
    map: (d) => ({
      type: 'document',
      id: String(d._id),
      title: d.title || '(untitled)',
      subtitle: [d.docNumber, d.type].filter(Boolean).join(' · '),
      link: '/documents',
    }),
  },
  {
    type: 'meeting',
    model: Meeting,
    fields: ['title', 'location'],
    map: (d) => ({
      type: 'meeting',
      id: String(d._id),
      title: d.title || '(untitled)',
      subtitle: [d.type, d.location].filter(Boolean).join(' · '),
      link: `/meetings/${d._id}`,
    }),
  },
  {
    type: 'task',
    model: Task,
    fields: ['title', 'description'],
    map: (d) => ({
      type: 'task',
      id: String(d._id),
      title: d.title || '(untitled)',
      subtitle: [d.status, d.priority].filter(Boolean).join(' · '),
      link: `/tasks/${d._id}`,
    }),
  },
  {
    type: 'reminder',
    model: ComplianceReminder,
    fields: ['title', 'ruleId', 'category'],
    map: (d) => ({
      type: 'reminder',
      id: String(d._id),
      title: d.title || '(untitled)',
      subtitle: [d.ruleId, d.category, d.status].filter(Boolean).join(' · '),
      link: `/compliance-reminders/${d._id}`,
    }),
  },
]

// 转义正则特殊字符，避免用户输入破坏查询
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 单条文档对查询词的相关度打分：
//   exact(整串相等)=100 > prefix(前缀)=60 > boundary(词/边界匹配)=35 > substring(子串)=15
// 字段可能是字符串或数组（tags/keywords），统一按多值处理。
function scoreDoc(doc, fields, qLower) {
  let best = 0
  for (const f of fields) {
    let vals = doc[f]
    if (vals == null) continue
    if (!Array.isArray(vals)) vals = [vals]
    for (let raw of vals) {
      if (raw == null) continue
      const v = String(raw).toLowerCase()
      if (v === qLower) { best = Math.max(best, 100); continue }
      if (v.startsWith(qLower)) { best = Math.max(best, 60); continue }
      const idx = v.indexOf(qLower)
      if (idx >= 0) {
        const before = idx === 0 ? '' : v[idx - 1]
        const after = idx + qLower.length >= v.length ? '' : v[idx + qLower.length]
        // 拉丁文前后非字母数字、或中文相邻（CJK 不在 a-z0-9 范围）均视为边界匹配
        const boundary = before === '' || after === '' || /[^a-z0-9]/i.test(before) || /[^a-z0-9]/i.test(after)
        best = Math.max(best, boundary ? 35 : 15)
      }
    }
  }
  return best
}

// GET /api/search?q=keyword[&limit=8]
router.get('/', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim()
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 50)

    if (!q) {
      return res.json({ data: { data: { results: [], counts: {}, query: '' } } })
    }

    const qLower = q.toLowerCase()
    const regex = new RegExp(escapeRegex(q), 'i')
    // 多取一些再做打分截断，保证高相关度结果不被 limit 过早截断
    const fetchLimit = Math.min(limit * 4, 60)

    const perEntity = await Promise.all(ENTITIES.map(async (e) => {
      const or = e.fields.map((f) => ({ [f]: regex }))
      const docs = await e.model.find({ $or: or }).lean().limit(fetchLimit).lean()
      const scored = docs
        .map((d) => ({ doc: d, score: scoreDoc(d, e.fields, qLower) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => ({ ...e.map(s.doc), score: s.score }))
      return { type: e.type, items: scored }
    }))

    const results = []
    const counts = {}
    perEntity.forEach((p) => {
      counts[p.type] = p.items.length
      p.items.forEach((it) => results.push(it))
    })

    res.json({ data: { data: { results, counts, query: q } } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
