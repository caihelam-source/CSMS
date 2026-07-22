# Meeting 生成文件无实体/无预览修复

## 问题
用户发现通过 Meeting 定稿生成的「会议通知」「会议纪要」在 Documents 列表显示 **"无实体文件（仅元数据）"**，无法预览也无法 ZIP 导出。

## 根因
这是一处**系统性漏洞**：多个有文件或已选文件的入口错用 `documentService.create()` 只写元数据，没有真正上传文件，导致 `fileUrl` 为空。

## 修复入口
| 文件 | 位置 | 修复前 | 修复后 |
|---|---|---|---|
| `client/src/pages/MeetingDetail.jsx` | `finalizeNotice` / `finalizeMinutes` | `documentService.create()` 只存元数据 | 生成 `.doc` Word 文件 → `documentService.upload(FormData)` |
| `client/src/pages/MeetingDetail.jsx` | 内联「上传签署文件」 | `documentService.create()` 只存元数据 | `documentService.upload(FormData)` 传真实文件 |
| `client/src/pages/CompanyDetail.jsx` | 「相关文件」上传弹窗 | `documentService.create()` 只存元数据 | `documentService.upload(FormData)` 传真实文件 |
| `client/src/pages/Dashboard.jsx` | 「发起签署任务」 | `documentService.create()` 写死 `fileUrl: '/scan/...'` | `documentService.upload(FormData)` 传真实文件 |

## 关键改动
- `MeetingDetail.jsx` 新增 `buildWordFile()` 复用现有 Word HTML 生成逻辑，定稿时把通知/纪要内容转为 `File` 再上传。
- 所有 FormData 均携带 `file`、`name`、`type`、`category`、`company`、`meeting`、`source`、`note` 等字段，与 `mock.upload` 和真实后端 `/api/documents` 对齐。
- mock 模式下上传后会生成 blob URL，DocumentManager 可正常预览、ZIP 导出。

## 验证与部署
- ESLint 全量 **0 error**
- `vite build` **0 error**（built in 1m 11s）
- DRY_RUN：changed 3 / deleted 0（安全）
- 已推送 commit **`c5c7b0e0cb950de4056e65195676fdff7ddc61f8`**，Render 自动重建中

## 注意
截图里的 `ME-0017` / `ME-0018` 是修复前用旧逻辑生成的元数据记录，仍会显示"无实体文件"。重新进入 Meeting 定稿后生成的新文档会带真实文件。
