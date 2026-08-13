#!/usr/bin/env bash
# ⚠️ 本脚本曾被 E 盘沙箱回载覆盖回退成旧版( tar -C /c/... + 字符串 EXCLUDES )。
# ⚠️ 旧版在 bsdtar 下会：(1) `tar -C /c/...` 报 could not chdir 直接失败；
#                          (2) 字符串 EXCLUDES 单引号被当字面量，排除长期未生效，靠事后 rm 兜底;
#                          (3) `--exclude=$null` 不加引号 → 展开成空模式 → bsdtar Couldn't exclude 中止打包 → 假成功。
# ✅ 正确写法（勿改回旧版）：subshell 相对路径 + bash 数组 EXCLUDES + 每个 exclude 源展开即排除。
# 将 Claw 最新代码+文档 镜像到「项目文档/精华文件」（完整 CSMS 工作副本）
# 每日由自动化调用；排除 node_modules / dist / 构建残留 / 明文密钥(.env)
set -e
SRC="/c/Users/Vincent/WorkBuddy/Claw"
DST="/c/Users/Vincent/WorkBuddy/项目文档/精华文件"

# 构建残留排除规则（bash 数组，确保逐项传给 tar 真正生效）
EXCLUDES=(
  --exclude=node_modules
  --exclude=dist
  --exclude='dist.bak.*'
  --exclude=dist_bak_align
  --exclude='dist-*'
  --exclude='*.log'
  --exclude='*.err'
  --exclude=build_jur
  --exclude='build_jur*'
  --exclude='vite.config.js.timestamp-*'
  --exclude='ssr-meetings*'
  --exclude=tmp
  --exclude=output
  --exclude=rom_ref_unpacked
  --exclude=uploads
  --exclude='$null'
  --exclude=.dev.log
)

# 1) 镜像 client/server/scripts（subshell 相对路径避免 bsdtar 的 /c/ MSYS 路径问题）
for d in client server scripts; do
  mkdir -p "$DST/$d"
  ( cd "$SRC/$d" && tar "${EXCLUDES[@]}" -cf - . ) | ( cd "$DST/$d" && tar -xf - )
  echo "[mirror] $d -> $(find "$DST/$d" -type f | wc -l) files"
done

# 删除 Claw 中已不存在的孤立文件（确保真镜像）
rm -f "$DST/client/src/components/VirtualList.jsx" || true

# 主动清理 client 层构建残留（tar 只增改不删，双保险）
rm -f "$DST/client/"*.log "$DST/client/"*.err "$DST/client/build_jur"* \
      "$DST/client/vite.config.js.timestamp-"* "$DST/client/ssr-meetings"* 2>/dev/null || true
rm -rf "$DST/client/tmp" "$DST/client/dist" "$DST/client/dist.bak."* "$DST/client/dist_bak_align" 2>/dev/null || true

# 2) 镜像 docs 与 .workbuddy
mkdir -p "$DST/docs"
( cd "$SRC/docs" && tar -cf - . ) | ( cd "$DST/docs" && tar -xf - )
echo "[mirror] docs -> $(find "$DST/docs" -type f 2>/dev/null | wc -l) files"

mkdir -p "$DST/.workbuddy"
( cd "$SRC/.workbuddy" && tar -cf - . ) | ( cd "$DST/.workbuddy" && tar -xf - )
echo "[mirror] .workbuddy -> $(find "$DST/.workbuddy" -type f | wc -l) files"

# 3) 根目录配置 + 核心文档（排除 .git / 日志 / 构建产物 / .env 明文密钥）
# ⚠️ 此清单为硬编码，新增根层配置/文档时须同步补充，否则会静默漏同步（2026-08-09 曾漏 eslint.config.js）。
for f in package.json package-lock.json .env.example .gitignore render.yaml Dockerfile docker-compose.yml nginx.conf cloudbaserc.json .dockerignore \
         eslint.config.js deploy.cmd migrate-apply.cmd setup-prod.cmd _sync_to_jinghua.sh \
         README.md PROJECT_ROADMAP.md TECH_DESIGN.md DEPLOY-FULLSTACK.md DEPLOYMENT.md DEVELOPMENT.md CONTRIBUTING.md LICENSE MIGRATION.md; do
  if [ -f "$SRC/$f" ]; then cp "$SRC/$f" "$DST/$f" && echo "[cp] $f"; fi
done

# 3b) 根层 overview*.md 特性说明文档（glob，自动纳入新增项）
for f in "$SRC"/overview*.md; do
  [ -f "$f" ] && cp "$f" "$DST/$(basename "$f")" && echo "[cp] $(basename "$f")"
done

# 3c) 根层 *.config.js 工具链配置（glob，自动纳入新增项）
# 2026-08-09 曾漏 eslint.config.js、2026-08-10 曾漏 vitest.config.js —— 均因硬编码清单未更新。
# 此段确保今后新增的根层构建/测试/lint 配置自动进入镜像，无需改清单。
for f in "$SRC"/*.config.js; do
  [ -f "$f" ] || continue
  b=$(basename "$f")
  [ -e "$DST/$b" ] && cmp -s "$f" "$DST/$b" && continue   # 已同步且内容一致则跳过，避免重复输出
  cp "$f" "$DST/$b" && echo "[cp] $b"
done

# 4) 防御性清理：根层运行残留（万一出现）
rm -rf "$DST/output" "$DST/rom_ref_unpacked" "$DST/uploads" "$DST/\$null" "$DST/"*.log "$DST/"*.err 2>/dev/null || true

# 5) 孤立文件隔离：源已删的目标文件 mv 到 _orphans（不留 rm，防误删唯一副本）
ORPHAN_DIR="$DST/../_orphans/$(date +%Y%m%d)"
mkdir -p "$ORPHAN_DIR"
for d in client server scripts docs; do
  if [ -d "$DST/$d" ]; then
    while IFS= read -r f; do
      rel="${f#$DST/$d/}"
      if [ ! -e "$SRC/$d/$rel" ]; then
        mkdir -p "$ORPHAN_DIR/$d/$(dirname "$rel")"
        mv "$f" "$ORPHAN_DIR/$d/$rel" && echo "[orphan] $d/$rel -> _orphans"
      fi
    done < <(find "$DST/$d" -type f)
  fi
done

echo "=== DONE sync ==="
echo "精华文件 总文件数: $(find "$DST" -type f | wc -l)"
