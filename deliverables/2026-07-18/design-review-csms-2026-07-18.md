# CSMS 视觉审查报告 + 生产级 HTML/CSS 落地规划

> **角色**：设计顾问 gstack-designer（设计师）
> **日期**：2026-07-18
> **范围**：仅产出「计划文档」——不修改任何业务代码，不 Write 任何 `.html`/`.css` 实际文件。
> **目标品牌色**：蓝（主色 / 结构色）+ 白（背景）+ 橙（点缀 / 行动色）
> **交付对象**：3 个对外营销页（项目内大概率尚未建立，属新建）——① 首页 Landing ② 定价页 Pricing ③ 产品详情页 Product Detail

---

## 0. 依据文件与已确认事实

| 文件 | 用途 | 关键发现 |
|---|---|---|
| `client/tailwind.config.js` | 设计令牌源 | 已有 `primary` 蓝 50–900、`success/warning/danger/info` 语义色、`canvas/surface/ink*/hairline` 中性令牌、`darkMode:'class'`、圆角 `xl=14px / 2xl=18px`、柔和阴影 `card/card-hover` |
| `client/src/index.css` | 全局令牌与组件类 | `:root` 以 RGB 通道存色、`.dark` 覆盖变量（暗色已就绪）；含 `.btn-*`/`.card`/`.input-field`/`.badge-*`/字阶工具类；`body` 已加 `antialiased` |
| `client/index.html` | 入口 | ❗ `viewport` **无 `viewport-fit=cover`** → `env()` 安全区失效（对应 F1） |
| `client/src/components/Layout.jsx` | 布局 | `<main className="flex-1 p-4 lg:p-6">` ❗**无安全区 padding**；无 `overflow-x` 守卫 |
| `client/src/components/Navbar.jsx` | 导航 | 触控目标 `py-2.5`(~40px)/`py-2`(~32px) ❗**< 44pt**；公司名 `truncate` 截断；`aria-label` 已部分覆盖 |
| `deliverables/2026-07-17/UX-RESEARCH-2026-07-17.md` | 体验痛点 | F1 移动端遮挡/截断 🔴、F2 闭环断裂、F3/F4 文件归属；研究员增补：触控≥44pt、禁横向滚动、对比度≥3:1、响应式 spacing token |
| `deliverables/2026-07-17/DECISION-MENU-2026-07-17.md` | 设计冻结决策 | E4= PWA（不建原生 App）、D-W1= H5-in-WeChat；设计已冻结，营销页为**新增表面**，须继承既有令牌 |
| `deliverables/UI-DESIGN-REVIEW-2026-07-16.md` | 既有设计评审 | 已驱动 M3.2（彩虹卡改语义色）、M3.5（硬编码色收敛进 token）；本报告在其基础上**补营销页 + 橙色品牌令牌 + a11y 缺口** |

**三条对齐结论（与既有设计系统一致，不推翻）**
1. 既有系统已是「Apple 风：中性画布 + 单一蓝强调 + 留白」——营销页应延续，而非另起炉灶。
2. **橙色目前仅作 `warning` 语义色（`--c-warning: 255 159 10`），并非品牌行动色**——这是与用户「橙=点缀/行动色」目标的最大缺口，须新增独立的 `--accent` 品牌橙令牌。
3. F1 移动端安全区 / 触控 / 横向滚动欠债在营销页**从第一天就须规避**（新建页无历史包袱，应直接做对）。

---

# Part A — 视觉审查报告

## A.1 当前设计体系盘点

### 颜色令牌现状（来自 `tailwind.config.js` + `index.css`）

