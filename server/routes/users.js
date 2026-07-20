const express = require('express');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// 所有用户管理端点都要求已登录 + admin 角色
router.use(auth);
router.use(adminAuth);

// GET /api/users — 列出全部用户（不含密码）
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: 1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users — 管理员创建用户（可指定角色）
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role, phone, company } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email and password are required' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }
    const validRoles = ['admin', 'secretary', 'manager', 'viewer'];
    const safeRole = validRoles.includes(role) ? role : 'viewer';
    const user = await User.create({
      name,
      email,
      password,
      role: safeRole,
      phone,
      company,
      isActive: true,
    });
    const { password: _pw, ...safe } = user.toObject();
    res.status(201).json({ success: true, data: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id — 管理员更新角色 / 状态 / 资料
router.put('/:id', async (req, res) => {
  try {
    const { name, role, phone, isActive } = req.body;
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    if (role !== undefined) {
      const validRoles = ['admin', 'secretary', 'manager', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
      target.role = role;
    }
    if (name !== undefined) target.name = name;
    if (phone !== undefined) target.phone = phone;
    if (isActive !== undefined) target.isActive = isActive;

    await target.save();
    const { password: _pw, ...safe } = target.toObject();
    res.json({ success: true, data: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/:id — 管理员删除用户（禁止删除自己）
router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    await target.deleteOne();
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
