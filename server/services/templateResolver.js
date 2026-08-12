/**
 * 模板预填解析服务（R-P1-1）。
 *
 * 职责：按 `template.variables[].source / fieldPath` 从 Company / Director / Meeting / system
 * 解析预填值。
 * **只返回值，不渲染任何 HTML**（Q2：渲染在前端）。
 *
 * 本期新增 director / meeting 来源支持：
 *   - source='director' → resolveDirectorValue(resolveDirectors(...), fieldPath)
 *   - source='meeting'  → resolveMeetingValue(meeting, fieldPath)
 *
 * ⚠️ 安全：路径取值走白名单式逐段读取，显式拒绝 __proto__ / constructor / prototype，
 *    杜绝原型污染；全程无 eval / new Function。
 */

const Company = require('../models/Company');
const { DIRECTOR_FIELD_PATHS, MEETING_FIELD_PATHS } = require('./templateResolverPaths');

/** 原型污染保护 */
const FORBIDDEN_SEGMENTS = ['__proto__', 'constructor', 'prototype'];

/**
 * 把 Date / 字符串统一格式化为 `YYYY-MM-DD`（与前端 `<input type="date">` 语义一致）。
 * @param {unknown} value 原始值
 * @returns {string} `YYYY-MM-DD` 字符串，无法解析时返回 ''
 */
function toDateString(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 把地址子文档拼接为单行地址串。
 * @param {Object|null|undefined} addr 地址对象
 * @returns {string} 拼接后的地址，空对象返回 ''
 */
function formatAddress(addr) {
  if (!addr || typeof addr !== 'object') return '';
  // 与 resolver 内其它字段（董事名、议程等）统一使用中文枚举分隔符「、」，
  // 保证同一模板内地址、董事名单、议程等拼接风格一致。
  return [addr.street, addr.city, addr.state, addr.postalCode, addr.country]
    .filter((s) => typeof s === 'string' && s.trim())
    .join('、');
}

/**
 * 安全的点路径取值（白名单逐段读取，防原型污染）。
 * @param {Object|null|undefined} obj 源对象
 * @param {string} path 点路径，如 `registeredAddress.city`
 * @returns {unknown} 取到的值，路径不存在返回 undefined
 */
function getByPath(obj, path) {
  if (!obj || typeof obj !== 'object' || typeof path !== 'string' || !path) return undefined;
  const segments = path.split('.').filter(Boolean);
  let cursor = obj;
  for (const seg of segments) {
    if (FORBIDDEN_SEGMENTS.includes(seg)) return undefined;
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(cursor, seg)) return undefined;
    cursor = cursor[seg];
  }
  return cursor;
}

/**
 * 把任意取值标准化为可直接写进表单的字符串。
 * @param {unknown} value 原始值
 * @returns {string} 标准化字符串
 */
function stringifyValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return toDateString(value);
  if (Array.isArray(value)) return value.filter((v) => v !== null && v !== undefined).join('、');
  if (typeof value === 'object') return formatAddress(value);
  return String(value);
}

/**
 * 解析 `source: 'company'` 的变量值。
 * @param {Object|null} company 公司文档（lean 对象）
 * @param {string} fieldPath 字段路径（允许历史写法 `company.name`）
 * @returns {string} 解析结果，无法解析返回 ''
 */
function resolveCompanyValue(company, fieldPath) {
  if (!company) return '';
  // 兼容历史数据里的 'company.name' 写法
  const path = fieldPath.startsWith('company.') ? fieldPath.slice('company.'.length) : fieldPath;
  if (!path) return '';

  if (path === 'registeredAddress' || path === 'businessAddress') {
    return formatAddress(company[path]);
  }
  if (path === 'financialYearEnd') {
    const fye = company.financialYearEnd;
    if (!fye || (!fye.day && !fye.month)) return '';
    return `${fye.month || ''}月${fye.day || ''}日`;
  }
  return stringifyValue(getByPath(company, path));
}

/**
 * 解析 `source: 'system'` 的变量值。
 * @param {string} fieldPath 系统字段名
 * @param {Object|null} company 公司文档（fiscalYearEnd 需要）
 * @param {Date} now 基准时间（便于单测注入）
 * @returns {string} 解析结果，未知字段返回 ''
 */
function resolveSystemValue(fieldPath, company, now) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');

  switch (fieldPath) {
    case '':
    case 'today':
      return `${y}-${m}-${d}`;
    case 'todayCompact':
      return `${y}${m}${d}`;
    case 'year':
    case 'fiscalYear':
      return String(y);
    case 'lastYear':
      return String(y - 1);
    case 'month':
      return m;
    case 'day':
      return d;
    case 'fiscalYearEnd': {
      const fye = company && company.financialYearEnd;
      if (!fye || !fye.month) return '';
      const fm = String(fye.month).padStart(2, '0');
      const fd = String(fye.day || 1).padStart(2, '0');
      return `${y}-${fm}-${fd}`;
    }
    default:
      return '';
  }
}

/**
 * 解析董事列表（来源：directorIds 显式指定，或按公司 links 聚合）。
 *
 * @param {{companyId?:string, directorIds?:string[]}} options 解析选项
 * @returns {Promise<Object[]>} Personnel 文档（lean）数组，无数据返回 []
 */
