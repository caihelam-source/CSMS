#!/bin/bash
# Claw 秘书管理系统 — 一键安装并启动开发环境
# 用法: bash scripts/setup.sh   (或 npm run setup)
# 动作: 安装依赖(root+client) → 启动 MongoDB(优先 Docker，否则用缓存的 mongod.exe) → 并发起前后端
set -u

PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT" || exit 1

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║  Claw 一键安装 / 启动开发环境                       ║"
echo "╚════════════════════════════════════════════════════╝"

# ── [1/4] 安装依赖 ──────────────────────────────────────────
echo ""
echo "=== [1/4] 安装依赖 (root + client) ==="
npm install
( cd client && npm install )

# ── [2/4] 启动 MongoDB ─────────────────────────────────────
echo ""
echo "=== [2/4] 启动 MongoDB ==="
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "→ 检测到 Docker，使用 docker compose 启动 MongoDB (mongo:7)"
  docker compose up -d mongo
  export MONGODB_URI="mongodb://admin:admin123@localhost:27017/company-secretary?authSource=admin"
else
  MONOD=$(find node_modules/.cache/mongodb-memory-server -name 'mongod*.exe' 2>/dev/null | head -1)
  if [ -z "$MONOD" ]; then
    echo "❌ 未找到 mongod 二进制，且 Docker 不可用。"
    echo "   请先运行一次 'node scripts/e2e-regression.js' 让其下载 mongod，或安装 Docker Desktop。"
    exit 1
  fi
  # 转为 Windows 原生路径(原生 mongod.exe 不认 /c/... 形式)
  MONOD_WIN=$(cygpath -w "$MONOD" 2>/dev/null || echo "$MONOD")
  DATA_WIN=$(cygpath -w "$PROJECT/.mongo-data" 2>/dev/null || echo "$PROJECT/.mongo-data")
  mkdir -p "$DATA_WIN"
  echo "→ 使用缓存 mongod: $MONOD_WIN"
  echo "   数据目录: $DATA_WIN"
  "$MONOD_WIN" --dbpath "$DATA_WIN" --port 27017 --bind_ip 127.0.0.1 >/tmp/claw-mongo.log 2>&1 &
  echo $! > /tmp/claw-mongo.pid
  export MONGODB_URI="mongodb://localhost:27017/company-secretary"
fi

# ── [3/4] 等待 MongoDB 就绪 ─────────────────────────────────
echo ""
echo "=== [3/4] 等待 MongoDB 就绪 (127.0.0.1:27017) ==="
READY=0
for i in $(seq 1 40); do
  if node -e "const net=require('net');const s=net.connect(27017,'127.0.0.1');s.on('connect',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  echo "❌ MongoDB 在 40s 内未就绪，请检查日志:"
  [ -f /tmp/claw-mongo.log ] && tail -20 /tmp/claw-mongo.log
  exit 1
fi
echo "✅ MongoDB 就绪 (URI: $MONGODB_URI)"

# ── [4/4] 启动前后端 ───────────────────────────────────────
echo ""
echo "=== [4/4] 启动前后端 (npm run dev) ==="
echo "   后端: http://localhost:5000/api   前端: http://localhost:5173"
echo "   按 Ctrl+C 停止（本地 mongod 后台进程请用 'npm run mongo:stop' 清理）"
echo ""
npm run dev
