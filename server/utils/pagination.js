'use strict'

/**
 * 统一分页工具（B3 — 六列表分页信封）
 *
 * 设计约束（详见 design-p0p1-2026-08-14.md §3.1 / §7 共享约定）：
 *  - 与既有 companies.js / personnel.js 分页契约对齐：保留「资源键数组」，新增
 *    `total` + opt-in `page` / `pageSize`；**不引入 `pages` 字段**。
 *  - 资源键（resourceKey）必须与各路由原返回键一致（tasks / meetings / documents /
 *    reminders / rules / tasks），否则 client/src/utils/responseNormalize.js 的
 *    ENTITY_KEYS 提取失败 → 前端 .filter/.map 白屏。这是 B3 的红线。
 *  - 前端本次全量取数（不传 page/limit）→ usePaging=false → 返回全量，与现状等价；
 *    未来切前端分页取数时，仅需前端传参，后端信封已就绪。
 */

/**
 * 解析分页查询参数，返回统一的 skip/limit/usePaging。
 *
 * @param {object} query  Express req.query（页码/每页大小）
 * @param {object} [opts]
 * @param {number} [opts.defaultLimit=50]  默认每页大小（与 PRD 默认 50 对齐）
 * @param {number} [opts.maxLimit=100]     每页大小上限（与既有 companies/personnel 一致）
 * @returns {{ page: number, limit: number, usePaging: boolean, skip: number }}
 */
function parsePaging(query = {}, { defaultLimit = 50, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(parseInt(query.limit, 10) || defaultLimit, maxLimit)
  const usePaging = !!(query.page || query.limit)
  return { page, limit, usePaging, skip: (page - 1) * limit }
}

/**
 * 生成统一分页信封（纯函数，便于单测）。
 *
 * @param {string} resourceKey  资源键（如 'tasks' / 'documents' / 'reminders' / 'rules'）
 * @param {Array}  items         本次返回的资源数组
 * @param {object} meta
 * @param {boolean} meta.usePaging  是否启用分页（决定是否回显 page/pageSize）
 * @param {number}  meta.page       当前页（仅分页时回显）
 * @param {number}  meta.limit      本页大小（仅分页时回显，字段名 pageSize）
 * @param {number}  meta.total      匹配总数（countDocuments 结果）
 * @returns {object} { success, count, total, [page], [pageSize], [resourceKey]: items }
 */
function pagingEnvelope(resourceKey, items, { usePaging, page, limit, total } = {}) {
  const base = {
    success: true,
    count: Array.isArray(items) ? items.length : 0,
    total: total || 0,
    [resourceKey]: items || [],
  }
  if (usePaging) {
    base.page = page
    base.pageSize = limit
  }
  return base
}

module.exports = { parsePaging, pagingEnvelope }
