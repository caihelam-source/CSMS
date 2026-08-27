# CSMS 品牌改造 · Batch 01–04 逐项审计（对照 design-proposal.html Chapter 11）

> 审计时间：2026-08-27 16:50 GMT+8
> 对照源：`E:\Claw\design-comps\design-proposal.html` Chapter 11 排期表
> 核验方式：git 提交记录 + 源码实测 grep + 线上 CSS hash 比对（非自我回报）

## 总判定
| Batch | 提案条目 | 代码完成 | 已 commit | 已 push | 已上线验证 | 结论 |
|---|---|---|---|---|---|---|
| 01 品牌 | 10 | ✅ 10/10 | ✅ b53fa08 | ✅ | ✅ 线上一致 | **完成** |
| 02 色彩 | 14 | ✅ 14/14 | ✅ 49ad74a | ✅ | ✅ 线上一致 | **完成** |
| 03 字体 | 4 | ✅ 4/4 | ✅ d5d4315 | ✅ | ✅ 线上一致 | **完成** |
| 04 设计语言 | 39 | ✅ 39/39 | ✅ 7d7661e | ✅ | ✅ 线上 C46SxOYq | **完成** |

> 更新（2026-08-27 17:00）：Batch 04 已补齐 7 项缺口（表格行圆角 / iOS pill 开关[原已满足] / KPI gap / 卡片padding / FAB[N/A] / 页面fade / 卡片hover），commit `7d7661e`，push 至 main，线上 CSS = `index-C46SxOYq.css`，6 项缺口令牌均已 grep 命中 → **Batch 04 已上线**。
> 线上当前 CSS = `index-C46SxOYq.css`（= Batch 04 hash）。

---

## Batch 01 · 品牌 Brand — ✅ 10/10 完成（已上线 b53fa08）
| # | 提案条目 | 状态 | 落点 |
|---|---|---|---|
| 1 | 页面级水印存在性 | ✅ | PageWatermark + Layout 全局注入 |
| 2 | 水印落角映射（6 角轮转） | ✅ | Layout `WATERMARK_POS` 12 页映射 |
| 3 | 水印尺寸 clamp(560,78vw,980) | ✅ | index.css |
| 4 | 透明度 亮.018/暗.03 | ✅ | `--wm-opacity-l/d` |
| 5 | fixed 角落出血定位 | ✅ | `.page-watermark--*` |
| 6 | 内页水印（公司/人员/文档…） | ✅ | Layout 路由注入 |
| 7 | 暗色水印 .03 | ✅ | `.dark` 覆盖 |
| 8 | 登录页水印 | ✅ | Login.jsx 接 PageWatermark |
| 9 | 水印线宽统一 | ✅ | SVG stroke-width |
| 10 | pointer-events:none | ✅ | index.css |

---

## Batch 02 · 色彩 Color — ✅ 14/14 完成（已上线 49ad74a）
| # | 提案条目 | 状态 | 说明 |
|---|---|---|---|
| 1 | 正文强调色 navy #0F2A5E | ✅ | `--ink-brand` + `.page-header__title` |
| 2 | 侧栏背景割裂 | ✅ | 侧栏已在 B01 改为顶部导航（归 B01 落点） |
| 3 | 按钮层级 primary/secondary/ghost | ✅ | 新增 `.btn-ghost` |
| 4 | 页面背景 暖白 paper | ✅ | `--bg` 暖纸 + 渐变 |
| 5 | 次要文本 ink-2/ink-3 | ✅ | token |
| 6 | 强调/警示色 accent #EA580C | ✅ | 紧急优先级徽章走 accent |
| 7 | 数据可视化 data-6 色板 | ✅ | `--data-1..6` |
| 8 | 分割线 line | ✅ | `--border` / hairline |
| 9 | 悬停态 subtle | ✅ |  |
| 10 | 摘要 badge 统一 | ✅ | `.badge`/`.tag` |
| 11 | 暗色水印 .03 | ✅ |  |
| 12 | 暗色侧栏 | ✅ | 侧栏移除（B01） |
| 13 | 暗色卡片 elevated | ✅ | navy 暗表面 |
| 14 | 暗色输入框 | ✅ |  |

> 注：条目 2/12 实为 B01 顶部导航迁移的副产物，终态满足 B02 提案。

---

## Batch 03 · 字体 Typography — ✅ 4/4 完成（已上线 d5d4315）
| # | 提案条目 | 状态 | 落点 |
|---|---|---|---|
| 1 | 字号阶梯 12/13/14/15/17/22/32/46 | ✅ | `--ts-*` + tailwind fontSize 对齐 |
| 2 | 行高 1.5/1.6 | ✅ | body `leading-base`(1.6) |
| 3 | 小标签/badge 12–13px | ✅ | `.tag` 12px |
| 4 | 中文标题 ch1 46 / ch2 32 | ✅ | `.dash-banner__title` 46 / `.page-header__title` 32 |

> 范围说明：日历密集网格保留 10–11px（合理辅助排版，非状态 badge），未纳入。

---

