# CSMS 移动端 / 微信端使用架构附录（部分工作流）

> 架构师：高见远（Gao）｜ 日期：2026-07-17
> 输入：① `ARCH-ROADMAP-2026-07-17.md`（C.3 PWA / C.4 小程序 BFF / C.1 多实体 / B 认证 / A 技术栈）② 认证与存储代码实测 ③ `.workbuddy/memory/2026-07-17.md` "F1 移动端适配 — 代码级根因核查"
> 范围：仅架构分析，不修改任何业务代码。所有代码事实均来自 Read 实测，附证据见文末。
> 用户画像：Vincent，3 家港股上市公司（众安集团 672.HK / 中国新城市 1321.HK / 众安智慧服务 2271.HK）的 CFO + 公司秘书，常往返香港/上海/杭州，需在**手机浏览器 + 微信**里操作 CSMS：看合规提醒、签会议纪要、上传扫描件、归档。

---

## 0. 执行摘要（TL;DR）

| # | 核心判断 | 推荐动作 |
|---|---------|---------|
| 1 | **"手机能用"的地基是响应式 + PWA**：F1 五大根因（遮挡/贴底/触控<44pt/横溢/截断）必须先在 M3.6 修掉，否则微信 WebView 同样会遮挡。 | M3.6 先行；PWA manifest + service worker 离线缓存支撑"常飞弱网"看已加载纪要/文档。 |
| 2 | **微信内先走路径 A（H5-in-WeChat）**：复用 90% 现有 React 代码，最低成本，接微信网页授权 + JSSDK 拿身份与分享能力；原生小程序（路径 B）延后到 M4 作为增量。 | 现在做 A，B 等 M4；两条路径**共享同一套 JWT / SignTask 状态**（呼应 C.4）。 |
| 3 | **真实登录必须先修好**：演示自动登录在真机打真实后端时不可用；live 模式权限失效（嵌套 `user` 未展开）会让 Vincent 在手机上看不到后台/签不了字——这是 Phase 0 前置。 | 修认证响应契约 + 演示显式开关（呼应 ARCH-ROADMAP §0 #2、B.2）。 |
| 4 | **微信身份绑定走 openid↔User**：`wx.login`/`snsapi_base` 拿 openid，绑定到已有 CSMS `User`（按 `company` 归属，呼应 C.1 行级过滤）；新微信用户走 invite 兜底。 | openid 落 `User.wechatOpenid`；不因此放开注册（呼应 B.5）。 |
| 5 | **文件上传走 R2 预签名 URL**：当前 `r2.js` 直接返回**公开 URL**，违背安全加固方向——手机/微信上传扫描件、签字件必须用预签名 PUT，且 **BFF 隐藏 R2 细节**（呼应 C.4、B.5）。 | 新增 `POST /api/v1/upload/presign`；公开 URL 改为私有桶 + 短期预签名下载。 |

> 一句话结论：**先把 Web 在手机端"修好+可装+PWA"，再用同一套代码包一层微信网页授权跑在微信里；原生小程序是 M4 的增量而非起点。** 所有端以服务端 `SignTask`/`Document` 为唯一真相源。

---

## 1. 两条路径对比表（关键决策）

> 问题："客户在微信里用 CSMS，是做小程序还是直接在微信里打开网页？"

| 维度 | 路径 A：微信内 H5（响应式 Web 跑在微信 WebView） | 路径 B：微信原生小程序 |
|------|-----------------------------------------------|----------------------|
| 前端技术 | 现有 React 18 + Vite（复用 90%+） | 独立 WXML/WXSS（**非 React**，需重写） |
| 接入方式 | 微信**网页授权(OAuth2)** + JSSDK | `wx.login` → `code` → 后端换 `openid` → 绑 User → 签 JWT |
| 登录身份 | `snsapi_base` 静默拿 openid，或仍用 CSMS 账号登录 | 微信 `code` 换 `openid`，与 CSMS User 绑定 |
| 文件上传 | `<input type=file accept=image/* capture=camera>` 调相机；微信 WebView 基本支持但**偶有限制/进度回调不稳** | `wx.chooseImage`/`wx.chooseMessageFile` 原生文件选择器，体验更稳 |
| 分享能力 | JSSDK `updateAppMessageShareData` 自定义分享；需公众号**已认证 + JS 安全域名** | `onShareAppMessage` 原生卡片分享，无需 JSSDK 配置 |
| 离线/缓存 | 可接 PWA service worker（同 H5） | 仅 `wx.setStorage` 本地缓存，**无 service worker** |
| 发版成本 | 随 Web 部署（Render），**无需审核** | 每次发版过微信审核（1–7 天），迭代慢 |
| 与现有 Web 同步 | 同一套代码/路由/状态 | 独立前端，**需 BFF 聚合 + 状态对齐**（呼应 C.4） |
| 成本/周期 | **低**（周级） | 高（月级 + 审核） |
| 短板 | 微信 WebView 对部分 API（如系统级文件、蓝牙）受限；分享需公众号资质 | 复用度低、维护双端、审核阻塞 |
| **推荐度** | ⭐⭐⭐⭐⭐ **现在做** | ⭐⭐⭐ 延后到 M4 增量 |

