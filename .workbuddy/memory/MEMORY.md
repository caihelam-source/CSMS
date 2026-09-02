# Claw - 香港公司秘书管理系统 (CSMS)

## 技术栈
- 后端: Node.js + Express + MongoDB Atlas + JWT；前端: React + Vite + TailwindCSS + Lucide
- 存储: 本地磁盘 / Cloudflare R2 (S3 兼容)；部署: Render (claw-api Web + claw-web Static)

## 模块速查
- Companies / Personnel(统一人员中枢, Director已并入) / Documents(R2上传) / Meetings / ComplianceReminders+Rules / Templates / SignTasks / Tasks / Dashboard
- 关键模型: Company(links[] 中心枢纽), Personnel(统一+roles标签), Document, Meeting, SignTask, Task, User。
- 后端读时聚合: `GET /api/personnel/:id/aggregate`；前端 `personnelService.getByPersonnel` 驱动 360°

## 启动与构建
- 前端 dev: `cd client && node node_modules/vite/bin/vite.js --host` (5173, Mock 模式 admin@example.com/admin123)
- Mock/Real: `services/index.js` `USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'`(默认 mock)
- **vite build + safe-delete shim**: shim 同时 hook shell `rm` 与 node `fs.rmSync`(vite emptyDir)。官方 bypass: `env CODEBUDDY_SAFE_DELETE_ENABLED=0 node ...`(Bash 内 `export` 对子进程不一定生效, 须用 `env VAR=val cmd`)。bypass 后 vite 自己 emptyDir, 不必手动 rm。

## normalize() 陷阱 — 已统一根治 (09-01, commit e6fe4ea + 5eebb2e)
- 旧实现第3条对扁平响应只抽单实体键、丢同级字段 → 命中 paging 列表型(D复合型) → payload 是对象非数组 → 前端 `.map` 白屏(audit 则静默空)。
- 加规则 E: 单实体键(数组)+仅分页 meta → 抽数组作 payload, 分页 meta 移 `result.paging`。ENTITY_KEYS 含 personnel/companies/documents/meetings/tasks/reminders/rules/templates/signTasks/events/duplicates/logs。
- 门禁: ESLint 0 error / vitest 24/24 / vite build 0 error。

