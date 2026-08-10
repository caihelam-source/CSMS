/**
 * timetableEngine.js — 港股业绩公告全周期排期引擎（前端 ESM 端口）
 *
 * 端口自后端 `server/services/timetableEngine.js`（同一套规则库逻辑，后端持有真源）。
 * 本文件仅供前端 mock / demo 预览使用；真实生成请切换 VITE_USE_MOCK=false 走后端引擎。
 *
 * 日期算法与后端、参考生成器 `业绩排期生成器.html` 完全一致：
 *   **纯日历日 addDays，不跳过周末、不使用 WORKDAY 语义。**
 *
 * generate() 返回 { period, anchors, offsets: offsetMap._list, items, compliance }
 *   items[i]      : { index, category, rule, title, steps, priority, status, project, owner, agency, startDate, endDate, file, note }
 *   offsets._list : { id, name, anchor, days, date }（date 为 'YYYY-MM-DD' 或 null）
 *   compliance    : { id, label, passed, detail }
 *
 * 用法：
 *   import { generate } from './timetableEngine.js';
 *   const { period, anchors, offsets, items, compliance } =
 *     generate('interim', { T0: '2025-12-31', T1: '2026-08-10', T2: '2026-09-22' });
 */

import RULES from './timetableData.js';

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

/** period → 规则库内部命名（rules.js 用 midyear / annual）。 */
function periodKey(period) {
  return period === 'annual' ? 'annual' : 'midyear';
}

/** 取该期间的偏移量定义数组。 */
function offsetDefs(period) {
  return periodKey(period) === 'annual' ? RULES.offsets_annual : RULES.offsets_midyear;
}

/** 取该期间的任务定义数组。 */
function taskDefs(period) {
  return periodKey(period) === 'annual' ? RULES.tasks_annual : RULES.tasks_midyear;
}

/** 该期间偏移量 id 前缀（用于把 rules.js 的 MY_/AN_ 前缀 id 归一化为语义键）。 */
function idPrefix(period) {
  return periodKey(period) === 'annual' ? 'AN_' : 'MY_';
}

/** 规则查询：rules[code] → { source, text, interpretation }，缺失时安全兜底。 */
function getRule(code) {
  if (!code) return { source: '', text: '', interpretation: '' };
  const r = RULES.rules[code];
  if (!r) return { source: code, text: '', interpretation: '' };
  return { source: r.source || code, text: r.text || '', interpretation: r.interpretation || '' };
}

/** 参与方显示名。 */
function partyLabel(key) {
  return (RULES.parties[key] || {}).label || key || '';
}