**推荐结论**：**现在做路径 A（H5-in-WeChat）**，原生小程序（路径 B）延后到 M4 作为增量。理由——Vincent 的核心动作（看提醒、签纪要、传扫描件、归档）都是 Web 表单 + 文件上传，H5 已能覆盖；复用现有代码把"微信可用"的代价压到最低，先验证真实使用习惯，再按需补小程序。两条路径**共用同一套 JWT 与 `SignTask`/`Document` 状态**，不是两套系统。

---

## 2. 八个架构考量点

### 2.1 手机浏览器 / H5 使用前提：响应式 + PWA

**现状根因（F1，实测 `memory/2026-07-17.md`）**
- 根因1（遮挡）：`client/index.html:6` viewport 缺 `viewport-fit=cover` → `env(safe-area-inset-*)` 真机恒为 0，底部被导航栏/Home 条挡。
- 根因2（贴底）：`client/src/components/Layout.jsx:23` `<main className="flex-1 p-4 lg:p-6">` 无安全区底部 padding。
- 根因3（选中态弱）：`Navbar.jsx` NavItem 选中态仅 `bg-primary-50 text-primary-700`，抽屉里不醒目。
- 根因4（触控<44pt）：NavItem `py-2.5`≈40px、移动 toggle `p-2`+icon22≈38px，低于 44pt；全仓无 `overflow-x:hidden` 守卫，宽表小屏横向溢出。
- 根因5（截断）：Navbar 用户 footer `truncate` 同款"公司名/人名被省略号截断"。

> 这些根因在**微信 WebView 里同样成立**——微信内置浏览器也是 WebView，遮挡/安全区问题一点不少。所以"手机能用"= M3.6 响应式硬化是微信可用的**强前置**。

**推荐方案**
1. **响应式硬化（M3.6，呼应 T-3.6.1~5）**：
   - `index.html` viewport 加 `viewport-fit=cover, user-scalable=no`；
   - `Layout` 的 `<main>` 加 `pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]`；
   - 全局加 `overflow-x:hidden` 守卫（根容器），宽表改横向滚动容器而非整页溢出；
   - 所有可点击元素 `min-h-11`（44px）、`min-w-11`，抽屉 NavItem 选中态加加粗/左侧色条；
   - 公司名/人名改用 `truncate` + 点击展开详情，不再硬截断。
2. **PWA 渐进增强（呼应 ARCH-ROADMAP C.3）**：
   - `manifest.json`：`display:standalone`、`name:"CSMS"`、`icons`（192/512），可在手机主屏"安装"，Vincent 在港深杭通勤时像原生 App 一样点开；
   - `service worker`：缓存**应用壳 + 最近查看的会议纪要/合规提醒/文档元数据**（不含敏感原文大文件全量）；R2 预签名下载 URL 短期缓存；
   - **弱网/地铁/飞机场景价值**：已加载的纪要、待签列表、合规日历可离线看，签完/传完在恢复网络时同步（以服务端为真相源，见 2.5）。

**备选方案**：不接 PWA，只做响应式 → 弱网/离线时完全不可用，Vincent 常飞场景体验差；或做原生 App（ARCH-ROADMAP E.4 已否，成本维护高）。

**影响**：M3.6 是微信可用的硬地基；PWA 离线缓存直接解决"常飞、弱网"看已加载文档/纪要的刚性需求。退出标准（呼应主计划验收）：手机端"看纪要→建任务→上传→归档"闭环成功率 100%。

---

### 2.2 微信内两条路径（详见 §1 对比表）

