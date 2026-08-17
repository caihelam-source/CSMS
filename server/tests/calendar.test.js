// 日历模块集成测试（mongodb-memory-server）
// 覆盖：
//   T01 — GET /api/calendar/events 聚合 6 系统源 + 第 7 源 user_event，断言 count>0 / events 为数组 /
//         types 过滤 / scope 过滤（受限角色仅见 scope 内事件）。
//   T02 — POST/PUT/DELETE /api/calendar/events 自建事件 CRUD + 第 7 源并入 + 归属/管理员校验。
//
// 运行：node --test server/tests/calendar.test.js
const test = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const jwt = require('jsonwebtoken')
const http = require('node:http')
const express = require('express')

process.env.JWT_SECRET = 'test-secret-calendar'

const Company = require('../models/Company')
const User = require('../models/User')
const ComplianceReminder = require('../models/ComplianceReminder')
const Task = require('../models/Task')
const Document = require('../models/Document')
const Meeting = require('../models/Meeting')
const ResultsTimetable = require('../models/ResultsTimetable')
const CalendarEvent = require('../models/CalendarEvent')
const calendarRoutes = require('../routes/calendar')

let mongoServer
let app
let server
let adminUser, managerUser, otherUser, auditorUser
let adminToken, managerToken, otherToken, auditorToken
let C1, C2

// ── 测试夹具 ────────────────────────────────────────────────
const at = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(12, 0, 0, 0)
  return d
}

function sign(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET)
}

function request(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const req = http.request(
      {
        host: '127.0.0.1',
        port: server.address().port,
        path,
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { 'Content-Type': 'application/json' } : {}),
        },
      },
      (res) => {
        let buf = ''
        res.on('data', (c) => (buf += c))
        res.on('end', () => {
          let json = null
          try {
            json = JSON.parse(buf)
          } catch {
            json = null
          }
          resolve({ status: res.statusCode, body: json })
        })
      },
    )
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())

  // 公司
  C1 = await Company.create({ name: '中国新城市', nameChinese: '中国新城市', registrationNumber: 'CR-NC-001' })
  C2 = await Company.create({ name: 'Abundant Zone', nameChinese: 'Abundant Zone', registrationNumber: 'CR-AZ-002' })
  // 让公司申报源在当月有锚点
  C1.compliance = { agmDueDate: at(10), arDueDate: at(9), taxFilingDue: at(11) }
  C1.brExpiryDate = at(12)
  await C1.save()
  C2.compliance = { agmDueDate: at(11) }
  C2.brExpiryDate = at(13)
  await C2.save()

  // 用户：admin / manager(scope C1) / other(scope C2)
  adminUser = await User.create({ name: 'Admin', email: 'admin@test.com', password: 'password123', role: 'admin' })
  managerUser = await User.create({
    name: 'Manager',
    email: 'mgr@test.com',
    password: 'password123',
    role: 'manager',
    accessibleCompanies: [C1._id],
  })
  otherUser = await User.create({
    name: 'Other',
    email: 'other@test.com',
    password: 'password123',
    role: 'manager',
    accessibleCompanies: [C2._id],
  })
  adminToken = sign(adminUser)
  managerToken = sign(managerUser)
  otherToken = sign(otherUser)
  // 审计只读角色（role=auditor，仅 view 权限）—— 用于验证写路由拦截
  auditorUser = await User.create({ name: 'Auditor', email: 'aud@test.com', password: 'password123', role: 'auditor' })
  auditorToken = sign(auditorUser)

  // 6 系统源（覆盖各来源的当月数据）
  await ComplianceReminder.create({
    company: C1._id,
    rule: new mongoose.Types.ObjectId(),
    ruleId: 'r-1',
    sourceRuleId: 'src-r-1',
    year: new Date().getFullYear(),
    title: '提交周年申报表',
    dueDate: at(5),
    status: '待办',
    priority: '高',
  })
  await ComplianceReminder.create({
    company: C1._id,
    rule: new mongoose.Types.ObjectId(),
    ruleId: 'r-2',
    sourceRuleId: 'src-r-2',
    year: new Date().getFullYear(),
    title: '备存董事名册',
    dueDate: at(-2),
    status: '待办',
    priority: '中',
  })
  await Task.create({ title: '签署董事会决议', type: 'other', dueDate: at(-1), status: 'pending', company: C1._id, createdBy: adminUser._id })
  await Task.create({ title: '归档会议纪要(C2)', type: 'other', dueDate: at(3), status: 'pending', company: C2._id, createdBy: adminUser._id })
  await Document.create({ name: '商业登记证', company: C1._id, expiresAt: at(4), locked: false, uploadedBy: adminUser._id })
  await Meeting.create({ title: '董事会', scheduledAt: at(6), company: C1._id, status: 'scheduled' })
  await ResultsTimetable.create({ name: '中国新城市', code: 'C1', company: C1._id, period: 'interim', createdBy: adminUser._id, anchors: { T0: at(7), T1: at(8) } })

  // 第 7 源 user_event
  await CalendarEvent.create({ title: '董事会现场会', date: at(2), time: '14:30', allDay: false, companyId: C1._id, createdBy: adminUser._id })
  await CalendarEvent.create({ title: '个人备忘', date: at(3), allDay: true, companyId: null, createdBy: managerUser._id })
  await CalendarEvent.create({ title: '友商活动(C2)', date: at(4), allDay: true, companyId: C2._id, createdBy: otherUser._id })

  // 测试用 express 应用（挂载真实 calendar 路由 + 真实 auth/scope 中间件）
  app = express()
  app.use(express.json())
  app.use('/api/calendar', calendarRoutes)
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
})

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

