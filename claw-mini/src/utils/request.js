import { API_BASE } from '../config.js'
import { getToken, clearToken } from './auth.js'

// 统一的 claw-api 请求封装（基于 uni.request，兼容微信小程序 / H5 / App）
// 成功返回 res.data（即后端 body）；401 自动清登录态并跳登录页。
export function request(path, { method = 'GET', data, auth = true } = {}) {
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' }
    if (auth) {
      const t = getToken()
      if (t) header['Authorization'] = 'Bearer ' + t
    }
    uni.request({
      url: API_BASE + path,
      method,
      data,
      header,
      success: (res) => {
        const body = res.data
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body)
        } else if (res.statusCode === 401) {
          clearToken()
          uni.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
          uni.reLaunch({ url: '/pages/login/login' })
          reject(new Error(body && body.message ? body.message : '未授权'))
        } else {
          reject(new Error(body && body.message ? body.message : '请求失败 (' + res.statusCode + ')'))
        }
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) ? err.errMsg : '网络错误'))
      },
    })
  })
}