**推荐方案**：路径 A（H5-in-WeChat）现在做，路径 B（原生小程序）M4 增量。接入层：
- 路径 A：微信**网页授权**（公众号 `appid` + `appsecret`，`snsapi_base` 静默授权拿 `code`→后端换 `openid`）+ **JSSDK**（需公众号已认证、配置 JS 安全域名、拿 `access_token`/`jsapi_ticket` 签名）实现自定义分享与图片上传。
- 路径 B：独立小程序 + **薄 BFF 聚合层**（呼应 C.4），`wx.login`→`code`→后端换 `openid`→绑 User→签 JWT。

**备选**：直接只做小程序（跳过 H5-in-WeChat）→ 失去"微信里点链接即开网页"的低门槛，且所有移动价值推迟到小程序上线（月级 + 审核）。

**影响**：路径 A 让"微信里可用"在周级落地；路径 B 的成本与审核风险被推迟，且仅作为增量补充而非重写。两路共享 JWT/状态，避免双系统分裂。

---

### 2.3 微信 / H5 登录与身份绑定

**问题**：Vincent 在手机/微信里怎么登录？演示自动登录真机打真实后端时不可用，且真实登录权限会失效。

**实测事实**
- `AuthContext.jsx:34-49`：无后端即 `setUser(DEMO_USER)` 自动 demo 登录，使 `#/login` 默认不可达——**真机连真实后端时此路径被绕过，坏登录链路长期未被验证**。
- `AuthContext.jsx:60-85 login`：取 `res.data?.data || res.data || res`，真实后端返 `{success, token, user:{...}}`（嵌套），`user` 未展开 → `isAdmin/canEdit/canDelete` 全为 `false`（ARCH-ROADMAP §0 #2）。
- `User.js` 角色枚举仅 `admin/secretary/user`，**缺 `manager/viewer`**（CFO 映射 `manager` 无枚举承载）。
- `Login.jsx:47`：注册写死 `role:'admin'`，后端 `register` 公开且 `role` 取请求体（任意访客可自封 admin，ARCH-ROADMAP §0 #3）。

**推荐方案（身份绑定双轨）**
1. **先修 Phase 0 权限契约**（前置，呼应 ARCH-ROADMAP B.2/B.3 + §0 #2）：
   - 后端登录/me 返回**扁平 `user`**（或前端归一化展开 `user` 字段），修复 live 权限失效；
   - `User.role` 扩枚举为 `['admin','secretary','manager','viewer']`（CFO=manager）；
   - 演示自动登录加**显式退出开关 + 角标**，绝不默认掩盖生产登录页。
2. **微信身份绑定模型**：
   - `User` 模型加 `wechatOpenid`（唯一索引，nullable）；
   - 路径 A：`snsapi_base` 拿到 `openid` → 后端查 `User.wechatOpenid`：
     - 已绑 → 直接签 JWT（静默登录，Vincent 微信里点开即进）；
     - 未绑 → 引导"用 CSMS 账号绑定"（输入邮箱+密码，校验后写 `wechatOpenid`）；新微信用户**走 invite 兜底**（呼应 B.5，不放开公开注册）。
   - 路径 B：`wx.login` 的 `code` 换 `openid`（同逻辑）。
3. **多实体归属（呼应 C.1）**：绑定/签 Token 时以 `User.company` 为作用域，`scopeByCompany` 中间件强制行级过滤；集团 CFO（manager）跨 3 家查看，各公司 secretary 仅本司。

**备选**：微信 openid 直接作为独立账号（不绑 CSMS User）→ 与 Web 端是两套身份，SignTask 状态无法跨端共享，违背 C.4。不推荐。

**影响**：微信可用性的**前提**是 Phase 0 权限修复；openid↔User 绑定让微信端复用全部现有 RBAC 与多实体隔离，零重复建模。

---

### 2.4 手机端文件上传（相机 / 签字件）→ R2 预签名 URL

**问题**：从手机相机或微信上传扫描件/签署件，怎么安全落到 R2？手机上如何打通 M5 闭环（会议→上传→归档）？

