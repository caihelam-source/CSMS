#!/bin/bash
# Claw 端到端回归测试 — 一键编排脚本
# 前置: 已将 MongoDB 8.2.6 Windows 二进制下载到 /tmp/mongo-bin/mongo.zip
# 用法: bash scripts/run-e2e.sh
set -u

ZIP=/tmp/mongo-bin/mongo.zip
EXPECTED=819033833
EXTRACT=/tmp/mongo-bin/extract
PROJECT=/c/Users/Vincent/WorkBuddy/Claw

echo "=== [1/4] 校验 zip 完整性 ==="
if [ ! -f "$ZIP" ]; then echo "❌ 找不到 $ZIP"; exit 1; fi
SIZE=$(stat -c%s "$ZIP" 2>/dev/null || echo 0)
if [ "$SIZE" -ne "$EXPECTED" ]; then
  echo "❌ zip 大小不符: $SIZE / $EXPECTED (未下载完整?)"
  exit 1
fi
if ! unzip -t "$ZIP" >/dev/null 2>&1; then
  echo "❌ zip 校验失败 (损坏)"; exit 1
fi
echo "✅ zip 完整 ($SIZE bytes)"

echo ""
echo "=== [2/4] 提取 mongod.exe ==="
rm -rf "$EXTRACT"
unzip -o -q "$ZIP" -d "$EXTRACT"
MONOD=$(find "$EXTRACT" -name mongod.exe | head -1)
if [ -z "$MONOD" ]; then echo "❌ 未找到 mongod.exe"; exit 1; fi
# 转为 Windows 原生路径(原生 Node 不认 /tmp 形式的 Unix 路径)
MONOD_WIN=$(cygpath -w "$MONOD" 2>/dev/null || echo "$MONOD")
echo "✅ mongod.exe: $MONOD_WIN"

echo ""
echo "=== [3/4] 启动内存 MongoDB + 后端 + 跑全模块回归 ==="
cd "$PROJECT" || exit 1
export MONGOMS_SYSTEM_BINARY="$MONOD_WIN"
export E2E_VERBOSE=1
node scripts/e2e-regression.js
RC=$?

echo ""
echo "=== [4/4] 结果 ==="
if [ $RC -eq 0 ]; then
  echo "🎉 端到端回归全部通过"
else
  echo "⚠️  端到端回归存在失败项 (退出码 $RC)"
fi
exit $RC
