# Claw UI 组件词汇表（与 AI 沟通的精确命名）

> 用途：本项目与 AI（设计/前端 agent）沟通 UI 需求时的**唯一事实源**。
> 痛点：用口语描述组件，AI 必跑偏（做成整页跳转、弹窗代替行内展开、固定工具条代替选中才出现等）。
> 纪律：凡涉及 UI 组件，**先查本表取「精确名 + Prompt 关键词」**，再套「四要素公式」补全行为/布局/状态。
> 配套 Skill：`ui-component-vocab`（加载后自动套用本表与公式）。

---

## 一、四要素公式（描述任何组件的通用模板）

光给名字不够，必须补齐四点，AI 才不会自由发挥：

```
① 组件名（精确术语）
+ ② 触发行为（什么操作让它出现 / 变化）
+ ③ 布局关系（和谁并排 / 覆盖 / 替换；是否路由跳转）
+ ④ 状态变化（空 / 选中 / 加载 / 报错时各自长什么样）
```

**范例**：「做一个 **Slide-over context drawer**（①），点击列表行打开（②），从右侧覆盖 40% 宽、原列表仍在左侧可见、不路由跳转（③），打开时遮罩半透明、关闭时滑回（④）。」

---

## 二、导航模式（9 种常见 + Claw 实际用的 2 种）

| # | 模式 | Prompt 关键词 | Claw 现状 |
|---|------|--------------|-----------|
| 1 | 悬浮吸顶 | `Floating + Sticky` | ✅ 已有（`Navbar` 为 `fixed` 悬浮药丸） |
| 2 | 侧边栏 | `Sidebar`（可折叠垂直导航） | ⬜ 缺失（用顶部栏 + 移动端底 Tab 代替） |
| 3 | 面包屑 | `Breadcrumb`（层级位置） | ✅ 已有（`Breadcrumbs.jsx`） |
| 4 | 二级下拉 | `Dropdown`（hover 显示子菜单） | ✅ 已有（模块菜单 / `UserMultiSelect`） |
| 5 | 巨型菜单 | `Mega Menu`（多列展开） | ⬜ 缺失 |
| 6 | 汉堡抽屉 | `Hamburger + Drawer`（移动端侧滑） | ✅ 已有（`Navbar` 汉堡→叉→右侧 `Drawer`） |
| 7 | 全屏遮罩 | `Full-screen Overlay`（覆盖全屏菜单） | 🟡 部分（`CommandPalette` 是搜索 overlay，非导航菜单） |
| 8 | 锚点导航 | `Anchor Navigation`（滚动高亮对应项） | ⬜ 缺失 |
| 9 | 滚动收缩 | `Shrink on Scroll`（滚动变矮+变色） | ✅ 已有（2026-09-05 落地：滚过 12px 收缩高度+背景更实+阴影加重） |
| 10 | 顶部水平导航 | `Top Bar`（一级模块横排） | ✅ 已有（`Navbar` 主结构，14 入口） |
| 11 | 底部标签栏 | `Bottom Tab Bar`（移动端） | ✅ 已有（`Layout` 移动端 `pb-24` + 底 Tab） |

---

## 三、难以描述的组件（数据密集型后台高频，AI 易误解）

| 组件 | 精确名 + Prompt 关键词 | 为什么难描述 | Claw 示例 |
|------|------------------------|--------------|-----------|
| 主从分栏 | `Master-Detail Split Pane` / `Two-pane with persistent selection` | AI 常做成「点列表→整页跳转详情」；要的是**左列表不消失、选中高亮、右就地刷新** | `Companies` ↔ `CompanyDetail` |
| 实体 360° 中枢 | `Entity 360` / `Hub-and-spoke Profile` / `Aggregate tab view` | Tab 不是平铺内容，而是从 `links` **聚合多集合**（人员/文档/会议/提醒） | `CompanyDetail` 各 Tab |
| 滑出式上下文抽屉 | `Slide-over Context Drawer` / `Coordinated panel (opens beside list, doesn't navigate)` | 与「汉堡抽屉（导航）」混淆；要点明**不路由跳转、原列表仍在** | `Drawer.jsx` 看详情 |
| 行内展开 / 下钻 | `Expandable Row Drill-down` / `Inline sub-grid` | AI 常做成「弹窗看子表」；要的是**同一行向下撑开显示子记录** | 合规/业绩宽表 |
| 批量操作条 | `Bulk Action Bar` / `Sticky selection toolbar (appears on multi-select)` | AI 做成固定顶部工具条；丢失「**选中才出现**、浮在列表上方、显示已选 N 项**」 | 列表多选 |
| 冻结首列 + 吸顶表头 | `Pinned first column` + `Sticky header row` / `Horizontal-scroll data table` | 宽表横向滚动时首列（公司名）与表头必须钉住，AI 默认一滚全飞 | 合规提醒 / 业绩排期 |
| 垂直时间线 / 里程碑 | `Vertical Timeline` / `Milestone Stepper` / `Status pipeline` | 带日期+状态的有序节点，AI 做成普通卡片流 | 合规到期（NAR1 / BR 续期） |
| 命令面板 | `Command Palette` / `Quick Switcher` / `Cmd+K` | ✅ 命名成功反例：说「Command Palette」AI 立刻懂 | `CommandPalette.jsx` |

---

## 四、状态变化的统一措辞（避免歧义）

| 状态 | 推荐关键词 |
|------|-----------|
| 空数据 | `Empty state`（插图 + 上下文 CTA，非「No data」） |
| 加载中 | `Skeleton screen`（占位高度≈真实内容，避免跳动） |
| 选中 | `Selected / Active`（高亮 + 持久） |
| 成功 | `Success toast`（对勾「绘制」而出，非瞬现） |
| 报错 | `Inline error`（字段下方，非弹窗） |
| 禁用 | `Disabled`（降透明度 + `cursor-not-allowed`） |

---

## 五、使用约定

1. 新增/修改 UI 前，先在本表找精确名；没有就补一行并同步更新配套 Skill。
2. 给 AI 的 prompt 必须含「四要素」，缺③（布局关系）最易导致整页跳转或弹窗误用。
3. 导航类优先用第二节的 11 个名；数据类用第三节的 8 个名。