/** 参与方实际机构名：优先用规则库 party_assignments 指派，否则回退角色标签。 */
function partyFirm(key) {
  if (!key) return '';
  const assigned = RULES.party_assignments && RULES.party_assignments[key];
  return assigned || partyLabel(key);
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
 * @returns {object} { [offsetId]: Date, _list: [{ ...offsetDef, date }] }
 *          另附 _byKey：去掉 MY_/AN_ 前缀的语义键 → Date（便于合规检查与主要事项表引用）。
 */
function computeOffsets(period, anchors) {
  const defs = offsetDefs(period);
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
    // 对外暴露的偏移量项：仅保留页面所需字段 { id, name, anchor, days, date }
    // date 为计算后的 'YYYY-MM-DD' 字符串，无锚点时置 null。
    list.push({
      id: off.id,
      name: off.name,
      anchor: off.anchor,
      days: off.days,
      date: date ? fmt(date) : null,
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
function resolveTaskRuleCode(task, period) {
  if (task.rule) return task.rule;
  const defs = offsetDefs(period);
  const oid = task.type === 'range'
    ? (task.start_offset_id || task.end_offset_id)
    : task.offset_id;
  if (!oid) return '';
  const off = defs.find((o) => o.id === oid);
  return off ? (off.rule_code || off.rule || '') : '';
}

/**
 * 计算任务起止日期（point / range），复刻参考生成器 computeTasks。
 * @returns {Array} [{ ...taskDef, startDate:Date|null, endDate:Date|null, ruleCode }]
 */
function computeTasks(period, anchors, offsets) {
  const defs = taskDefs(period);
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
      ruleCode: resolveTaskRuleCode(task, period),
      startDate,
      endDate,
    };
  });
}

/**
 * 由（可能被用户就地编辑过的）items 反建「偏移量 → 日期」索引。
 *
 * items 上的 offsetId / startOffsetId / endOffsetId 由 generate() 写入（见下），
 * 同时索引带前缀 id（MY_blackout）与去前缀语义键（blackout），
 * 以便与 computeOffsets 产出的 `_byKey` 短键口径对齐。
 *
 * @param {Array} items generate() 产出的任务行（日期为 'YYYY-MM-DD' 字符串）
 * @returns {object} { [offsetKey]: { start, end } }
 */
function buildDateByOffset(items) {
  const m = {};
  const set = (k, start, end) => {
    if (!k) return;
    m[k] = { start, end };
    const s = k.replace(/^(MY|AN)_/, '');
    if (s !== k) m[s] = { start, end };
  };
  (items || []).forEach((it) => {
    if (it.offsetId) set(it.offsetId, it.startDate, it.endDate);
    if (it.startOffsetId) set(it.startOffsetId, it.startDate, null);
    if (it.endOffsetId) set(it.endOffsetId, null, it.endDate);
  });
  return m;
}

/**
 * 合规自检，复刻参考生成器 renderPreview 中 ck1..ck7 的判定逻辑与阈值。
 *
 * 注意：`rules.js` 并不包含 `compliance_checks` 字段（参考 HTML 引用
 * `RULEBOOK.compliance_checks.midyear` 实为空引用），故检查项标题在此处定义，
 * 阈值与判定式严格照抄 HTML 第 577–592 行。
 *
 * @param {Array} [items] 可选：（被用户就地编辑后的）任务行。传入时，
 *        依赖具体任务日期的检查项（禁售期 / 审阅报告 / 正文定稿）改按编辑后的日期判定；
 *        未传或该项无对应任务时，回落到按锚点+偏移量推算的日期。
 * @returns {Array} [{ id, label, passed, detail }]
 */
function complianceChecks(period, anchors, offsets, items) {
  const isAnnual = periodKey(period) === 'annual';
  const byKey = offsets._byKey || {};
  const edited = items ? buildDateByOffset(items) : {};
  // 锚点与偏移量日期可能是 Date（引擎内部调用）或 'YYYY-MM-DD'（页面实时重算时），统一归一化为 Date。
  const pick = (...cands) => {
    for (const c of cands) {
      const d = parseDate(c);
      if (d) return d;
    }
    return null;
  };
  const a = anchors || {};
  const T0 = pick(a.T0);
  const T1 = pick(a.T1);
  const T2 = pick(a.T2);
  const T3 = pick(a.T3);
  const T4 = pick(a.T4);
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

    const bd = pick(edited.blackout && edited.blackout.start, byKey.blackout);
    const bdGap = bd && T1 ? Math.abs(diffDays(bd, T1)) : null;
    push('ck4', '董事禁售期须于业绩公告日前至少 30 天开始（附录十 A.3）',
      bdGap != null && bdGap >= 30,
      bdGap != null ? `禁售期距 T1 ${bdGap} 天 ≥ 30 天（起 ${fmt(bd)}）` : '禁售期未计算（缺 T1）');

    const rd = pick(edited.review_report && edited.review_report.end, byKey.review_report);
    push('ck5', '审阅报告须于业绩公告日（T1）前完成',
      !!(rd && T1 && rd <= T1),
      rd && T1 ? `审阅报告 ${fmt(rd)} ≤ T1 ${fmt(T1)}` : '缺审阅报告日或 T1');

    const fd = pick(edited.report_final && edited.report_final.start, byKey.report_final);
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

    const bd = pick(edited.blackout && edited.blackout.start, byKey.blackout);
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
 * @returns {{ period, anchors, offsets, items, compliance }}
 */
function generate(period, overrides = {}) {
  const p = period === 'annual' ? 'annual' : 'interim';
  const anchors = normalizeAnchors(p, overrides);
  const offsets = computeOffsets(p, anchors);
  const tasks = computeTasks(p, anchors, offsets);

  const items = tasks.map((t, i) => {
    const partyKeys = (Array.isArray(t.parties) && t.parties.length) ? t.parties : (t.party ? [t.party] : []);
    const firms = partyKeys.map((k) => partyFirm(k));
    const ownerKey = t.owner || t.party || (partyKeys[0] || '');
    const ownerVal = partyFirm(ownerKey) || firms[0] || '';
    const resolvedRule = getRule(t.ruleCode).source || t.ruleCode || '';
    return {
      index: i + 1,
      category: t.category || '',
      rule: resolvedRule,
      title: t.name || '',
      steps: (t.details || []).join('\n'),
      priority: t.priority || '中优',
      status: '未启动',
      project: t.project || '',
      owner: ownerVal,
      agency: firms.join('、'),
      parties: firms,
      startDate: fmt(t.startDate),
      endDate: fmt(t.endDate),
      // 携带偏移量绑定，使合规检查能按编辑后的任务日期重算
      offsetId: t.type === 'range' ? undefined : (t.offset_id || undefined),
      startOffsetId: t.type === 'range' ? (t.start_offset_id || undefined) : undefined,
      endOffsetId: t.type === 'range' ? (t.end_offset_id || undefined) : undefined,
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

export {
  generate,
  computeOffsets,
  computeTasks,
  complianceChecks,
  parseDate,
  fmt,
  addDays,
};
