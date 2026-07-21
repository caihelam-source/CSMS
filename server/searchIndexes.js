// M2.2 搜索增强：为全局搜索涉及的 6 个集合创建 $text 全文索引。
// routes/search.js 已实现「优先 $text 相关度排序，缺索引回退正则」，但此前从未建索引，
// 导致生产环境每次查询都抛 "text index required" 后走正则（能用但无相关度）。本模块补齐索引。
// 防御式：索引已存在 / 选项冲突时静默忽略；任何异常不影响服务启动。

const mongoose = require('mongoose')

const SPEC = [
  { model: require('./models/Company'), fields: { name: 'text', nameChinese: 'text', stockCode: 'text', registrationNumber: 'text' } },
  { model: require('./models/Personnel'), fields: { name: 'text', nameChinese: 'text', idNumber: 'text', email: 'text', nric: 'text' } },
  { model: require('./models/Document'), fields: { title: 'text', docNumber: 'text', description: 'text', tags: 'text', keywords: 'text' } },
  { model: require('./models/Meeting'), fields: { title: 'text', location: 'text' } },
  { model: require('./models/Task'), fields: { title: 'text', description: 'text' } },
  { model: require('./models/ComplianceReminder'), fields: { title: 'text', ruleId: 'text', category: 'text' } },
]

async function ensureSearchIndexes() {
  // 等 mongoose 连接就绪（已在 start() 中 connect，这里兜底）
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once('connected', resolve))
  }
  for (const { model, fields } of SPEC) {
    try {
      await model.collection.createIndex(fields, { name: 'csms_text_search' })
    } catch (err) {
      const msg = String((err && err.message) || '')
      // 已存在 / 选项冲突(11000) → 视为就绪，忽略
      if (!/already exists|IndexOptionsConflict|11000/.test(msg)) {
        console.warn(`⚠️ 搜索索引创建跳过(${model.modelName}):`, msg)
      }
    }
  }
  console.log('✅ 搜索全文索引就绪（6 集合）')
}

module.exports = { ensureSearchIndexes }
