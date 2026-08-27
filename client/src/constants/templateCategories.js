/**
 * 模板分类 · 前端镜像（ESM）
 *
 * ⚠️⚠️ 单一事实源是 `shared/templateCategories.json`（仓库根目录）。
 *    Vite 不宜跨 root 引用 JSON，故此处维护一份 ESM 镜像。
 *    **改一边不改另一边 ⇒ `templateCategories.test.js` 会直接红。**
 *    新增 / 删除 / 重命名分类时，必须同时改动：
 *      1. shared/templateCategories.json（后端 enum 与校验的来源）
 *      2. 本文件的 TEMPLATE_CATEGORY_VALUES / TEMPLATE_CATEGORY_LABELS
 */

/** @type {string[]} 13 项分类值域，顺序与 shared JSON 完全一致 */
export const TEMPLATE_CATEGORY_VALUES = [
  'board_resolution',
  'agm_resolution',
  'minutes',
  'director_change',
  'secretary_change',
  'shareholder_notice',
  'annual_report',
  'internal_control',
  'risk_management',
  'ipo_filing',
  'compliance_filing',
  'project_governance',
  'other',
]

/** @type {Record<string,string>} 分类 → 中文 label */
export const TEMPLATE_CATEGORY_LABELS = {
  board_resolution: '董事会决议',
  agm_resolution: '股东大会决议',
  minutes: '会议记录',
  director_change: '董事变更',
  secretary_change: '公司秘书变更',
  shareholder_notice: '股东通知',
  annual_report: '年度报告',
  internal_control: '内部监控',
  risk_management: '风险管理',
  ipo_filing: 'IPO 及申报',
  compliance_filing: '合规申报',
  project_governance: '项目治理',
  other: '其他',
}

/**
 * 分类徽标配色（Tailwind class，含暗色模式）。
 * ⚠️ 仅影响外壳 UI，不影响 `.doc-*` 文书区（文书区恒白底黑字）。
 * @type {Record<string,string>}
 */
export const TEMPLATE_CATEGORY_BADGE = {
  board_resolution: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  agm_resolution: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  minutes: 'bg-subtle text-ink-2 dark:bg-canvas dark:text-ink-2',
  director_change: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  secretary_change: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  shareholder_notice: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  annual_report: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  internal_control: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  risk_management: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  ipo_filing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  compliance_filing: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  project_governance: 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
  other: 'bg-subtle text-ink-2 dark:bg-canvas dark:text-ink-2',
}

/**
 * 供下拉框直接使用的 { value, label } 选项数组。
 * @type {Array<{value: string, label: string}>}
 */
export const TEMPLATE_CATEGORY_OPTIONS = TEMPLATE_CATEGORY_VALUES.map((value) => ({
  value,
  label: TEMPLATE_CATEGORY_LABELS[value],
}))

/**
 * 取分类的中文 label，未知分类回退为原值。
 * @param {string} value 分类值
 * @returns {string} 中文 label
 */
export const categoryLabel = (value) => TEMPLATE_CATEGORY_LABELS[value] || value || '其他'

/**
 * 取分类徽标 class，未知分类回退为 other 的配色。
 * @param {string} value 分类值
 * @returns {string} Tailwind class 串
 */
export const categoryBadge = (value) => TEMPLATE_CATEGORY_BADGE[value] || TEMPLATE_CATEGORY_BADGE.other

/**
 * 判断分类是否合法。
 * @param {unknown} value 待判定值
 * @returns {boolean} 是否在 12 项白名单内
 */
export const isValidCategory = (value) =>
  typeof value === 'string' && TEMPLATE_CATEGORY_VALUES.includes(value)
