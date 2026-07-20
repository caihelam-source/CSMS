// RBAC 权限矩阵单测（无需数据库）
const test = require('node:test')
const assert = require('node:assert')
const { can, atLeast, requireRole, requirePermission } = require('../middleware/rbac')

function makeRes() {
  const res = {}
  res.status = (code) => { res._status = code; return res }
  res.json = (obj) => { res._json = obj; return res }
  return res
}

// ── can() 权限判定 ──
test('can: admin 拥有全部权限', () => {
  for (const a of ['view', 'edit', 'upload', 'manageUsers', 'delete']) {
    assert.strictEqual(can('admin', a), true)
  }
})

test('can: viewer 仅能 view', () => {
  assert.strictEqual(can('viewer', 'view'), true)
  assert.strictEqual(can('viewer', 'edit'), false)
  assert.strictEqual(can('viewer', 'manageUsers'), false)
})

test('can: secretary/manager 可 edit/upload 但不可 manageUsers', () => {
  for (const r of ['secretary', 'manager']) {
    assert.strictEqual(can(r, 'edit'), true)
    assert.strictEqual(can(r, 'upload'), true)
    assert.strictEqual(can(r, 'manageUsers'), false)
    assert.strictEqual(can(r, 'delete'), false)
  }
})

test('can: 未知角色无权限', () => {
  assert.strictEqual(can('ghost', 'view'), false)
})

// ── atLeast() 等级 ──
test('atLeast: admin >= secretary, viewer 不满足', () => {
  assert.strictEqual(atLeast('admin', 'secretary'), true)
  assert.strictEqual(atLeast('secretary', 'admin'), false)
  assert.strictEqual(atLeast('viewer', 'manager'), false)
})

// ── requireRole() 中间件 ──
test('requireRole: 角色匹配放行', () => {
  const req = { user: { role: 'admin' } }
  const res = makeRes()
  let nextCalled = false
  requireRole('admin')(req, res, () => { nextCalled = true })
  assert.strictEqual(nextCalled, true)
})

test('requireRole: 角色不符返回 403', () => {
  const req = { user: { role: 'viewer' } }
  const res = makeRes()
  let nextCalled = false
  requireRole('admin')(req, res, () => { nextCalled = true })
  assert.strictEqual(res._status, 403)
  assert.strictEqual(nextCalled, false)
})

// ── requirePermission() 中间件 ──
test('requirePermission: 有该权限放行', () => {
  const req = { user: { role: 'secretary' } }
  const res = makeRes()
  let nextCalled = false
  requirePermission('edit')(req, res, () => { nextCalled = true })
  assert.strictEqual(nextCalled, true)
})

test('requirePermission: 无该权限返回 403', () => {
  const req = { user: { role: 'viewer' } }
  const res = makeRes()
  let nextCalled = false
  requirePermission('manageUsers')(req, res, () => { nextCalled = true })
  assert.strictEqual(res._status, 403)
  assert.strictEqual(nextCalled, false)
})

test('requirePermission: 未登录返回 401', () => {
  const req = {}
  const res = makeRes()
  let nextCalled = false
  requirePermission('view')(req, res, () => { nextCalled = true })
  assert.strictEqual(res._status, 401)
  assert.strictEqual(nextCalled, false)
})