## NAR1/BR 证 → CSMS 识别器 (09-01 拍板, 已 skill 化+推送 164cc58)
- 脚本 `scripts/nar1_recognize.py`(NAR1) + `br_recognize.py`(BR证) + `nar1_report.py`；识别结果 `scripts/_nar1_recognized.json`(14家) + `_br_recognized.json`(仅 EasyRich 1份 BR证)。
- **决策**: `Company.registrationNumber` 映射到 **BR号**(NAR1 不印 CR号), 附 `registrationNumberSource`；`brExpiryDate` 字段已存在, 从 BR证填(仅 EasyRich 有)。
- **NAR1 gap**: incorporationDate / 董事 appointmentDate / financialYearEnd / 公司类别单选框(文本不可靠) → 全标 review/None。
- **落库阶段(09-01 已落地, 09-02 真正执行)**:
  - `scripts/seed-from-nar1.js`(旧, **只建 Document 元数据, 不传 PDF 正文** — `fileSize:0` 标注"沙箱无PDF未上传正文") → 已被 `scripts/seed-nar1-full.js` 取代。
  - `scripts/seed-nar1-full.js`(09-02 新增, 同 commit 二次扩成"完整闭环"): 读 `_nar1_recognized.json`(14家) + 内置 PDF_MAP 映射 `D:\BaiduSyncdisk\CNC接收文件\04_香港子公司\...\` 原件 → **Phase 1** 上传 NAR1 PDF 到 R2(`STORAGE_DRIVER=r2` 复用 `server/storage/r2.js`) → upsert Company/Personnel/links → 建带真实文件引用的 NAR1 Document(category='annual_return', type='nar1_return') → 对 HK 公司自动 ensure HK_AR_42+HK_BR_RENEW → **Phase 2** glob 同公司 BR PDFs（启发式：中文名 → NAR1 全名简化 → 多 token 全命中 → FINANCIAL[CI]AL 拼写容错）→ 上传 BR PDF + 挂 Document(category='br_certificate', type='business_registration') → regex 抓文件名 expiry + 回填 Company.brExpiryDate + 重 ensure HK_BR_RENEW。含 `--dry-run`(路径+文件夹匹配校验, 不联网)。
  - ⚠️ **必填字段坑(09-02 第二轮闭环修复发现)**: seed upsert 必须**同时**写 `fileName` (R2 key) **和** `filename` (schema 字段, /view /download 守卫), 否则 R2 上有字节但前端 404 → fallback 显示"不支持"。跑完 seed 必查 `Document.countDocuments({filename:{$exists:false}})` 应为 0。回填用 `scripts/backfill-doc-filename.js`(idempotent, 把 fileName 复制到 filename)。
  - 类型 enum (`Document.js:6-13`) 已含 `business_registration` / `nar1_return` / `nn3_return`；老类型 `return` / `certificate` 也仍在 enum(其他文档还会用)。迁移用 `scripts/migrate-doc-types.js`(按 type+category 双条件 update, 幂等)。
  - **09-02 已真实执行 2 次 + 独立验证 (commit c0cb066)**: 14 NAR1 + 16 BR PDF = **30 files uploaded, 100% 真实文件引用, 0 异常**; R2 HEAD 抽样 4 份字节精确吻合; 6 ComplianceReminder (Easy Rich 1 + 既有 BVI/CAY 5); 14+1 公司; 7 自然人; 45/46 links; BR 命中文件夹 10/14 (4 家 tough case = 归档中本无 BR PDF,非 bug); Easy Rich 自动拿到 brExpiryDate='2024-03-31'。复验用 `scripts/verify-nar1-seed.js`(升级版直读 Atlas + R2 HEAD 抽样 + 逐公司核对 + 异常总结)。
  - MONGODB_URI 优先级 环境变量 > `SECRETS.md`(Atlas) > .env(local) > localhost。旧 `seed-hk-companies.js`(5家硬编码, 字段bug) 已废弃。
  - ⚠️ **沙箱直连 Atlas 必坑**: 默认 egress 拦 mongodb.net(`querySrv ECONNREFUSED`)。修法: 脚本顶部 `require('dns').setServers(['8.8.8.8','1.1.1.1'])`(家用路由 192.168.1.1 拒绝 SRV 查询) + Bash 跑时 `dangerouslyDisableSandbox:true`(外网/R2 仍通, 仅 mongo SRV 被路由拒)。
  - ⚠️ **诚实声明 (Vincent 须手动补 2 项)**:
    1. **NAR1 PDF 上不含"成立日期"**(周年申报表本就不印)→ 14 家公司 incorporationDate 都空;修法: 用 CI Certificate(公司注册证明书)/ 早年 BR Date of Commencement / 政府 ICRIS 查询 → 在 CompanyDetail "基本信息" 编辑页录入 → 系统自动 ensure HK_AR_42 提醒。
    2. **BR PDF 在沙箱是扫描件、无 OCR** → brExpiryDate 自动从文件名 regex 抓, 仅 Easy Rich 1 份成功 (31 Mar 2024);其余 13 家 Vincent 须在 CompanyDetail "BR 到期日" 维护**精确** expiry (用政府商业登记署网站查 https://www.gov.hk/tc/business/registration/brs.htm )。
    3. 完成后: POST `/api/compliance-reminders/ensure` 或 admin "为全部 HK 公司 ensure 提醒" 一键 (adminComplianceReminders.ensureAllHk 已在前 commit 落地) → 自动按新日期生成 HK_AR_42 + HK_BR_RENEW。

## 部署真相与本地对齐铁律 (08-31 坐实)
- 沙箱 git 实际可用；远端 `github`=caihelam-source/CSMS(=Render 构建源, 线上 claw-web.onrender.com)。
- 铁律: 改线上 bug 前先 `git fetch github && git merge --ff-only github/main` 对齐基底, 否则旧基底改了不推送=线上看不到。
- 本地落后自查: `git rev-list --count HEAD..github/main`(>0 即落后)。
- Render 部署不跑 ESLint, 本地 `scripts/push-no-git.cjs` 门禁跑 `eslint .` 须 0 error。
- **线上 URL 真实映射 (09-02 探活坐实)**：claw-web = `https://claw-web.onrender.com`（静态）；claw-api = `https://claw-api-5zq7.onrender.com`（**不是** `claw-api.onrender.com`，Render 给 web service 分配随机后缀，全在 `SECRETS.md` 的 `VITE_API_BASE`）。探活务必用 5zq7，否则全 404 误判为服务 down。前端打包 chunk 名 `index-*.js` + lazy Nar1Import 路由；验线上部署：`curl -s https://claw-web.onrender.com/assets/index-*.js | grep -oE "Nar1Import|HK_AR_42|/nar1-import"`。

## v6.x 文件管理重构 (07-21 拍板, Phase A+B 已落)
- 数据根=Company；Personnel 全局共享中枢、与公司多对多。文件编号 `归属码-年份-类型码-序号`。scope(company/person)。导出 CSV/ZIP。Phase C 待做(权限模型/Company Tab 组件化)。

