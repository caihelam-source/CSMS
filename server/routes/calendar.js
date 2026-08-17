const express = require('express')
const { auth } = require('../middleware/auth')
const { scopeMiddleware } = require('../middleware/scope')
const { requirePermission } = require('../middleware/rbac')
const { getCalendarEvents, createEvent, updateEvent, deleteEvent } = require('../services/calendarService')
const { sendEmail } = require('../utils/mailer')

const router = express.Router()

// 解析 YYYY-MM-DD → Date（缺省回退到当前月）
function parseMonthRange(from, to) {
  if (from && to) {
    return { from: new Date(from), to: new Date(to) }
  }
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { from: start, to: end }
}

// GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD&types=task,meeting
// 聚合 6 类来源的日历事件，受 scope 行级权限约束。
router.get('/events', auth, scopeMiddleware, async (req, res) => {
  try {
    const { from, to } = parseMonthRange(req.query.from, req.query.to)
    const types = req.query.types
      ? String(req.query.types).split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const events = await getCalendarEvents({ from, to, types, req })
    res.json({ success: true, count: events.length, from, to, events })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/calendar/events —— 新建用户自建事件（第 7 源）
// 权限：需 edit 权限（secretary/manager/admin）；归属 = 当前用户。auditor/viewer 仅只读，不可写。
router.post('/events', auth, requirePermission('edit'), async (req, res) => {
  try {
    const doc = await createEvent(req.body, req.user)
    res.status(201).json({ success: true, event: doc.toEventVO() })
  } catch (err) {
    const code = err.statusCode || 500
    res.status(code).json({ message: err.message })
  }
})

// PUT /api/calendar/events/:id —— 编辑用户自建事件
// 权限：需 edit 权限；仅创建者 / admin（auditor/viewer 仅只读，不可写）。
router.put('/events/:id', auth, requirePermission('edit'), async (req, res) => {
  try {
    const doc = await updateEvent(req.params.id, req.body, req.user)
    res.json({ success: true, event: doc.toEventVO() })
  } catch (err) {
    const code = err.statusCode || 500
    res.status(code).json({ message: err.message })
  }
})

// DELETE /api/calendar/events/:id —— 删除用户自建事件
// 权限：需 edit 权限；仅创建者 / admin（auditor/viewer 仅只读，不可写）。
router.delete('/events/:id', auth, requirePermission('edit'), async (req, res) => {
  try {
    await deleteEvent(req.params.id, req.user)
    res.json({ success: true })
  } catch (err) {
    const code = err.statusCode || 500
    res.status(code).json({ message: err.message })
  }
})

// POST /api/calendar/digest
// 把当前用户可见范围内「本月 + 逾期未完成」事件汇总为邮件摘要，发到登录邮箱。
router.post('/digest', auth, scopeMiddleware, async (req, res) => {
  try {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const events = await getCalendarEvents({ from, to, req })

    const open = events.filter((e) => e.status === 'open' || e.status === 'overdue')
    if (!req.user.email) {
      return res.status(400).json({ success: false, message: '当前账号无邮箱，无法发送摘要' })
    }

    const rows = open.map((e) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${e.overdue ? '🔴' : '🟡'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${new Date(e.date).toLocaleDateString('zh-CN')}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${e.module}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(e.title)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${e.companyName || '—'}</td>
      </tr>`).join('')

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:640px;margin:auto;">
        <h2 style="color:#2563EB;">CSMS · ${now.getFullYear()}年${now.getMonth() + 1}月 待办摘要</h2>
        <p>共 ${open.length} 项待处理（含逾期 ${events.filter((e) => e.overdue).length} 项）。</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f8fafc;text-align:left;">
              <th style="padding:6px 10px;"></th>
              <th style="padding:6px 10px;">日期</th>
              <th style="padding:6px 10px;">模块</th>
              <th style="padding:6px 10px;">事项</th>
              <th style="padding:6px 10px;">公司</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#888;">本月暂无待办 🎉</td></tr>'}</tbody>
        </table>
        <p style="color:#888;font-size:12px;margin-top:16px;">本邮件由 CSMS 日历模块生成。</p>
      </div>`

    const result = await sendEmail({
      to: req.user.email,
      subject: `CSMS 待办摘要 · ${now.getFullYear()}年${now.getMonth() + 1}月（${open.length} 项）`,
      html,
    })

    if (result.skipped) {
      return res.json({ success: true, skipped: true, count: open.length, message: 'SMTP 未配置，邮件未发送（请在环境变量中设置 MAIL_*）' })
    }
    if (!result.ok) {
      return res.status(502).json({ success: false, message: '邮件发送失败：' + (result.error || '未知错误') })
    }
    res.json({ success: true, sent: true, count: open.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

module.exports = router
