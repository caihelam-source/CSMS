# Claw Commit 风险评估（2026-08-04 实测）

> 配套文档：`commit-plan-2026-08-04.md`（分组清单）
> 本文回答一个问题：**现在 commit / push，会不会搞坏生产？**
> 所有结论均由实测得出，非推断。

---

## 一、当前状态快照

```
HEAD          = 98e73e1（与远端 github/main 完全对齐：落后 0 / 领先 0）
待提交         = 36 条（25 修改 + 11 新增）
回退文件       = 0        ← 已在对齐阶段全部恢复
构建产物噪音   = 0        ← 已被 .gitignore 规则消灭
```

---

## 二、风险分级结论

### 🔴 高风险：仅 1 项 —— push 会自动部署到生产

`render.yaml` **未声明 `autoDeploy: false`**，Render 的默认值就是 **自动部署开启**：

```yaml
- type: web
  name: claw-api
  branch: main              # ← 监听 main
  startCommand: node server/index.js
- type: web
  name: claw-web
  branch: main              # ← 同样监听 main
  buildCommand: cd .. && npm install && cd client && npm install && npm run build
```

**含义**：`git push github main` 落地的瞬间，`claw-api` 与 `claw-web` 两个生产服务会立即重建并重启。没有灰度、没有确认环节。

> ⚠️ 注意这是**推送**的风险，不是**提交**的风险。见第四节的分步方案。

### 🟡 中风险：2 项

| 项 | 说明 | 爆炸半径 |
|---|---|---|
| **ResultsTimetable 未经真实后端验证** | 港股业绩排期，前后端 2400+ 行新代码，全程只在 mock 模式下开发过，从未跑通真实 Atlas + API 链路 | **受限**：前端是 `lazy()` 懒加载独立路由、后端是独立 `/api/results-timetable` 前缀 + 独立 collection。即使全挂，也只影响这一个页面，不波及现有功能 |
| **Render 免费版构建可能超时** | 前端本地 `vite build` 耗时 4m27s（含 `vite-plugin-checker` 全量检查），Render 免费实例更慢 | 构建失败 → 前端保持上一版本，不会白屏。属于"部署不成功"而非"部署坏了" |

### 🟢 低风险：已逐项实测通过

| 检查项 | 方法 | 结果 |
|---|---|---|
| 是否含版本回退 | 25 个 M 文件逐个 `diff --numstat` | ✅ 全部纯增量，无远端功能被删 |
| 两个"删多于增"文件 | 逐个核对删除内容去向 | ✅ `Dashboard.jsx` −10 是删假菜单（B7，预期）；`Tasks.jsx` −165 完整搬入 `TaskForm.jsx`（163 行） |
| 服务端改动兼容性 | 读取完整 diff | ✅ `server/index.js` 仅**追加**一条路由挂载；`Task.js` 仅 enum **加值** + 新增**可选**字段（无 required），对存量数据零影响 |
| 服务端语法 | `node --check` × 6 文件 | ✅ 全部 OK |
| 服务端依赖 | require 清单 vs package.json | ✅ `express` / `mongoose` / `xlsx` 均已声明，无缺失 |
| 服务端可加载 | 单独 require 4 个新模块 | ✅ `REQUIRE_OK` |
| 服务端可启动 | 整体启动冒烟 10s | ✅ `STARTUP_OK`，未崩溃 |
| 前端构建 | `vite build` | ✅ `BUILD_EXIT=0` |
| 产物容器查询 | grep 产物 CSS | ✅ `@container` 4 处存活、`container-type` 注册成功 |
| 产物色板 | grep 产物 CSS | ✅ Lumina `#2563eb` 生效，旧苹果蓝 `0071e3` **0 残留** |
| 代码规范 | 全量 ESLint | ✅ **0 error** |
| `uploads/` 是否污染 | 目录扫描 | ✅ 仅 `.gitkeep`，且 `.gitignore` 已配 `uploads/*` + `!uploads/.gitkeep`，**应当**提交（保证部署时目录存在） |

---

## 三、为什么"提交"本身零风险

Git 的提交是**纯本地**操作，不触碰任何远程或生产环境：

- 提交后可用 `git reset --soft HEAD~N` 完整撤销，磁盘文件一个不动
- 远端 `github/main` 在 push 之前保持原样
- Render 监听的是**远端** main 分支，本地 commit 它完全感知不到

**所以：commit 可以放心做，风险全部集中在 push 那一步。**

---

## 四、推荐执行方案（分步、可停）

### 方案 A：分步推进（推荐，风险最低）

```
第 1 步：本地 commit 全部 7 组        → 零风险，随时可 reset
第 2 步：本机 npm run dev 跑真实后端  → 验证 ResultsTimetable 真实链路
第 3 步：确认无误后再 push            → 此时才触发生产部署
```

### 方案 B：拆分推送（若想先上稳的、缓上新的）

7 个 commit 里，第 6 组是 `ResultsTimetable`（唯一未经真实链路验证的）。可以只推它之前的：

```bash
# 假设 Commit 5 的 sha 是 <sha5>，只推到那里
git push github <sha5>:main
```

UX 重构 + Settings + 响应式架构先上生产，`ResultsTimetable` 留在本地慢慢验。

### 方案 C：临时关闭自动部署（若要一次全推但想控节奏）

在 render.yaml 两个 service 下各加一行：

```yaml
    autoDeploy: false
```

push 后不会自动部署，改由 Render 面板手动点 Deploy，或走 API：

```
POST /v1/services/{serviceId}/deploys
```

> 记忆中已有一条相关经验：**Render 改 env 不会自动重部署，须显式调用 deploy API**。此处同理。

---

## 五、推送方式的一个改进

以往用 `scripts/push-no-git.cjs`（GitHub Git Data API）推送。**建议改回常规 `git push`**：

| | API 脚本 | 常规 git push |
|---|---|---|
| 是否移动本地 HEAD | ❌ 不移动 | ✅ 移动 |
| 后果 | 本地永远"落后 N 个提交"，索引失真 | 本地远端始终一致 |

08-04 这次踩的"本地落后 6 个提交、127 个文件误判为新增"，根因正是 API 推送不移动本地 HEAD。既然已实测**沙箱有 git**（`/mingw64/bin/git`，加 `-c safe.directory` 即可用），没有理由再走 API。

---

## 六、遗留提醒

- **C 盘工作区 `C:\Users\Vincent\WorkBuddy\Claw` 仍停在 `86d156d`**，落后远端 6 个提交。若在该目录操作，须先做同样的 `git fetch` + `git reset --mixed github/main` 对齐，否则会重演回退风险。
- 备份目录 `.backup-prealign-20260804/`（13 个文件）已被 `.backup-*/` 规则忽略，不会进仓库；确认无误后可自行删除。

---

**评估人**：ArchitectUX
**评估日期**：2026-08-04
**结论**：**提交零风险，可立即执行；推送有一项高风险（自动部署生产），建议按方案 A 分步推进。**
