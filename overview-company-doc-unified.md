# CompanyDetail 文件 Tab 统一为 DocumentManager

## 问题
- 用户截图反馈：Company 详情页「文件」Tab 功能简陋，只有 Download，没有 Documents 页面的预览/修改/删除/批量操作/导出。
- 用户担心每次 commit 会删掉已保存的资料。

## 数据说明
- **代码 commit 不会删除数据库**。
- 当前前端跑在 mock 模式，所有数据存在前端内存数组，每次 Render 重新部署后会重置，造成「资料被删」的错觉。
- 真实后端（MongoDB Atlas）通了之后，新增保存的记录会持久化，不会丢失。

## 改动
- `client/src/components/DocumentManager.jsx`
  - 新增 `onDocumentsChange` prop，加载文档后把列表回传父组件，用于 Tab 计数。
- `client/src/pages/CompanyDetail.jsx`
  - 导入 `DocumentManager`。
  - 删除原文件 Tab 内联的多级筛选器、分组列表、操作按钮等 ~200 行代码。
  - 删除 `docFilterCategory`/`docFilterSubtype`/`docFilterYear` 状态及衍生 memo。
  - `loadAll` 不再重复请求文档列表。
  - 文件 Tab 直接渲染 `<DocumentManager companyId={id} embedded showExport onDocumentsChange={setDocuments} />`。
  - 保留「上传并关联会议」按钮作为补充入口。

## 验证与部署
- ESLint 0 error
- vite build 0 error（built in 1m 34s）
- DRY_RUN：changed 2 / added 1 / deleted 0
- 已推送 commit `ff0e9d3eb3c213527af4d924bb1a7568d0a5bb63`，Render 自动重建中。

## 后续
- 真实数据持久化需等 Atlas 密码轮换、`claw-api` 后端就绪。
