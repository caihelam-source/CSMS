const mongoose = require('mongoose');

// 首页公告（运营位走马灯）。管理员可在后台编辑，前台 Dashboard 轮播读取。
// 注意：本期仅做公告 CMS，不接广告网络；link/linkText 为可选的内链/外链跳转。
const announcementSchema = new mongoose.Schema({
  eyebrow: { type: String, default: '' },            // 小标签（如「合规提醒」）
  title: { type: String, required: true },            // 主标题
  subtitle: { type: String, default: '' },             // 副标题
  link: { type: String, default: '' },                 // 跳转链接（可选；内链以 / 开头，外链以 http 开头）
  linkText: { type: String, default: '' },             // 链接按钮文案（可选）
  active: { type: Boolean, default: true },            // 是否在前台展示
  order: { type: Number, default: 0 },                 // 排序权重（小在前）
  createdBy: { type: String, default: 'admin' },       // 创建人（审计用）
}, {
  timestamps: true,
});

// 复合索引：按 order 升序、创建时间倒序，前台读取稳定有序
announcementSchema.index({ active: 1, order: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
