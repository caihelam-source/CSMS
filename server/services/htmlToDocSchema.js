/**
 * HTML → docSchema 转换器（纯函数，正则/字符串解析，不引入 jsdom）。
 *
 * 用途：迁移脚本把旧 HTML 引擎模板的 `content`（HTML 正文）转换为 schema 引擎的 docSchema。
 *
 * 设计要点（见增量方案 §HTML→docSchema 转换算法）：
 *   - 不引 jsdom；segments 只许 join / var / text / blank 之一。
 *   - 严禁 { text:'', blank:true }（会被 text 分支吞掉、渲染成空白无下划线）；留白用 { blank:true }。
 *   - 字段 key 必匹配 /^[A-Za-z_][A-Za-z0-9_]*$/。
 *   - 产物必过 assertValidDocSchema。
 *
 * 安全红线：禁止 eval / new Function；取值走白名单；字段 key 经 regex 校验与去重。
 */

const { assertValidDocSchema, deriveVariables, SCHEMA_VERSION } = require('../constants/templateSchema');
const { DIRECTOR_FIELD_PATHS, MEETING_FIELD_PATHS } = require('./templateResolverPaths');

/** 变量占位符正则：匹配 {{ some.key }} 形式 */
const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * system 源支持的 fieldPath 白名单（与 templateResolver.resolveSystemValue 的 switch 保持一致）。
 * 注意：这里存**去掉 'system.' 前缀后**的短名。
 */
const SYSTEM_FIELD_PATHS = new Set([
  'today',
  'todayCompact',
  'year',
  'fiscalYear',
  'lastYear',
  'month',
  'day',
  'fiscalYearEnd',
]);

/**
 * 旧模板常见的**无点号**变量名 → 结构化来源的别名表。
 * 只收录语义明确、误判风险极低的名字；含糊的（如 `date`、`name`）一律留给 manual，
 * 让用户自己填，避免把一个本该手填的字段变成永远解析为空的自动字段。
 */
const BARE_KEY_ALIASES = {
  companyname: { source: 'company', fieldPath: 'company.name' },
  company_name: { source: 'company', fieldPath: 'company.name' },
  companycn: { source: 'company', fieldPath: 'company.chineseName' },
  boardlist: { source: 'director', fieldPath: 'boardList' },
  directorname: { source: 'director', fieldPath: 'director.name' },
  director_name: { source: 'director', fieldPath: 'director.name' },
  directorcount: { source: 'director', fieldPath: 'director.count' },
  meetingdate: { source: 'meeting', fieldPath: 'meeting.date' },
  meeting_date: { source: 'meeting', fieldPath: 'meeting.date' },
  meetingtitle: { source: 'meeting', fieldPath: 'meeting.title' },
  today: { source: 'system', fieldPath: 'today' },
  currentdate: { source: 'system', fieldPath: 'today' },
  systemdate: { source: 'system', fieldPath: 'today' },
};

/**
 * 从旧模板的原始变量名推断 docSchema 字段的 { source, fieldPath }。
 *
 * ⭐ 决策 2（董事/会议自动填充保留）的关键：旧 HTML 里的 `{{company.name}}` /
 * `{{director.name}}` / `{{meeting.date}}` 必须迁移成带 source+fieldPath 的字段，
 * 否则 deriveVariables 会把它们降级为 manual，`POST /:id/resolve` 不再自动填充，
 * 自动填充能力在迁移过程中静默丢失。
 *
 * 规则：
 *   · `company.*`   → source 'company'，fieldPath 保留原样（resolveCompanyValue 自带前缀兼容）
 *   · `director.*` / `boardList` → 仅命中 DIRECTOR_FIELD_PATHS 白名单才认，否则 manual
 *   · `meeting.*`   → 仅命中 MEETING_FIELD_PATHS 白名单才认，否则 manual
 *   · `system.X`    → 仅命中 SYSTEM_FIELD_PATHS 才认，fieldPath 去掉 'system.' 前缀
 *   · 其余（含 `user.name` 这类未知命名空间）→ manual
 *
 * 未命中白名单时**故意降级为 manual**：宁可让用户手填，也不要产出一个永远解析成
 * 空字符串的"自动"字段。
 *
 * @param {string} rawKey 原始占位符内部名（可能含点号）
 * @returns {{source:string, fieldPath:string}} 推断结果，未知返回 { source:'manual', fieldPath:'' }
 */
