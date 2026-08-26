# CSMS — Design System & Brand Guidelines

> CSMS 香港公司秘书管理系统 · 品牌与界面设计规范
> 基线：Lumina 重设计（React + Vite + Tailwind，令牌驱动，明暗双主题）

本文件是 CSMS 品牌与界面的**单一事实源**。所有视觉产出（Logo、配色、字体、间距、组件）以本文件为准；前端实现统一引用 `src/index.css` 的设计令牌与 `<BrandLogo>` 组件。

---

## 1. Brand 品牌

| 项 | 值 |
|----|----|
| 主品牌名 / Logo 字标 | **CSMS**（唯一对外品牌名） |
| 中文品牌名 | 无（克拉 / 御册 均不采用） |
| 系统描述副标题 | **香港公司秘书管理系统 · Company Secretary Management System** |
| 内部代号 | Claw（仅作技术 / 产品代号，不出现在用户可见界面） |
| Slogan | 井然有序，合規無憂 / "Order in every entity." |
| 气质关键词 | 专业、可信、港式商务、稳重、现代、高效、合規、秩序 |

**命名规则**
- 标题、页头、合同、登录页一律用 `CSMS`；其下小字用系统描述副标题。
- 对外资料可写 `CSMS (Claw)` 表示底层系统，但 UI 文案不出现 `Claw`。

---

## 2. Logo — Direction A: Sealmark（印章）

**概念**：深蓝双环印章（权威 / 认证 / 可信）+ 品牌蓝粗体 `C`（开口向右，C = CSMS / Company）+ 一枚对勾（已核验 / 已盖章）。
**为什么是 A**：香港公司的「公司印章 / 钢印」是权威与认证的最强本土符号，最贴合「专业 · 可信 · 高大上 · 港式商务」；单色可复现、收缩到 16px 仍清晰。

### 2.1 Logo 家族

| 资产 | 文件 | 用途 |
|------|------|------|
| 图标版（App Icon / Favicon / Maskable） | `public/icon.svg` | 浏览器标签、PWA、移动主屏、导航小标 |
| 横版主 Logo | `public/logo-full.svg` | 登录页、页头、合同页眉、官网 |
| 反白版 | `public/logo-reversed.svg` | 深蓝底卡 / 深色模式区域 |

- `icon.svg`：64×64，深蓝方底 `#0F2A5E`（圆角 14）+ 白色描边印章。图形控制在中心 80% 安全区，可作 maskable。
- `logo-full.svg`：viewBox `330×64`，印章图标 + `CSMS` 字标（800）+ 副标题。
- `logo-reversed.svg`：viewBox `330×64`，深蓝卡底 `#0F2A5E` + 白描边 + 白字（副标题白 72% 透明）。

### 2.2 几何结构（可复现参数）

图标（`icon.svg`，64 网格）：
- 背景方：`<rect width="64" height="64" rx="14" fill="#0F2A5E"/>`
- 外环：`<circle cx="32" cy="32" r="20" fill="none" stroke="#FFFFFF" stroke-width="3"/>`
- `C` 弧：`<path d="M32 18 A14 14 0 1 0 32 46" fill="none" stroke="#FFFFFF" stroke-width="5.5" stroke-linecap="round"/>`
- 对勾：`<path d="M25 32 l5 5 l10 -11" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`

横版主标（`logo-full.svg`，左图标区 64 宽）：
- 外环 r26 `stroke #0F2A5E` 4px；内环 r21 `stroke #0F2A5E` 1.5px `@35%`
- `C` 弧 r16 `stroke #2563EB` 7px round；对勾 `stroke #2563EB` 2.5px
- 字标 `CSMS`：x≈72, y=40，Inter 800，size 30，`letter-spacing -1`，fill `#0F172A`
- 副标题：x≈73, y=54，Inter/中文栈，size 9.5，fill `#64748B`

### 2.3 留白与最小尺寸

