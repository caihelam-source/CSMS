@echo off
REM Claw 秘书管理系统 — 一键安装并启动开发环境 (Windows)
REM 用法: scripts\setup.cmd   (或 npm run setup)
setlocal
cd /d %~dp0\..

echo.
echo ╔════════════════════════════════════════════════════╗
echo ║  Claw 一键安装 / 启动开发环境                       ║
echo ╚════════════════════════════════════════════════════╝

REM ── [1/4] 安装依赖 ──────────────────────────────────────
echo.
echo === [1/4] 安装依赖 (root + client) ===
call npm install
cd client && call npm install && cd ..

REM ── [2/4] 启动 MongoDB ─────────────────────────────────
echo.
echo === [2/4] 启动 MongoDB ===
where docker >nul 2>nul
if %errorlevel%==0 (
  docker info >nul 2>nul
  if %errorlevel%==0 (
    echo -^> 检测到 Docker，使用 docker compose 启动 MongoDB
    docker compose up -d mongo
    set "MONGODB_URI=mongodb://admin:admin123@localhost:27017/company-secretary?authSource=admin"
    goto :wait
  )
)
REM 回退: 使用缓存的 mongod.exe
set "MONOD="
for /f "delims=" %%f in ('dir /b /s node_modules\.cache\mongodb-memory-server\mongod*.exe 2^>nul') do set "MONOD=%%f"
if not defined MONOD (
  echo ❌ 未找到 mongod，且 Docker 不可用。请先运行 node scripts\e2e-regression.js 下载，或安装 Docker Desktop。
  exit /b 1
)
if not exist .mongo-data mkdir .mongo-data
echo -^> 使用缓存 mongod: %MONOD%
echo    数据目录: %CD%\.mongo-data
start "" /b "%MONOD%" --dbpath "%CD%\.mongo-data" --port 27017 --bind_ip 127.0.0.1 > .mongo-data\mongo.log 2>&1
set "MONGODB_URI=mongodb://localhost:27017/company-secretary"

:wait
REM ── [3/4] 等待 MongoDB 就绪 ─────────────────────────────
echo.
echo === [3/4] 等待 MongoDB 就绪 (127.0.0.1:27017) ===
:waitloop
node -e "const net=require('net');const s=net.connect(27017,'127.0.0.1');s.on('connect',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));" >nul 2>nul
if %errorlevel%==0 goto :ready
timeout /t 1 >nul
goto :waitloop
:ready
echo ✅ MongoDB 就绪 (URI: %MONGODB_URI%)

REM ── [4/4] 启动前后端 ───────────────────────────────────
echo.
echo === [4/4] 启动前后端 (npm run dev) ===
echo    后端: http://localhost:5000/api   前端: http://localhost:5173
echo    按 Ctrl+C 停止
echo.
call npm run dev
