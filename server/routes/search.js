const express = require('express')
const router = express.Router()
const Company = require('../models/Company')
const Personnel = require('../models/Personnel')
const Document = require('../models/Document')
const Meeting = require('../models/Meeting')
const Task = require('../models/Task')
const ComplianceReminder = require('../models/ComplianceReminder')
const { auth } = require('../middleware/auth')

// 跨实体结构化全局搜索：对 公司 / 人员 / 文件 / 会议 / 任务 / 合规提醒 做关键词正则匹配，
// 归一成 { type, id, title, subtitle, link } 形状，前端按 type 分组展示并跳转。
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

// GET /api/search?q=keyword[&limit=5]
router.get('/', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim()
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20)

    if (!q) {
      return res.json({ data: { data: { results: [], counts: {}, query: '' } } })
    }

    const regex = new RegExp(escapeRegex(q), 'i')
    // 搜索增强 M2.1：优先用 $text 全文索引（相关度排序）；索引未就绪时回退正则匹配
    const queries = ENTITIES.map((e) => {
      const textQuery = e.model.find(
        { $text: { $search: q } },
        { score: { $meta: 'textScore' } },
      ).sort({ score: { $meta: 'textScore' } }).limit(limit).lean().then((docs) => docs.map(e.map))
      return textQuery.catch((err) => {
        const msg = String(err && err.message || '')
        if (msg.includes('text index') || msg.includes('$text') || msg.includes('text search')) {
          const or = e.fields.map((f) => ({ [f]: regex }))
          return e.model.find({ $or: or }).limit(limit).lean().then((docs) => docs.map(e.map))
        }
        throw err
      })
    })

    const settled = await Promise.all(queries)
    const results = settled.flat()
    const counts = {}
    ENTITIES.forEach((e, i) => { counts[e.type] = settled[i].length })

    res.json({ data: { data: { results, counts, query: q } } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
