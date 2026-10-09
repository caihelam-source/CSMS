<template>
  <view class="page">
    <!-- 顶部品牌区：对齐网页端，深蓝渐变 + 真 Claw 印章 logo -->
    <view class="brand-zone">
      <view class="logo-row">
        <image class="logo-img" src="/static/logo-icon.png" mode="aspectFit" />
        <view class="logo-text">
          <text class="brand-name">CSMS</text>
          <text class="brand-sub">Claw · 香港公司秘书与合规管理系统</text>
        </view>
      </view>

      <text class="slogan">香港公司秘书与合规，一站式掌控</text>
    </view>

    <!-- 白色表单卡：负 margin 上浮，对齐网页端右侧卡片 -->
    <view class="card">
      <text class="card-title">欢迎回来</text>
      <text class="card-sub">登录 CSMS 继续管理公司档案和合规工作</text>

      <view class="field">
        <text class="field-label">账号 / 邮箱</text>
        <input
          class="input"
          v-model="email"
          placeholder="you@firm.com.hk"
          placeholder-class="ph"
        />
      </view>

      <view class="field">
        <text class="field-label">密码</text>
        <input
          class="input"
          v-model="password"
          placeholder="••••••••"
          placeholder-class="ph"
          password
        />
      </view>

      <view class="options-row">
        <view class="remember" @tap="remember = !remember">
          <view class="checkbox" :class="{ checked: remember }">
            <text v-if="remember" class="check-mark">✓</text>
          </view>
          <text class="remember-text">记住我</text>
        </view>
        <text class="forgot" @tap="onForgot">忘记密码？</text>
      </view>

      <button
        class="login-btn"
        :disabled="loading"
        @tap="login"
      >
        {{ loading ? '登录中…' : '登录 →' }}
      </button>

      <button
        v-if="showWechat"
        class="wx-btn"
        :disabled="loading"
        @tap="onWechatLogin"
      >
        <text class="wx-ico">微</text>{{ loading ? '登录中…' : '微信一键登录' }}
      </button>

      <view class="divider">
        <view class="divider-line"></view>
        <text class="divider-text">或使用企业服务</text>
        <view class="divider-line"></view>
      </view>

      <button class="sso-btn" @tap="onSso">企业 SSO 登录</button>

      <view class="register-row">
        <text class="register-text">还没有账号？</text>
        <text class="register-link" @tap="onApply">申请开通</text>
      </view>
    </view>

    <text class="copyright">© 2026 Claw CSMS · 香港企业秘书与合规系统</text>
    <view class="footer-safe"></view>

    <view v-if="bindMode" class="bind-mask">
      <view class="bind-card" @tap.stop>
        <text class="bind-title">绑定已有账号</text>
        <text class="bind-tip">首次使用微信登录。绑定你的邮箱账号即可同步公司、人员等全部数据；也可跳过，直接创建新的微信账号。</text>
        <view class="field">
          <text class="field-label">邮箱</text>
          <input class="input" v-model="bindEmail" placeholder="you@firm.com.hk" placeholder-class="ph" />
        </view>
        <view class="field">
          <text class="field-label">密码</text>
          <input class="input" v-model="bindPassword" password placeholder="••••••••" placeholder-class="ph" />
        </view>
        <button class="login-btn" :disabled="loading" @tap="onBind">绑定并登录</button>
        <text class="bind-skip" @tap="onSkipBind">跳过，创建新微信账号</text>
      </view>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { setToken, setUser, getToken } from '../../utils/auth.js'