function inferFieldSource(rawKey) {
  const MANUAL = { source: 'manual', fieldPath: '' };
  if (typeof rawKey !== 'string' || !rawKey) return MANUAL;
  const key = rawKey.trim();

  if (key.startsWith('company.') && key.length > 'company.'.length) {
    return { source: 'company', fieldPath: key };
  }
  if (key === 'boardList' || key.startsWith('director.')) {
    return DIRECTOR_FIELD_PATHS[key] ? { source: 'director', fieldPath: key } : MANUAL;
  }
  if (key.startsWith('meeting.')) {
    return MEETING_FIELD_PATHS[key] ? { source: 'meeting', fieldPath: key } : MANUAL;
  }
  if (key.startsWith('system.')) {
    const short = key.slice('system.'.length);
    return SYSTEM_FIELD_PATHS.has(short) ? { source: 'system', fieldPath: short } : MANUAL;
  }
  const alias = BARE_KEY_ALIASES[key.toLowerCase()];
  return alias ? { ...alias } : MANUAL;
}

/** 顶层块级标签 */
const _BLOCK_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'ul', 'ol', 'table', 'hr'];

/** 字段 key 命名规则（与 templateSchema.FIELD_KEY_PATTERN 一致） */
const FIELD_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * 清洗 HTML：剥离 script / style / doctype / html / head / body，块级边界加换行。
 * @param {string} html 原始 HTML
 * @returns {string} 清洗后的 HTML 片段
 */
function cleanHtml(html) {
  if (typeof html !== 'string' || !html) return '';
  let s = html;
  s = s.replace(/<!DOCTYPE[^>]*>/gi, ' ');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<\/?(?:html|head|body)[^>]*>/gi, ' ');
  // 块级边界加换行，方便按块扫描
  s = s.replace(/<\/(h[1-6]|p|div|ul|ol|table|li|tr|br|hr)>/gi, '$&\n');
  s = s.replace(/<(h[1-6]|p|div|ul|ol|table|br|hr)[^>]*>/gi, '\n$&');
  s = s.replace(/[ \t]+/g, ' ');
  return s;
}

/**
 * 去除所有标签，得到纯文本。
 * @param {string} s 含标签的字符串
 * @returns {string} 纯文本
 */
function stripTags(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/<[^>]+>/g, '');
}

/**
 * 把原始 {{var}} 名转为合法字段 key（非法字符 → 下划线），并按 registry 去重。
 * 同时把字段登记进 fields 数组，来源经 inferFieldSource 推断（company/director/meeting/system/manual）。
 *
 * ⭐ 同名变量复用：旧模板里同一个 `{{company.name}}` 常在页眉与正文各出现一次。
 *    传入 rawRegistry 时，第二次出现会复用第一次的 key，而不是新建 `company_name_1`
 *    ——否则用户要为同一个语义字段填两遍（自动填充源同样会被拆成两个字段）。
 *    只有「sanitize 后撞名但原始名不同」的情况才追加数字后缀。
 *
 * @param {string} rawKey 原始占位符内部名（可能含点号）
 * @param {Array<{key:string,label:string,source:string,type:string}>} fields 字段累加数组
 * @param {Set<string>} fieldKeys 已用 key 集合
 * @param {Map<string,string>} [rawRegistry] 原始名 → 已分配 key 的映射（用于同名复用，可省略）
 * @returns {string} 合法且唯一的字段 key（空串表示无效）
 */
function sanitizeKey(rawKey, fields, fieldKeys, rawRegistry) {
  if (!rawKey) return '';
  if (rawRegistry && rawRegistry.has(rawKey)) return rawRegistry.get(rawKey);

  let key = rawKey.replace(/[^A-Za-z0-9_]/g, '_');
  if (!key) return '';
  if (!/^[A-Za-z_]/.test(key)) key = `_${key}`;
  if (!FIELD_KEY_RE.test(key)) return '';

  let uniqueKey = key;
  let n = 1;
  while (fieldKeys.has(uniqueKey)) {
    uniqueKey = `${key}_${n}`;
    n += 1;
  }
  fieldKeys.add(uniqueKey);
  if (rawRegistry) rawRegistry.set(rawKey, uniqueKey);

  const { source, fieldPath } = inferFieldSource(rawKey);
  fields.push({ key: uniqueKey, label: uniqueKey, source, type: 'text', fieldPath });
  return uniqueKey;
}

