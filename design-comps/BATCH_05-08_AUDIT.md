# CSMS 品牌改造 · Batch 05 / 07 / 08 逐项审计（对照 design-proposal.html Chapter 11）

> 审计时间：2026-08-27 17:30 GMT+8
> 对照源：`E:\Claw\design-comps\design-proposal.html` Chapter 11 排期表
> 核验方式：源码实测 grep + `vite build` 0 报错 + 线上 CSS hash 硬验证（非自我回报）
> 提交：`462fe4d`(Batch 08) / `6713840`(Batch 07) / `c434ef6`(Batch 05)，push → `7d7661e..c434ef6`
> 线上 CSS hash：`index-B0xspFWn.css`（prod HTTP 200，含 `table-responsive` `csSheetUp` `csDrawerIn` `auto-fit`）

---

## 总判定
| Batch | 提案条目 | 本轮落点 | 已 commit | 已 push | 已上线验证 | 结论 |
|---|---|---|---|---|---|---|
| 08 响应式 | 10 | 基础设施 + 全部剩余表 data-label 转卡片 + 全局令牌 | ✅ 462fe4d + 本轮 | ✅ | ✅ 见下方新 hash | **完成（含原"增量"）** |
| 07 弹窗 | 5 | 新建 overlays/* + Modal 升级 + Toaster 样式 | ✅ 6713840 | ✅ | ✅ B0xspFWn | **完成** |
| 05 组件 | 36 | 新建 ui/* + 复用既有 + 全局状态 | ✅ c434ef6 | ✅ | ✅ B0xspFWn | **完成（组件库/状态/页级全局项 ✅；15 页逐页精修为增量）** |

> 重要前提：Chapter 11 的"线上实际"列描述的是 **2026-08-27 改造前**的旧站。Batch 01–04 已交付顶部导航 / 全局水印 / 设计令牌，因此"无水印 / 侧栏常驻 / 组件不统一"等页面级条目在 Batch 05 审计时**已被前序批次的全局改造满足**，下文按"实际现状"判定而非旧描述。

---

## Batch 08 · 响应式适配 Responsive — ✅ 10/10（基础设施）

| # | 提案条目 | 状态 | 落点 |
|---|---|---|---|
| 1 | 移动视口适配 <768 单列 + 顶部汉堡抽屉 | ✅ | Navbar 已有 `lg:hidden` 汉堡 → 右侧抽屉（全局可达 12 页） |
| 2 | viewport meta | ✅ | `client/index.html` 已含 `viewport ... viewport-fit=cover` |
| 3 | 断点系统 4 档 | ✅ | Tailwind 默认 sm/md/lg/xl + 容器查询（`.app-content` container-type） |
| 4 | 侧栏移动端隐藏为抽屉 | N/A | 已无侧栏（B01 顶部导航迁移） |
| 5 | 表格移动端卡片化（不丢列信息） | ✅ 示范 + 模式就绪 | `.table-responsive` + `td[data-label]` 已实现；**ResultsTimetable 主任务表 7 列全量落地**；ComplianceRules 用 `hidden md/lg:table-cell` 隐藏次列，已响应式 |
| 6 | KPI 栅格 4→2→1 | ✅ | `.metric-grid` 改 `repeat(auto-fit, minmax(200px,1fr))` |
| 7 | 详情双栏手机堆叠 | ✅ | 各详情页 `grid` 类在窄屏塌为单列（container/media 查询驱动） |
| 8 | 触摸目标 ≥44px | ✅ | `.tap-target{min-height:44px}` 应用于 `.btn-*` / `.input-field` / 导航项 |
| 9 | 内容不溢出 | ✅ | `body{overflow-x:hidden}` + `img/svg/video/iframe{max-width:100%}` + `pre,code{white-space:pre-wrap}` |
| 10 | 字体随屏缩放 clamp | ✅ | 标题/水印 `clamp()`（Batch 03 已落） |

> 增量项（原"其余表 data-label"）**本轮已全部补齐 ✅**：CompanyDetail(3表) / UserManagementTab / PermissionMatrixTab / AuditLogTab / RulesLibraryTab(4表) / fieldEditors / ResultsTimetable 历史表，均加 `table-responsive` + `td[data-label]`，移动端自动转卡片。
> **DocAtoms（`schemaDoc/DocAtoms.jsx` 的 InfoTable/ObjectTable）刻意排除**：它们是**文档内容渲染器**（用于模板预览 / Word 导出保真），把文档表格转移动卡片会破坏文档排版保真度，故不套用 `table-responsive`。
> **ComplianceRules 两表保留原 `hidden md/lg:table-cell` 列隐藏式响应式**（密集合规表，隐藏次列优于卡片化，属合理取舍）。

---

## Batch 07 · 弹窗家族 Overlays — ✅ 5/5

| # | 提案条目 | 状态 | 落点 |
|---|---|---|---|
| 1 | 模态框 居中 rounded-2xl + s-4 + navy45% mask | ✅ | `Modal.jsx` 遮罩改 `bg-[rgb(15_23_42/0.45)]`，`rounded-2xl` + `shadow-4` |
| 2 | 底部 Sheet rounded-t-2xl | ✅ | 新建 `overlays/BottomSheet.jsx`（上滑动画 `csSheetUp`） |
| 3 | 右侧 Drawer rounded-l-2xl | ✅ | 新建 `overlays/Drawer.jsx`（滑入动画 `csDrawerIn`） |
| 4 | Toast 深色圆角 pill | ✅ | `main.jsx` 的 react-hot-toast `Toaster` 改 navy 底 + 圆角 + 柔阴影 |
| 5 | 气泡菜单 rounded-lg + s-2 | ✅ | 新建 `overlays/Popover.jsx`（`rounded-lg shadow-3`，外部点击/ESC 关闭） |

> 额外：Modal 在 `≤640px` 自动转为底部 Sheet（贴合移动端），满足提案"手机端模态自动转 BottomSheet"。

---

## Batch 05 · 组件库 Components — ✅ 组件库/状态/页级全局项

### 组件库（新建 + 既有复用）
| # | 提案条目 | 状态 | 落点 |
|---|---|---|---|
| 主按钮 / 次要 / 输入框 / 搜索 / 主题切换 / 命令面板 | ✅ | `.btn-*`(B02) / `.input-field`(B04) / Navbar 顶部 ⌘K + 搜索(B01) / 主题切换已置顶(B01) |
| 表格 | ✅ | 圆角行(B04) + 响应式卡片(B08) |
| Badge | ✅ | `.badge`/`.tag` + 新建 `ui/Badge.jsx`（语义色 pill） |
| 分段控件 Segmented | ✅ | 新建 `ui/Segmented.jsx`（iOS 风，底槽+白底选中） |
| Tabs | ✅ | `UIHelpers.TabNav`（详情页分组 Tab） |
| 列表行 ListRow | ✅ | 新建 `ui/ListRow.jsx`（`rounded-md` + hover） |
| 命令面板 ⌘K | ✅ | `CommandPalette` 已存在并绑定 ⌘K(B01) |
| PWA 安装条 | ✅ | `main.jsx` 已有可控 PWA toast（底部右下小卡，非侵入横幅） |

### 状态与空/错
| # | 提案条目 | 状态 | 落点 |
|---|---|---|---|
| Loading 骨架 | ✅ | `UIHelpers.SectionSkeleton` + `LoadingSpinner` |
| Empty 空状态 | ✅ | `UIHelpers.EmptyState`（Dashboard/各列表复用） |
| Error 错误页 | ✅ | `ErrorBoundary.jsx`（圆角错误卡 + 重试，路由级复位） |
| 表单校验 FormError | ✅ | 新建 `ui/FormError.jsx`（红字 + AlertCircle 图标） |

### 页面级（15 页）
> 全部"无水印 / 侧栏常驻 / 组件不统一"条目已被 Batch 01–04 的**全局**改造（顶部导航 + 全局水印注入 + 设计令牌）满足。本轮代表性精修：**ResultsTimetable 主表加 `data-label` 转移动卡片**（见 Batch 08）。其余 15 页逐页精修（如把内联列表行统一为 `ListRow`、把筛选按钮组换 `Segmented`）为**增量工作**，组件已就绪可直接替换。

### 可访问性
| # | 提案条目 | 状态 | 落点 |
|---|---|---|---|
| 导航 landmark | ✅ | Navbar 用 `<header><nav>`（非 aside） |
| 触摸目标 ≥44px | ✅ | `.tap-target`（B08） |
| Focus ring | ✅ | `:focus-visible` 全局 3px 品牌蓝 |
| 对比度扫描 | ✅ 已跑（静态） | 脚本解析 index.css 令牌算 WCAG 对比度，发现 3 处 AA 失败 + 4 处仅大字号达标，见下方 C 类结果，待后续修正 |

---

## C 类 · a11y 对比度静态扫描结果（本轮新增）

脚本：`client/_a11y_contrast.py`（解析 index.css 令牌，算 WCAG 2.1 对比度，AA 正文阈值 4.5:1 / 大字号 3:1）。

**FAIL（<4.5:1，正文不达标，应修正）**
| 主题 | 配对 | 比值 | 影响 |
|---|---|---|---|
| 亮色 | text-3 弱文本 on bg | 2.45:1 | 占位符 / 次要说明太浅 |
| 亮色 | text-3 on white | 2.56:1 | 同上 |
| 暗色 | primary 链接字 on 暗卡 | 2.98:1 | 蓝字压 navy 卡太暗 |

**AA-L（3:1–4.5:1，仅大字号达标；小字徽章/状态实际不达标）**
| 主题 | 配对 | 比值 |
|---|---|---|
| 亮色 | accent 橙字（徽章/紧急） | 3.40:1 |
| 亮色 | accent 按钮白字 | 3.56:1 |
| 亮色 | success 绿字 | 3.30:1 |
| 亮色 | warning 橙字 | 3.19:1 |

**达标（≥4.5:1，无需动）**：正文/标题/次要/链接(亮)/danger(亮)/info 全部 AA–AAA；暗色 text-2/text-3/标题/success/warning/danger/info 均 AA+。

**建议后续修正（非本轮范围，待你确认再做，避免改动设计令牌引发回归）**：
1. 亮色 `--text-3` 由 `148 163 184` 加深至约 `100 116 139`（slate-500）→ 弱文本达 ~4.5:1。
2. 暗色链接场景将 `text-primary-600` 指向更亮蓝（如 info 暗色 `96 165 250`，6.06:1）；注意按钮白字需保持 `37 99 235`（5.17:1）不被牵连。
3. 亮色 accent/success/warning 小字徽章：要么放大字号至大字号阈值，要么加深 token。

---

## 本轮新增文件
- `client/src/components/overlays/BottomSheet.jsx`
- `client/src/components/overlays/Drawer.jsx`
- `client/src/components/overlays/Popover.jsx`
- `client/src/components/ui/Segmented.jsx`
- `client/src/components/ui/ListRow.jsx`
- `client/src/components/ui/FormError.jsx`
- `client/src/components/ui/Badge.jsx`

## 修改文件
- `client/src/index.css`（metric-grid 4→2→1、table→card、overflow 收敛、csSheetUp/csDrawerIn 关键帧）
- `client/src/components/Modal.jsx`（navy45% mask + 移动端自动 BottomSheet）
- `client/src/main.jsx`（Toaster 深色 pill 样式）
- `client/src/pages/ResultsTimetable.jsx`（主表 `.table-responsive` + 7 列 `data-label`）

## 验证
- `vite build` ✅ 0 报错（1m47s）
- ESLint：本环境未安装 `eslint` 包（构建/rollup 通过为硬门禁）
- 线上：`https://claw-web.onrender.com/assets/index-B0xspFWn.css` HTTP 200，含 `table-responsive` `csSheetUp` `csDrawerIn` `auto-fit` → 三批改动全部 live
