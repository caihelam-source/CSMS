// claw-api 生产地址。
// ⚠️ 微信小程序生产环境要求：在「微信公众平台 → 开发 → 开发管理 → 服务器域名 → request 合法域名」
// 中加入 https://claw-api-5zq7.onrender.com （必须是 https 且备案/校验通过）。
// 开发阶段可在 manifest.json 的 mp-weixin.setting.urlCheck=false 关闭校验。
//
// 如需连本地/内网后端联调：把下面改成 http://<你的局域网IP>:4000 等，并确保手机与后端同网段。
export const API_BASE = 'https://claw-api-5zq7.onrender.com'
