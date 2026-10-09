const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: false,
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'secretary', 'manager', 'viewer', 'auditor'],
    default: 'viewer'
  },
  // Wave 0 rev2 — 行级权限：该登录用户可访问的公司范围（公司秘书多集团场景下按集团隔离数据）
  // admin / auditor 免过滤（见 middleware/scope.js）；其余角色只看 accessibleCompanies 内的公司数据
  accessibleCompanies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  }],
  phone: {
    type: String,
    trim: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // 微信登录：小程序 wx.login 换得的 openid 绑定到同一 User，实现「微信 / 邮箱同源同数据」
  wechatOpenid: {
    type: String,
    unique: true,
    sparse: true
  },
  wechatUnionid: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