| 类别 | 令牌 | 值（亮色） | 与品牌目标的对齐 |
|---|---|---|---|
| 主色蓝 | `primary-500/600` | `#0a84ff` / `#0071e3` | ✅ 已系统落地，可作结构色 |
| 主色蓝梯度 | `primary-50…900` | 完整 10 级 | ✅ 明度梯度齐备 |
| 中性画布 | `--bg` | `#f5f5f7` | ✅ Apple 灰白 |
| 表面 | `--surface` | `#ffffff` | ✅ 白背景到位 |
| 文字 | `text-1/2/3` | `#1d1d1f / #6e6e73 / #86868b` | ⚠️ `text-3` 浅灰在小字下对比度存疑（见 A.2.4） |
| 发丝边框 | `--border` | `#e3e3e6` | ✅ |
| 语义色 | `success/warning/danger/info` | 绿/橙/红/蓝 | ✅ 仅承载状态 |
| **品牌橙（行动）** | — | **无独立令牌** | ❌ **缺口**：橙仅作 warning，无 `--accent` |

### 字体 / 间距 / 断点现状

| 维度 | 现状 | 缺口 |
|---|---|---|
| 字体栈 | `body` 仅默认栈 + `antialiased` + `font-feature-settings`，**未定义显式 `fontFamily`** | ❌ 缺中文字族回退（vc 用简体中文：PingFang SC / Microsoft YaHei / Noto Sans SC） |
| 字阶 | `.page-title(text-2xl)` / `.section-title(text-base)` / `.text-muted(text-sm)` / `.text-caption(text-xs)` | ⚠️ 仅 4 级，无 `hero h1`（营销首屏需 48–64px）、无 `text-lg` 区块标题 |
| 间距 | `p-4(16)/p-6(24)/gap-4(16)/space-y-6(24)`，基本 8pt 倍数 | ✅ 近似 8pt；但**无统一 section 间距令牌**，营销页需 `section-y` |
| 断点 | Tailwind 默认 `sm(640)/md(768)/lg(1024)/xl(1280)` | ✅ 够用；营销页加 `2xl(1536)` 控制最大宽度 |
| 圆角 | `xl=14px / 2xl=18px` | ✅ 统一 |
| 阴影 | `card`（极柔）/ `card-hover` | ✅ 单一深度，符合 Apple 克制 |

## A.2 四维度审查表

> 严重度：🔴 Critical（阻断/合规风险）｜🟠 Major（明显体验损失）｜🟡 Minor（润色）｜🟢 已达标

### A.2.1 颜色

| 项 | 现状 | 问题 | 改进建议 | 严重度 |
|---|---|---|---|---|
| 品牌色系统落地 | 蓝（primary）全站系统落地；白（surface/canvas）到位 | 橙未作为品牌色，仅 `warning` 语义 | 新增 `--accent` 橙品牌令牌（见 B.1），用于营销页 CTA / 高亮，与产品内蓝 CTA 形成「获客页=橙、产品内=蓝」的层级区分 | 🟠 |
| 主色蓝明度梯度 | 50–900 完整 | 达标 | 维持；营销页 hero 可用 `primary-600` 为基底、`primary-700` 悬停 | 🟢 |
| 橙作 CTA 对比 | 无橙 CTA | 若直接用 `#ff9f0a` 配白字，对比度仅 ~1.9:1，**严重不达标** | CTA 实底用更深橙 `#EA580C`（白字 ≈3.9:1，满足大号/粗体 AA）；高亮/描边用浅橙 `#F97316` | 🔴 |
| 中性灰阶 | canvas/surface/text-1/2/3/border 齐备 | `text-3(#86868b)` 在白底上对比度约 3.4:1，小字不达 AA(4.5) | `text-3` 仅用于≥18px 或装饰性三级说明；正文用 `text-2(#6e6e73 ≈4.6:1)` | 🟡 |

### A.2.2 排版

