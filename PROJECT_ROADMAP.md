# 🗺️ 项目路线图 - Project Roadmap

Claw 公司秘书管理系统的开发路线图、版本计划和任务追踪。

## 📌 当前状态：v5.2（v5.2.1 增量已交付）

**最后更新**: 2026-08-13
**当前阶段**: v5.2 已交付（会议闭环 + 文件管理 + 移动端 + 签署增强）；**v5.2.1 增量**：Schema 驱动模板系统融合 9 预设 + 可编辑存档说明 + 一键本地部署 `deploy:local`。下一步 M1 后端数据迁移 `--apply` 与 M4 微信端细化。

---

## 🎯 版本规划

### ✅ v1.0 - MVP (已完成)
- [x] 用户认证系统（注册/登录/JWT）
- [x] 基础公司 CRUD
- [x] 董事信息管理
- [x] 会议管理基础功能
- [x] 文档上传下载
- [x] 任务管理

### ✅ v2.0 - 功能增强（已完成）
- [x] 人员库统一管理（Personnel）
- [x] 股东条目管理 + 入股退股时间线
- [x] 董事条目管理 + 任职记录
- [x] 合规规则管理（17 条预设）
- [x] 合规提醒管理
- [x] 文档模板变量渲染
- [x] Excel 导入导出
- [x] ROM/ROD PDF 生成
- [x] Dashboard 仪表盘

### ✅ v3.0 - 数据联动与协作（已完成）
- [x] 人员库 ↔ 公司关联自动更新
- [x] 人员合并 / 去重 / 重复检测
- [x] 前后端功能对齐
- [x] 批量操作支持

### ✅ v4.0 - 代码优化（已完成）
- [x] React.lazy / 共享组件 / 虚拟列表 / 验证器 / Toast
- [x] 端到端回归 31/31 通过

### ✅ v5.0 - 统一人员中枢重构（已完成，2026-07-14）
- [x] Director / ShareholderEntry / DirectorEntry 合并入 Personnel
- [x] `Company.links[]` 为公司中心枢纽（唯一事实源，读时聚合）
- [x] 导航重组（移除 Directors 独立页，仅留 Companies / Personnel / Documents / Meetings / Tasks / Reminders）
- [x] Personnel 360° 视图（任职公司 + 会议 / 文件 / 合规 / 任务）
- [x] CompanyDetail 打通合规提醒
- [x] 迁移脚本 `scripts/migrate-v5.js`（dry-run / 备份 / verify / rollback / cleanup）
- [x] 后端读时聚合 `GET /api/personnel/:id/aggregate`

### ✅ v5.2 - 四增量模块（已完成，2026-07-20）
- [x] **会议纪要闭环补强**：自动生成签署 Task + 上传暂存 staged + 归档批量移库重命名 + 锁定只读 + 已归档印章
- [x] **文件管理升级**：CompanyDetail 多级筛选器（大类→子类型→年份 + 面包屑 + 实时数量）
- [x] **移动端适配**：pb-safe 20px / tap-target 44px / DetailHeader 折行 / TabNav 选中加深
- [x] **Dashboard 签署任务增强**：双来源 Task（meeting/dashboard 计数同步）+ 模态发起 + 直接归档公司库（CTC 命名）
- [x] **会议通知/纪要 Tab 完善**：补齐「重新生成 / 保存 Word / HTML 预览」，修复编辑后预览丢失

### ✅ v5.2.1 - Schema 驱动模板系统（已完成，2026-08-13）
- [x] **模板引擎重构**：`docSchema` JSON（字段 + 区块 + 变量）经通用引擎渲染，列表 / 填写 / 编辑三视图 + Word 导出 + HTML 预览 + 复制文案
- [x] **9 个真实预设**：董事遵守标准守则之确认函、董事确认函、DU004G 董事个人资料及履历、部门年度企业管治自评、风险管理及内部监控报告、项目章程（RMIC）、董事会决议（RMIC）、董事辞任信、同意出任董事书
- [x] **可编辑存档说明**：渲染引擎 `note` 区块支持变量引用；每个预设新增 `archiveNote` 多行字段（默认标准说明），「打印存档说明」勾选控制整行是否打印
- [x] **旧 HTML 模板迁移**：`scripts/migrateHtmlTemplates.cjs`（dry-run / 备份 / assertValidDocSchema 校验）升级旧 `engine:'html'` 模板为 schema 引擎
- [x] **`/initialize` 端点**：聚合 `presets/*.js` 写 9 预设（严守「先迁移旧 HTML，后 `/initialize`」红线）
- [x] **一键本地部署**：`npm run deploy:local`（`scripts/deploy-local.js`）自动起 MongoDB → seed-admin → 迁移 → 起后端 → 登录取 token → 写预设
- [x] **修复**：mock 模式（`VITE_USE_MOCK`）登录 500、两处 lint 自退、补齐 demo 秘书账号

