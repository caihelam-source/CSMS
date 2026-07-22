# New Task 弹窗增加关联字段

## 问题
用户反馈 Tasks 页面点击 **New Task** 创建任务时，弹窗只有 title / description / type / priority / status / due date，缺少「关联公司 / 关联会议 / 关联人员」。在 CSMS 中，Task 的 company 归属是后续文件归档、Dashboard 统计、权限控制的根节点，必须能在创建时指定。

## 修复
修改 `client/src/pages/Tasks.jsx`：

1. **加载关联选项**
   - `TaskForm` 组件挂载时并行拉取 `companyService.getAll()`、`meetingService.getAll()`、`personnelService.getAll()`。
   - 下拉框 disabled 直到选项加载完成。

2. **新增三列选择器**
   - 关联公司（显示 `name` + `nameChinese`）
   - 关联会议（显示 `title`）
   - 关联人员（显示 `name` / `englishName`）
   - 均可选空 `-- 请选择 --`。

3. **兼容编辑模式**
   - 初始值可能是对象 `{ _id, name }`（后端 populate 后）或字符串 ID，统一用 `idOf()` 提取 `_id`。
   - 提交时空字符串会被转成 `undefined`，避免后端存空引用。

4. **列表卡片显示归属**
   - 任务列表中的每个卡片现在会显示已关联的公司 / 会议 / 人员小徽章，方便一眼识别。

## 验证与部署
- ESLint 全量 **0 error**
- `vite build` **0 error**（built in 59.93s）
- DRY_RUN：changed 1 / added 1 / deleted 0（安全）
- 已推送 commit **`d1db927ce3e970adba45dcf53720bd88d8c7ca22`**，Render 自动重建中
