// 响应归一化（纯函数，可单测）
// 后端返回两种形状：
//   1) 双层 { data: { data: X } }        —— 直接透传
//   2) 单层 { success, data: X }         —— 包成 { data: { data: X } }
//   3) 扁平 { success, personnel } 等     —— 提取主负载实体键
// 统一归一化为前端期望的 { data: { data: X } }，消除 Mock / 真实后端差异。

// 单数键在前（getOne / create / update 返回单条），复数键在后（getAll 返回列表）。
// ⚠️ 新增后端路由时务必同步补充主负载键，否则 normalize 会落到步骤 4 兜底，
// 把整个 body（如 { success, count, rules }）当作 payload 交给前端，
// 导致组件上 .filter / .map 调用报 "xxx.filter is not a function" 白屏。
const ENTITY_KEYS = [
  'personnel', 'company', 'document', 'meeting', 'task', 'reminder', 'rule', 'template', 'signTask',
  'companies', 'documents', 'meetings', 'tasks', 'reminders', 'rules', 'personnelList', 'links', 'link',
]

export const normalize = (body) => {
  // 1) 后端已双层嵌套 —— 直接透传
  if (body && typeof body === 'object' && body.data && typeof body.data === 'object' && 'data' in body.data) {
    return { data: body.data }
  }
  // 2) 后端单层嵌套 { success, data: X } —— 包成 { data: { data: X } }
  if (body && typeof body === 'object' && body.data !== undefined) {
    return { data: { data: body.data } }
  }
  // 3) 扁平响应 { success, personnel } 等 —— 提取主负载
  for (const k of ENTITY_KEYS) {
    if (body && body[k] !== undefined) return { data: { data: body[k] } }
  }
  // 4) 兜底：整包作为 payload
  return { data: { data: body } }
}