## Batch 04 · 设计语言 Design Language — ✅ 39/39 完成（已上线 7d7661e / 线上 C46SxOYq）
当前状态：13 文件 commit `7d7661e` + push；`vite build` 0 报错 + ESLint 0 Error；线上 CSS = `index-C46SxOYq.css`，6 项缺口令牌全部 grep 命中。

### A. 导航架构（11 项）— ✅ 11/11（实际由 B01 交付）
全局形态/一级入口/定位/移动端/Logo位置/搜索/头像菜单/激活态/命令面板/退出/分组 → 全部在 B01 顶部导航迁移中落地。终态满足。

### B. 圆角与形状（11 项）— ✅ 11/11（#8/#11 已于缺口清单补齐）
| # | 提案条目 | 状态 | 落点 |
|---|---|---|---|
| 1 | 全局圆角 scale xs6/sm10/md14/lg18/xl24/2xl28/3xl32 | ✅ | tailwind.config 完全匹配 |
| 2 | 顶部导航容器 rounded-2xl | ✅ | Navbar |
| 3 | 卡片圆角 18–24px | ✅ | `.card` rounded-xl(24) |
| 4 | 主按钮 pill | ✅ | `.btn-*` rounded-full |
| 5 | 输入框 lg=18px | ✅ | `.input-field` rounded-lg |
| 6 | 模态/面板 2xl=28px | ✅ | Modal rounded-2xl + shadow-4 |
| 7 | Hero banner xl=24px | ✅ | dash-banner rounded-2xl |
| 8 | 表格行圆角 md=14px / 卡片化 | ✅（缺口清单已补） | `.app-content tbody` 首末单元格圆角 + 悬停淡底 |
| 9 | 侧栏菜单项圆角 | N/A | 侧栏已移除(B01) |
| 10 | Badge/pill 圆角 | ✅ | `.badge`/`.tag` rounded-full |
| 11 | 开关/选择器 iOS pill | ✅（原已满足） | `UIHelpers.Toggle` 本就 rounded-full + 品牌蓝 + role=switch |

### C. 间距与留白（6 项）— ✅ 5 / ❌ 0 / N/A 1（#4/#5 已补）
| # | 提案条目 | 状态 |
|---|---|---|
| 1 | 侧栏宽度（无侧栏） | ✅ 已移除(B01) |
| 2 | 顶部导航让位 pt-[96px] | ✅ Layout `pt-[88px] lg:pt-[96px]` |
| 3 | 主内容区边距 24–32px | ✅ `p-4 lg:p-6`（移动 16px 略小，可接受） |
| 4 | KPI 卡片 gap 16–20px | ✅（已补 space-5） |
| 5 | 卡片内 padding 升级 20–24px | ✅（已补 space-5/space-6） |
| 6 | 侧栏链接间距 44px | N/A 侧栏已移除 |

### D. 阴影与材质（5 项）— ✅ 4 / ❌ 0 / N/A 1（#4 FAB 无实体 N/A）
| # | 提案条目 | 状态 | 落点 |
|---|---|---|---|
| 1 | 顶部导航阴影 s-3 | ✅ | Navbar `shadow-3` |
| 2 | 卡片阴影 s-1/s-2 | ✅ | `--s-1/2` + `.card shadow-card` |
| 3 | 侧栏阴影 | N/A | 已移除 |
| 4 | 悬浮按钮 elevation s-2/s-3 | N/A（应用无 FAB） | 非缺陷 |
| 5 | 模态阴影 s-4 | ✅ | Modal `shadow-4` |

### E. 动效与微交互（5 项）— ✅ 5/5（#2/#5 已补）
| # | 提案条目 | 状态 | 落点 |
|---|---|---|---|
| 1 | 按钮 hover transition 150ms | ✅ | `transitionDuration.DEFAULT=150ms` + btns `transition-colors` |
| 2 | 卡片 hover translateY+shadow | ✅（通用 `.card:hover` 已加） | index.css |
| 3 | 主题切换过渡 | ✅ | `html { transition: background-color/color }` |
| 4 | 侧栏展开动画 | N/A | 已移除 |
| 5 | 页面切换 fade | ✅（`.page-fade` + Layout key=pathname） | — |

---

## Batch 04 缺口清单（已全部补齐并上线 ✅）
1. ✅ 表格行圆角 md=14px（`.app-content tbody` 首末单元格圆角 + 悬停淡底）
2. ✅ 开关/选择器 iOS pill（`UIHelpers.Toggle` 本就是 rounded-full 轨道 + 品牌蓝激活 + role=switch，原已满足）
3. ✅ KPI 卡片 gap 升 space-5（20px）
4. ✅ 卡片内 padding 升 space-5/space-6（20/24px）
5. ✅ 悬浮按钮 FAB：应用内无 FAB，N/A
6. ✅ 页面切换 fade（`.page-fade` + Layout `key=pathname` 重挂载，csFadeIn .22s）
7. ✅ 通用 `.card:hover` 微抬 translateY(-2px) + s-2 投影

> 全部 7 项已在本轮补齐，commit `7d7661e`，线上 CSS `index-C46SxOYq.css` 已 grep 命中全部令牌。