| 项 | 现状 | 问题 | 改进建议 | 严重度 |
|---|---|---|---|---|
| 字体栈 | 默认栈，无中文回退 | vc 用简体中文，iOS/Win 渲染不一致 | 定义 `--font-sans: -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif` | 🟠 |
| 字号阶梯 | 4 级（2xl/base/sm/xs） | 无 hero 大标题、无 `text-lg` | 建立 6 级营销字阶：`display(56px)/h1(40)/h2(28)/h3(20)/body(16)/caption(13)`（见 B.1 `--fs-*`） | 🟠 |
| 行高 / 字重 | 行高随 Tailwind 默认 | 中文正文行高建议 1.7、标题 1.2 | 加 `--lh-tight:1.2 / --lh-base:1.7`；中文用 `font-weight:600` 而非 700（避免黑体过粗） | 🟡 |
| 中文排版适配 | 无 `lang`/`letter-spacing` 优化 | 中文标题可加 `letter-spacing:-0.01em` 更紧凑 | `html lang="zh-CN"`；标题轻微负字距 | 🟡 |

### A.2.3 间距

| 项 | 现状 | 问题 | 改进建议 | 严重度 |
|---|---|---|---|---|
| 8pt 栅格 | 基本遵守（16/24 为主） | 偶有 `py-2.5(10)` 非 8 倍数 | 营销页严格 8pt：`4/8/12/16/24/32/48/64/96` 间距令牌（见 B.1） | 🟢 |
| section 间距 | 无统一区块间距 | 各页 section 间距易漂移 | 新增 `--space-section: 96px`（移动 64px）统一纵向节奏 | 🟡 |
| 卡片内边距 | `.card` 固定 `p-6(24)` | 达标 | 维持；营销页特性卡用 `p-6` 一致 | 🟢 |

### A.2.4 可访问性（a11y）

| 项 | 现状 | 问题 | 改进建议 | 严重度 |
|---|---|---|---|---|
| 对比度 | 蓝/白、文字梯度基本达标；橙 CTA 未定义 | 橙若浅则失败；`text-3` 小字存疑 | 按 A.2.1 定橙阶；用对比度工具验收（目标 WCAG AA：正文 4.5:1，大号 3:1） | 🔴 |
| 焦点可见 | 仅 `hover` 态；无 `:focus-visible` 环 | 键盘用户无可见焦点 | 全站加 `:focus-visible { outline: 2px solid var(--accent); outline-offset:2px }` | 🔴 |
| ARIA / 地标 | Navbar 有 `aria-label`；无 `skip-link` | 营销页长内容无跳转锚点 | `header/nav/main/section/article/footer` 地标 + `skip-link` 跳主内容 | 🟠 |
| 键盘导航 | 链接/按钮可 Tab | 汉堡菜单、定价切换需键盘可达 | 汉堡用 `<button aria-expanded>` + Esc 关闭；切换用 `role="tablist"` 或真实 `<button>` | 🟠 |
| 触摸目标 | `py-2.5`/`py-2` < 44pt | 移动端点不准（F1 研究员增补） | 所有可点元素 ≥ 44×44pt（`min-h-11 min-w-11`） | 🔴 |
| `prefers-reduced-motion` | 无 | 动效敏感用户不适 | 全局 `@media (prefers-reduced-motion: reduce){ *{animation/transition:none} }` | 🟡 |
| 安全区 / 横向滚动 | viewport 无 `viewport-fit=cover`；`<main>` 无安全区；无 `overflow-x` | 刘海/底栏遮挡、公司名截断（F1） | 见 B.4：加 `viewport-fit=cover` + `env()` padding + `overflow-x:hidden` | 🔴 |

## A.3 三个目标页面设计语言提案（蓝 + 白 + 橙叙事）

> 统一叙事：**蓝 = 信任与结构（专业 B2B），白 = 留白与清晰，橙 = 行动召唤（"立即试用 / 预约演示"）**。橙只出现在「该你行动」处，绝不泛滥（呼应既有「颜色只承载语义」原则）。