**实测事实**
- `server/storage/r2.js:67-98`：当前 `r2Driver.upload` 直接返回**公开 URL**（`R2_PUBLIC_URL` 或 `pub.` 子域），`getUrl` 也是公开地址——**违背 ARCH-ROADMAP B.5"文件访问走预签名 URL、不直接暴露 R2 公网地址"**的安全方向；且上传是服务端代理（先收全量再 PUT），手机大文件易超时。
- 上传接口 `documentService.upload` 走 `multipart/form-data`（`services/index.js:237-242`）；微信 WebView 对 `input[type=file]` 支持基本可用，但**进度回调与超大文件不稳**。

**推荐方案**
1. **预签名 URL 上传（呼应 B.5 + C.4）**：
   - 新增 `POST /api/v1/upload/presign`：后端校验权限 + 生成 **R2 PUT 预签名 URL**（短期，如 5 分钟，含 `company`/`user` 上下文前缀），前端**直传 R2**（手机相机拍照后直接 PUT，不经服务端中转，省流量、抗超时）；
   - 上传完成后前端回写 `Document` 元数据（key/name/size/company/meeting/source），服务端存 `key` 而非公开 URL；
   - 下载/预览：`GET /api/v1/documents/:id/url` 返回**短期预签名 GET URL**（隐藏 R2 内部细节，呼应 C.4 BFF 思路；小程序走 BFF 同理）。
2. **R2 桶改私有**：关闭当前公开 URL 策略，所有访问经预签名；签署件按 D2 另存副本（呼应 UX 决策 D2）。
3. **M5 手机闭环打通**：会议详情页"签纪要/传扫描件"→ 调预签名直传 → 创建 `Document`(source=meeting/stage) 并关联 `SignTask`/归档状态 → 状态变更走同一写接口（见 2.5）。Vincent 在高铁上拍完签字页即归档。

**备选**：维持服务端代理上传 → 手机弱网下大文件易失败、服务端带宽成本高；维持公开 URL → 合规风险（任何人持链接可下载签字件）。均不推荐。

**影响**：预签名直传是手机上传的可靠性与安全的共同基石；私有桶 + 预签名是 B.5 安全加固的移动端落地。

---

### 2.5 跨端状态同步（Web / 手机 / 微信 三端一致）

**原则**：`SignTask.status` 与 `Document.archivedAt` 等**以服务端为唯一真相源**，三端视图一致（呼应 ARCH-ROADMAP C.4）。

**推荐方案**
- 所有写操作（签纪要、上传、归档、解除归档）统一走 **`/api/v1` 同一套写接口**，三端无本地状态副本；
- 前端读取走 `services/index.js` 的 `wrap()`（mock/real 统一），真机强制 `USE_MOCK=false`（编译期锁定，呼应 ARCH-ROADMAP A.3 建议）；
- 微信/H5 与 Web 共享同一 JWT，**同一 `signTaskId` 状态在任意端变更，其他端轮询/订阅即一致**；
- 离线时（PWA）本地仅缓存"已查看内容"，恢复网络后**以服务端状态覆盖本地草稿**，避免两端各存一份导致不一致（呼应 C.4 "避免两端各存一份"）。
- 触发刷新时机：手机端 `visibilitychange`/`focus` 时拉最新；关键动作（签署/归档）完成即乐观更新 + 服务端确认。

**备选**：各端本地存草稿再合并 → 冲突多、审计乱，违背 C.4。不推荐。

**影响**：三端一致是 Vincent 在"手机签一半、回办公室电脑接着签"场景的硬要求；实现成本极低（本来就是服务端驱动），重点在**关掉 mock 静默回退**（A.3 债务①）。

---

### 2.6 多公司切换（手机端）

**问题**：Vincent 管 3 家上市公司，手机上怎么切？

**推荐方案**
- 复用现有 `company` 维度 + `scopeByCompany` 行级过滤（呼应 C.1）：顶栏放**公司切换器**（下拉/底部 Tab，三家公司 + "集团视图"）；
- 切换器在手机端做**大字触控版**（≥44pt，呼应 2.1），避免根因4；当前公司名**不全截断**，长名滚动或展开；
- 切换即带 `company` 上下文请求，`scopeByCompany` 强制过滤，CFO(manager) 可跨公司、"集团视图"聚合三司看板；
- 微信身份绑定后，`User.company` 决定默认进入的公司，切换仍受 RBAC 约束。

**备选**：每家公司独立登录 → 操作割裂、Vincent 需登出登入 3 次，体验差。不推荐。

**影响**：多公司切换是 CFO 角色的移动端刚需；复用 C.1 行级过滤，零新建模，仅前端交互适配。

---

