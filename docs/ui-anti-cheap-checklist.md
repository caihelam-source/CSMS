# Claw UI 反廉价清单（Anti-Cheap Checklist）

> 用途：交付任何 UI 改动前，按本清单逐条扫描，消除"一眼假 / 廉价感 / 塑料感"。
> 定位：VibeCoding 三支柱之「质感提升 (Anti-Cheap)」在 Claw 的具体落地；与 `ui-component-vocabulary.md`（命名）、`web-design-guidelines`（代码评审）互补，本表聚焦**观感质感**而非可达性/可达命名。
> 配套 Skill：`claw-ui-vibe`（加载后自动套用本表 + 三支柱编排）。
> 纪律：凡前端 PR/改动，必过本清单；任一条命中即视为"廉价信号"，需先修再交付。

---

## 一、反廉价扫描项（15 条，Claw / Tailwind / Lumina 专属）

| # | 廉价信号（一眼假） | 正确做法（Lumina 规范） | 检查方法 |
|---|-------------------|------------------------|----------|
| 1 | 裸 `shadow` / `shadow-lg` 乱用，无层次 | 用 `--s-1`(静止)→`--s-2`(悬停)→`--s-3`(弹出)→`--s-4`(模态) 分层；对应 `shadow-sm/md/lg` | grep `shadow` 是否只取 sm/md/lg |
| 2 | 纯色平铺主按钮，无 hover/按压态 | 按钮基类 `.btn-*` 已含 `hover:` + `active:scale(.96)` 弹簧；禁止 `bg-blue-500` 直接裸用 | 主按钮是否有按压反馈 |
| 3 | 字体随意 `text-[15px]` 脱离字阶 | 统一 `--ts-12/12.5/13/14/15/17/22/32/46` 刻度；正文 14/15、标题 22+ | grep `text-\[` 魔法字号 |
| 4 | 后台页面内容全居中 | 数据类**左对齐**；数值列 `tabular-nums` 对齐（`.table-responsive td` 已加） | 表格/列表是否该左对齐却居中 |
| 5 | 圆角不一致（有的地方 4px 有的地方 24px） | 统一 Lumina `--radius-*`：卡片 `lg(18)` / 按钮 `full` / 弹窗 `xl(24)` | 同屏圆角是否同族 |
| 6 | 间距魔法数字（`mt-7 mr-3` 无节奏） | 用 `--space-1..16`（4px 基准）；批量用 `gap-*` | grep 散落 margin |
| 7 | 默认灰→彩渐变 / 彩虹渐变 | 渐变克制：单色蓝或 `navy→blue`；禁止 `from-gray-200 to-blue-500` 默认式 | 渐变是否品牌内 |
| 8 | 冷冰冰 `No data` / `Loading...` | 用 `EmptyState`（插图+CTA）/ `Skeleton`（占位高度≈真实） | 空/加载态是否有人情味 |
| 9 | 图标与文字基线不对齐 | lucide 统一 `size`，父级 `flex items-center gap-*` | 图标是否 vertical-center |
| 10 | 移动端宽表一滚全飞 | 用 `.table-responsive`（<768px 转卡片，间距 16px + `shadow-md` 浮起） | 窄屏表格是否卡片化 |
| 11 | 成功态瞬现无过程 | 对勾"绘制"而出（`.draw-check` csDraw 描边）；toast 非弹窗占屏 | 成功反馈是否有过程感 |
| 12 | 暗色模式靠 invert（近黑 slate） | 用 navy 调表面（`--surface:15 36 71`），非近黑；品牌锚点保留 | 暗色是否 navy 调 |
| 13 | 颜色对比不达 AA | 主色字换亮蓝（已修 a11y）；文字/背景 ≥ 4.5:1 | 对比度抽检 |
| 14 | `transition: all` 全属性动画 | 限定属性：`transition-colors` / `transition-transform` / `transition-shadow` | grep `transition-all` |
| 15 | 过度装饰（阴影+边框+渐变+发光叠满） | 留白即设计；一处焦点一个强调；非必要不加框 | 单卡元素是否过载 |

---

## 二、质感预设（Taste Presets，替代"10 风格一键换皮"）

> 说明：Claw 是真实 SaaS（Lumina 设计系统 + 数据表格），**不允许整体换皮**。
> 改为"质感旋钮"——在 Lumina 框架内微调观感，安全且一致。给 AI 说"感觉"词，它调对应旋钮。

