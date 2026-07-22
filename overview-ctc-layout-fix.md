# CTC PDF 声明区块布局修复

## 完成内容
- 修复 `client/src/utils/ctcPdf.js` 中 CTC（Certified True Copy）声明区块的布局问题。
- 解决用户反馈的四个问题：
  1. **边框未覆盖全部内容** → 盒子从 320×140pt 加大到 **340×200pt**。
  2. **位置应在第一页右下角** → 从最后一页改为 `pages[0]` 右下角。
  3. **Title 与 Membership No. 合并一行** → 输出格式如 `HKICPA / M123456`。
  4. **签字预留空间不足** → 签名线下方增加 22pt 留白，签名栏横线加长。

## 关键改动
- `client/src/utils/ctcPdf.js`：调整 box 尺寸、定位到第一页、优化垂直间距、合并 Title/Membership 行。

## 验证
- ESLint：0 error
- vite build：0 error（built in 1m 33s）
- 推送：commit `274782b2f5a7b192d28ca3672836ec4306a66d1e`，Render 自动重建中。

## 已知问题
- Dashboard chunk 仍为 537KB（pdf-lib），建议后续动态 import 优化。
- claw-api 仍因 Atlas 密码问题未就绪，线上为 mock 模式。