/**
 * 扫描内层文本，顺序生成 segments（text / var）。
 * 文本片段合并相邻 text；变量片段转为 { var: sanitizedKey }。
 *
 * @param {string} inner 块内层（可能含 {{var}}，但已去除块级标签）
 * @param {Array} fields 字段累加数组
 * @param {Set<string>} fieldKeys 已用 key 集合
 * @param {Map<string,string>} [rawRegistry] 原始名 → key 映射（同名变量复用）
 * @returns {Array<{text?:string, var?:string}>} segments；纯空返回 []
 */
function buildSegments(inner, fields, fieldKeys, rawRegistry) {
  if (typeof inner !== 'string' || !inner) return [];

  const segments = [];
  let lastIndex = 0;
  let m;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(inner)) !== null) {
    const textPart = stripTags(inner.slice(lastIndex, m.index)).replace(/\s+/g, ' ').trim();
    if (textPart) {
      const last = segments[segments.length - 1];
      if (last && last.text !== undefined && last.var === undefined && last.blank === undefined) {
        last.text += textPart;
      } else {
        segments.push({ text: textPart });
      }
    }
    const sanitized = sanitizeKey(m[1], fields, fieldKeys, rawRegistry);
    if (sanitized) {
      segments.push({ var: sanitized });
    }
    lastIndex = VAR_RE.lastIndex;
  }
  const tail = stripTags(inner.slice(lastIndex)).replace(/\s+/g, ' ').trim();
  if (tail) {
    const last = segments[segments.length - 1];
    if (last && last.text !== undefined && last.var === undefined && last.blank === undefined) {
      last.text += tail;
    } else {
      segments.push({ text: tail });
    }
  }
  return segments;
}

/**
 * 把 HTML 按顶层块切分，返回 [{tag, inner}]。
 * 通过标签栈处理嵌套（div 套 div、div 套 p 等），hr 为 void 元素单独处理。
 *
 * @param {string} html 清洗后的 HTML
 * @returns {Array<{tag:string, inner:string}>} 顶层块列表
 */
function splitBlocks(html) {
  /** @type {Array<{tag:string, inner:string}>} */
  const blocks = [];
  const tagRe = /<(\/)?(h[1-6]|p|div|ul|ol|table|hr)\b([^>]*)>/gi;
  /** @type {Array<{tag:string, innerStart:number}>} */
  const stack = [];
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const isClose = m[1] === '/';
    const tag = m[2].toLowerCase();
    const tagStart = m.index;
    const tagEnd = tagRe.lastIndex;

    if (tag === 'hr') {
      if (stack.length === 0) blocks.push({ tag: 'hr', inner: '' });
      continue;
    }

    if (isClose) {
      const top = stack[stack.length - 1];
      if (!top || top.tag !== tag) continue; // 不匹配的闭合标签忽略
      stack.pop();
      if (stack.length === 0) {
        blocks.push({ tag: top.tag, inner: html.slice(top.innerStart, tagStart) });
      }
    } else {
      stack.push({ tag, innerStart: tagEnd });
    }
  }
  // 末尾未闭合的顶层块也收集
  while (stack.length > 0) {
    const top = stack.pop();
    if (stack.length === 0) {
      blocks.push({ tag: top.tag, inner: html.slice(top.innerStart) });
    }
  }
  return blocks;
}

/**
 * 提取 ul/ol 中的 li 文本项。
 * @param {string} inner 列表块内层
 * @returns {string[]} li 文本数组（已去除标签、trim）
 */
function extractListItems(inner) {
  const items = [];
  const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(inner)) !== null) {
    const text = stripTags(m[1]).replace(/\s+/g, ' ').trim();
    if (text) items.push(text);
  }
  return items;
}

