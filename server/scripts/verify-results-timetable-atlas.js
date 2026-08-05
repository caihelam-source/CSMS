/**
 * verify-results-timetable-atlas.js
 * ───────────────────────────────────────────────────────────────────────
 * ResultsTimetable 真实 Atlas 链路验证脚本（本机运行，沙箱无法直连 mongodb.net）
 *
 * 它复刻 routes/resultsTimetable.js 的「真实 DB 路径」：
 *   1) 用真实 mongoose 模型 + timetableEngine 生成排期
 *   2) 落库 ResultsTimetable（锚点 + 任务项）
 *   3) 回写 Task（deleteMany + insertMany，带 resultsTimetable 引用）
 *   4) 读回：list / getOne，逐项校验字段形状与计数
 *   5) 校验 excel 端点能产出合法 xlsx buffer（不落 Atlas，仅验证依赖与逻辑）
 *   6) 全程使用 __RT_TEST__ 前缀的临时数据，结束自动清理
 *
 * 运行（Vincent 本机，Atlas 可达）：
 *   cd E:/Claw
 *   # 真实连接串见 .workbuddy/memory/SECRETS.md 的 MONGODB_URI（库名 claw_prod）
 *   $env:MONGODB_URI = "mongodb+srv://caihelam_db_user:****@csms-cluster0.83kh9al.mongodb.net/claw_prod?retryWrites=true&w=majority"
 *   node server/scripts/verify-results-timetable-atlas.js
 * 或依赖根 .env 中的 MONGODB_URI（脚本自动 dotenv 加载）。
 *
 * 退出码：0 = 全绿；1 = 有失败项（详细见输出）。
 * ───────────────────────────────────────────────────────────────────────
 */
'use strict'

const path = require('path')
const fs = require('fs')

// 尽量加载 .env（若存在）
try {
  const dotenv = require(path.join(__dirname, '..', '..', 'node_modules', 'dotenv'))
  const envPath = path.join(__dirname, '..', '..', '.env')
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath })
} catch { /* dotenv 可选 */ }

const mongoose = require('mongoose')
const ResultsTimetable = require('../models/ResultsTimetable')
const Task = require('../models/Task')
const Company = require('../models/Company')
const { generate } = require('../services/timetableEngine')
const XLSX = require('xlsx')

const MONGODB_URI = process.env.MONGODB_URI
const TEST_TAG = '__RT_TEST__'

let failures = 0
function check(name, cond, detail) {
  const ok = !!cond
  if (!ok) failures++
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}
function section(t) { console.log(`\n── ${t} ──`) }

