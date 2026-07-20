// RBAC 权限矩阵（Wave 0 rev2 — 5 角色）
// 角色等级：admin(超级用户) > auditor(审计只读·跨公司) > secretary/manager > viewer
// 权限动作：view（只读）/ edit（增改）/ upload（上传文件）/ manageUsers（用户管理）/ delete（删除）
const PERMISSIONS = {
  admin: ['view', 'edit', 'upload', 'manageUsers', 'delete'],
  auditor: ['view'],
  secretary: ['view', 'edit', 'upload'],
  manager: ['view', 'edit', 'upload'],
  viewer: ['view'],
}

// 行级权限豁免角色：这些角色不受 accessibleCompanies 约束（admin=全量管理，auditor=跨公司审计只读）
const SCOPE_BYPASS_ROLES = ['admin', 'auditor'];

// 判断某角色是否拥有某权限
const can = (role, action) => {
  const perms = PERMISSIONS[role]
  if (!perms) return false
  return perms.includes('*') || perms.includes(action)
}

// 角色是否 >= 给定角色等级（用于 requireRole）
const RANK = { viewer: 0, manager: 1, secretary: 1, auditor: 2, admin: 3 }
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

module.exports = { PERMISSIONS, can, atLeast, requireRole, requirePermission, requireAdmin, SCOPE_BYPASS_ROLES }
