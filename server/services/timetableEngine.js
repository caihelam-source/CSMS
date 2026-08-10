/**
 * timetableEngine.js — 港股业绩公告全周期排期引擎（Node 版）
 *
 * 权威来源：`业绩排期生成器_完整包/rules.js` → 转换为 `./timetableData.js`。
 * 自「规则库后端化 rev2」起，`timetableData.js` 退化为 **种子 / 兜底（SEED）**，
 * 运行时规则库由 MongoDB 的 `RuleLibrary` 单例文档提供，通过 `library` 参数注入。
 *
 * 日期算法与参考生成器 `业绩排期生成器.html` 完全一致：
 *   **纯日历日 addDays，不跳过周末、不使用 WORKDAY 语义。**
 *
 * 用法：
 *   const { generate } = require('./timetableEngine');
 *   // 用种子（不传 library）
 *   generate('interim', { T0: '2025-12-31', T1: '2026-08-10', T2: '2026-09-22' });
 *   // 用数据库规则库
 *   generate('interim', anchors, libraryFromMongo);
 *
 * items[i] 字段与 models/ResultsTimetable.js 的 itemSchema 严格对齐：
 *   { index, category, rule, title, steps, priority, status,
 *     project, owner, agency, startDate, endDate, file, note }
 */

/** 种子规则库（SEED）：数据库为空或库非法时的兜底。 */
const RULES = require('./timetableData');

/** 中期只使用 T0/T1/T2；年度使用 T0..T4（T4 仅参与合规校验与主要事项表）。 */
const ANCHOR_KEYS = ['T0', 'T1', 'T2', 'T3', 'T4'];
const INTERIM_ANCHORS = ['T0', 'T1', 'T2'];
const ANNUAL_ANCHORS = ['T0', 'T1', 'T2', 'T3', 'T4'];

/** 解析 'YYYY-MM-DD' 为本地零点 Date，避免任何时区漂移。 */
function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return Number.isNaN(s.getTime()) ? null : new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const str = String(s).slice(0, 10);
  const parts = str.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

