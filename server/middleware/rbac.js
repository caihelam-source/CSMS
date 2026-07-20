// RBAC 权限矩阵（Wave 0 — 统一 4 角色）
// 角色：admin > secretary/manager > viewer
// 权限动作：view（只读）/ edit（增改）/ upload（上传文件）/ manageUsers（用户管理）/ delete（删除）
const PERMISSIONS = {
  admin: ['view', 'edit', 'upload', 'manageUsers', 'delete'],
  secretary: ['view', 'edit', 'upload'],
  manager: ['view', 'edit', 'upload'],
  viewer: ['view'],
}

// 判断某角色是否拥有某权限
const can = (role, action) => {
  const perms = PERMISSIONS[role]
  if (!perms) return false
  return perms.includes('*') || perms.includes(action)
}

// 角色是否 >= 给定角色等级（用于 requireRole）
const RANK = { viewer: 0, manager: 1, secretary: 1, admin: 2 }
const atLeast = (role, minRole) => (RANK[role] ?? -1) >= (RANK[minRole] ?? 0)

// Express 中间件：要求角色属于给定列表之一
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' })
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: `Access denied. Required role: ${roles.join(' / ')}.` })
  }
  next()
}

// Express 中间件：要求拥有某权限
const requirePermission = (action) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' })
  if (!can(req.user.role, action)) {
    return res.status(403).json({ message: `Access denied. Missing permission: ${action}.` })
  }
  next()
}

// 兼容既有 adminAuth 语义：仅 admin
const requireAdmin = requireRole('admin')

module.exports = { PERMISSIONS, can, atLeast, requireRole, requirePermission, requireAdmin }
