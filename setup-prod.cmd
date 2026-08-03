@echo off
REM setup-prod.cmd - 生产库一键初始化：v5.0 迁移 + 计数 + 灌演示数据
REM 密码不落盘：从 env MONGODB_URI 读取，未设置则运行时输入（不写入任何文件）。
cd /d E:\Claw

IF "%MONGODB_URI%"=="" (
  set /p MONGODB_URI=Enter MONGODB_URI (mongodb+srv://user:pwd@host/db): 
)

echo.
echo [1/4] v5.0 迁移 DRY RUN（应为 0 条遗留数据）...
node scripts/migrate-v5.js
echo.
set /p M1=Review migration dry-run. Type APPLY to run --apply (or anything else to skip): 
IF /I "%M1%"=="APPLY" (
  node scripts/migrate-v5.js --apply --i-know-this-is-prod
) ELSE (
  echo Skipped migration apply.
)

echo.
echo [2/4] 当前业务库计数...
node scripts/count-prod.js
echo.
set /p M2=Type SEED to write demo data (or anything else to skip): 
IF /I "%M2%"=="SEED" (
  node scripts/seed-prod.js --apply --i-know-this-is-prod
) ELSE (
  echo Skipped seeding.
)

echo.
echo [3/4] 再次计数确认...
node scripts/count-prod.js

echo.
echo [4/4] 完成。
pause
