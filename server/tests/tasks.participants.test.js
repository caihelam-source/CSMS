// 任务多参与者增量集成测试（mongodb-memory-server）
// 覆盖（按 design-incremental-2026-08-19.md T03/T04/T08）：
//   T03 — GET /api/tasks?assignedTo=me 翻译为 req.user._id；逗号多值 → $in；scope 不被绕过
//   T04 — PUT /:id 完成权限收窄（Q1）：admin/创建者/参与者可完成，非授权 403；附件门禁保留 400
//   Q6  — 完成时写入 completer 审计字段
//   T05 — 模型索引 / completer 字段（间接验证：写入后可读取）
//
// 运行：node --test server/tests/tasks.participants.test.js
const test = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const jwt = require('jsonwebtoken')
const http = require('node:http')
const express = require('express')

process.env.JWT_SECRET = 'test-secret-tasks-participants'

const Company = require('../models/Company')
const User = require('../models/User')
const Task = require('../models/Task')
const taskRoutes = require('../routes/tasks')

let mongoServer
let app
let server
let adminUser, managerUser, otherUser, viewerUser
let adminToken, managerToken, otherToken, viewerToken
let C1, C2

const at = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
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

  C1 = await Company.create({ name: 'Company One', registrationNumber: 'CR-001' })
  C2 = await Company.create({ name: 'Company Two', registrationNumber: 'CR-002' })

  // admin 不受 scope 限制；manager/other 同属 scope C1（用于隔离 `me` 翻译与 scope 的影响）
  adminUser = await User.create({ name: 'Admin', email: 'admin@t.com', password: 'password123', role: 'admin' })
  managerUser = await User.create({ name: 'Manager', email: 'mgr@t.com', password: 'password123', role: 'manager', accessibleCompanies: [C1._id] })
  otherUser = await User.create({ name: 'Other', email: 'other@t.com', password: 'password123', role: 'manager', accessibleCompanies: [C1._id] })
  // viewer 属 scope C2（用于验证 scope 不被绕过 + 完成权限 403）
  viewerUser = await User.create({ name: 'Viewer', email: 'viewer@t.com', password: 'password123', role: 'viewer', accessibleCompanies: [C2._id] })

  adminToken = sign(adminUser)
  managerToken = sign(managerUser)
  otherToken = sign(otherUser)
  viewerToken = sign(viewerUser)

  // 夹具任务
  await Task.create({ title: 'other-assigned', type: 'other', dueDate: at(5), status: 'pending', company: C1._id, assignedTo: [otherUser._id], createdBy: adminUser._id })
  await Task.create({ title: 'manager-assigned', type: 'other', dueDate: at(5), status: 'pending', company: C1._id, assignedTo: [managerUser._id], createdBy: adminUser._id })
  await Task.create({ title: 'c2-task', type: 'other', dueDate: at(5), status: 'pending', company: C2._id, createdBy: adminUser._id })
  await Task.create({ title: 'signing-no-attach', type: 'signing', dueDate: at(5), status: 'pending', company: C1._id, hasAttachment: false, createdBy: adminUser._id })

  app = express()
  app.use(express.json())
  app.use('/api/tasks', taskRoutes)
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
})

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

// ── T03：assignedTo=me 翻译 ─────────────────────────────
test('GET /api/tasks?assignedTo=me：翻译为当前用户，返回指派给本人的任务', async () => {
  const { status, body } = await request('GET', '/api/tasks?assignedTo=me', { token: otherToken })
  assert.strictEqual(status, 200)
  assert.ok(Array.isArray(body.tasks))
  assert.strictEqual(body.tasks.length, 1)
  assert.strictEqual(body.tasks[0].title, 'other-assigned')
})

test('GET /api/tasks?assignedTo=me：仅取本人（隔离 scope，不误返回他人任务）', async () => {
  // manager 与 other 同属 scope C1，但 assignedTo=me 应仅返回 manager 自己的任务：
  // 既不应误返回 other 的任务，也应正确返回 manager 自己被指派的 manager-assigned。
  const { status, body } = await request('GET', '/api/tasks?assignedTo=me', { token: managerToken })
  assert.strictEqual(status, 200)
  const titles = body.tasks.map((t) => t.title)
  assert.ok(!titles.includes('other-assigned'), '不应误返回 other 的任务（scope 内隔离）')
  assert.ok(titles.includes('manager-assigned'), '应返回 manager 自己被指派的任务')
})

// ── T03：逗号多值 → $in ───────────────────────────────
test('GET /api/tasks?assignedTo=a,b：多值 $in 返回两者', async () => {
  const ids = [managerUser._id.toString(), otherUser._id.toString()].join(',')
  const { status, body } = await request('GET', `/api/tasks?assignedTo=${ids}`, { token: adminToken })
  assert.strictEqual(status, 200)
  const titles = body.tasks.map((t) => t.title).sort()
  assert.deepStrictEqual(titles, ['manager-assigned', 'other-assigned'])
})

