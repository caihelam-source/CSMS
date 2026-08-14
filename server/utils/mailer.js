// 轻量邮件发送器（Wave 日历模块 · 邮件摘要）
// 复用依赖 nodemailer。SMTP 通过环境变量配置；未配置时优雅跳过（返回 { skipped: true }），
// 不阻断主流程 —— 部署时只需在 Render 填入 MAIL_* 环境变量即可激活。
//
// 所需环境变量：
//   MAIL_HOST / MAIL_PORT / MAIL_USER / MAIL_PASS / MAIL_FROM
//   （可选 MAIL_SECURE=true 走 465 隐式 TLS）

const nodemailer = require('nodemailer')

let transporterCache = null
function getTransporter() {
  const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS } = process.env
  if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) return null
  if (transporterCache) return transporterCache
  transporterCache = nodemailer.createTransport({
    host: MAIL_HOST,
    port: Number(MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === 'true',
    auth: { user: MAIL_USER, pass: MAIL_PASS },
  })
  return transporterCache
}

/**
 * 发送邮件。未配置 SMTP 时跳过并标记 skipped。
 * @returns {Promise<{ok:boolean, skipped?:boolean, error?:string}>}
 */
async function sendEmail({ to, subject, html }) {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('[mailer] SMTP 未配置，跳过邮件未发送（设置 MAIL_HOST/MAIL_USER/MAIL_PASS 后激活）')
    return { ok: false, skipped: true }
  }
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to,
      subject,
      html,
    })
    return { ok: true }
  } catch (err) {
    console.error('[mailer] 发送失败:', err.message)
    return { ok: false, error: err.message }
  }
}

module.exports = { sendEmail }
