<template>
  <view class="page">
    <view class="brand">
      <view class="logo">Claw</view>
      <text class="appname">Claw 公司秘书</text>
      <text class="tagline">香港公司合规管理</text>
    </view>

    <view class="form">
      <input class="input" v-model="email" placeholder="邮箱 / 手机号" />
      <input class="input" v-model="password" placeholder="密码" password />
      <button class="login-btn" :disabled="loading" :loading="loading" @tap="login">
        {{ loading ? '登录中' : '登录' }}
      </button>
      <text class="hint">使用你的 Claw 网页端账号登录（同一套数据）</text>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { setToken, setUser, getToken } from '../../utils/auth.js'

export default {
  data() {
    return { email: '', password: '', loading: false }
  },
  onLoad() {
    if (getToken()) {
      uni.reLaunch({ url: '/pages/gaps/gaps' })
    }
  },
  methods: {
    async login() {
      if (!this.email || !this.password) {
        uni.showToast({ title: '请输入账号和密码', icon: 'none' })
        return
      }
      this.loading = true
      try {
        const body = await request('/api/auth/login', {
          method: 'POST',
          data: { email: this.email, password: this.password },
          auth: false,
        })
        if (!body.token) throw new Error(body.message || '登录失败')
        setToken(body.token)
        setUser(body.user || {})
        uni.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => uni.reLaunch({ url: '/pages/gaps/gaps' }), 600)
      } catch (e) {
        uni.showToast({ title: e.message || '登录失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style scoped>
.page {
  padding: 120rpx 56rpx 80rpx;
}
.brand {
  text-align: center;
  margin-bottom: 80rpx;
}
.logo {
  font-size: 76rpx;
  font-weight: 800;
  color: #2563eb;
  letter-spacing: 2rpx;
}
.appname {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #111827;
  margin-top: 16rpx;
}
.tagline {
  display: block;
  font-size: 26rpx;
  color: #6b7280;
  margin-top: 8rpx;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.input {
  background: #fff;
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
  padding: 28rpx 24rpx;
  font-size: 30rpx;
  color: #111827;
}
.login-btn {
  background: #2563eb;
  color: #fff;
  border-radius: 14rpx;
  padding: 28rpx 0;
  font-size: 32rpx;
  margin-top: 12rpx;
  border: none;
}
.login-btn[disabled] {
  opacity: 0.6;
}
.hint {
  font-size: 24rpx;
  color: #9ca3af;
  text-align: center;
  margin-top: 12rpx;
}
</style>
