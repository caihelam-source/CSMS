# CSMS 收尾与增强 — 团队计划与分工（2026-07-17）

> 主理人：齐活林（Qi）· 交付总监
> 团队：`software-claw-backlog`
> 范围：07-17 收尾四项闭环后，剩余未完成任务的全量盘点 + 两份评审附件（DB-AUDIT-2026-07-16、UI-DESIGN-REVIEW-2026-07-16）中明列的未完成项。

## 一、来源盘点（哪些是真·未完成）

### A. 07-17 对话梳理的待办
1. v5.0 后端数据迁移 `--apply`（legacy 三表 → Personnel + Company.links）—— 只做过空库 dry-run，从未对真实数据执行
2. 搜索增强（正则 → `$text` / Atlas Search）
3. 真实后端打通（`VITE_USE_MOCK=false` live 验证，前端 real 模式从未 live 验证）
4. 微信小程序签署模块（延后）
5. 暗色模式全站启用 + 主题切换（令牌已就绪，未全站启用）
6. `Personnel.roles` 存储值 vs 读时派生一致性
7. `Document.generateDocNumber` count+1 竞态
8. CompanyDetail chunk 懒加载 xlsx（418KB）
9. 单元测试补齐（normalize + auth 冒烟）
10. codemod 遗留硬编码 Tailwind 色
11. 本地库 `company-secretary` 19 条中文残留（无害/可选）

### B. DB-AUDIT-2026-07-16 附件状态
| 项 | 状态 |
|---|---|
| P0-1 360° `$lookup` 改 `localField/foreignField` + 应用层并行 | ✅ 已落地（07-16） |
| P0-2 Dashboard 补索引 | ✅ 已落地 |
| P0-3 列表分页 + 投影 | ✅ 已落地 |
| P1-4 遗留集合双写漂移 | 🟡 半做（已加 `KEEP_LEGACY_ENTRIES` 开关，但迁移 `--apply` 未跑、未 drop、未移除路由） |
| P1-5 `Personnel.roles` 一致性 | ❌ 未做（待方案 A/B 决策） |
| P1-6 删除实体不清理反向引用 | ✅ 已落地（级联清理） |
| P1-7 重复路由定义 | ✅ 已落地（已移除） |
| P1-8 `generateDocNumber` 竞态 | ❌ 未做（需 counters 集合） |
| P2-9 搜索正则 → `$text`/Atlas Search | ❌ 未做 |
| P2-10 Mongoose 连接池/超时 | ✅ 已落地 |
| P2-11 Excel 导入 region/financialYearEnd | ✅ 已落地 |
| P2-12 `Document.expiresAt` 索引 | ✅ 已落地 |
| P2-13 `SignTask.signers.signer` 索引 | ⏸ 可暂缓 |
| 迁移后清理检查清单（7 项） | ❌ 全未做（依赖迁移 `--apply`） |

### C. UI-DESIGN-REVIEW-2026-07-16 附件状态
| 项 | 状态 |
|---|---|
| P0-1 仪表盘去彩虹 | ✅ 已落地 |
| P0-2 收敛设计令牌（tailwind + index.css） | ✅ 已落地 |
| P1-3 徽章/状态色统一到语义集 | ❌ 未做（badge 仍用 Tailwind 默认色，可接受但未统一） |
| P1-4 组件 token 一致性（按钮走 `.btn-*`） | ✅ 已落地 |
| P1-5 卡片深度统一 | ✅ 已落地 |
| P2-6 暗色模式全站启用 + 主题切换 | ❌ 未做（令牌就绪，未启用 + 无开关） |
| P2-7 字体渲染/字阶（antialiased 已加；text-lg/text-xs 分级未补） | 🟡 半做 |

---

## 二、里程碑路线（按 ROI 与依赖排序）