### ① 首页 Landing
- **信息架构**：Header（Logo + 导航 + 登录/CTA）→ Hero（主张 + 主 CTA 橙 + 副 CTA 蓝描边）→ 信任带（港股上市公司 LOGO 占位）→ 核心能力（3–4 卡片，蓝图标 + 白卡）→ 工作流（会议→签署→归档 闭环图）→ 数据/合规背书 → 定价入口 → FAQ → Footer。
- **首屏**：左侧大标题（`display 56px`）+ 副文案（text-2）+ 橙 CTA「免费试用」+ 蓝描边「看产品演示」；右侧产品界面抽象插画/截图。蓝作背景微渐变，橙作唯一行动点。
- **关键区块**：能力卡用白底 + `primary` 蓝图标（中性，不抢戏）；「合规零容错」背书区用浅蓝 `primary-50` 底。

### ② 定价页 Pricing
- **信息架构**：Header → 标题 → **月/年切换**（真实 `<button>`，橙高亮选中）→ 3 档套餐卡（Starter / Professional / Enterprise）→ 功能对比表 → FAQ → Footer。
- **首屏**：标题 + 切换器；推荐档（Professional）用橙描边 + 「最受欢迎」橙徽章，其余蓝/中性。
- **关键区块**：对比表在移动端转「逐档手风琴」；年付省 20% 用橙高亮。

### ③ 产品详情页 Product Detail
- **信息架构**：Header → 面包屑 → 模块 Hero（名称 + 一句话价值 + 橙 CTA）→ 功能要点（图文交替，蓝图标）→ 使用场景（港股合规事例）→ 与竞品/集成 → CTA 区 → 相关模块 → Footer。
- **关键区块**：图文交替用白/浅灰 `bg-canvas` 斑马分隔；场景卡片蓝语义色标注「合规状态」。

---

# Part B — 生产级 HTML/CSS 落地规划（Pretext 框架）

> **Pretext** = 语义化（Semantic）+ 移动优先（Mobile-First）+ 令牌驱动（Token-Driven）+ 渐进增强（Progressive Enhancement）。以下为实施规划，代码片段均为「规划示意」，落地时由工程师并入 `index.css` / `tailwind.config.js` 或营销页样式，**本次不产出独立文件**。

## B.1 设计令牌定义（`:root` CSS 自定义属性）

```css
:root {
  /* —— 品牌主色：蓝（结构/信任） —— */
  --color-primary-50:  #eef6ff;
  --color-primary-100: #d9ecff;
  --color-primary-300: #84bcff;
  --color-primary-500: #0a84ff;
  --color-primary-600: #0071e3;   /* 产品内主行动 / 结构色 */
  --color-primary-700: #005bbd;

  /* —— 品牌点缀：橙（行动召唤 / 高亮）★新增 —— */
  --color-accent-50:  #fff4ec;
  --color-accent-300: #fdba8c;
  --color-accent-500: #f97316;    /* 高亮 / 描边 / 渐变 */
  --color-accent-600: #ea580c;    /* CTA 实底（白字 ≈3.9:1，满足大号/粗体 AA） */
  --color-accent-700: #c2410c;

  /* —— 中性：白 / 灰阶 —— */
  --color-surface:    #ffffff;
  --color-canvas:     #f5f5f7;
  --color-canvas-2:   #ececf0;    /* 斑马分隔 */
  --color-ink-1:      #1d1d1f;    /* 主文字 */
  --color-ink-2:      #6e6e73;    /* 次文字（AA 4.6:1） */
  --color-ink-3:      #86868b;    /* 仅 ≥18px / 装饰 */
  --color-hairline:   #e3e3e6;

  /* —— 字体 —— */
  --font-sans: -apple-system, BlinkMacSystemFont, "PingFang SC",
               "Microsoft YaHei", "Noto Sans SC", "Segoe UI", Roboto, system-ui, sans-serif;

  /* —— 字号阶梯（营销 6 级） —— */
  --fs-display: 3.5rem;   /* 56px hero */
  --fs-h1: 2.5rem;        /* 40px */
  --fs-h2: 1.75rem;       /* 28px */
  --fs-h3: 1.25rem;       /* 20px */
  --fs-body: 1rem;        /* 16px */
  --fs-caption: 0.8125rem;/* 13px */

  /* —— 行高 —— */
  --lh-tight: 1.2;
  --lh-base: 1.7;         /* 中文正文 */

  /* —— 间距尺度（8pt 栅格） —— */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px;
  --space-section: 96px;  /* 桌面区块间距 */
  --space-section-sm: 64px; /* 移动区块间距 */

  /* —— 圆角 / 阴影 —— */
  --radius-card: 18px;    /* 2xl */
  --radius-btn: 14px;     /* xl */
  --shadow-card: 0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.03);
  --shadow-card-hover: 0 6px 20px rgba(0,0,0,.06);

  /* —— 安全区（需 viewport-fit=cover 才生效） —— */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

/* 暗色：复用既有 .dark 策略，补充橙阶 */
.dark {
  --color-canvas: #000000;
  --color-surface: #1c1c1e;
  --color-canvas-2: #161618;
  --color-ink-1: #f5f5f7;
  --color-ink-2: #98989d;
  --color-hairline: #38383a;
}
```

