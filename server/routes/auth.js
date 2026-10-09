const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, company, inviteToken } = req.body

    // Wave 0 安全：关闭公开自封，仅允许持有有效邀请令牌注册
    const REQUIRED_TOKEN = process.env.REGISTER_INVITE_TOKEN
    if (REQUIRED_TOKEN && inviteToken !== REQUIRED_TOKEN) {
      return res.status(403).json({ message: 'Registration is invite-only. Contact an administrator for an invite token.' })
    }
    if (!REQUIRED_TOKEN) {
      return res.status(403).json({ message: 'Open registration is disabled. Users are created by an administrator.' })
    };

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create user (self-register via invite → 默认 viewer，角色由管理员在 /api/users 调整)
    const user = await User.create({
      name,
      email,
      password,
      role: 'viewer',
      phone,
      company
    });

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        // 行级数据权限：前端据此做渲染期无声过滤（缺失=不过滤，[]=明确无授权）
        accessibleCompanies: user.accessibleCompanies || []
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean().populate('company', 'name registrationNumber');
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/wechat-login
// @desc    微信小程序一键登录：wx.login code -> code2Session -> openid -> 建/查 User -> JWT
// @access  Public
router.post('/wechat-login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: '缺少 wx.login 返回的 code' });

    const appid = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_APPSECRET;
    if (!appid || !secret) {
      return res.status(500).json({ message: '服务端未配置 WECHAT_APPID / WECHAT_APPSECRET' });
    }

    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
    const wxRes = await fetch(wxUrl);
    const wxData = await wxRes.json();

    if (wxData.errcode) {
      return res.status(401).json({ message: `微信登录失败：${wxData.errmsg || wxData.errcode}` });
    }
    const { openid, unionid } = wxData;
    if (!openid) return res.status(401).json({ message: '微信未返回 openid' });

    let user = await User.findOne({ wechatOpenid: openid });
    let isNew = false;
    if (!user) {
      isNew = true;
      user = await User.create({
        name: '微信用户',
        email: `wx_${openid}@claw.local`,
        wechatOpenid: openid,
        wechatUnionid: unionid || undefined,
        role: 'viewer'
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      token,
      isNew,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        accessibleCompanies: user.accessibleCompanies || []
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/wechat-bind
// @desc    将微信 openid 绑定到已有邮箱账号（校验邮箱+密码后写入 wechatOpenid）
// @access  Public
router.post('/wechat-bind', async (req, res) => {
  try {
    const { email, password, code } = req.body;
    if (!email || !password || !code) {
      return res.status(400).json({ message: '缺少 email / password / code' });
    }
    const appid = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_APPSECRET;
    if (!appid || !secret) {
      return res.status(500).json({ message: '服务端未配置 WECHAT_APPID / WECHAT_APPSECRET' });
    }

    const wxRes = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`);
    const wxData = await wxRes.json();
    if (wxData.errcode || !wxData.openid) {
      return res.status(401).json({ message: `微信校验失败：${wxData.errmsg || wxData.errcode}` });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(401).json({ message: '账号不存在' });
    if (!user.password) return res.status(401).json({ message: '该账号未设置密码，无法绑定' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: '邮箱或密码错误' });

    const conflict = await User.findOne({ wechatOpenid: wxData.openid });
    if (conflict && String(conflict._id) !== String(user._id)) {
      return res.status(409).json({ message: '该微信已绑定其他账号' });
    }
    user.wechatOpenid = wxData.openid;
    if (wxData.unionid) user.wechatUnionid = wxData.unionid;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        accessibleCompanies: user.accessibleCompanies || []
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
