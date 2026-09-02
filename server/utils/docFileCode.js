/**
 * Document 文件 v6.x 编号工具
 *
 * 公司合并时（POST /api/companies/:id/merge options.renumberFiles=true）调用本 util：
 *  - 推断归属码（entityCode）
 *  - 按 typeCode 分组 → createdAt 升序 → 生成 seq
 *  - 输出 Mongo bulkWrite ops（仅改 docNumber 字段，R2 文件本体不动，/view /download 仍按 _id 路由）
 *
 * 格式：`<entityCode>-<year>-<typeCode>-<seq:04d>`
 * 示例：`HKOP-2026-BR-0001.pdf`（隐含 .pdf，按 filename 扩展位推断即可）
 *
 * ⚠️ 历史教训：Document.generateDocNumber 当前把 ownerCode 硬绑到 regNo 末 4 位（截图 BR 35387857 → "7857"），
 *                与公司实体（HKOP / LISTCO）无视觉关联。本 util 升级优先级，让合并后的 docNumber 一眼可读。
 */
'use strict'

// Document schema 同款 DOC_TYPE_CODE — 镜像一份避免跨服务依赖；schema 修改时需双改
const DOC_TYPE_CODE = {
  minutes: 'MIN', resolution: 'RES', board_resolution: 'RES', agreement: 'AGR',
  form: 'FORM', certificate: 'COI', return: 'NAR1', notice: 'NOT', memo: 'MEM',
  annual_report: 'AR', financial_statement: 'FS', id_document: 'ID',
  passport: 'PP', proof_of_address: 'ADDR', incorporation_doc: 'INC', ctc: 'CTC',
  business_registration: 'BR', nar1_return: 'NAR1', nn3_return: 'NN3', other: 'OTH',
}

// v6.x 编号正则：`HKOP-2026-BR-0001[.pdf]`
const V6_FILENAME_RE = /^([A-Z0-9]{2,8})-(\d{4})-([A-Z0-9]{2,5})-(\d{1,5})(?:\.[a-z0-9]+)?$/i

/**
 * 推断归属码 entityCode
 * 优先级：
 *   1) Company.entityCode（如已有 schema 扩展）
 *   2) jurisdiction 推断：HK + 5位 stockCode → LISTCO；HK → HKOP；BVI → BVIC；Cayman → CAYM；SG → SGPC
 *   3) registrationNumber 末 4 位（兜底，与 Document.generateDocNumber 旧逻辑兼容）
 *   4) 'GEN'（最终兜底）
 *
 * @param {object} company lean 对象
 * @returns {string} 4-8 位大写字母数字
 */
function inferEntityCode(company) {
  if (!company) return 'GEN'
  if (company.entityCode) return String(company.entityCode).toUpperCase().replace(/[^A-Z0-9]/g, '')
  const j = company.jurisdiction
  if (j === 'HK') {
    const sc = String(company.stockCode || '').trim()
    if (sc && /^\d{5}$/.test(sc)) return 'LISTCO'
    return 'HKOP'
  }
  if (j === 'BVI') return 'BVIC'
  if (j === 'Cayman') return 'CAYM'
  if (j === 'SG') return 'SGPC'
  const reg = String(company.registrationNumber || '').replace(/\D/g, '')
  return reg.slice(-4).toUpperCase() || 'GEN'
}

/**
 * 推断单文档 typeCode
 * @param {string} type Document.type 字段
 * @returns {string} 2-5 位大写字母
 */
function inferTypeCode(type) {
  return DOC_TYPE_CODE[type] || 'OTH'
}

/**
 * 解析已 v6.x 编号的 filename/docNumber
 * @param {string} name 例: 'HKOP-2026-BR-0001' / 'HKOP-2026-BR-0001.pdf'
 * @returns {null|{ownerCode: string, year: number, typeCode: string, seq: number, ext: string}}
 */
function parseV6Filename(name) {
  if (!name) return null
  const m = String(name).match(V6_FILENAME_RE)
  if (!m) return null
  return {
    ownerCode: m[1].toUpperCase(),
    year: Number(m[2]),
    typeCode: m[3].toUpperCase(),
    seq: Number(m[4]),
    ext: m[0].includes('.') ? m[0].split('.').pop().toLowerCase() : '',
  }
}

/**
 * 单文件新编号生成（供单元测试和外部使用；内部 renumberCompanyDocs 不依赖）
 * @param {object} args
 * @param {object} args.company lean
 * @param {string} args.type Document.type
 * @param {Date|string} [args.createdAt] 源文件创建时间（缺省 now）
 * @param {number} args.seq 从 1 起
 * @returns {string} docNumber，无扩展名
 */