async function resolveDirectors(options = {}) {
  const { companyId, directorIds } = options;
  const Personnel = require('../models/Personnel');

  // 优先：显式指定的一组董事 ID
  if (Array.isArray(directorIds) && directorIds.length > 0) {
    const ids = directorIds.map((id) => String(id));
    const docs = await Personnel.find({ _id: { $in: ids } }).lean();
    return docs || [];
  }

  // 兜底：按公司 links 聚合出 directors
  if (!companyId) return [];
  const company = await Company.findById(companyId).lean();
  if (!company || !Array.isArray(company.links)) return [];

  const directorLinkIds = company.links
    .filter(
      (l) => l && l.linkModel === 'Personnel' && Array.isArray(l.roles) && l.roles.includes('director')
    )
    .map((l) => l.link)
    .filter(Boolean)
    .map((id) => String(id));

  if (directorLinkIds.length === 0) return [];
  const docs = await Personnel.find({ _id: { $in: directorLinkIds } }).lean();
  return docs || [];
}

/**
 * 解析 `source: 'director'` 的变量值（fieldPath 白名单见 templateResolverPaths）。
 * @param {Object[]} directors Personnel 文档数组
 * @param {string} fieldPath 字段路径（director.name / director.count / boardList ...）
 * @returns {string} 解析结果，无数据返回 ''
 */
function resolveDirectorValue(directors, fieldPath) {
  if (!Array.isArray(directors) || directors.length === 0) return '';
  if (!DIRECTOR_FIELD_PATHS[fieldPath]) return '';

  switch (fieldPath) {
    case 'director.count':
      return String(directors.length);
    case 'director.name':
      return directors.map((d) => (d && d.name) || '').filter(Boolean).join('、');
    case 'director.chineseName':
      return directors
        .map((d) => (d && (d.nameChinese || d.name)) || '')
        .filter(Boolean)
        .join('、');
    case 'director.nric':
      return directors.map((d) => (d && d.nric) || '').filter(Boolean).join('、');
    case 'director.role':
      return directors
        .map((d) => (d && Array.isArray(d.roles) ? d.roles.join('/') : ''))
        .filter(Boolean)
        .join('、');
    case 'boardList':
      return directors
        .map((d) => {
          const name = d && d.name ? d.name : '';
          const role =
            d && Array.isArray(d.roles) && d.roles.length ? `（${d.roles.join('/')}）` : '';
          return name ? `${name}${role}` : '';
        })
        .filter(Boolean)
        .join('、');
    default:
      return '';
  }
}

/**
 * 解析 `source: 'meeting'` 的变量值（fieldPath 白名单见 templateResolverPaths）。
 * @param {Object|null} meeting Meeting 文档（lean）
 * @param {string} fieldPath 字段路径（meeting.date / meeting.title / meeting.agenda ...）
 * @returns {string} 解析结果，无数据返回 ''
 */
function resolveMeetingValue(meeting, fieldPath) {
  if (!meeting || !MEETING_FIELD_PATHS[fieldPath]) return '';

  switch (fieldPath) {
    case 'meeting.date':
    case 'meeting.scheduledAt':
      return toDateString(meeting.scheduledAt);
    case 'meeting.title':
      return typeof meeting.title === 'string' ? meeting.title : '';
    case 'meeting.agenda':
      if (!Array.isArray(meeting.agenda)) return '';
      return meeting.agenda
        .map((a) => (a && typeof a.item === 'string' ? a.item : ''))
        .filter(Boolean)
        .join('、');
    default:
      return '';
  }
}

/**
 * 按模板变量表解析预填值。
 *
 * @param {Object} template DocumentTemplate 文档（需含 `variables[]`）
 * @param {Object} [options] 解析选项
 * @param {string} [options.companyId] 公司 ID，可空（空则仅解析 system 变量）
 * @param {string[]} [options.directorIds] 显式指定的董事 ID 列表
 * @param {string} [options.meetingId] 会议 ID
 * @param {Date} [options.now] 基准时间，默认 `new Date()`
 * @returns {Promise<{values: Object<string,string>, autoFilled: string[]}>} 预填值与命中的字段 key
 */
async function resolveValues(template, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const companyId = options.companyId || null;
  const directorIds = Array.isArray(options.directorIds) ? options.directorIds : [];
  const meetingId = options.meetingId || null;

  const variables = template && Array.isArray(template.variables) ? template.variables : [];

  /** @type {Object<string,string>} */
  const values = {};
  /** @type {string[]} */
  const autoFilled = [];

  let company = null;
  if (companyId) {
    company = await Company.findById(companyId).lean();
  }

  const directors = await resolveDirectors({ companyId, directorIds });

  let meeting = null;
  if (meetingId) {
    const Meeting = require('../models/Meeting');
    meeting = await Meeting.findById(meetingId).lean();
  }

  for (const variable of variables) {
    if (!variable || typeof variable.key !== 'string' || !variable.key) continue;
    const fieldPath = typeof variable.fieldPath === 'string' ? variable.fieldPath : '';

    let value = '';
    if (variable.source === 'company') {
      value = resolveCompanyValue(company, fieldPath);
    } else if (variable.source === 'system') {
      value = resolveSystemValue(fieldPath, company, now);
    } else if (variable.source === 'director') {
      value = resolveDirectorValue(directors, fieldPath);
    } else if (variable.source === 'meeting') {
      value = resolveMeetingValue(meeting, fieldPath);
    } else {
      // manual：本期不做自动解析（Q5 签名块为自由文本）
      continue;
    }

    // director / meeting 代表用户显式选定的实体：即使解析结果为空也透传 ''，
    // 便于前端区分「已参与本次解析但无数据」与「未参与解析（字段不出现）」。
    // company / system / manual 维持「空值不写入 values」的既有约定。
    if (value !== '' || variable.source === 'director' || variable.source === 'meeting') {
      values[variable.key] = value;
    }
    if (value !== '') {
      autoFilled.push(variable.key);
    }
  }

  return { values, autoFilled };
}

module.exports = {
  resolveValues,
  resolveDirectors,
  resolveDirectorValue,
  resolveMeetingValue,
  resolveCompanyValue,
  resolveSystemValue,
  getByPath,
  toDateString,
  formatAddress,
};