/**
 * 主入口：把旧 HTML 正文转换为 { docSchema, variables, report }。
 *
 * 步骤：清洗 → splitBlocks → 块映射 → 组装 docSchema → assertValidDocSchema 校验
 *       → deriveVariables → 返回。
 *
 * @param {string} html 旧模板 HTML 正文
 * @returns {{docSchema:Object, variables:Array, report:string[]}} 转换结果
 * @throws {Error} 产物不通过 assertValidDocSchema 时抛出
 */
function convertHtmlToDocSchema(html) {
  const cleaned = cleanHtml(html);

  /** @type {Array<{key:string,label:string,source:string,type:string}>} */
  const fields = [];
  const fieldKeys = new Set();
  /** 原始变量名 → 已分配 key：保证同名变量在整份文档内只登记一个字段 */
  const rawRegistry = new Map();
  /** @type {Array<Object>} */
  const sections = [];
  /** @type {string[]} */
  const report = [];
  let docTitle = '';

  const blocks = splitBlocks(cleaned);

  for (const block of blocks) {
    const { tag, inner } = block;

    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag[1], 10);
      let text = stripTags(inner).replace(/\s+/g, ' ').trim();
      if (!text) continue; // 空标题跳过
      // 含 {{var}} 时，变量替换为 BLANK_MD 占位并登记字段
      text = text.replace(VAR_RE, (_full, raw) => {
        const k = sanitizeKey(raw, fields, fieldKeys, rawRegistry);
        return k ? '＿＿＿＿＿＿' : '';
      });
      if (!docTitle) docTitle = text;
      sections.push({ type: 'heading', level, text });
    } else if (tag === 'p' || tag === 'div') {
      // 按 <br> 拆 chunk，每段非空 → 一段 paragraph
      const chunks = inner.split(/<br\s*\/?>/i);
      for (const chunk of chunks) {
        const segs = buildSegments(chunk, fields, fieldKeys, rawRegistry);
        if (segs.length === 0) continue; // 空块跳过
        sections.push({ type: 'paragraph', segments: segs });
      }
    } else if (tag === 'ul' || tag === 'ol') {
      // ⚠️ 列表项必须走 buildSegments：否则 <li> 里的 {{var}} 会以字面量形式留在正文里，
      //    字段既不登记、也不可填、更不会自动填充（旧实现的静默丢失点）。
      //    ol 用「1. 2. 3.」保留原文书的条款序号，ul 沿用「• 」。
      const items = extractListItems(inner);
      items.forEach((item, i) => {
        const bullet = tag === 'ol' ? `${i + 1}. ` : '• ';
        const segs = buildSegments(item, fields, fieldKeys, rawRegistry);
        if (segs.length === 0) return;
        if (segs[0] && segs[0].text !== undefined && segs[0].var === undefined && segs[0].blank === undefined) {
          segs[0].text = bullet + segs[0].text;
        } else {
          segs.unshift({ text: bullet });
        }
        sections.push({ type: 'paragraph', segments: segs });
      });
    } else if (tag === 'table') {
      const trMatches = inner.match(/<tr\b[^>]*>/gi) || [];
      const nRows = trMatches.length;
      const firstRow = (inner.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i) || [null, ''])[1];
      const nCols = (firstRow.match(/<t[dh]\b[^>]*>/gi) || []).length || 0;
      report.push(`表格（${nRows}行${nCols}列）已降级为占位，请人工补全`);
      sections.push({
        type: 'note',
        text: `⚠️ 原模板含表格(${nRows}行${nCols}列)，已降级为占位，请人工补全。`,
      });
      sections.push({ type: 'paragraph', segments: [{ blank: true }] });
    } else if (tag === 'hr') {
      sections.push({ type: 'divider' });
    }
  }

  const docSchema = {
    schemaVersion: SCHEMA_VERSION,
    layoutMode: 'custom',
    meta: { docTitle },
    fields,
    rules: [],
    layout: { sections },
  };

  // 产物必须通过契约校验
  assertValidDocSchema(docSchema);

  const variables = deriveVariables(docSchema);

  return { docSchema, variables, report };
}

module.exports = {
  convertHtmlToDocSchema,
  cleanHtml,
  splitBlocks,
  buildSegments,
  sanitizeKey,
};
