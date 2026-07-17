// 后端鉴权冒烟测试（无需数据库）
// 覆盖 auth 中间件的两个关键拒绝路径：无 token / 无效 token 均返回 401 且不调用 next。
const test = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-secret-for-auth-smoke'

const { auth } = require('../middleware/auth')

function makeRes() {
  const res = {}
  res.status = (code) => { res._status = code; return res }
  res.json = (obj) => { res._json = obj; return res }
  return res
}

test('auth: 无 token 返回 401 且不调用 next', async () => {
  const req = { header: () => undefined }
  const res = makeRes()
  let nextCalled = false
  await auth(req, res, () => { nextCalled = true })
  assert.strictEqual(res._status, 401)
  assert.strictEqual(nextCalled, false)
})

test('auth: 无效 token 返回 401 且不调用 next', async () => {
  const badToken = jwt.sign({ userId: 'abc' }, 'wrong-secret')
  const req = { header: () => `Bearer ${badToken}` }
  const res = makeRes()
  let nextCalled = false
  await auth(req, res, () => { nextCalled = true })
  assert.strictEqual(res._status, 401)
  assert.strictEqual(nextCalled, false)
})

test('auth: 格式错误 header 返回 401', async () => {
  const req = { header: () => 'not-a-bearer-token' }
  const res = makeRes()
  let nextCalled = false
  await auth(req, res, () => { nextCalled = true })
  assert.strictEqual(res._status, 401)
  assert.strictEqual(nextCalled, false)
})
