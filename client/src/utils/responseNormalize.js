// 响应归一化（纯函数，可单测）
// 后端返回两种形状：
//   1) 双层 { data: { data: X } }        —— 直接透传
//   2) 单层 { success, data: X }         —— 包成 { data: { data: X } }
//   3) 扁平 { success, personnel } 等     —— 提取主负载实体键
// 统一归一化为前端期望的 { data: { data: X } }，消除 Mock / 真实后端差异。

const ENTITY_KEYS = [
  'personnel', 'company', 'document', 'meeting', 'task', 'reminder', 'template', 'signTask',
  'companies', 'documents', 'meetings', 'tasks', 'reminders', 'personnelList', 'links', 'link',
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
