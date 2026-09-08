/**
 * 全局 Toast 封装（react-hot-toast）
 * ───────────────────────────────────────────
 * 解决截图里"双红条"问题：多个独立请求并发失败时，每个组件 catch 各 toast 一次，
 * react-hot-toast 无内建去重。这里在模块级做 1.5s 同消息去重——
 * 配合 api.js 拦截器把后端冷启动错误统一成同一文案，并发的 cold-start 失败只会显示一条。
 *
 * 用法：import { notify } from '../services/notify'
 *   notify.error('...') / notify.success('...') / notify.info('...') / notify.loading('...')
 */
import toast from 'react-hot-toast'

const DEDUP_MS = 1500
const seen = new Map() // key(msg) -> timestamp

function emit(type, msg, opts) {
  const now = Date.now()
  const key = String(msg)
  const last = seen.get(key)
  if (last && now - last < DEDUP_MS) return // 窗口内重复 → 跳过
  seen.set(key, now)
  // 轻量清理，防止 Map 无限增长
  if (seen.size > 80) {
    for (const [k, t] of seen) if (now - t > DEDUP_MS) seen.delete(k)
  }
  if (type === 'error') return toast.error(msg, opts)
  if (type === 'success') return toast.success(msg, opts)
  if (type === 'loading') return toast.loading(msg, opts)
  return toast(msg, opts) // info / default
}

export const notify = {
  error: (msg, opts) => emit('error', msg, opts),
  success: (msg, opts) => emit('success', msg, opts),
  info: (msg, opts) => emit('info', msg, opts),
  loading: (msg, opts) => emit('loading', msg, opts),
}

export default notify