**关键决策**：橙色作为**独立 `--accent` 令牌**新增，不占用 `warning` 语义色，二者职责分离（橙=品牌行动，黄=系统警示）。

## B.2 Pretext 框架适配说明

| 原则 | 落地方式 |
|---|---|
| **语义化** | `header / nav / main / section / article / footer` 地标；列表用 `ul/li`；图标 `aria-hidden`；装饰图 `role="presentation"` |
| **移动优先** | 样式先写移动（单列、base 字号），再用 `min-width` 媒体查询逐级增强；容器 `max-w-6xl mx-auto px-4` |
| **令牌驱动** | 所有颜色/间距/圆角引用 `var(--*)` 或 Tailwind 令牌，**禁止硬编码 hex**（呼应 M3.5） |
| **命名约定** | 区块 `BEM`：`hero`、`hero__title`、`hero__cta`；Tailwind 工具类只用于布局微调；组件类（`.btn-primary` 等）沿用既有 |
| **渐进增强** | 无 JS 时内容可读（导航全展开 / 定价默认月付 / CTA 可用）；JS 仅增强交互 |

## B.3 三页面结构与组件清单

### 首页 Landing
```
<header class="site-header">          导航 + 登录 + [橙CTA]
<main>
  <section class="hero">              主张 + 主橙CTA + 蓝描边次CTA + 产品视觉
  <section class="trustbar">          港股上市公司 LOGO 占位带
  <section class="features">          3–4 张 .card（蓝图标 + 白底）
  <section class="workflow">          会议→签署→归档 三步闭环（蓝步骤线）
  <section class="proof">             合规背书（浅蓝 primary-50 底）
  <section class="pricing-teaser">    三档预览 + 「查看定价」蓝链接
  <section class="faq">               <details> 手风琴
<footer>
```
**组件**：`SiteHeader`、`Hero`、`FeatureCard`、`WorkflowStep`、`ProofBand`、`PricingTeaser`、`FaqItem`、`SiteFooter`、`Button(primary-accent / secondary-blue)`。

### 定价页 Pricing
```
<header>
<main>
  <section class="pricing-hero">      标题 + [月/年切换器]
  <section class="plans">             3× PlanCard（Professional 橙描边+徽章）
  <section class="compare">           功能对比表 → 移动端转手风琴
  <section class="faq">
<footer>
```
**组件**：`BillingToggle`、`PlanCard`、`CompareTable`、`FaqItem`。

