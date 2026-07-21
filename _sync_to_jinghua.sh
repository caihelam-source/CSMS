#!/usr/bin/env bash
# 将 Claw 最新代码+文档 镜像到「项目文档/精华文件」（完整 CSMS 工作副本）
# 每日由自动化调用；排除 node_modules / dist / 构建残留 / 明文密钥(.env)
set -e
SRC="/c/Users/Vincent/WorkBuddy/Claw"
DST="/c/Users/Vincent/WorkBuddy/项目文档/精华文件"

# 构建残留排除规则（防止每日同步重新污染副本）
EXCLUDES="--exclude=node_modules --exclude=dist \
  --exclude='*.log' --exclude='*.err' --exclude='build_jur*' \
  --exclude='vite.config.js.timestamp-*' --exclude='ssr-meetings*' \
  --exclude='tmp' --exclude='output' --exclude='rom_ref_unpacked' \
  --exclude='uploads' --exclude='\$null' --exclude='.dev.log'"

# 1) 镜像 client/server/scripts（tar 覆盖 + 排除）
for d in client server scripts; do
  mkdir -p "$DST/$d"
  tar -C "$SRC/$d" $EXCLUDES -cf - . | tar -C "$DST/$d" -xf -
  echo "[mirror] $d -> $(find "$DST/$d" -type f | wc -l) files"
done

# 删除 Claw 中已不存在的孤立文件（确保真镜像）
rm -f "$DST/client/src/components/VirtualList.jsx" || true

# 主动清理 client 层构建残留（tar 只增改不删，双保险）
rm -f "$DST/client/"*.log "$DST/client/"*.err "$DST/client/build_jur"* \
      "$DST/client/vite.config.js.timestamp-"* "$DST/client/ssr-meetings"* 2>/dev/null || true
rm -rf "$DST/client/tmp" 2>/dev/null || true

# 2) 镜像 docs 与 .workbuddy
mkdir -p "$DST/docs"
tar -C "$SRC/docs" -cf - . | tar -C "$DST/docs" -xf -
echo "[mirror] docs -> $(find "$DST/docs" -type f 2>/dev/null | wc -l) files"

mkdir -p "$DST/.workbuddy"
tar -C "$SRC/.workbuddy" -cf - . | tar -C "$DST/.workbuddy" -xf -
echo "[mirror] .workbuddy -> $(find "$DST/.workbuddy" -type f | wc -l) files"

# 3) 根目录配置 + 核心文档（排除 .git / 日志 / 构建产物 / .env 明文密钥）
for f in package.json package-lock.json .env.example .gitignore render.yaml Dockerfile docker-compose.yml nginx.conf cloudbaserc.json .dockerignore deploy.cmd README.md PROJECT_ROADMAP.md TECH_DESIGN.md DEPLOY-FULLSTACK.md DEPLOYMENT.md DEVELOPMENT.md CONTRIBUTING.md LICENSE MIGRATION.md; do
  if [ -f "$SRC/$f" ]; then cp "$SRC/$f" "$DST/$f" && echo "[cp] $f"; fi
done

# 4) 防御性清理：根层运行残留（万一出现）
rm -rf "$DST/output" "$DST/rom_ref_unpacked" "$DST/uploads" "$DST/\$null" 2>/dev/null || true

echo "=== DONE sync ==="
echo "精华文件 总文件数: $(find "$DST" -type f | wc -l)"