### 2.7 分享 / 深链

**问题**：微信里把某个会议/文件链接发给同事，点开在哪打开？

**推荐方案**
- **路径 A（H5-in-WeChat）**：分享链接 = `https://csms.example.com/#/meetings/:id`（HashRouter 现状）；用**微信 JSSDK** `updateAppMessageShareData` 自定义标题/封面/描述；同事在微信里点开即在 WebView 打开同一 H5，**自动走 2.3 的 openid 绑定/登录**。
- **路径 B（小程序）**：`onShareAppMessage` 分享小程序卡片，`path` 带 `meetingId`；点击在小程序内打开。
- **深链统一**：无论哪端，深链都指向**服务端资源 ID**（`meetingId`/`documentId`/`signTaskId`），由对应端按当前环境路由；H5 与小程序共享同一套资源 ID，未来互通无障碍。
- **权限守卫**：深链打开即按 `scopeByCompany` + RBAC 校验，无权限返回"无访问权限"（不泄露内容存在性过多）。

**备选**：分享整页截图/文件 → 脱离 CSMS 审计、易外泄（见 2.8），不推荐用于合规材料。

**影响**：深链让 Vincent 在微信里"把纪要甩给董事"成为自然动作；JSSDK 配置需公众号资质（路径 A 的前置依赖，列入待拍板 2.7 项）。

---

### 2.8 合规 / 数据驻留

**问题**：微信生态里的合规注意点。

**推荐方案**
- **openid 处理**：`User.wechatOpenid` 视为 PII，入库加密存储；不在日志/前端暴露明文；与 `company` 绑定，离职即清（呼应 B.5 `isActive=false` 吊销）。
- **聊天外泄风险**：微信聊天是**非受控渠道**，签字件/纪要**绝不通过聊天文件传输**（走 CSMS 深链 + 预签名，见 2.4/2.7）；UI 提示"敏感材料请走 CSMS 链接，勿发聊天"。
- **数据驻留**：当前单库单地域（MongoDB Atlas + R2），3 家同集团无跨境驻留强需求；若某司受特定辖区监管，触发 C.1 物理多租户（乙）再谈分地域——现在无需。
- **审计**：微信内所有签署/归档/解除动作照常写 `AuditLog`（呼应 C.5），`who` 含 `wechatOpenid` 来源标记，便于追溯"是谁在手机/微信端操作的"。
- **公众号 vs 小程序资质**：路径 A 的 JSSDK 分享需**已认证服务号**；路径 B 需小程序账号。资质归属列入待拍板。

**备选**：把签字 PDF 直接发微信聊天 → 脱离审计、不可控外泄，违反港股合规精神。严禁。

**影响**：合规是 CSMS 的立身之本；微信生态只是"入口"，数据真相与审计仍在 CSMS 服务端，聊天仅作触达不作文档通道。

---

## 3. 与现有里程碑对齐

| 阶段 | 里程碑 | 本附录动作 | 依赖 | 退出标准 |
|------|--------|-----------|------|---------|
| **Phase 0 解阻塞（前置）** | M1.1 / M2.2 | 修认证响应契约（live 权限失效）、`User.role` 扩 4 枚举、演示显式开关、关公开注册+invite、R2 改私有桶+预签名端点雏形 | 客户拍板 E1–E5（见 ARCH-ROADMAP） | 真机真实登录后 `isAdmin/canEdit` 正确；登录页可达 |
| **M3.6 移动端（地基）** | M3.6 | 响应式硬化（safe-area/44pt/overflow-x/截断）+ **PWA 化**（manifest+sw 离线缓存） | Phase 0 权限修复 | 手机闭环成功率 100%；可安装；弱网可看已加载内容 |
| **微信 H5（路径 A）** | M3.6 之后增量 | 微信网页授权(openid↔User 绑定) + JSSDK 分享 + 深链 + 公司切换器移动版 | M3.6；公众号资质 | 微信里点开即进、分享卡片可达、三端状态一致 |
| **M4 小程序（路径 B，延后）** | M4 | 独立小程序前端 + **薄 BFF 聚合层** + `wx.login`→JWT + 预签名上传经 BFF | M5 签署状态模型；小程序账号资质 | 小程序可签且状态与 Web 同步；BFF 隐藏 R2 细节 |
| **M5 闭环（手机打通）** | M5 | 预签名直传 + 会议→上传→归档手机闭环 + `scopeByCompany` + `AuditLog` | M3.6；Phase 0 | 三来源闭环在手机打通；签署/归档留审计 |
| **M6 文件管理** | M6 | 分类字典 + 筛选/搜索并存 + 手机文件可发现性（呼应 F3/F4） | M5 命名/来源字段 | 找文件 ≤2 步 |

