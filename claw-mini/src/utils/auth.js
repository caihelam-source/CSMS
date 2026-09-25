// 登录态本地存储（微信小程序用 uni.setStorageSync，H5/App 同样适用）
const TOKEN_KEY = 'claw_token'
const USER_KEY = 'claw_user'

export function getToken() {
  return uni.getStorageSync(TOKEN_KEY) || ''
}
export function setToken(t) {
  uni.setStorageSync(TOKEN_KEY, t)
}
export function clearToken() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
}
export function setUser(u) {
  uni.setStorageSync(USER_KEY, u || {})
}
export function getUser() {
  return uni.getStorageSync(USER_KEY) || null
}
