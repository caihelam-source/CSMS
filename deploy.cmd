@echo off
REM ============================================================
REM  Claw 一键部署脚本
REM  作用: 提交当前前端改动并推送到 GitHub(main)，
REM        Render 会自动 build + 部署到公共网页。
REM  用法: 在本机双击本文件，或命令行运行 deploy.cmd
REM  前提: 本机已安装 git 且能 push 到 github 远程
REM ============================================================
cd /d "%~dp0"

echo.
echo === Claw Deploy ===
echo [1/3] 暂存改动...
git add -A

echo [2/3] 提交...
set "MSG="
set /p "MSG=Commit message (回车用默认): "
if "%MSG%"=="" set "MSG=chore: update frontend (ROM/ROD templates, signature block, auto-fill)"

git commit -m "%MSG%"
if %errorlevel% neq 0 (
  echo [!] 没有可提交的改动，或 commit 失败，直接尝试推送...
)

echo [3/3] 推送到 GitHub (Render 将自动构建上线)...
git push github main

if %errorlevel%==0 (
  echo.
  echo === 推送成功! Render 正在自动构建，几分钟后公共网页即更新 ===
  echo     前端地址: https://claw-web.onrender.com
) else (
  echo.
  echo === 推送失败 (错误码 %errorlevel%) ===
  echo     请检查: 1) 本机 git 是否能访问 github 远程  2) GitHub 凭证是否有效
)
echo.
pause
