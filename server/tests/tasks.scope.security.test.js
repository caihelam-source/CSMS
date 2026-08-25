// 任务写接口 scope 安全加固集成测试（P0 修复验证，mongodb-memory-server）
// 与 tasks.participants.test.js 相互独立（各自独立内存库），本文件不修改现有 13 个用例。
// 覆盖（commit 7ebec58/be93545 架构评审 P0）：
//   · 跨公司用户 PUT 自加为参与者 / 完成 → 403（inScope 闸门）
//   · scope 内非参与者自加为参与者 → 403（assignedTo 变更闸门），绕过完成链被拦截
//   · 合法编辑（创建者/admin 在 scope 内修改 assignedTo、原参与者清空 assignedTo）→ 200
//
// 运行：node --test server/tests/tasks.scope.security.test.js
const test = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const jwt = require('jsonwebtoken')
const http = require('node:http')
const express = require('express')

process.env.JWT_SECRET = 'test-secret-tasks-scope-security'

const Company = require('../models/Company')
const User = require('../models/User')
const Task = require('../models/Task')
const taskRoutes = require('../routes/tasks')

let mongoServer, app, server
let adminUser, c1Manager, c1Stranger, c2User
let adminToken, c1ManagerToken, c1StrangerToken, _c2Token
let C1, C2

const at = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d }
const sign = (u) => jwt.sign({ userId: u._id }, process.env.JWT_SECRET)

function request(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const req = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      path,
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Type': 'application/json' } : {}),
      },
    }, (res) => {
      let buf = ''
      res.on('data', (c) => (buf += c))
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(buf) } catch { json = null }
        resolve({ status: res.statusCode, body: json })
      })
    })
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

  adminUser = await User.create({ name: 'Admin', email: 'admin@s.com', password: 'password123', role: 'admin' })
  // c1Manager / c1Stranger 同属 scope C1；c1Manager 是 c1-task 的原参与者，c1Stranger 仅 scope 内非参与者
  c1Manager = await User.create({ name: 'C1Mgr', email: 'c1m@s.com', password: 'password123', role: 'manager', accessibleCompanies: [C1._id] })
  c1Stranger = await User.create({ name: 'C1Str', email: 'c1s@s.com', password: 'password123', role: 'manager', accessibleCompanies: [C1._id] })
  c2User = await User.create({ name: 'C2User', email: 'c2@s.com', password: 'password123', role: 'manager', accessibleCompanies: [C2._id] })

  adminToken = sign(adminUser)
  c1ManagerToken = sign(c1Manager)
  c1StrangerToken = sign(c1Stranger)
  _c2Token = sign(c2User)

  // 跨公司任务（C2，创建者 admin，参与者 c2User）
  await Task.create({ title: 'cross-task', type: 'other', dueDate: at(5), status: 'pending', company: C2._id, assignedTo: [c2User._id], createdBy: adminUser._id })
  // C1 任务（创建者 admin，参与者 c1Manager；c1Stranger 是 scope 内非参与者）
  await Task.create({ title: 'c1-task', type: 'other', dueDate: at(5), status: 'pending', company: C1._id, assignedTo: [c1Manager._id], createdBy: adminUser._id })

  app = express()
  app.use(express.json())
  app.use('/api/tasks', taskRoutes)
  await new Promise((resolve) => { server = app.listen(0, resolve) })
})

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

// ── 跨公司攻击链拦截（inScope 闸门）────────────────────
test('P0：跨公司用户 PUT 自加为参与者 → 403（scope 外，攻击链第 1 步被拦）', async () => {
  const t = await Task.findOne({ title: 'cross-task' })
  const { status } = await request('PUT', `/api/tasks/${t._id}`, {
    token: c1ManagerToken, // C1 scope，任务在 C2
    body: { assignedTo: [c1Manager._id.toString(), c2User._id.toString()] },
  })
  assert.strictEqual(status, 403, '跨公司编辑参与者必须被 scope 拦截')
})

test('P0：跨公司用户 PUT 完成 → 403（scope 外，攻击链第 2 步被拦）', async () => {
  const t = await Task.findOne({ title: 'cross-task' })
  const { status } = await request('PUT', `/api/tasks/${t._id}`, {
    token: c1ManagerToken,
    body: { status: 'completed' },
  })
  assert.strictEqual(status, 403, '跨公司完成必须被 scope 拦截')
})

// ── scope 内非参与者自加为参与者被拦截（assignedTo 变更闸门）──
test('P0：scope 内非参与者自加为参与者 → 403（assignedTo 变更闸门）', async () => {
  const t = await Task.findOne({ title: 'c1-task' })
  const { status } = await request('PUT', `/api/tasks/${t._id}`, {
    token: c1StrangerToken, // C1 scope，但非创建者/非参与者
    body: { assignedTo: [c1Manager._id.toString(), c1Stranger._id.toString()] },
  })
  assert.strictEqual(status, 403, 'scope 内非参与者不得修改参与者列表')
})

test('P0：scope 内非参与者自加后被拦截，无法进入完成链', async () => {
  const t = await Task.findOne({ title: 'c1-task' })
  // 先尝试自加（应 403，闸门拦截），因此无法再通过「参与者」身份完成
  const r1 = await request('PUT', `/api/tasks/${t._id}`, {
    token: c1StrangerToken,
    body: { assignedTo: [c1Stranger._id.toString()] },
  })
  assert.strictEqual(r1.status, 403)
  // 确认任务状态未被置于 completed、completer 未被写入
  const fresh = await Task.findById(t._id).lean()
  assert.notStrictEqual(fresh.status, 'completed')
  assert.strictEqual(fresh.completer, undefined)
})

// ── 合法编辑不受影响 ─────────────────────────────────
test('合法：scope 内原参与者清空 assignedTo → 200（P1-2 修复：显式 [] 真正清空）', async () => {
  const t = await Task.findOne({ title: 'c1-task' })
  const { status, body } = await request('PUT', `/api/tasks/${t._id}`, {
    token: c1ManagerToken, // c1Manager 是 c1-task 原参与者
    body: { assignedTo: [] },
  })
  assert.strictEqual(status, 200, '原参与者清空参与者应成功')
  const assigned = (body.task.assignedTo || []).map((x) => String(x._id || x))
  assert.deepStrictEqual(assigned, [], '清空后 assignedTo 应为空数组')
})

test('合法：创建者/admin 在 scope 内修改 assignedTo → 200', async () => {
  const t = await Task.findOne({ title: 'c1-task' })
  const { status } = await request('PUT', `/api/tasks/${t._id}`, {
    token: adminToken,
    body: { assignedTo: [c1Stranger._id.toString()] },
  })
  assert.strictEqual(status, 200, 'admin 在 scope 内修改参与者应成功')
})