- 安全留白：标志四周 ≥ 图标高度的 **1/2**；横版左右留白 ≥ 字标宽度的 **1/4**。
- 最小尺寸：图标 **16px**；字标最小高度 **18px**（低于则只用图标版）。
- 禁止：拉伸变形；加投影 / 渐变；`C` 与对勾改色（反白版除外）；在彩色照片上无底色直接使用。

---

## 3. Color 配色

既有 `src/index.css` 已用 RGB 通道存储令牌（支持 `rgb(var()/alpha)`）。新增 `--brand-navy`，其余沿用 Lumina 体系，**零架构改动**。

### 3.1 品牌色

| 角色 | HEX | RGB 通道 | CSS 变量 | 用途 |
|------|-----|----------|----------|------|
| Primary | `#2563EB` | `37 99 235` | `--color-primary` | 主操作、链接、Logo `C`/对勾主笔 |
| Primary hover | `#1D4ED8` | `29 78 216` | `--color-primary-hover` | 主按钮悬停 |
| **Navy 锚点** | `#0F2A5E` | `15 42 94` | `--brand-navy`（新增） | Logo 印章环、深色模式主文字、反白底、权威感来源 |
| Accent 橙 | `#EA580C` | `234 88 12` | `--color-accent` | 单一关键项 / 紧急待办 / 点缀，**占比 < 10%** |

### 3.2 中性（cool slate，沿用）

| 角色 | HEX | 变量 |
|------|-----|------|
| Ink（主文字） | `#0F172A` | `--text-1` |
| 次文字 | `#475569` | `--text-2` |
| 弱文字 | `#94A3B8` | `--text-3` |
| 边框 | `#E2E8F0` | `--border` |
| 表面 | `#FFFFFF` | `--surface` |
| 页面底 | `#F8FAFC` | `--bg` |

### 3.3 深色模式（沿用 `.dark`）

`--bg #0B1120` · `--surface #0F172A` · `--text-1 #F8FAFC` · `--text-2 #94A3B8` · `--border #1E293B`
（建议把深色主文字锚定到 navy 系 `--brand-navy` 以强化权威感。）

### 3.4 语义色（沿用）

Success `#16A34A` · Warning `#D97706` · Danger `#DC2626` · Info `#2563EB`

### 3.5 配色原则

- 蓝色为主（信任锚点），单色蓝阶最协调；橙仅作 5–10% 强调。
- 严禁红作品牌主色；深色模式背景用近黑深蓝（非纯黑 `#000`）。

---

## 4. Typography 字体

| 场景 | 字体 | 字重 | 备注 |
|------|------|------|------|
| 西文 / 数字 UI | **Inter** | 400 / 500 / 600 / 700 | B2B 信任感最强；数字用 `tabular-nums` 对齐 |
| 字标 `CSMS` | Inter | **800** | `letter-spacing -1%`；预算充足可换 General Sans / Söhne |
| 等宽数字（金额 / 日期 / 股份） | JetBrains Mono / IBM Plex Mono | 500 | 仅数据列，强化「精准」 |
| 中文界面 | PingFang SC → Microsoft YaHei → Noto Sans SC | 400 / 500 / 700 | 已在 `--font-sans`；中文避免 900（易糊） |

- 行高：中文 1.6，西文 1.5；大标题 `letter-spacing -0.02em`。
- 字号阶梯沿用现有 `--text-xs … --text-3xl` 与 `--fluid-*` 流体变量。

---

## 5. Spacing & Radius 间距与圆角

- 间距基数 **4px**（沿用 `--space-1 … --space-16`）；响应式用 `--fluid-*` 流体变量（320 → 2560+）。
- 圆角：`--radius-sm 6` / `--radius-md 8` / `--radius-lg 12` / `--radius-xl 16`；Logo 卡圆角 = `--radius-xl(16)`，图标方底圆角 14。
- 按钮圆角沿用 `rounded-2xl`；卡片 `rounded-2xl` + 发丝边 + 极柔阴影（单深度，不双重叠加）。