// ── T01：聚合非空 + 第 7 源并入 ─────────────────────────────
test('GET /events：admin 下聚合非空且含 user_event', async () => {
  const { status, body } = await request('GET', '/api/calendar/events', { token: adminToken })
  assert.strictEqual(status, 200)
  assert.strictEqual(body.success, true)
  assert.ok(Array.isArray(body.events), 'events 应为数组')
  assert.ok(body.count > 0, '聚合结果应非空')
  const sources = body.events.map((e) => e.source)
  assert.ok(sources.includes('user_event'), '应包含第 7 源 user_event')
  assert.ok(sources.includes('compliance_reminder'))
  assert.ok(sources.includes('task'))
})

test('GET /events：types 过滤仅返回指定来源', async () => {
  const { status, body } = await request('GET', '/api/calendar/events?types=task', { token: adminToken })
  assert.strictEqual(status, 200)
  assert.ok(body.events.length > 0)
  assert.ok(body.events.every((e) => e.source === 'task'))
})

test('GET /events：受限角色 scope 过滤（仅见 scope 内公司事件）', async () => {
  const { status, body } = await request('GET', '/api/calendar/events', { token: managerToken })
  assert.strictEqual(status, 200)
  // 不应看到 C2 的系统任务「归档会议纪要(C2)」
  assert.ok(!body.events.some((e) => e.title === '归档会议纪要(C2)'), '受限角色不应见 scope 外公司事件')
  // 不应看到 createdBy=other 的 C2 user_event
  assert.ok(!body.events.some((e) => e.title === '友商活动(C2)'), '受限角色不应见 scope 外且非本人的事件')
  // 应看到本人创建的「个人备忘」
  assert.ok(body.events.some((e) => e.title === '个人备忘'), '应见本人创建的个人事件')
  // 应看到 scope 内 C1 的 user_event
  assert.ok(body.events.some((e) => e.title === '董事会现场会'), '应见 scope 内公司的事件')
})

test('GET /events：无 token 返回 401', async () => {
  const { status } = await request('GET', '/api/calendar/events')
  assert.strictEqual(status, 401)
})