> 关键排序：**Phase 0（修登录/权限）→ M3.6（修手机+PWA）→ 微信 H5（路径 A）→ M4（小程序增量）**。原生小程序不是起点，是 M3.6+H5 验证后的增量。

---

## 4. 待客户拍板的 3 个决策

### D-W1. 微信端路径：现在 A（H5-in-WeChat）还是直接 B（原生小程序）？
- **推荐**：现在做 **A（H5-in-WeChat）**，复用 90% 代码周级上线；**B（原生小程序）延后到 M4** 作增量。
- **备选**：只做小程序（跳过 H5）→ 移动价值推迟月级 + 审核风险。
- **影响**：决定"微信可用"的交付速度与成本；两路共享 JWT/状态，不互斥。

### D-W2. 微信身份绑定方式：openid 静默登录 vs 账号绑定兜底
- **推荐**：`snsapi_base` 拿 openid → 已绑 `User` 则**静默签 JWT 直接进**；未绑走"CSMS 账号绑定"（写 `wechatOpenid`）；新微信用户走 **invite 兜底**（不开公开注册，呼应 B.5）。
- **备选**：openid 独立成账号（不绑 CSMS User）→ 与 Web 双身份、SignTask 无法跨端共享，违背 C.4。
- **影响**：决定 Vincent 在微信里"点开即用"还是"每次登录"；绑定模型决定多端一致性。

### D-W3. PWA 离线缓存范围：仅元数据 vs 含原文
- **推荐**：**离线缓存"应用壳 + 最近查看的纪要/提醒/文档元数据"**；敏感签字原文**不整量离线**（仅短期预签名 URL 缓存、恢复网络即失效），避免手机丢失导致合规材料泄露。
- **备选**：离线缓存全文 PDF → 体验最佳但丢机风险高（CFO 手机含 3 家上市公司签字件，合规不可接受）；或完全不离线 → 弱网/飞行不可用。
- **影响**：决定弱网可用性 vs 数据泄露风险的天平；推荐档在"够用且不冒进"。

> 附加前置依赖（非本附录新增，源自 ARCH-ROADMAP E1–E5，须先拍板）：种子管理员机制、注册开放策略、多租户 now-or-later、移动端 PWA-or-App、RBAC 细粒度——其中 **E4（PWA 不建 App）已与本附录 D-W3 一致**，**E2（关公开注册）直接约束 D-W2 的兜底方式**。

---

## 附录：复核证据（代码实测索引）

| 事实 | 文件:行 |
|------|--------|
| F1 根因1：viewport 缺 `viewport-fit=cover` | `client/index.html:6` |
| F1 根因2：`<main>` 无安全区 padding | `client/src/components/Layout.jsx:23` |
| F1 根因4：触控 <44pt、无 `overflow-x` 守卫 | `client/src/components/Navbar.jsx`（NavItem `py-2.5`、toggle `p-2`） |
| F1 根因5：截断 | `Navbar.jsx` 用户 footer `truncate` |
| 演示自动登录掩盖登录页 | `client/src/contexts/AuthContext.jsx:34-49` |
| live 权限失效（嵌套 user 未展开） | `AuthContext.jsx:60-85` 取 `res.data?.data \|\| res.data`，后端 `auth.js:79-95` 返 `{success,token,user}` |
| 注册写死 `role:'admin'` + 公开 register | `client/src/pages/Login.jsx:47`；`server/routes/auth.js:11-52` |
| User 角色枚举缺 manager/viewer | `server/models/User.js:24-28` |
| R2 当前返回**公开 URL**（非预签名） | `server/storage/r2.js:79-97` |
| 上传为服务端代理 multipart | `client/src/services/index.js:237-242` |
| mock/real 静默回退（生产隐患） | `client/src/services/index.js:27-39` |
| 微信 H5/JSSDK 思路 | 呼应 ARCH-ROADMAP C.3 / C.4 |

*架构师：高见远（Gao）｜ 2026-07-17 ｜ 本文为架构分析文档，不含业务代码改动。*