| 预设名 | 大白话感觉 | 旋钮调整 |
|--------|-----------|----------|
| 安静高级 Quiet Luxury | "安静、高级" | density↓、留白大、motion 弱、单色蓝、去边框 |
| 有冲击力 High Impact | "有冲击力" | motion 强（弹簧曲线）、对比强、accent 橙点缀、重点加 `shadow-3` |
| 温暖手作 Warm Craft | "温暖、手作感" | 暖灰 surface、amber accent、圆角偏大（xl）、微纹理 |
| 科技精密 Tech Precision | "精密、专业" | 数据密集、tabular-nums、冷蓝、微动效、网格线细腻 |
| 极简 Minimal | "干净、克制" | 去边框、弱阴影、大留白、弱化分隔 |

**旋钮定义**（AI 调整时的实际取值）：
- `MOTION_INTENSITY` 1–5：1=仅 hover 色彩，3=微抬+弹簧，5=强动效+overshoot
- `VISUAL_DENSITY` 1–10：后台默认 6（数据密集），落地页可 4
- `WARMTH` 0–1：0=冷蓝中性，1=暖灰+amber
- `CONTRAST` 0–1：影响 accent 显隐与分隔线深浅

---

## 三、行业配色系统（Color System，自动匹配主色）

> 主色永远从 Lumina 取（`--color-primary:37 99 235` 蓝），accent 按业务微调。

| 业务类型 | 主色 | accent | 备注 |
|---------|------|--------|------|
| 企业秘书 / 合规（CSMS 本体） | Lumina 蓝 #2563EB | 品牌橙 #C2410C | navy 锚点 #0F2A5E 作权威感 |
| 金融 / 财报 | 蓝 | 红涨(#DC2626)绿跌(#16A34A) | 遵循 CN 红涨绿跌 |
| 法务 | navy #0F2A5E | 金 #B45309 | 权威、稳重 |
| SaaS 工具 | 蓝紫 #6366F1 | 蓝 | 现代、轻 |
| 文档 / 知识库 | 蓝 | 青 #0D9488 | 安静、可读 |

---

## 四、大白话迭代映射（Plain-English → Design Action）

初稿不满意，直接说人话，AI 翻译成设计调整：

| 你的指令 | AI 理解（Design Action） |
|---------|--------------------------|
| 再大胆点 | `MOTION_INTENSITY` +1、对比+、accent 更显、重点 `shadow-3` |
| 收一收 | `VISUAL_DENSITY`↓、`MOTION_INTENSITY`↓、去装饰边框、留白↑ |
| 换个风格 | 切第二节某质感预设（不整体换皮） |
| 再充实点 | `VISUAL_DENSITY`↑、加内容块、避免页面太空 |
| 更安静 | 切 Quiet Luxury / Minimal，`MOTION_INTENSITY`→1 |
| 暖一点 | `WARMTH`↑、amber accent、圆角 xl |

---

## 五、三支柱编排（一个 Skill 搞定高级 UI）

VibeCoding = 审美判断 + 质感提升 + 实践经验。Claw 落地映射：

```
① 审美判断  (Aesthetic Judgment)  ← design-taste-frontend  （已装 user-level）
② 质感提升  (Anti-Cheap)           ← 本文档（反廉价清单 + 质感预设 + 配色系统）
③ 实践经验  (Practical Know-how)   ← web-design-guidelines（代码评审）+ ui-component-vocabulary（命名/四要素）
④ 统一规范  (Design System)        ← Lumina 令牌（index.css，单一事实源）
```

**3 步大白话输入契约**（替代专业术语）：
```
What   : 要做什么？（页面类型：落地页/后台/详情/列表）
Feel   : 想要什么感觉？（一两个词：安静高级 / 有冲击力 / 温暖）
Ref    : 有没有参照？（可选：参考站 或 "别做得像模板"）
```
AI 收到后：查 `ui-component-vocabulary.md` 取精确名 → 套四要素补全 → 按 `Feel` 选调质预设 → 落地 → 过本清单反廉价扫描 → 跑 `web-design-guidelines` 代码评审。

---

## 六、使用约定

1. 前端 PR 前必过第一节 15 条；命中任一条先修。
2. 给 AI 的 UI 需求用"3 步大白话"开头，AI 自动编排四支柱。
3. 新增廉价信号 → 补第一节一行；新增质感预设 → 补第二节；同步 `claw-ui-vibe` Skill。
4. 本表与 `ui-component-vocabulary.md` 同为团队共享事实源，已入库。