function buildV6DocNumber({ company, type, createdAt, seq }) {
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear()
  return [
    inferEntityCode(company),
    year,
    inferTypeCode(type),
    String(Math.max(1, seq | 0)).padStart(4, '0'),
  ].join('-')
}

/**
 * 计算每篇文档的目标 docNumber（纯函数，供 renumberCompanyDocs / applyDocRenumbers 复用）
 *  - 按 (entityCode, year, typeCode) 分组 —— 每年同类型 seq 重置（v6.x 设计意图：NAR1 每年归零）
 *  - 每组内按 createdAt 升序编号（seq=1,2,3...）
 * @returns {Map<string, string>} _id -> 目标 docNumber
 */
function computeDocNumbers(company, documents) {
  const ownerCode = inferEntityCode(company)
  const byKey = new Map()
  for (const d of documents) {
    const typeCode = inferTypeCode(d.type)
    const year = d.createdAt ? new Date(d.createdAt).getFullYear() : new Date().getFullYear()
    const key = `${ownerCode}|${year}|${typeCode}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(d)
  }
  const final = new Map()
  for (const [key, list] of byKey.entries()) {
    list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    list.forEach((d, i) => {
      const [, year, typeCode] = key.split('|')
      const seq = i + 1
      final.set(String(d._id), `${ownerCode}-${year}-${typeCode}-${String(seq).padStart(4, '0')}`)
    })
  }
  return final
}

/**
 * 批量重编号：返回 Mongo bulkWrite ops（仅改 docNumber；filename / R2 object key 不动）
 *  - 按 (entityCode, year, typeCode) 分组 —— 每年同类型 seq 重置（v6.x 设计意图：NAR1 每年归零）
 *  - 每组内按 createdAt 升序编号（seq=1,2,3...）
 *  - 同 docNumber 不做 no-op，避免无谓写入
 *
 * ⚠️ 直接 bulkWrite 这些 ops 会触发 docNumber 唯一索引的瞬时冲突（同组里被释放的旧号尚未让位）。
 *    需要原子地重排时请用 applyDocRenumbers（两遍写：先临时号 → 再最终号）。
 *
 * @param {object} company lean
 * @param {Array<object>} documents lean 文档列表（必须含 _id, type, createdAt, docNumber）
 * @returns {Array<object>} bulkWrite 数组 — 空表示已全部对齐
 */
function renumberCompanyDocs(company, documents) {
  if (!documents || !documents.length) return []
  const final = computeDocNumbers(company, documents)
  const ops = []
  for (const d of documents) {
    const newNum = final.get(String(d._id))
    if (d.docNumber !== newNum) {
      ops.push({
        updateOne: {
          filter: { _id: d._id },
          update: { $set: { docNumber: newNum } },
        },
      })
    }
  }
  return ops
}

/**
 * 安全地落地重编号（两遍写，规避 docNumber 唯一索引瞬时冲突）
 *  - 第一遍：把该组全部文档临时置为 `__renum_tmp_<i>`（全局唯一，不会与真实编号撞车）
 *  - 第二遍：一次性写入最终 docNumber（此时旧号已全部释放，无瞬时冲突）
 * @param {Model} DocumentModel Mongoose Document model
 * @param {object} company lean
 * @param {Array<object>} documents lean 文档列表（含 _id, type, createdAt, docNumber）
 * @returns {Promise<number>} 处理的文档数
 */
async function applyDocRenumbers(DocumentModel, company, documents) {
  if (!documents || !documents.length) return 0
  const final = computeDocNumbers(company, documents)
  const pass1 = documents.map((d, i) => ({
    updateOne: { filter: { _id: d._id }, update: { $set: { docNumber: `__renum_tmp_${i}` } } },
  }))
  const pass2 = documents.map((d) => ({
    updateOne: { filter: { _id: d._id }, update: { $set: { docNumber: final.get(String(d._id)) } } },
  }))
  await DocumentModel.bulkWrite(pass1)
  await DocumentModel.bulkWrite(pass2)
  return documents.length
}

module.exports = {
  DOC_TYPE_CODE,
  V6_FILENAME_RE,
  inferEntityCode,
  inferTypeCode,
  parseV6Filename,
  buildV6DocNumber,
  renumberCompanyDocs,
  computeDocNumbers,
  applyDocRenumbers,
}