async function main() {
  if (!MONGODB_URI) {
    console.error('❌ 未找到 MONGODB_URI。请在本机 export/设置该环境变量（脚本也会尝试加载根 .env）。')
    process.exit(1)
  }

  console.log('⏳ 连接 Atlas…')
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  console.log(`✅ 已连接: ${mongoose.connection.db.databaseName}`)
  console.log('⚠️ 注意：本脚本会在该库创建 __RT_TEST__ 前缀的临时数据，结束（含异常）时自动清理。')

  // 复用路由里的映射（与 routes/resultsTimetable.js 保持一致）
  const PRI_MAP = { '最高优': 'urgent', '高优': 'high', '中优': 'medium', '低优': 'low' }
  const STA_MAP = { '未启动': 'pending', '进行中': 'in_progress', '部分完成': 'in_progress', '已完成': 'completed' }

  const period = 'annual'
  const anchors = { T0: '2026-12-31', T1: '2027-03-26', T2: '2027-04-23', T3: '2027-06-04', T4: '2027-05-14' }
  const createdBy = new mongoose.Types.ObjectId()

  // 在 finally 中清理用的句柄（无论成功失败都删，避免污染生产库）
  let company = null
  let doc = null

  try {
    // 1) 建临时公司
    section('1) 建临时测试公司')
    company = await Company.create({ name: `${TEST_TAG}公司`, code: '9999', status: 'active' })
    check('Company 创建成功', company && company._id, `_id=${company?._id}`)

    // 2) 引擎生成 + 落库（复刻 POST /generate 的 DB 路径）
    section('2) 生成排期并落库 ResultsTimetable')
    const { anchors: calc, items } = generate(period, anchors)
    check('engine 产出 items 非空', Array.isArray(items) && items.length > 0, `count=${items.length}`)
    const sampleFields = ['index', 'category', 'rule', 'title', 'steps', 'priority', 'status', 'project', 'owner', 'agency', 'startDate', 'endDate', 'file', 'note']
    const sampleOk = items[0] && sampleFields.every((f) => f in items[0])
    check('item 字段与前端/模型契约一致', sampleOk, sampleFields.join(','))
    check('startDate 为 YYYY-MM-DD 字符串', typeof items[0].startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(items[0].startDate), items[0].startDate)

    doc = await ResultsTimetable.create({
      company: company._id,
      period,
      fiscalYear: '2026',
      code: '9999',
      name: company.name,
      anchors: { T0: new Date(calc.T0), T1: new Date(calc.T1), T2: new Date(calc.T2), T3: new Date(calc.T3), T4: new Date(calc.T4) },
      items: items.map((it) => ({ ...it, startDate: new Date(it.startDate), endDate: new Date(it.endDate) })),
      createdBy,
    })
    check('ResultsTimetable 落库成功', doc && doc._id, `_id=${doc?._id}`)

    // 3) 回写 Task（复刻 deleteMany + insertMany）
    section('3) 回写 Task（results_timetable 类型）')
    await Task.deleteMany({ company: company._id, timetablePeriod: period, type: 'results_timetable' })
    const taskDocs = items.map((it) => ({
      title: it.title,
      description: it.steps,
      type: 'results_timetable',
      company: company._id,
      priority: PRI_MAP[it.priority] || 'medium',
      status: STA_MAP[it.status] || 'pending',
      dueDate: new Date(it.endDate),
      startDate: new Date(it.startDate),
      responsiblePerson: it.owner,
      ruleReference: it.rule,
      timetablePeriod: period,
      resultsTimetable: doc._id,
      notes: [{ content: `规则依据：${it.rule}\n步骤：${it.steps}\n负责中介：${it.agency}\n文件：${it.file}` }],
      createdBy,
    }))
    const inserted = await Task.insertMany(taskDocs)
    check('Task 回写条数 == items 条数', inserted.length === items.length, `${inserted.length}/${items.length}`)
    const refOk = inserted.every((t) => String(t.resultsTimetable) === String(doc._id))
    check('每条 Task.resultsTimetable 正确引用排期', refOk)
    const priOk = inserted.every((t) => ['urgent', 'high', 'medium', 'low'].includes(t.priority))
    check('优先级映射为合法英文枚举', priOk)
    const staOk = inserted.every((t) => ['pending', 'in_progress', 'completed'].includes(t.status))
    check('状态映射为合法英文枚举', staOk)

    // 4) 读回：list（复刻 GET /list）
    section('4) 读回校验：list / getOne（真实 Atlas 往返）')
    const listDocs = await ResultsTimetable.find({ company: company._id }).populate('company', 'name code').sort('-createdAt').limit(50)
    check('list 返回数组且含本排期', Array.isArray(listDocs) && listDocs.some((d) => String(d._id) === String(doc._id)), `len=${listDocs.length}`)
    const listItem = listDocs[0]
    check('list 项中 items 日期已存为 Date 并可序列化', listItem.items?.[0]?.startDate instanceof Date, String(listItem.items?.[0]?.startDate))

    const got = await ResultsTimetable.findById(doc._id).populate('company', 'name code')
    check('getOne 命中', got && String(got._id) === String(doc._id))
    check('getOne 形状含 period/anchors/items', got && got.period === period && got.anchors && Array.isArray(got.items) && got.items.length === items.length)
    // 模拟前端读取：reopen 后 anchors/items 字段齐全
    const reopen = { id: got._id, period: got.period, anchors: got.anchors, items: got.items, tasksCreated: got.items.length }
    const reitemsOk = reopen.items.every((it) => 'index' in it && 'title' in it && 'startDate' in it && 'priority' in it && 'status' in it)
    check('reopen 后前端可读字段齐全', reitemsOk)

    // 5) excel buffer（复刻 GET /:id/excel，纯 xlsx，不落 Atlas）
    section('5) Excel 导出 buffer（依赖 xlsx + 引擎数据）')
    const wb = XLSX.utils.book_new()
    const taskRows = [['大类', '规则依据', '任务名称', '操作步骤', '优先级', '状态', '项目', '负责人', '中介', '启动', '截止', '文件', '备注']]
    got.items.forEach((it) => {
      taskRows.push([it.category, it.rule, it.title, it.steps, it.priority, it.status, it.project, it.owner, it.agency, String(it.startDate).slice(0, 10), String(it.endDate).slice(0, 10), it.file, it.note])
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(taskRows), '任务信息表')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    check('xlsx buffer 生成成功', Buffer.isBuffer(buf) && buf.length > 0, `${buf.length} bytes`)
  } finally {
    // 6) 清理：无论成功/异常都删，杜绝生产库残留
    section('6) 清理临时数据（finally 兜底）')
    let cOk = true
    try {
      if (doc) {
        await ResultsTimetable.deleteOne({ _id: doc._id })
        await Task.deleteMany({ resultsTimetable: doc._id })
      }
      if (company) {
        await Company.deleteOne({ _id: company._id })
      }
      const leftover = doc ? await ResultsTimetable.countDocuments({ _id: doc._id }) : 0
      const leftoverTasks = doc ? await Task.countDocuments({ resultsTimetable: doc._id }) : 0
      const leftoverCo = company ? await Company.countDocuments({ _id: company._id }) : 0
      check('排期已删除', leftover === 0)
      check('关联 Task 已删除', leftoverTasks === 0)
      check('测试公司已删除', leftoverCo === 0)
      cOk = leftover === 0 && leftoverTasks === 0 && leftoverCo === 0
    } catch (cleanErr) {
      cOk = false
      console.error('⚠️ 清理阶段异常（请手动检查 __RT_TEST__ 残留）:', cleanErr.message)
    }
    await mongoose.disconnect()
    if (failures === 0 && cOk) {
      console.log('\n🎉 全部通过：真实 Atlas 链路 OK，临时数据已清理')
    } else {
      console.log(`\n⚠️ 验证失败项=${failures}，清理完成=${cOk}`)
    }
    process.exit(failures === 0 && cOk ? 0 : 1)
  }
}

main().catch(async (e) => {
  console.error('💥 验证脚本异常:', e)
  try { await mongoose.disconnect() } catch { /* 断开兜底 */ }
  process.exit(1)
})
