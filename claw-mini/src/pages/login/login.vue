<template>
  <view class="page">
    <!-- 品牌区：模板⑩ 单栏顶部 Logo 居中 -->
    <view class="brand">
      <view class="logo-badge">
        <text class="logo-mark">C</text>
      </view>
      <text class="appname">Claw 公司秘书</text>
      <text class="tagline">香港公司合规管理 · 一站式掌控</text>
    </view>

    <!-- 表单区 -->
    <view class="form">
      <view class="field">
        <text class="field-label">账号</text>
        <input
          class="input"
          v-model="email"
          placeholder="邮箱 / 手机号"
          placeholder-class="ph"
          :adjust-position="true"
        />
      </view>
      <view class="field">
        <text class="field-label">密码</text>
        <input
          class="input"
          v-model="password"
          placeholder="请输入密码"
          placeholder-class="ph"
          password
        />
      </view>

      <button
        class="login-btn"
        :class="{ 'is-loading': loading }"
        :disabled="loading"
        @tap="login"
      >
        {{ loading ? '登录中…' : '登录' }}
      </button>

      <view class="meta">
        <text class="hint">使用你的 Claw 网页端账号登录</text>
        <text class="hint-sub">同一套数据，移动端与网页端实时同步</text>
      </view>
    </view>

    <view class="footer-safe"></view>
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
/* Claw 品牌变量（claw-login-templates 模板⑩ 移动端优先） */
.page {
  min-height: 100vh;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f1f5fb 0%, #eaf1fb 100%);
  padding: 140rpx 48rpx 0;
  display: flex;
  flex-direction: column;
}

/* 品牌区 */
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 88rpx;
}
.logo-badge {
  width: 132rpx;
  height: 132rpx;
  border-radius: 32rpx;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 16rpx 32rpx rgba(37, 99, 235, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-mark {
  color: #ffffff;
  font-size: 72rpx;
  font-weight: 800;
  line-height: 1;
}
.appname {
  margin-top: 32rpx;
  font-size: 40rpx;
  font-weight: 700;
  color: #0f2a5e;
  letter-spacing: 2rpx;
}
.tagline {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #475569;
}

/* 表单区 */
.form {
  display: flex;
  flex-direction: column;
}
.field {
  margin-bottom: 28rpx;
}
.field-label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #16213a;
  margin-bottom: 12rpx;
}
.input {
  width: 100%;
  box-sizing: border-box;
  height: 96rpx; /* 触控目标 ≥48px */
  background: #ffffff;
  border: 2rpx solid #e2e8f0;
  border-radius: 20rpx; /* 单圆角体系：输入框 10px */
  padding: 0 28rpx;
  font-size: 30rpx;
  color: #16213a;
  transition: border-color 0.2s ease;
}
.ph {
  color: #94a3b8;
}

/* 登录按钮：uni button 默认宽度会塌陷，必须显式全宽 */
.login-btn {
  width: 100% !important;
  box-sizing: border-box;
  height: 96rpx;
  line-height: 96rpx;
  margin-top: 16rpx;
  padding: 0;
  background: #2563eb;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
  border-radius: 20rpx; /* 单圆角体系：按钮 10px */
  text-align: center;
}
/* 清除 uni button H5 默认 ::after 描边 */
.login-btn::after {
  border: none;
}
.login-btn[disabled] {
  opacity: 0.55;
  color: #ffffff;
  background: #2563eb;
}

.meta {
  margin-top: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hint {
  font-size: 26rpx;
  color: #475569;
}
.hint-sub {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #94a3b8;
}
.footer-safe {
  height: env(safe-area-inset-bottom);
}
</style>