test('GET /api/tasks?assignedTo=<单值>：等值匹配', async () => {
  const { status, body } = await request('GET', `/api/tasks?assignedTo=${managerUser._id.toString()}`, { token: adminToken })
  assert.strictEqual(status, 200)
  assert.strictEqual(body.tasks.length, 1)
  assert.strictEqual(body.tasks[0].title, 'manager-assigned')
})

// ── T03：scope 过滤不被绕过（决策 #3）────────────────────
test('GET /api/tasks：受限角色仅见 scope 内公司任务（scope 外 C2 被拦截）', async () => {
  const { status, body } = await request('GET', '/api/tasks', { token: managerToken })
  assert.strictEqual(status, 200)
  assert.ok(!body.tasks.some((t) => t.title === 'c2-task'), 'scope C1 用户不应见 C2 任务')
})

test('GET /api/tasks?company=C2：显式 company 过滤被 scope 覆盖（不被绕过）', async () => {
  const { status, body } = await request('GET', `/api/tasks?company=${C2._id.toString()}`, { token: managerToken })
  assert.strictEqual(status, 200)
  assert.ok(!body.tasks.some((t) => t.title === 'c2-task'), 'scope 应覆盖显式 company 过滤，结果仍为空')
})

test('GET /api/tasks：admin 不受限可见全部（含 C2）', async () => {
  const { status, body } = await request('GET', '/api/tasks', { token: adminToken })
  assert.strictEqual(status, 200)
  assert.ok(body.tasks.some((t) => t.title === 'c2-task'))
})

// ── T04 / Q1：完成权限收窄 ─────────────────────────────
test('PUT /:id：参与者标记完成 → 200，并写入 completer（Q6）', async () => {
  const t = await Task.findOne({ title: 'manager-assigned' })
  const { status, body } = await request('PUT', `/api/tasks/${t._id}`, {
    token: managerToken,
    body: { status: 'completed' },
  })
  assert.strictEqual(status, 200, JSON.stringify(body))
  assert.strictEqual(body.task.status, 'completed')
  assert.ok(body.task.completedDate, 'completedDate 应被写入')
  assert.strictEqual(String(body.task.completer?._id || body.task.completer), String(managerUser._id))
})

test('PUT /:id：创建者（admin）标记完成 → 200，并写入 completer', async () => {
  const t = await Task.findOne({ title: 'other-assigned' })
  const { status, body } = await request('PUT', `/api/tasks/${t._id}`, {
    token: adminToken,
    body: { status: 'completed' },
  })
  assert.strictEqual(status, 200, JSON.stringify(body))
  assert.strictEqual(String(body.task.completer?._id || body.task.completer), String(adminUser._id))
})

test('PUT /:id：非创建者/非参与者/非 admin → 403', async () => {
  // viewer 属 scope C2，既非创建者也非参与者，且无 admin 角色
  const t = await Task.findOne({ title: 'manager-assigned' })
  const { status, body } = await request('PUT', `/api/tasks/${t._id}`, {
    token: viewerToken,
    body: { status: 'completed' },
  })
  assert.strictEqual(status, 403, '非授权者完成应返回 403')
  assert.ok(body.message.includes('Access denied'), `错误信息应含 Access denied，实际：${body.message}`)
})

// 注：本测试原用 viewerToken（scope C2）重新打开 C1 任务；现因 PUT 已挂载 scope 校验（P0 修复），
// 跨 scope 编辑返回 403，故改为 scope 内但非创建者/非参与者的 otherToken 来验证
// 「重新打开（status≠completed）不触发完成权限 403」这一原本意图。
test('PUT /:id：重新打开（status≠completed）不受完成权限限制 → 200', async () => {
  const t = await Task.findOne({ title: 'manager-assigned' })
  const { status } = await request('PUT', `/api/tasks/${t._id}`, {
    token: otherToken,
    body: { status: 'pending' },
  })
  assert.strictEqual(status, 200, '重新打开不应触发完成权限 403')
})

// ── 附件门禁保留（#2.3）─────────────────────────────────
test('PUT /:id：signing 类无附件标记完成 → 400（门禁保留）', async () => {
  const t = await Task.findOne({ title: 'signing-no-attach' })
  const { status } = await request('PUT', `/api/tasks/${t._id}`, {
    token: adminToken,
    body: { status: 'completed' },
  })
  assert.strictEqual(status, 400, 'signing 无附件完成应返回 400')
})

// ── 鉴权基础路径 ───────────────────────────────────────
test('GET /api/tasks：无 token → 401', async () => {
  const { status } = await request('GET', '/api/tasks')
  assert.strictEqual(status, 401)
})