export default {
  data() {
    return {
      email: '',
      password: '',
      remember: false,
      loading: false,
      showWechat: process.env.UNI_PLATFORM === 'mp-weixin',
      bindMode: false,
      bindEmail: '',
      bindPassword: '',
      pendingWechatCode: '',
      bindToken: '',
      bindUser: {}
    }
  },
  onLoad() {
    if (getToken()) {
      uni.switchTab({ url: '/pages/companies/companies' })
    }
  },
  methods: {
    onForgot() {
      uni.showToast({ title: '请联系管理员重置密码', icon: 'none' })
    },
    onSso() {
      uni.showToast({ title: '企业 SSO 即将开放', icon: 'none' })
    },
    onApply() {
      uni.showToast({ title: '请联系管理员开通账号', icon: 'none' })
    },
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
        uni.showToast({ title: '欢迎回来', icon: 'success' })
        setTimeout(() => uni.switchTab({ url: '/pages/companies/companies' }), 600)
      } catch (e) {
        uni.showToast({ title: e.message || '登录失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    async onWechatLogin() {
      uni.login({
        provider: 'weixin',
        success: async (res) => {
          if (!res.code) {
            uni.showToast({ title: '微信登录失败：未获取到 code', icon: 'none' })
            return
          }
          this.loading = true
          try {
            const body = await request('/api/auth/wechat-login', {
              method: 'POST',
              data: { code: res.code },
              auth: false,
            })
            if (!body.token) throw new Error(body.message || '微信登录失败')
            if (body.isNew) {
              this.pendingWechatCode = res.code
              this.bindToken = body.token
              this.bindUser = body.user || {}
              this.bindMode = true
              this.loading = false
              return
            }
            setToken(body.token)
            setUser(body.user || {})
            uni.showToast({ title: '微信登录成功', icon: 'success' })
            setTimeout(() => uni.switchTab({ url: '/pages/companies/companies' }), 600)
          } catch (e) {
            uni.showToast({ title: e.message || '微信登录失败', icon: 'none' })
          } finally {
            this.loading = false
          }
        },
        fail: () => {
          uni.showToast({ title: '微信登录已取消或不可用', icon: 'none' })
        },
      })
    },
    async onBind() {
      if (!this.bindEmail || !this.bindPassword) {
        uni.showToast({ title: '请输入邮箱和密码', icon: 'none' })
        return
      }
      this.loading = true
      try {
        const body = await request('/api/auth/wechat-bind', {
          method: 'POST',
          data: { email: this.bindEmail, password: this.bindPassword, code: this.pendingWechatCode },
          auth: false,
        })
        if (!body.token) throw new Error(body.message || '绑定失败')
        setToken(body.token)
        setUser(body.user || {})
        uni.showToast({ title: '已绑定并登录', icon: 'success' })
        setTimeout(() => uni.switchTab({ url: '/pages/companies/companies' }), 600)
      } catch (e) {
        uni.showToast({ title: e.message || '绑定失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    onSkipBind() {
      if (!this.bindToken) return
      setToken(this.bindToken)
      setUser(this.bindUser || {})
      uni.showToast({ title: '已创建微信账号', icon: 'success' })
      setTimeout(() => uni.switchTab({ url: '/pages/companies/companies' }), 600)
    },
    noop() {},
  },
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  background: #f1f5fb;
  display: flex;
  flex-direction: column;
}

/* 品牌区：深蓝渐变，对齐网页端左侧品牌区 */
.brand-zone {
  background: linear-gradient(150deg, #0f2a5e 0%, #1d4ed8 100%);
  padding: 96rpx 56rpx 140rpx;
}
.logo-row {
  display: flex;
  align-items: center;
}
.logo-img {
  width: 108rpx;
  height: 108rpx;
  border-radius: 24rpx;
}
.logo-text {
  margin-left: 26rpx;
  display: flex;
  flex-direction: column;
}
.brand-name {
  color: #ffffff;
  font-size: 44rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
  line-height: 1.1;
}
.brand-sub {
  color: rgba(255, 255, 255, 0.68);
  font-size: 20rpx;
  margin-top: 8rpx;
}
.slogan {
  display: block;
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.4;
  margin-top: 48rpx;
}

/* 表单卡：上浮覆盖品牌区底部 */
.card {
  margin: -100rpx 40rpx 0;
  background: #ffffff;
  border-radius: 32rpx;
  border: 1rpx solid #e2e8f0;
  box-shadow: 0 24rpx 48rpx rgba(15, 42, 94, 0.10);
  padding: 56rpx 44rpx 48rpx;
}
.card-title {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: #0f2a5e;
}
.card-sub {
  display: block;
  font-size: 24rpx;
  color: #64748b;
  margin-top: 12rpx;
  margin-bottom: 40rpx;
}

.field {
  margin-bottom: 28rpx;
}
.field-label {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #16213a;
  margin-bottom: 12rpx;
}
.input {
  width: 100%;
  box-sizing: border-box;
  height: 92rpx;
  background: #f8fafc;
  border: 2rpx solid #e2e8f0;
  border-radius: 16rpx;
  padding: 0 26rpx;
  font-size: 28rpx;
  color: #16213a;
}
.ph {
  color: #94a3b8;
}

.options-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
}
.remember {
  display: flex;
  align-items: center;
}
.checkbox {
  width: 34rpx;
  height: 34rpx;
  border-radius: 8rpx;
  border: 2rpx solid #cbd5e1;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.checkbox.checked {
  background: #2563eb;
  border-color: #2563eb;
}
.check-mark {
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1;
}
.remember-text {
  font-size: 24rpx;
  color: #475569;
  margin-left: 12rpx;
}
.forgot {
  font-size: 24rpx;
  color: #2563eb;
}

/* 登录按钮 */
.login-btn {
  width: 100% !important;
  box-sizing: border-box;
  height: 92rpx;
  line-height: 92rpx;
  padding: 0;
  background: #2563eb;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  border-radius: 16rpx;
  text-align: center;
}
.login-btn::after {
  border: none;
}
.login-btn[disabled] {
  opacity: 0.55;
  color: #ffffff;
  background: #2563eb;
}

/* 微信一键登录按钮 */
.wx-btn {
  width: 100% !important;
  box-sizing: border-box;
  height: 92rpx;
  line-height: 92rpx;
  padding: 0;
  margin-top: 24rpx;
  background: #07c160;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  border-radius: 16rpx;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wx-btn::after {
  border: none;
}
.wx-ico {
  font-weight: 700;
  margin-right: 12rpx;
}

/* 分割线 */
.divider {
  display: flex;
  align-items: center;
  margin: 40rpx 0 32rpx;
}
.divider-line {
  flex: 1;
  height: 1rpx;
  background: #e2e8f0;
}
.divider-text {
  font-size: 22rpx;
  color: #94a3b8;
  padding: 0 20rpx;
}

/* SSO 描边按钮 */
.sso-btn {
  width: 100% !important;
  box-sizing: border-box;
  height: 88rpx;
  line-height: 84rpx;
  padding: 0;
  background: #ffffff;
  color: #16213a;
  font-size: 28rpx;
  font-weight: 500;
  border: 2rpx solid #cbd5e1;
  border-radius: 16rpx;
  text-align: center;
}
.sso-btn::after {
  border: none;
}

.register-row {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 36rpx;
}
.register-text {
  font-size: 22rpx;
  color: #94a3b8;
}
.register-link {
  font-size: 22rpx;
  color: #2563eb;
  font-weight: 600;
  margin-left: 8rpx;
}

.copyright {
  display: block;
  text-align: center;
  font-size: 20rpx;
  color: #94a3b8;
  margin-top: auto;
  padding: 48rpx 0 24rpx;
}
.footer-safe {
  height: env(safe-area-inset-bottom);
}

/* 微信绑定弹层 */
.bind-mask { position: fixed; inset: 0; background: rgba(15,23,42,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 40rpx; }
.bind-card { width: 100%; background: #fff; border-radius: 28rpx; padding: 40rpx 36rpx; box-sizing: border-box; }
.bind-title { font-size: 34rpx; font-weight: 700; color: #0f2a5e; display: block; }
.bind-tip { font-size: 24rpx; color: #64748b; line-height: 1.6; margin: 14rpx 0 26rpx; display: block; }
.bind-skip { display: block; text-align: center; font-size: 26rpx; color: #2563eb; margin-top: 22rpx; }
</style>
