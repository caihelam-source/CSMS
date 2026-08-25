const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {});

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    next();
  } catch {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

/**
 * 编辑者鉴权：admin 或 secretary 可执行模板写操作。
 * 等价于 auth + 角色校验，否则返回 403。
 * @param {import('express').Request} req Express 请求
 * @param {import('express').Response} res Express 响应
 * @param {import('express').NextFunction} next 下一中间件
 */
const editorAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {});

    const role = req.user && req.user.role;
    if (role !== 'admin' && role !== 'secretary') {
      return res.status(403).json({ message: 'Access denied. Editor (admin or secretary) only.' });
    }

    next();
  } catch {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports = { auth, adminAuth, editorAuth };
