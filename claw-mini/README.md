# Claw 秘书小程序（MVP · 路线 B）

香港公司秘书合规管理小程序的**第一阶段 MVP**：在微信里查看「合规数据缺口」并手机补全缺失日期，
数据**同源**复用网页端 `claw-api`（不另起数据库）。

技术栈：uni-app（Vue3 + Vite），可直接发微信小程序；同样代码也可发 H5 / App。

## 已实现
- 登录：复用网页端账号（邮箱/手机号 + 密码）走 `/api/auth/login`，JWT 存本地。
- 缺口列表：`/api/compliance-rules/diagnose` 拉全部有缺口的公司 + 缺失字段标签。
- 手机补全：底部抽屉按缺失字段填「商业登记到期日 / 成立日期 / 财政年度结算日」。
- 提交：`/api/companies/bulk-update`（只更新你填的字段，绝不误删库里其他值）。
- 自动重算：提交后调用 `/api/compliance-reminders/ensure-all-hk`，BR 续期 / 周年申报 / NN3 提醒按新数据重生（与网页版一致）。

> 第二阶段（未做）：浏览公司、看/处理合规提醒、文档；微信 openid 直接登录绑定。

## 运行方式

### 方式一：HBuilderX（推荐，零配置编译）
1. 用 [HBuilderX](https://www.dcloud.io/hbuilderx.html) 打开本目录（`claw-mini/`）。
2. 顶部菜单「运行 → 运行到小程序模拟器 → 微信开发者工具」会自动编译并拉起。
   - 首次需把微信开发者工具「设置 → 安全 → 开启服务端口」打开。
3. 改 AppID：见下方「配置」。

### 方式二：命令行（uni cli）
```bash
cd claw-mini
npm install            # 若版本解析异常，见下方「版本」
npm run dev:mp-weixin  # 开发
npm run build:mp-weixin # 产出到 dist/build/mp-weixin，再用微信开发者工具导入
```

## 配置
1. **API 地址**：`src/config.js` 的 `API_BASE`，默认 `https://claw-api-5zq7.onrender.com`。
   - 联调内网后端时改成本机局域网地址。
2. **小程序 AppID**：`src/manifest.json` → `mp-weixin.appid`。占位 `touristappid` 可用「游客模式」预览；
   正式需改成你自己的微信小程序 AppID（公众平台获取）。
3. **合法域名（生产必填）**：微信公众平台 → 开发 → 开发管理 → 服务器域名 →
   `request 合法域名` 加入 `https://claw-api-5zq7.onrender.com`（必须 https）。
   开发阶段可在 `manifest.json` 的 `mp-weixin.setting.urlCheck=false` 关闭校验。

## 版本说明
`package.json` 里 `@dcloudio/*` 用 `^3.0.0`，npm 会取最新 3.x。若 cli 安装/编译报版本不匹配，
请用 HBuilderX 打开（它自带匹配好的 uni 编译器），或把三个 `@dcloudio/*` 锁成同一日期版本。

## 目录
```
claw-mini/
├─ src/
│  ├─ config.js            # API_BASE
│  ├─ utils/request.js     # uni.request 封装（JWT + 401 跳登录）
│  ├─ utils/auth.js        # token/user 本地存储
│  ├─ pages/login/         # 登录
│  └─ pages/gaps/          # 缺口列表 + 填写闭环
├─ index.html / vite.config.js / package.json
└─ README.md
```