/** Date → 'YYYY-MM-DD'。 */
function fmt(d) {
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 纯日历日推移（不跳过周末），与参考生成器 addDays 等价。 */
function addDays(base, n) {
  const b = base instanceof Date ? base : parseDate(base);
  if (!b) return null;
  const d = new Date(b);
  d.setDate(d.getDate() + (Number(n) || 0));
  return d;
}

/** 两个日期相差天数（b - a），任一为空返回 null。 */
function diffDays(a, b) {
  const da = a instanceof Date ? a : parseDate(a);
  const db = b instanceof Date ? b : parseDate(b);
  if (!da || !db) return null;
  return Math.round((db - da) / 86400000);
}

/** 返回种子规则库（只读用途：路由把库为空时的兜底转成 library 形状）。 */
function getSeed() {
  return RULES;
}

/**
 * 规则库形状校验：至少要有 tasks_midyear / tasks_annual 两个数组。
 * @param {any} lib
 * @returns {boolean}
 */
function isLibrary(lib) {
  return !!lib
    && typeof lib === 'object'
    && Array.isArray(lib.tasks_midyear)
    && Array.isArray(lib.tasks_annual);
}

/**
 * 规则库解析：合法则用传入库，否则回落 SEED。
 * 所有内部取数函数都先经过它，保证 library 缺省 / 非法时行为与旧版一致。
 * @param {object} [lib]
 * @returns {object} 可用的规则库对象
 */
function resolveLibrary(lib) {
  return isLibrary(lib) ? lib : RULES;
}

/** period → 规则库内部命名（rules.js 用 midyear / annual）。 */
function periodKey(period) {
  return period === 'annual' ? 'annual' : 'midyear';
}

/** 单条定义是否被 admin 在规则库管理界面禁用。 */
function isEnabled(def) {
  return !(def && def._disabled === true);
}

/** 取该期间的偏移量定义数组（已过滤被禁用项）。 */
function offsetDefs(period, library) {
  const lib = resolveLibrary(library);
  const arr = periodKey(period) === 'annual' ? lib.offsets_annual : lib.offsets_midyear;
  return (Array.isArray(arr) ? arr : []).filter(isEnabled);
}

/** 取该期间的任务定义数组（已过滤被禁用项）。 */
function taskDefs(period, library) {
  const lib = resolveLibrary(library);
  const arr = periodKey(period) === 'annual' ? lib.tasks_annual : lib.tasks_midyear;
  return (Array.isArray(arr) ? arr : []).filter(isEnabled);
}

/** 该期间偏移量 id 前缀（用于把 rules.js 的 MY_/AN_ 前缀 id 归一化为语义键）。 */
function idPrefix(period) {
  return periodKey(period) === 'annual' ? 'AN_' : 'MY_';
}

/** 规则查询：rules[code] → { source, text, interpretation }，缺失时安全兜底。 */
function getRule(code, library) {
  if (!code) return { source: '', text: '', interpretation: '' };
  const lib = resolveLibrary(library);
  const r = (lib.rules || {})[code];
  if (!r) return { source: code, text: '', interpretation: '' };
  return { source: r.source || code, text: r.text || '', interpretation: r.interpretation || '' };
}

/** 参与方显示名。 */
function partyLabel(key, library) {
  const lib = resolveLibrary(library);
  return ((lib.parties || {})[key] || {}).label || key || '';
}

/**
 * 归一化锚点：接受 Date 或 'YYYY-MM-DD'，缺失置 null。
 * 中期强制 T3/T4 = null（参考生成器中期不使用 T3/T4）。
 */
function normalizeAnchors(period, overrides = {}) {
  const allowed = periodKey(period) === 'annual' ? ANNUAL_ANCHORS : INTERIM_ANCHORS;
  const anchors = {};
  ANCHOR_KEYS.forEach((k) => {
    anchors[k] = allowed.includes(k) ? parseDate(overrides[k]) : null;
  });
  return anchors;
}

/**
 * 计算全部偏移量日期。
 * @param {string} period 'interim' | 'annual'
 * @param {object} anchors { T0..T4: Date|null }
 * @param {object} [library] 规则库，缺省用 SEED
 * @returns {object} { [offsetId]: Date, _list: [{ ...offsetDef, date, dateStr, rule }] }
 *          另附 _byKey：去掉 MY_/AN_ 前缀的语义键 → Date（便于合规检查与主要事项表引用）。
 */
function computeOffsets(period, anchors, library) {
  const lib = resolveLibrary(library);
  const defs = offsetDefs(period, lib);
  const prefix = idPrefix(period);
  const map = {};
  const byKey = {};
  const list = [];

  defs.forEach((off) => {
    const anchorDate = anchors[off.anchor] || null;
    const date = anchorDate ? addDays(anchorDate, off.days) : null;
    if (date) {
      map[off.id] = date;
      byKey[off.id.startsWith(prefix) ? off.id.slice(prefix.length) : off.id] = date;
    }
    // rules.js 中偏移量的规则字段名为 rule_code（HTML 里写成 o.rule 是笔误，此处兼容两者）
    const ruleCode = off.rule_code || off.rule || '';
    list.push({
      id: off.id,
      name: off.name,
      anchor: off.anchor,
      days: off.days,
      ruleCode,
      date,
      dateStr: fmt(date),
      // rules.js 的偏移量本身没有 interpretation/interp_override 字段，
      // 实务解读回落到所绑定规则的 interpretation
      interpretation: off.interp_override || off.interpretation || getRule(ruleCode, lib).interpretation,
    });
  });

  Object.defineProperty(map, '_list', { value: list, enumerable: false });
  Object.defineProperty(map, '_byKey', { value: byKey, enumerable: false });
  return map;
}

/**
 * 从任务反查规则代码。
 * rules.js 的 task 对象并没有 `rule` 字段（HTML 里 getRule(t.rule) 因此始终落空），
 * 故按任务绑定的偏移量（offset_id / start_offset_id / end_offset_id）反查 offset.rule_code。
 * 若未来规则库为 task 增加 rule 字段，则优先采用该字段。
 */
function resolveTaskRuleCode(task, period, library) {
  if (task.rule) return task.rule;
  const defs = offsetDefs(period, library);
  const oid = task.type === 'range'
    ? (task.start_offset_id || task.end_offset_id)
    : task.offset_id;
  if (!oid) return '';
  const off = defs.find((o) => o.id === oid);
  return off ? (off.rule_code || off.rule || '') : '';
}

/**
 * 计算任务起止日期（point / range），复刻参考生成器 computeTasks。
 * @param {string} period 'interim' | 'annual'
 * @param {object} anchors { T0..T4: Date|null }
 * @param {object} offsets computeOffsets 的返回值
 * @param {object} [library] 规则库，缺省用 SEED
 * @returns {Array} [{ ...taskDef, startDate:Date|null, endDate:Date|null, ruleCode }]
 */
function computeTasks(period, anchors, offsets, library) {
  const lib = resolveLibrary(library);
  const defs = taskDefs(period, lib);
  return defs.map((task) => {
    let startDate = null;
    let endDate = null;

    if (task.type === 'range') {
      if (task.start_offset_id && offsets[task.start_offset_id]) {
        startDate = offsets[task.start_offset_id];
      } else if (task.start_anchor && anchors[task.start_anchor]) {
        startDate = addDays(anchors[task.start_anchor], task.start_days || 0);
      }
      if (task.end_offset_id && offsets[task.end_offset_id]) {
        endDate = offsets[task.end_offset_id];
      } else if (task.end_anchor && anchors[task.end_anchor]) {
        endDate = addDays(anchors[task.end_anchor], task.end_days || 0);
      }
    } else {
      const d = offsets[task.offset_id] || null;
      startDate = d;
      endDate = d;
    }

    return {
      ...task,
      ruleCode: resolveTaskRuleCode(task, period, lib),
      startDate,
      endDate,
    };
  });
}

/**
 * 合规自检，复刻参考生成器 renderPreview 中 ck1..ck7 的判定逻辑与阈值。
 *
 * 注意：`rules.js` 并不包含 `compliance_checks` 字段（参考 HTML 引用
 * `RULEBOOK.compliance_checks.midyear` 实为空引用），故检查项标题在此处定义，
 * 阈值与判定式严格照抄 HTML 第 577–592 行。
 *
 * @returns {Array} [{ id, label, passed, detail }]
 */
function complianceChecks(period, anchors, offsets) {
  const isAnnual = periodKey(period) === 'annual';
  const byKey = offsets._byKey || {};
  const { T0, T1, T2, T3, T4 } = anchors;
  const dT1 = diffDays(T0, T1);
  const dT2 = diffDays(T0, T2);
  const dT3 = diffDays(T0, T3);
  const out = [];
  const push = (id, label, passed, detail) => out.push({ id, label, passed: !!passed, detail: detail || '' });

  if (!isAnnual) {
    push('ck1', '中期业绩公告须于财政期间结束后 60 天内刊发（LR13.49(6)）',
      dT1 != null && dT1 <= 60,
      dT1 != null ? `T0→T1 ${dT1} 天 ≤ 60 天` : '缺 T0 或 T1');

    push('ck2', '中期报告须于财政期间结束后 90 天内寄发（LR13.48(1)）',
      dT2 != null && dT2 <= 90,
      dT2 != null ? `T0→T2 ${dT2} 天 ≤ 90 天` : '缺 T0 或 T2');

    const bd = byKey.blackout || null;
    const bdGap = bd && T1 ? Math.abs(diffDays(bd, T1)) : null;
    push('ck4', '董事禁售期须于业绩公告日前至少 30 天开始（附录十 A.3）',
      bdGap != null && bdGap >= 30,
      bdGap != null ? `禁售期距 T1 ${bdGap} 天 ≥ 30 天（起 ${fmt(bd)}）` : '禁售期未计算（缺 T1）');

    const rd = byKey.review_report || null;
    push('ck5', '审阅报告须于业绩公告日（T1）前完成',
      !!(rd && T1 && rd <= T1),
      rd && T1 ? `审阅报告 ${fmt(rd)} ≤ T1 ${fmt(T1)}` : '缺审阅报告日或 T1');

    const fd = byKey.report_final || null;
    push('ck6', '中期报告正文须于上传日（T2）前定稿付印',
      !!(fd && T2 && fd <= T2),
      fd && T2 ? `正文定稿 ${fmt(fd)} ≤ T2 ${fmt(T2)}` : '缺定稿日或 T2');

    push('ck7', '已设定报告上传日（T2）',
      !!T2,
      T2 ? `T2 = ${fmt(T2)}` : '未设定 T2');
  } else {
    push('ck1', '年度业绩公告须于财政年度结束后 90 天内刊发（LR13.49(1)）',
      dT1 != null && dT1 <= 90,
      dT1 != null ? `T0→T1 ${dT1} 天 ≤ 90 天` : '缺 T0 或 T1');

    push('ck2', '年报须于财政年度结束后 120 天内寄发（LR13.46(2)）',
      dT2 != null && dT2 <= 120,
      dT2 != null ? `T0→T2 ${dT2} 天 ≤ 120 天` : '缺 T0 或 T2');

    push('ck3', '股东周年大会须于财政年度结束后 6 个月（183 天）内召开',
      dT3 != null && dT3 <= 183,
      dT3 != null ? `T0→T3 ${dT3} 天 ≤ 183 天` : '缺 T0 或 T3');

    const notice = diffDays(T4, T3);
    push('ck4', 'AGM 通告须于会议前至少 21 天发出（公司条例 622 第 571 条）',
      notice != null && notice >= 21,
      notice != null ? `T4→T3 ${notice} 天 ≥ 21 天` : '缺 T3 或 T4');

    const bd = byKey.blackout || null;
    const bdGap = bd && T1 ? Math.abs(diffDays(bd, T1)) : null;
    push('ck5', '董事禁售期须于年度业绩公告日前至少 60 天开始（附录十 A.3）',
      bdGap != null && bdGap >= 60,
      bdGap != null ? `禁售期距 T1 ${bdGap} 天 ≥ 60 天（起 ${fmt(bd)}）` : '禁售期未计算（缺 T1）');

    push('ck6', '所有关键日期须避开香港公众假期',
      true,
      '（需结合公众假期计算，人工确认）');
  }

  return out;
}

/**
 * 生成排期。
 * @param {string} period 'interim' | 'annual'
 * @param {object} [overrides] 锚点覆盖 { T0..T4 }，Date 或 'YYYY-MM-DD'
 * @param {object} [library] 规则库（MongoDB RuleLibrary 文档的普通对象形式）；
 *                           缺省或形状非法时回落到 SEED（timetableData.js）
 * @returns {{ period, anchors, offsets, items, compliance }}
 */
function generate(period, overrides = {}, library) {
  const lib = resolveLibrary(library);
  const p = period === 'annual' ? 'annual' : 'interim';
  const anchors = normalizeAnchors(p, overrides);
  const offsets = computeOffsets(p, anchors, lib);
  const tasks = computeTasks(p, anchors, offsets, lib);

  const items = tasks.map((t, i) => {
    const label = partyLabel(t.party, lib);
    return {
      index: i + 1,
      category: t.category || '',
      rule: getRule(t.ruleCode, lib).source || t.ruleCode || '',
      title: t.name || '',
      steps: (t.details || []).join('\n'),
      priority: t.priority || '中优',
      status: '未启动',
      project: t.project || '',
      owner: label,
      agency: label,
      startDate: fmt(t.startDate),
      endDate: fmt(t.endDate),
      file: '',
      note: '',
    };
  });

  return {
    period: p,
    anchors,
    offsets: offsets._list,
    items,
    compliance: complianceChecks(p, anchors, offsets),
  };
}

module.exports = {
  generate,
  computeOffsets,
  computeTasks,
  complianceChecks,
  parseDate,
  fmt,
  addDays,
  diffDays,
  getRule,
  partyLabel,
  offsetDefs,
  taskDefs,
  getSeed,
  isLibrary,
  resolveLibrary,
  RULES,
};
