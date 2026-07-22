# 登记册预览功能

## 完成内容

为公司登记册（ROD / ROM / Secretary）增加了「预览」按钮和 HTML 预览弹窗。

## 改动文件

- `client/src/pages/CompanyDetail.jsx`

## 关键实现

1. 每个登记册标题栏新增「预览」按钮（Eye 图标），位于「生成 Word」左侧。
2. 点击后弹出 xl 尺寸 Modal，按当前选择的地区和用途渲染预览：
   - 公司英/中文名、公司编号、属地、日期、用途标签。
   - 大标题 REGISTER OF DIRECTORS / MEMBERS / SECRETARIES。
   - 分「现任」「历任」两节表格，字段与 Word 版对齐。
   - BVI 格式提示含多表分栏；bank/audit 提示含签字栏。
3. Secretary 登记册暂无 Word 生成器，也同步提供数据预览。

## 验证与部署

- ESLint 0 error
- vite build 0 error（built in 1m 41s）
- 推送 commit `ac0ce5b50c211da21f3d77a1fe434ca46e6a536a`，Render 自动重建中。
