@echo off
REM migrate-apply.cmd - v5.0 data migration: dry-run -> backup -> apply
REM Password is NOT hardcoded. It is read from env MONGODB_URI, or prompted at runtime (not saved to disk).
cd /d E:\Claw

IF "%MONGODB_URI%"=="" (
  set /p MONGODB_URI=Enter MONGODB_URI (mongodb+srv://user:pwd@host/db): 
)

echo.
echo [1/3] DRY RUN (no writes, just stats + reconciliation)...
node scripts/migrate-v5.js
IF ERRORLEVEL 1 (
  echo.
  echo DRY RUN failed. Aborting - nothing changed.
  pause
  exit /b 1
)

echo.
set /p CONFIRM=Review the dry-run output. Type APPLY to continue (backup + apply), anything else to abort: 
IF /I NOT "%CONFIRM%"=="APPLY" (
  echo.
  echo Aborted by user. No changes made.
  pause
  exit /b 0
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd"') do set DT=%%i
echo.
echo [2/3] Backing up via mongodump to ./backup-%DT% ...
mongodump --uri "%MONGODB_URI%" --out "./backup-%DT%"
IF ERRORLEVEL 1 (
  echo.
  echo mongodump failed. Aborting BEFORE apply - your data is untouched.
  pause
  exit /b 1
)

echo.
echo [3/3] APPLY (writes Company.links[]; old tables kept)...
node scripts/migrate-v5.js --apply --i-know-this-is-prod
echo.
echo Done. Review the verification summary above.
pause