### 产品详情页 Product Detail
```
<header>
<main>
  <nav class="breadcrumb">
  <section class="product-hero">      模块名 + 价值句 + 橙CTA
  <section class="features-alt">      图文交替（斑马 canvas/白）
  <section class="scenarios">         港股合规场景卡（蓝语义标）
  <section class="integration">       集成/API
  <section class="cta-band">          大橙 CTA 区
  <section class="related">           相关模块
<footer>
```
**组件**：`Breadcrumb`、`ProductHero`、`FeatureRow`、`ScenarioCard`、`CtaBand`、`RelatedModules`。

## B.4 响应式策略（直接修复 F1）

```css
/* 1) index.html viewport 必须改为： */
/* <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"> */

/* 2) 根容器禁横向滚动 */
html, body { overflow-x: hidden; max-width: 100%; }

/* 3) 安全区内边距（营销页 main / footer / 固定 CTA 条） */
.site-header { padding-top: var(--safe-top); }
main { padding-left: var(--safe-left); padding-right: var(--safe-right);
       padding-bottom: calc(var(--space-8) + var(--safe-bottom)); }
.fixed-cta-bar { bottom: 0; padding-bottom: var(--safe-bottom); }

/* 4) 触控目标 ≥ 44pt */
.btn-primary, .btn-secondary, .nav-link, .billing-toggle {
  min-height: 44px; min-width: 44px;
  display: inline-flex; align-items: center; justify-content: center;
}
```

| 断点 | 列布局 | 备注 |
|---|---|---|
| `<640` | 单列，区块间距 64px | 汉堡导航；对比表转手风琴 |
| `≥640` | 2 列（能力卡） | — |
| `≥1024` | 3–4 列；hero 左右分栏 | 桌面导航常驻 |
| `≥1280/1536` | `max-w-6xl` 居中，留白放大 | 控制行宽 ≤72ch 利于阅读 |

## B.5 无障碍实施清单

- [ ] `html lang="zh-CN"`；`skip-link` 跳至 `#main`（首个可聚焦元素，视觉隐藏但键盘可见）
- [ ] 所有 `interactive` 元素 `:focus-visible` 橙环：`outline:2px solid var(--color-accent-600); outline-offset:2px`
- [ ] 对比度验收：正文 `ink-2`(4.6:1)✅；橙 CTA 实底用 `accent-600`(白字 3.9:1，大号/粗体达标)；`ink-3` 仅 ≥18px
- [ ] 汉堡按钮：`aria-expanded` + `aria-controls` + Esc 关闭 + 焦点陷阱
- [ ] 定价切换：`role="group"` + 两个真实 `<button aria-pressed>`（非仅靠颜色区分，附文字「月付/年付」）
- [ ] 图标 `aria-hidden="true"`；信息图配 `<figcaption>` 或 `aria-label`
- [ ] 表单/CTA 有可访问名称；外部链接 `rel="noopener"`
- [ ] 动效守卫：`@media (prefers-reduced-motion: reduce){ *,*::before,*::after{ transition:none!important; animation:none!important } }`
- [ ] 公司名等截断改为「两行 + 展开」或 `title` 属性，保障读屏念全称（呼应 F1 研究员增补）

## B.6 实施步骤分解（工程师 Checklist）

1. **令牌**：将 B.1 的 `--accent` 橙阶 + 字体栈 + 营销字阶并入 `:root`（与既有蓝/中性令牌共存）；Tailwind 扩展 `accent` 色与 `fontFamily`。
2. **骨架**：写 3 页语义骨架（header/nav/main/section/footer + skip-link），移动优先单列。
3. **组件**：落地 `Button`/`Card`/`PlanCard`/`BillingToggle`/`FaqItem` 等，全部引用令牌。
4. **响应式**：加 `viewport-fit=cover`、安全区 padding、`overflow-x:hidden`、44pt 触控、断点列布局。
5. **a11y**：skip-link、focus-visible、ARIA、对比度验收、reduced-motion。
6. **交互**：汉堡导航、定价月/年切换、CTA hover/focus、scroll-reveal（尊重 reduced-motion）。
7. **验收**：Lighthouse a11y ≥ 90；键盘走查全页；真机（iPhone）测安全区与触控。