// ── T02：CRUD + 归属校验 ───────────────────────────────────
test('POST /events：admin 新建事件并并入聚合', async () => {
  const { status, body } = await request('POST', '/api/calendar/events', {
    token: adminToken,
    body: { title: '新建测试事件', date: at(5).toISOString(), companyId: C1._id.toString() },
  })
  assert.strictEqual(status, 201)
  assert.strictEqual(body.success, true)
  assert.strictEqual(body.event.source, 'user_event')
  assert.strictEqual(body.event.title, '新建测试事件')

  // 随后 GET 应包含该事件
  const after = await request('GET', '/api/calendar/events', { token: adminToken })
  assert.ok(after.body.events.some((e) => e.id === body.event.id))
})

test('POST /events：标题缺失返回 400', async () => {
  const { status } = await request('POST', '/api/calendar/events', {
    token: adminToken,
    body: { date: at(5).toISOString() },
  })
  assert.strictEqual(status, 400)
})

test('PUT /events/:id：归属者编辑成功', async () => {
  const created = await request('POST', '/api/calendar/events', {
    token: otherToken,
    body: { title: '其他用户事件', date: at(6).toISOString(), companyId: C2._id.toString() },
  })
  const id = created.body.event.id
  const { status, body } = await request('PUT', `/api/calendar/events/${id}`, {
    token: otherToken,
    body: { title: '其他用户事件-改' },
  })
  assert.strictEqual(status, 200)
  assert.strictEqual(body.event.title, '其他用户事件-改')
})

test('DELETE /events/:id：非归属非 admin 返回 403', async () => {
  const created = await request('POST', '/api/calendar/events', {
    token: otherToken,
    body: { title: '越权删除目标', date: at(6).toISOString(), companyId: C2._id.toString() },
  })
  const id = created.body.event.id
  const denied = await request('DELETE', `/api/calendar/events/${id}`, { token: managerToken })
  assert.strictEqual(denied.status, 403, '非归属且非 admin 应被拒绝')
  // admin 可删除他人事件
  const allowed = await request('DELETE', `/api/calendar/events/${id}`, { token: adminToken })
  assert.strictEqual(allowed.status, 200)
  const after = await request('GET', '/api/calendar/events', { token: adminToken })
  assert.ok(!after.body.events.some((e) => e.id === id), '删除后应从聚合中消失')
})

test('DELETE /events/:id：不存在返回 404', async () => {
  const { status } = await request('DELETE', '/api/calendar/events/000000000000000000000000', { token: adminToken })
  assert.strictEqual(status, 404)
})

// ── T03：写路由权限闸门（auditor 仅只读）────────────────────
test('POST/PUT/DELETE /events：auditor 仅只读，写操作一律 403', async () => {
  // 先由 admin 建一个事件，供 PUT/DELETE 验证
  const created = await request('POST', '/api/calendar/events', {
    token: adminToken,
    body: { title: '审计只读验证', date: at(7).toISOString() },
  })
  assert.strictEqual(created.status, 201)
  const id = created.body.event.id

  const post = await request('POST', '/api/calendar/events', {
    token: auditorToken,
    body: { title: 'auditor 自建', date: at(8).toISOString() },
  })
  assert.strictEqual(post.status, 403, 'auditor 不应能新建事件（缺 edit 权限）')

  const put = await request('PUT', `/api/calendar/events/${id}`, {
    token: auditorToken,
    body: { title: 'auditor 改' },
  })
  assert.strictEqual(put.status, 403, 'auditor 不应能编辑事件')

  const del = await request('DELETE', `/api/calendar/events/${id}`, { token: auditorToken })
  assert.strictEqual(del.status, 403, 'auditor 不应能删除事件')

  // 旁观：auditor 仍可正常读取聚合数据
  const get = await request('GET', '/api/calendar/events', { token: auditorToken })
  assert.strictEqual(get.status, 200)
  assert.strictEqual(get.body.success, true)
})
