// 响应归一化（纯函数，可单测）
// 后端成功响应形形色色，统一归一化为前端期望的 { data: { data: X } }：
//   A) 双层 { data: { data: X } }                         —— 直接透传
//   B) 规范 { success, data: X }                          —— X 作 payload（X 为对象时合并 sibling）
//   C) 扁平 { success, companies } / { success, rule }    —— 单实体键作 payload（列表 / 单条）
//   D) 复合型扁平 { success, companies, total, summary }  —— 整包去 envelope-meta 作 payload（防止丢字段）
//
// ⚠️ 历史陷阱：旧实现第 3 条对扁平响应只抽第一个 ENTITY_KEYS 实体键，
// 会丢弃同级的 totalCompanies / summary / allSigned / counts 等，导致组件解构崩溃
// （如合规「数据缺口」diagnose 接口白屏）。现统一约定：仅当「单实体键且无其它数据字段」时
// 才抽该实体；其余一律保留全部 sibling 字段。新增路由请尽量走 B) { success, data } 规范形状。

// envelope 元数据键（不参与 payload）
const ENVELOPE_META = new Set(['success', 'message', 'code', 'status', 'count', 'error', 'errors'])
// 列表型分页元数据（参与 E 规则：列表响应抽数组作 payload，分页 meta 移到 result.paging）
const PAGING_META = new Set(['total', 'page', 'pageSize', 'limit'])
// 复数 → 单数（单/复数对优先取单数主负载，如 template + templates 并存）
const SINGULAR_OF = {
  companies: 'company', documents: 'document', meetings: 'meeting', tasks: 'task',
  reminders: 'reminder', rules: 'rule', templates: 'template', personnelList: 'personnel',
  links: 'link', signTasks: 'signTask',
}
// 主负载实体键（扁平响应单实体提取用）
const ENTITY_KEYS = [
  'personnel', 'company', 'document', 'meeting', 'task', 'reminder', 'rule', 'template', 'signTask',
  'companies', 'documents', 'meetings', 'tasks', 'reminders', 'rules', 'templates', 'personnelList', 'links', 'link',
  // 日历聚合事件列表（GET /api/calendar/events 返回 { success, count, events }）
  'events',
  // 重复检测（GET /api/personnel/duplicates 返回 { success, duplicates, total }）
  'duplicates',
  // 审计日志（GET /api/audit 返回 { success, count, total, logs }）—— 不加则 normalize 走 D 复合型 → payload 是 {total,logs} 对象 → 前端 .map 静默失败
  'logs',
]

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

export const normalize = (body) => {
  // A) 后端已双层嵌套 —— 直接透传
  if (isObj(body) && isObj(body.data) && 'data' in body.data) {
    return { data: body.data }
  }
  // B / C / D) envelope { success, ...fields }
  if (isObj(body) && body.success !== undefined) {
    const dataKeys = Object.keys(body).filter((k) => !ENVELOPE_META.has(k))

    // B) 规范形状 { success, data: X }
    if (dataKeys.includes('data')) {
      const payload = body.data
      const siblings = {}
      for (const k of dataKeys) {
        if (k !== 'data' && isObj(payload)) siblings[k] = body[k]
      }
      const final = Object.keys(siblings).length ? { ...payload, ...siblings } : payload
      return { data: { data: final } }
    }

    const entityKeys = dataKeys.filter((k) => ENTITY_KEYS.includes(k))

    // C) 单实体键且无其它数据字段 —— 直接抽该实体（列表 / 单条，保持旧契约）
    if (entityKeys.length === 1 && dataKeys.length === 1) {
      return { data: { data: body[entityKeys[0]] } }
    }

    // 单 / 复数对（如同时有 template + templates）—— 优先取单数主负载
    if (entityKeys.length === 2) {
      const [a, b] = entityKeys
      const singular = SINGULAR_OF[a] === b ? b : (SINGULAR_OF[b] === a ? a : null)
      if (singular) return { data: { data: body[singular] } }
    }

    // E) 列表型 + 分页 meta：单实体键（值为数组）+ 其余键全是分页元数据
    //    —— 抽实体数组作 payload；分页 meta 放 result.paging（顶层 sibling，不污染 {data:{data}} 契约）
    //    —— 覆盖 pagingEnvelope('tasks' / 'documents' / 'meetings' / 'rules' / 'reminders' / 'tasks'(signTasks) / 'personnel' / 'companies') 等所有列表接口
    //    —— 历史教训：08-31 personnel 列表崩「O.map is not a function」, 后端 {success, count, total, page, pageSize, personnel} 走 D 复合型 → payload 是对象 → 前端 .map 白屏
    if (entityKeys.length === 1) {
      const ek = entityKeys[0]
      if (Array.isArray(body[ek]) && dataKeys.every((k) => k === ek || PAGING_META.has(k))) {
        const paging = {}
        for (const k of dataKeys) if (k !== ek) paging[k] = body[k]
        return { data: { data: body[ek] }, paging }
      }
    }

    // D) 复合型（实体键带 sibling / 多实体 / 无实体多字段）
    //    —— 整包去 envelope-meta 作 payload，保留全部 sibling 字段，杜绝丢字段白屏
    const cleaned = {}
    for (const k of dataKeys) cleaned[k] = body[k]
    return { data: { data: cleaned } }
  }
  // 兜底：整包作为 payload
  return { data: { data: body } }
}

/**
 * 防御性数组提取：保证写入列表状态的值一定是数组。
 *
 * normalize 的兜底可能把整个 body（如 { success, count, rules }）当作 payload。
 * 组件若直接 setState，后续 .filter / .map 会抛
 * "xxx.filter is not a function" 并导致整页白屏。
 * 所有列表型 setState 都应经过本函数。
 *
 * @param {unknown} value 归一化后的 payload
 * @param {...string} keys 可能承载数组的候选键名（如 'rules' / 'tasks'）
 * @returns {Array} 始终返回数组，无法提取时返回空数组
 */
export const toArray = (value, ...keys) => {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key]
    }
  }
  return []
}