### 里程碑 M1 — v5.0 迁移收尾（总开关，阻塞链起点）
- **M1.1** 执行 `migrate-v5.js --apply`（dry-run → mongodump 备份 → apply → verify）
- **M1.2** 迁移后清理检查清单（停双写 + 移除/只读化 entries 路由 + drop 遗留集合 + 确认无代码写旧模型）
- **M1.3** `Personnel.roles` 一致性（方案 A 删字段 / 方案 B 全链路同步）
- **M1.4** `Document.generateDocNumber` 竞态（counters 集合原子自增）
> ⚠️ M1.1 阻塞于 Atlas URI + DBA 复核；执行须在本机或用户授权贴 URI，沙箱连不到 Atlas。

### 里程碑 M2 — 搜索与真实后端（高 ROI）
- **M2.1** 全局搜索增强：`$text` 索引 / Atlas Search（架构设计 → 实现 → QA）
- **M2.2** 真实后端打通：`VITE_USE_MOCK=false` 连 Atlas 整链路 live 验证

### 里程碑 M3 — 前端体验与质量
- **M3.1** 暗色模式全站启用 + 主题切换开关
- **M3.2** 徽章/状态色统一到语义集
- **M3.3** CompanyDetail chunk 懒加载 xlsx
- **M3.4** 单元测试补齐（normalize + auth 冒烟）
- **M3.5** codemod 遗留硬编码 Tailwind 色清理

### 里程碑 M4 — 延后 / 可选
- **M4.1** 微信小程序签署模块（需 PM 先出 PRD）
- **M4.2** 本地库 19 条中文残留清理（无害，一键 `--apply`）

---

## 三、角色分工（RACI）

| 工作流 | 产品经理 许清楚 | 架构师 高见远 | 工程师 寇豆码 | QA 严过关 |
|---|---|---|---|---|
| M1.1 迁移执行 | — | 审核迁移方案/数据映射 | 主导执行 + verify | 验证迁移后数据一致性 |
| M1.2 迁移清理 | — | 清理顺序设计 | 停双写/drop 集合/移除路由 | 回归测试 |
| M1.3 roles 一致性 | — | **决策方案 A/B** | 按方案实现 + 前端同步 | 角色显示回归 |
| M1.4 序号竞态 | — | counters 方案 | 实现 + 索引 | 并发测试 |
| M2.1 搜索增强 | 搜索需求/验收 | **索引/Atlas Search 方案** | 实现 search.js | 搜索召回/排序测试 |
| M2.2 真实后端 | — | — | 切 real 模式验证 | E2E 冒烟 |
| M3.1 暗色模式 | 体验验收 | 主题开关方案 | 全站扫 + 开关 | 双主题视觉回归 |
| M3.2 徽章色 | 语义色规范 | — | 收敛到令牌 | 视觉核对 |
| M3.3 xlsx 懒加载 | — | — | 动态 import | bundle 体积验证 |
| M3.4 单测 | — | 测试策略 | — | **主导编写** |
| M3.5 硬编码色 | — | — | 逐页收敛 | — |
| M4.1 小程序 | **出 PRD** | 技术方案 | 实现 | 测试 |
| M4.2 本地残留 | — | — | 一键清理 | — |

---

## 四、任务清单（已建 TaskCreate 追踪）
见对话内 TaskList。优先级：M1（P0 阻塞）> M2（高 ROI）> M3（打磨）> M4（延后）。

## 五、立即下一步（M1.1 准备）
1. 主理人产出 `migrate-v5.js` 执行前核对清单（数据映射/备份/回滚）。
2. 待用户给 Atlas URI 或在本机执行 dry-run，确认真实数字后再 `--apply`。
3. M1.1 完成即解锁 M1.2–M1.4 与迁移清理检查清单。

> 注：沙箱无 git、连不到 Atlas，所有连库执行由用户本机完成；代码改动经 GitHub API 脚本推送（feature / main）。生产库 `claw_prod` 任何写操作须先备份 + `--i-know-this-is-prod` 显式确认。