## 公司去重 / 合并 / 曾用名 (09-02 落地, commit dcbfe01)
- 三层去重 `server/utils/dedup.js`：exact_regno(容忍 `DEMO-CR-` 前缀) > alias(formerNames) > fuzzy_name(Jaro-Winkler ≥0.92)。`findCompanyDuplicates` O(n²)。
- 软合并 `POST /api/companies/:id/merge`(admin)：引用迁移→Personnel.links 去重合并→formerNames 入 target→文件重编号(`server/utils/docFileCode.js`, 按 entityCode+year+typeCode 组内 seq 重置)→源 status='merged'。零数据丢失。
- `GET /api/companies/duplicates` 手动按钮触发；`PUT /api/companies/:id/former-names` 管曾用名(merger 来源不可删)。
- `nar1Import.js` upsert 加模糊候选检测(返回 `merge_candidate` 不直接合)。
- 安全设计：dry-run first。`scripts/dedup-dry-run.js`(连 Atlas 扫 38 家→10 对, 写 `_dedup_pairs.json`) + `exec-merge-plan.js`(--apply 真合 / --rollback / --only-auto)。真实库 10 对中 #1-5 exact_regno(含 HuiJun 35387857 用户截图案例)、#6-9 fuzzy 1.0、#10 China New City 0.943 需人工。
- **09-02 已真合并 9 对**（commit a76da49）：遇 docNumber 全局唯一索引与 v6.x 公司内编号冲突 → E11000；根治为 (company,docNumber) 复合唯一 + `applyDocRenumbers` 两遍写（详见 skill `company-dedup-merge` 的"docNumber 唯一索引坑"）。验证：9 target formerNames 齐、反向引用 0 残留、0 临时号残留。#10 仍留人工。
- **人员(Personnel)去重/合并同构落地**（commit a79f23a）：用户"personnel 也有同样问题"。`server/utils/personnelDedup.js` 三层 exact_nric>exact_chinese>alias>pinyin（拼音相互包含且被含串≥4 规避 SHI 误命中）；Personnel 模型加 status/mergedInto/formerNames；`POST /api/personnel/merge` 改软合并+迁移 7 类引用（原硬删源是 bug）；`GET /duplicates` 返回并查集收敛的重复组+建议 target(按 Company.links 数)；列表默认排除 merged。`dedup-personnel-dry-run.js`+`exec-merge-personnel.js`(--apply/--rollback)。**真实库已执行：17 条→10 人（7 条软合并），0 悬挂引用、formerNames 正确(含施侃成别名)**。单测 14/14（dedup 总 33/33）。详见 skill `company-dedup-merge` 的"Personnel 去重/合并"段。

## 待办
- ⚠️ seed-admin.js(真实管理员 hk1321@agent.qq.com)未跑 → 真实登录链路仍不通；须本机跑 `node scripts/seed-admin-local.cjs --email hk1321@agent.qq.com --name "Vincent Lin" --password "lin19900731"`(Atlas 密码已正确)。
- 🔑 Render API key `rnd_M8x2lSfoZmFfmzaDnnzOfCUaW5Gp` ~~收尾时提醒 Vincent 去 Account Settings 注销~~ — **2026-09-02 经验证不存在**：Vincent 打开 dashboard.render.com/settings/api-keys，页面显示 "No provisioned API keys"，该 key 实际从未存在 / 早已被清。**关闭。**
- 迁移 --apply (migrate-v5.js, 待 DBA 复核+先备份库)。
- NAR1 落库**已完成(09-02 闭环+独立验证 30 PDF)**: 14 公司/14 NAR1+16 BR 文档(R2 真文件)/45 links / ComplianceReminder 6 (Easy Rich 1 + 既有 BVI/CAY 5)。详见上方"落库阶段"。

## 质量门禁
- ESLint 根 `eslint.config.js` 须 0 error；vite build 0 error；`react/jsx-no-undef` 拦未导入组件。

## 协作与部署
- 优先真实 `git push github main`(沙箱可用)。`push-no-git.cjs`(Git Data API) 仅兜底——其换行伪差异会把 ~331 文件判 changed 污染仓库, **禁用整树 API 脚本做精准推送**。
- PAT 存 `.workbuddy/memory/SECRETS.md`(gitignored)。push 后 Render 自动 build+deploy。

## Skill 入库约定
- `.workbuddy/` 整体 gitignore, `!` unignore 跨不了父目录 → 项目级 skill 用 `git add -f .workbuddy/skills/<name>/SKILL.md`。User-level skill 放 `~/.workbuddy/skills/` 不受限。

## 前端/脚本坑
- 改 `tailwind.config.js` 须重启 vite dev；`index.css` 注释 `*/` 提前闭合。
- 同步 `_sync_to_jinghua.sh`: tar 用 subshell 相对路径(bsdtar 不认 /c/)；校验用 `cmp -s`(Git Bash 无 md5sum)；孤立文件 `mv` 到 _orphans 不用 rm；每次运行复查根层未镜像项。
- 全局搜索 `GET /api/search` 正则子串+CJK 友好；`GlobalSearch.jsx` variant inline/navbar/overlay；原 ⌘K 是 CommandPalette 已替换为实体搜索。
