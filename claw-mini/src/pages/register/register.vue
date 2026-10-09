<template>
  <view class="page">
    <view class="brand-zone">
      <view class="logo-row">
        <image class="logo-img" src="/static/logo-icon.png" mode="aspectFit" />
        <view class="logo-text">
          <text class="brand-name">CSMS</text>
          <text class="brand-sub">Claw · 香港公司秘书与合规管理系统</text>
        </view>
      </view>
      <text class="slogan">创建你的 CSMS 账号</text>
    </view>

    <view class="card">
      <text class="card-title">注册账号</text>
      <text class="card-sub">填写信息以开通 CSMS 访问权限</text>

      <view class="field">
        <text class="field-label">姓名 *</text>
        <input class="input" v-model="name" placeholder="你的姓名" placeholder-class="ph" />
      </view>

      <view class="field">
        <text class="field-label">邮箱 *</text>
        <input class="input" v-model="email" placeholder="you@firm.com.hk" placeholder-class="ph" />
      </view>

      <view class="field">
        <text class="field-label">密码 *</text>
        <input class="input" v-model="password" placeholder="至少 6 位" placeholder-class="ph" password />
      </view>

      <view class="field">
        <text class="field-label">确认密码 *</text>
        <input class="input" v-model="confirm" placeholder="再次输入密码" placeholder-class="ph" password />
      </view>

      <view class="field">
        <text class="field-label">邀请码（如已获发）</text>
        <input class="input" v-model="inviteToken" placeholder="联系管理员获取（可选）" placeholder-class="ph" />
      </view>

      <button class="submit" :disabled="loading" @tap="submit">{{ loading ? '注册中…' : '注册并登录' }}</button>

      <view class="login-row">
        <text class="login-text">已有账号？</text>
        <text class="login-link" @tap="goLogin">返回登录</text>
      </view>
    </view>

    <text class="copyright">© 2026 Claw CSMS · 香港企业秘书与合规系统</text>
    <view class="footer-safe"></view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { setToken, setUser } from '../../utils/auth.js'

export default {
  data() {
    return {
      name: '',
      email: '',
      password: '',
      confirm: '',
      inviteToken: '',
      loading: false,
    }
  },
  methods: {
    goLogin() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/login/login' }) }) },
    async submit() {
      if (!this.name || !this.email || !this.password) {
        uni.showToast({ title: '请填写姓名、邮箱与密码', icon: 'none' })
        return
      }
      if (this.password.length < 6) {
        uni.showToast({ title: '密码至少 6 位', icon: 'none' })
        return
      }
      if (this.password !== this.confirm) {
        uni.showToast({ title: '两次密码不一致', icon: 'none' })
        return
      }
      this.loading = true
      try {
        const body = await request('/api/auth/register', {
          method: 'POST',
          data: {
            name: this.name,
            email: this.email,
            password: this.password,
            inviteToken: this.inviteToken || undefined,
          },
          auth: false,
        })
        if (!body.token) throw new Error(body.message || '注册失败')
        setToken(body.token)
        setUser(body.user || {})
        uni.showToast({ title: '注册成功', icon: 'success' })
        setTimeout(() => uni.switchTab({ url: '/pages/companies/companies' }), 600)
      } catch (e) {
        // 后端为邀请制：未配置/不匹配邀请码会返回 403 提示
        uni.showToast({ title: e.message || '注册失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style scoped>
.page { min-height: 100vh; box-sizing: border-box; background: #f1f5fb; display: flex; flex-direction: column; }
.brand-zone { background: linear-gradient(150deg, #0f2a5e 0%, #1d4ed8 100%); padding: 96rpx 56rpx 140rpx; }
.logo-row { display: flex; align-items: center; }
.logo-img { width: 108rpx; height: 108rpx; border-radius: 24rpx; }
.logo-text { margin-left: 26rpx; display: flex; flex-direction: column; }
.brand-name { color: #ffffff; font-size: 44rpx; font-weight: 800; letter-spacing: 2rpx; line-height: 1.1; }
.brand-sub { color: rgba(255,255,255,0.68); font-size: 20rpx; margin-top: 8rpx; }
.slogan { display: block; color: #ffffff; font-size: 36rpx; font-weight: 700; line-height: 1.4; margin-top: 48rpx; }
.card { margin: -100rpx 40rpx 0; background: #ffffff; border-radius: 32rpx; border: 1rpx solid #e2e8f0; box-shadow: 0 24rpx 48rpx rgba(15,42,94,0.10); padding: 56rpx 44rpx 48rpx; }
.card-title { display: block; font-size: 40rpx; font-weight: 800; color: #0f2a5e; }
.card-sub { display: block; font-size: 24rpx; color: #64748b; margin-top: 12rpx; margin-bottom: 40rpx; }
.field { margin-bottom: 28rpx; }
.field-label { display: block; font-size: 24rpx; font-weight: 600; color: #16213a; margin-bottom: 12rpx; }
.input { width: 100%; box-sizing: border-box; height: 92rpx; background: #f8fafc; border: 2rpx solid #e2e8f0; border-radius: 16rpx; padding: 0 26rpx; font-size: 28rpx; color: #16213a; }
.ph { color: #94a3b8; }
.submit { width: 100% !important; box-sizing: border-box; height: 92rpx; line-height: 92rpx; padding: 0; background: #2563eb; color: #ffffff; font-size: 30rpx; font-weight: 600; border: none; border-radius: 16rpx; text-align: center; margin-top: 8rpx; }
.submit::after { border: none; }
.submit[disabled] { opacity: 0.55; }
.login-row { display: flex; align-items: center; justify-content: center; margin-top: 32rpx; }
.login-text { font-size: 22rpx; color: #94a3b8; }
.login-link { font-size: 22rpx; color: #2563eb; font-weight: 600; margin-left: 8rpx; }
.copyright { display: block; text-align: center; font-size: 20rpx; color: #94a3b8; margin-top: auto; padding: 48rpx 0 24rpx; }
.footer-safe { height: env(safe-area-inset-bottom); }
</style>
