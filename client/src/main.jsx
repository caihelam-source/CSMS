import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
            {/* Batch 07 · Toast（深色圆角 pill，对齐设计语言）：navy 底 + 圆角 + 柔阴影 */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3200,
                style: {
                  background: 'rgb(15 23 42)',
                  color: '#fff',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,.08)',
                  boxShadow: '0 10px 30px rgba(15,23,42,.35)',
                  fontSize: '14px',
                  padding: '10px 14px',
                  maxWidth: '340px',
                },
                success: { iconTheme: { primary: '#22C55E', secondary: '#0F172A' } },
                error: { iconTheme: { primary: '#EF4444', secondary: '#0F172A' } },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

// ── PWA：生产构建注册 SW + 安装/更新 UX（D-W3 增强）─────────────
// 仅生产构建执行（dev 下跳过，避免缓存干扰 HMR 调试）。
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // 轻量原生 toast（不依赖 React 树，SW 事件在 React 之外触发）
  const mountPwaToast = (title, actionText, onAction) => {
    const old = document.getElementById('pwa-toast')
    if (old) old.remove()
    const el = document.createElement('div')
    el.id = 'pwa-toast'
    el.setAttribute('role', 'status')
    el.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:9999;max-width:340px;' +
      'background:#0f172a;color:#fff;border-radius:12px;padding:12px 14px;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.28);font:14px/1.4 system-ui,-apple-system,sans-serif;' +
      'display:flex;align-items:center;gap:10px;'
    const span = document.createElement('span')
    span.style.flex = '1'
    span.textContent = title
    const btn = document.createElement('button')
    btn.textContent = actionText
    btn.style.cssText =
      'background:#2563EB;color:#fff;border:0;border-radius:8px;padding:6px 12px;' +
      'font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;'
    btn.onclick = () => {
      el.remove()
      if (onAction) onAction()
    }
    const close = document.createElement('button')
    close.id = 'pwa-toast-close'
    close.textContent = '×'
    close.setAttribute('aria-label', '关闭')
    close.style.cssText = 'background:transparent;border:0;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;'
    close.onclick = () => el.remove()
    el.append(span, btn, close)
    document.body.appendChild(el)
  }

  // 捕获浏览器原生「安装到主屏」提示，转为可控 UI（否则某些浏览器永不提示）
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    window.__deferredPWA = e
    mountPwaToast('将 CSMS 安装到主屏，离线也能用', '安装', () => {
      const ev = window.__deferredPWA
      if (!ev) return
      ev.prompt()
      ev.userChoice.finally(() => {
        window.__deferredPWA = null
      })
    })
  })
  window.addEventListener('appinstalled', () => {
    window.__deferredPWA = null
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // 新版本就绪 → 提示用户刷新（仅当已有旧 SW 在控，避免首装误报）
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              mountPwaToast('CSMS 已发布新版本', '刷新', () => {
                const waiting = reg.waiting || navigator.serviceWorker.controller
                if (waiting) waiting.postMessage('SKIP_WAITING')
                window.location.reload()
              })
            }
          })
        })
      })
      .catch(() => {})
  })
}
// force rebuild 1787837274
