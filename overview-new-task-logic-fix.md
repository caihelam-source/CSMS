# New Task 弹窗逻辑修正

## 完成内容

修正 Tasks 页面 New Task / Edit Task 弹窗的两处业务逻辑：

1. **关联会议按公司过滤**：选择公司后，会议下拉只显示该公司的会议；未选公司时禁用并提示「请先选择公司」；切换公司时自动清空不匹配的会议。
2. **「关联人员」改为「跟进人 / 负责人」**：第三列下拉改为系统注册用户（User），对应后端 `Task.assignedTo` 字段，表示任务派给谁跟进。

## 改动文件

- `client/src/pages/Tasks.jsx`

## 关键实现

- 引入 `userService`，在 Tasks 页面加载用户列表并传给 `TaskForm`。
- `TaskForm` 表单字段从 `personnel` 改为 `assignedTo`，提交时包装为 `[userId]` 数组。
- 使用 `useMemo` 动态计算 `visibleMeetings`，根据 `form.company` 过滤。
- 新增 `useEffect`：公司变化时检查当前会议是否仍属于该公司，若不匹配则清空。
- 任务列表卡片徽章同步改为显示 `task.assignedTo` 用户名，并兼容旧 mock 数据的 `responsiblePerson` 回退。

## 验证与部署

- ESLint 0 error
- vite build 0 error（built in 32.49s）
- 推送 commit `0ac9b2b4d1f67aee1476458b8effd6645b5d54ce`，Render 自动重建中。
