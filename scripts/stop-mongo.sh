#!/bin/bash
# 停止一键脚本(localhost mongod 缓存二进制模式)启动的 MongoDB
set -u
if [ -f /tmp/claw-mongo.pid ]; then
  PID=$(cat /tmp/claw-mongo.pid)
  echo "停止 mongod (pid $PID)..."
  kill "$PID" 2>/dev/null && echo "✅ 已停止" || echo "进程不存在或已退出"
  rm -f /tmp/claw-mongo.pid
else
  echo "未找到 pid 文件，尝试按进程名查找..."
  if pkill -f "mongod-x64-win32" 2>/dev/null; then
    echo "✅ 已停止"
  else
    echo "未发现运行中的本地 mongod"
  fi
fi