## B.7 基本交互规格（文字 + 伪代码，不写 JS 文件）

**导航汉堡（移动）**
```
on click toggle-btn:
  open = !open
  btn.aria-expanded = open
  nav.classList.toggle('is-open', open)
  if open: trap focus in nav; else: return focus to btn
on keydown Escape (when open): close(); btn.focus()
```

**定价月/年切换**
```
state billing = 'monthly' | 'annual'
on click annual-btn:  billing='annual'
on click monthly-btn: billing='monthly'
render: for each plan:
  price = billing==='annual' ? plan.price*0.8/12 : plan.price
  show "省 20%" badge only when annual
无 JS 降级：默认显示月付价，切换为增强项
```

**CTA hover / focus**
```
.btn-primary (橙):
  default:  bg accent-600, text white
  hover:    bg accent-700          (禁止仅靠颜色→同时略加深+微抬 shadow-card-hover)
  focus-visible: outline 2px accent-600 offset 2px
  active:   translateY(1px)
```

**Scroll reveal（渐进增强）**
```
IntersectionObserver 进入视口 → 加 .is-visible（opacity/translateY 过渡）
@media reduced-motion: 直接显示，跳过动画
```

---

# Part C — 待用户拍板的设计决策（5 项）

> 每项给「推荐方案 + 备选 + 影响」，请 vc / CEO 拍板。

### C1. 蓝主色色值
- **推荐**：沿用既有 Apple 蓝 `#0071e3`（primary-600）——与已上线产品零割裂，品牌连续。
- **备选**：迁移到 Tailwind `blue-600 #2563EB` / `blue-700 #1D4ED8`（更「企业 SaaS」观感，但需全站复刷令牌）。
- **影响**：推荐方案零改造成本、一致性最高；备选需同步产品内所有蓝引用，收益是更「商务」气质。

### C2. 橙点缀强度与用法
- **推荐**：橙仅作**营销页 CTA / 高亮**（新增 `--accent`），与产品内蓝 CTA 分层；产品内 `warning` 黄保持独立。
- **备选 A**：橙同时升级为产品内主 CTA 色（与蓝互换角色）。**备选 B**：橙只作极少量高亮，CTA 仍用蓝。
- **影响**：推荐方案清晰区分「获客表面 vs 产品表面」，且不同表面有记忆锚点；备选 A 改动大、混淆既有；备选 B 营销页行动感弱。

### C3. 深色模式是否覆盖营销页
- **推荐**：**继承**既有 `.dark` 令牌，营销页同步支持暗色（港股 CFO 常夜间查档，D-W 决策已定 PWA/H5）。
- **备选**：营销页仅亮色（实施更快）。
- **影响**：推荐方案一致性与专业度更高；备选省一时工时但破坏全站统一。

### C4. 字体栈（系统 vs 定制）
- **推荐**：系统栈 + 中文回退（`PingFang SC / Microsoft YaHei / Noto Sans SC`）——零加载、Apple 风、快。
- **备选**：引入定制 Web 字体（如 Inter + 思源黑体）——更统一但增 ~100KB、需授权/托管。
- **影响**：推荐方案性能与一致性最佳；备选仅在国际化/强品牌统一时有必要。

### C5. 营销页是否引入「双强调色」叙事
- **推荐**：蓝=结构/信任、橙=行动，双色各司其职（本文主方案）。
- **备选**：单色（仅蓝）更克制，但行动召唤弱。
- **影响**：推荐方案转化路径更清晰；备选更「安静」但 CTA 不够跳。

---

*设计顾问 gstack-designer ｜ 2026-07-18 ｜ 本文为计划文档，未改动任何业务代码、未产出 .html/.css 实际文件。*
