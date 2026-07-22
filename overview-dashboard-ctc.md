# Dashboard 发起签署任务重构 + CTC PDF 生成

## 问题
用户截图反馈 Dashboard「发起签署任务」弹窗需要：
1. 可选公司 → 选该公司文件，或可选人员 → 选该人员文件。
2. 普通签署不需要「签署人」字段。
3. CTC 签署需要填写 Full Name / Professional Title / Membership No.，并在所选 PDF 右下角生成 CTC 声明区块，生成新的待签字版 PDF。

## 改动

### 新增文件
- `client/src/utils/ctcPdf.js`
  - `generateCtcPdf(pdfBytes, { fullName, professionalTitle, membershipNo })`：使用 `pdf-lib` 在 PDF 最后一页右下角绘制白色背景声明框，包含：
    - CERTIFIED TRUE COPY
    - 认证声明文本
    - Dated this _____ day of __________, 20____
    - 签名栏
    - Full Name / Professional Title / Membership No.

### 修改文件
- `client/package.json` / `package-lock.json`：安装 `pdf-lib@^1.17.1`。
- `client/src/pages/Dashboard.jsx`：
  - 弹窗表单新增「公司 / 人员」二选一归属类型。
  - 选择公司/人员后，文件下拉只显示对应文件。
  - 普通签署保留「签署人」字段；CTC 签署隐藏签署人，显示 CTC 信息三字段。
  - 提交时：CTC 模式下载原 PDF → 生成带声明区块的新 PDF → 上传归档 → 创建 signing task。
  - Task 关联 company 或 personnel，描述区分 CTC/普通模式。

## 验证与部署
- ESLint 0 error
- vite build 0 error（built in 1m 32s）
- Dashboard chunk 涨至 537KB（pdf-lib ~500KB），build 有 chunk size warning 但可运行
- DRY_RUN：changed 3 / added 2 / deleted 0
- 已推送 commit `b7de6888e7a8dd0bedc210b9acd1e7aecfe2cc93`，Render 自动重建中

## 后续优化
- 将 `pdf-lib` 改为动态 import，减小 Dashboard 首屏 chunk 体积。