---

## 🔮 下一步规划（v5.2+）

### 🔄 M1 - 后端数据迁移 `--apply`（进行中）
- [ ] 执行 `scripts/migrate-v5.js --apply`（需先备份 Atlas 库，DBA 复核）
  - legacy 数据 `directors` / `shareholderentries` / `directorentries` 合并进 Personnel + Company.links
  - 默认 DRY RUN 安全；`--apply` 仅拦 `prod|production|live|主` 库名
- [ ] 验证聚合接口在真实数据下正确

### ⏸ M2 - 搜索增强（后端 live 验证待 Atlas）
- [x] 前端 `$text` 索引建立（`server/searchIndexes.js`，6 集合）
- [ ] 真实 Atlas 上 live 验证全文搜索可用性
- [ ] 搜索结果高亮 / 分类展示

### ⏸ M3 - 前端体验精修
- [x] 暗色模式（ThemeContext + 全站令牌对齐）
- [x] 移动端适配
- [ ] 暗色视觉精修
- [ ] 单元测试起步

### 🔮 M4 - 微信端（架构就绪，细节后定）
- [ ] 架构已可后续添加微信端入口（E1-E5 维持原档，微信端后期细化）

---

## 📊 当前迭代任务看板

### 进行中 (In Progress)
| 任务 | 优先级 | 状态 |
|------|--------|------|
| M1 后端迁移 `--apply` | P0 | 待备份库 + DBA 复核 |
| Atlas 密码轮换 | P0 | 🔴 最高优先（活密码曾泄露风险） |

### 待开始 (To Do)
| 任务 | 优先级 |
|------|--------|
| M2 真实搜索 live 验证 | P1 |
| M3 暗色视觉精修 + 单测 | P2 |
| M4 微信端细化 | P3 |

### 已完成 (Done)
| 任务 | 完成日期 |
|------|----------|
| v5.2 四增量模块 | 2026-07-17 |
| v5.2 会议通知/纪要 Tab 修复 | 2026-07-20 |
| v5.0 统一人员中枢 | 2026-07-14 |
| 全栈部署上线 | 2026-07-09 |
| v4.0 代码优化 + 端到端回归 | 2026-07-08 |

---

## 🐛 已知问题 (Known Issues)

### 严重 (Critical)
- 🔴 **Atlas 活密码需轮换**（曾泄露风险，最高优先）
- 🔴 **M1 后端迁移未 `--apply`**（legacy 数据仍在旧集合，聚合依赖读时兼容）

### 主要 (Major)
| Issue ID | 描述 | 影响 | 状态 |
|----------|------|------|------|
| #M2-1 | 真实 Atlas 全文搜索未 live 验证 | 搜索增强仅前端就绪 | 待 Atlas |
| #M3-1 | 暗色视觉细节待精修 | 体验 | 待排期 |

### 次要 (Minor)
- 无（v5.2 回归 0 error，构建绿）

---

## 📈 质量门禁

| 指标 | 状态 |
|------|------|
| ESLint | 0 error（根 `eslint.config.js` flat CJS） |
| vite build | 0 error（先清 dist 与 node_modules/.vite 避 safe-delete） |
| 端到端回归 | v3.0 阶段 31/31 通过 |

---

## 👥 团队分工建议

| 角色 | 职责 |
|------|------|
| 全栈开发者 | 核心功能，前后端 |
| 后端工程师 | API / 数据库 / 迁移脚本 |
| 前端工程师 | UI / 交互 / 移动端 |
| QA | 回归测试 |

---

## 🗓️ 重要里程碑

```
2026-06    v3.0 Beta 发布          ████████████ 100%
2026-07-08 v4.0 代码优化           ████████████ 100%
2026-07-14 v5.0 统一人员中枢       ████████████ 100%
2026-07-17 v5.2 四增量模块         ████████████ 100%
2026-07-20 v5.2 会议 Tab 修复      ████████████ 100%
2026-07    M1 后端迁移 --apply     ░░░░░░░░░░░░░░ 待执行
2026-Q3    M4 微信端               ░░░░░░░░░░░░░░ 规划中
```

---

## 🔗 相关链接

- **README**: [README.md](./README.md)
- **技术设计**: [TECH_DESIGN.md](./TECH_DESIGN.md)
- **部署手册**: [DEPLOY-FULLSTACK.md](./DEPLOY-FULLSTACK.md)
- **整体搬迁**: [MIGRATION.md](./MIGRATION.md)
- **开发指南**: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **API 文档**: [docs/API.md](./docs/API.md)

---

<div align="center">
<strong>🚀 Claw v5.2 — 让公司秘书工作更高效</strong>
</div>
