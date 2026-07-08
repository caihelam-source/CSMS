@echo off
REM 停止本地 mongod (缓存二进制模式)
tasklist | findstr /i mongod.exe >nul 2>nul
if %errorlevel%==0 (
  taskkill /F /IM mongod.exe >nul 2>nul
  echo ✅ 已停止 mongod
) else (
  echo 未发现运行中的 mongod
)
