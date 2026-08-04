/**
 * timetableEngine.js — 港股业绩公告全周期排期引擎（Node 版）
 *
 * 与 skill 版 generate.py 完全同源：偏移量 / 任务定义来自 timetableData.js
 * （由 Python 常量 1:1 转来），日期算法与 Excel WORKDAY 等价（跳过周末）。
 *
 * 用法：
 *   const { generate } = require('./timetableEngine');
 *   const { period, anchors, items } = generate('interim', { T1: '2026-08-20' });
 *   // items[i] = { index, category, rule, title, steps, priority, status,
 *   //              project, owner, agency, startDate, endDate, file, note }
 */

const data = require('./timetableData');

const ANCHOR_KEYS = ['T0', 'T1', 'T2', 'T3', 'T4'];

function parseDate(s) {
  // 解析 'YYYY-MM-DD' 为本地零点 Date，避免任何时区漂移
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** 与 Excel WORKDAY 等价：跳过周六日，推移 n 个营业日（n 可为负）。 */
function workdayAdd(base, n) {
  let d = new Date(base);
  const step = n >= 0 ? 1 : -1;
  let rem = Math.abs(n);
  while (rem > 0) {
    d.setDate(d.getDate() + step);
    const wd = d.getDay(); // 0=Sun .. 6=Sat
    if (wd !== 0 && wd !== 6) rem -= 1;
  }
  return d;
}

/** 解析 key：锚点(T0~T4)直接返回其日期；偏移量 key 返回 锚点+偏移天数。 */
function resolveKey(key, anchors, offsetMap) {
  if (ANCHOR_KEYS.includes(key)) {
    if (!anchors[key]) throw new Error(`缺少锚点 ${key}`);
    return parseDate(anchors[key]);
  }
  const off = offsetMap[key];
  if (!off) throw new Error(`未知偏移量 key: ${key}`);
  return addDays(parseDate(anchors[off.anchor]), off.days);
}

/** 计算一个任务的起/止日期（workday=true 表示用 WORKDAY 语义）。 */
function computeDate(key, workday, delta, anchors, offsetMap) {
  const base = resolveKey(key, anchors, offsetMap);
  const d = workday ? workdayAdd(base, delta) : addDays(base, delta);
  return fmtISO(d);
}

/**
 * 生成排期。
 * @param {string} period 'interim' | 'annual'
 * @param {object} [overrides] 锚点覆盖，如 { T1:'2026-08-20', T2:'2026-09-22' }
 * @returns {{ period, anchors, items }}
 */
function generate(period, overrides = {}) {
  const isInterim = period === 'interim';
  const offsets = isInterim ? data.interimOffsets : data.annualOffsets;
  const tasks = isInterim ? data.interimTasks : data.annualTasks;
  const def = data.defaults[period];

  const anchors = {
    T0: overrides.T0 ?? def.T0,
    T1: overrides.T1 ?? def.T1,
    T2: overrides.T2 ?? def.T2,
    T3: isInterim ? null : overrides.T3 ?? def.T3,
    T4: isInterim ? null : overrides.T4 ?? def.T4,
  };

  const offsetMap = {};
  offsets.forEach((o) => { offsetMap[o.key] = { anchor: o.anchor, days: o.days }; });

  const items = tasks.map((t, i) => ({
    index: i + 1,
    category: t.cat,
    rule: t.rule,
    title: t.title,
    steps: t.steps,
    priority: t.pri,
    status: t.status,
    project: t.proj,
    owner: t.owner,
    agency: t.agency,
    startDate: computeDate(t.sKey, t.sWorkday, t.sDelta, anchors, offsetMap),
    endDate: computeDate(t.eKey, t.eWorkday, t.eDelta, anchors, offsetMap),
    file: t.file,
    note: t.note,
  }));

  return { period, anchors, items };
}

module.exports = { generate, computeDate, resolveKey, workdayAdd, addDays, parseDate };