---

## 6. Motion 动效

- 时长：`--dur-fast 150ms` / `--dur-base 200ms` / `--dur-slow 300ms`。
- 缓动：`--ease cubic-bezier(.4,0,.2,1)`；入场 `cubic-bezier(.16,1,.3,1)`。
- Logo 可选微动效：登录页环形「描边 → 对勾盖章」一次性动画；须 `prefers-reduced-motion` 时禁用。

---

## 7. 前端替换清单（React + Vite + Tailwind）

**单一事实源**：新增共享组件 `<BrandLogo variant="full|icon|reversed" size="sm|md|lg"/>`，Login / Navbar / Dashboard 页头全部引用它，杜绝三处不一致。

| 文件 | 改动 |
|------|------|
| `index.html` | ① favicon `href` 从 `/vite.svg` → `/icon.svg`（当前 `/vite.svg` 缺失，须修）；② `apple-touch-icon` → `/icon.svg`；③ `<title>` → `CSMS · 香港公司秘书管理系统`；④ `theme-color` 保持 `#2563EB` |
| `public/icon.svg` | 已替换为 Sealmark（本仓 `icon.svg`） |
| `public/manifest.webmanifest` | `name` → `CSMS · 香港公司秘书管理系统`，`short_name` → `CSMS`，`theme_color` `#2563EB` |
| `src/index.css` | 新增 `--brand-navy:15 42 94;`；`.dark` 下主文字锚定 navy 系；橙 `--color-accent` 维持，仅 5–10% 处使用 |
| `tailwind.config.js` | `colors` 增加 `navy: 'rgb(var(--brand-navy))'` |
| `src/pages/Login.jsx` (~L58-65) | 删掉 `Briefcase`+蓝方块，改 `<BrandLogo variant="full" size="lg"/>`，副标题接 slogan「井然有序，合規無憂」 |
| `src/components/Navbar.jsx` (~L141-149) | 左上改 `<BrandLogo variant="full" size="sm"/>`；标题使用 `CSMS / 香港公司秘书管理系统` |
| `src/pages/Dashboard.jsx` (~L278-279) | `page-header__logo` 内 `Building2` 换 `<BrandLogo variant="icon"/>`；标题使用 `CSMS` |

**一致性验收**：favicon 是否生效 · 三处 Logo 是否同源 · 深色模式反白是否清晰 · 橙占比是否 < 10%。

---

## 8. Assets 资产清单

| 文件 | 路径 | 关键参数 |
|------|------|----------|
| 图标 / App Icon | `public/icon.svg` | 64×64，`#0F2A5E` 方底 rx14 + 白印章；maskable |
| 横版主 Logo | `public/logo-full.svg` | viewBox 330×64，印章 + `CSMS` 800 + 双语副标题 |
| 反白版 | `public/logo-reversed.svg` | viewBox 330×64，`#0F2A5E` 卡底 + 白描边 + 白字 |

### PNG 栅格化命令（环境无 GUI 栅格器时，任选其一，不阻塞流程）
```bash
# Inkscape（推荐，跨平台）
inkscape public/icon.svg --export-type=png -w 512 -h 512 -o public/icon-512.png
inkscape public/logo-full.svg --export-type=png -w 1320 -h 256 -o public/logo-full.png

# rsvg-convert（Linux/macOS，或 Windows 装 librsvg）
rsvg-convert -w 512 -h 512 public/icon.svg -o public/icon-512.png

# ImageMagick
magick convert -background none -density 384 public/icon.svg public/icon-512.png

# Node（如装了 sharp / @resvg/resvg-js）
npx -y @resvg/resvg-js public/icon.svg public/icon-512.png
```

---

*规范状态：提案已确认（方向 A / CSMS 主品牌 / 无中文品牌名）。本文件随 DESIGN.md 一并冻结，后续前端落地以第 7 节清单为准。*
