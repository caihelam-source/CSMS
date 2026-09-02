@echo off
chcp 65001 >nul
cd /d "C:\Users\Vincent\WorkBuddy\Claw"
echo ============================================================
echo  NAR1 全量落库 (覆盖刷新模式 --overwrite)
echo  数据源: scripts/_nar1_recognized.json (已修正人名)
echo  动作: 已存在公司/人员/法人实体也按修正后 JSON 更新字段(不删、不覆盖 notes)
echo        并重新上传 14 份 NAR1 PDF + BR 证书 PDF 到 Cloudflare R2 补文件引用
echo  凭证: 自动从 .workbuddy\memory\SECRETS.md 读取 Atlas URI + R2_*
echo ============================================================
node scripts/seed-nar1-full.js --overwrite
echo.
echo 执行完毕，按任意键关闭窗口...
pause >nul
