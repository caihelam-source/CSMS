@echo off
REM ============================================================
REM  NAR1 批量录入 — 双击即跑 (本机 Windows)
REM  脚本会自动从 .workbuddy/memory/SECRETS.md 读取 Atlas 生产库 URI,
REM  无需手动配置。录完刷新 https://claw-web.onrender.com 即可看到。
REM ============================================================
cd /d C:\Users\Vincent\WorkBuddy\Claw
if not exist "scripts\seed-from-nar1.js" (
  echo [错误] 未找到 scripts\seed-from-nar1.js，请确认本文件在 Claw 项目根目录。
  pause
  exit /b 1
)
echo 正在将 NAR1 识别结果批量录入 CSMS (Atlas 生产库)...
node scripts\seed-from-nar1.js
echo.
echo 退出码: %ERRORLEVEL%
if not "%ERRORLEVEL%"=="0" (
  echo [失败] 请查看上方报错 (常见: 网络连不上 Atlas / 依赖未安装)。
) else (
  echo [成功] 录入完成，可刷新线上 https://claw-web.onrender.com 查看。
)
pause
