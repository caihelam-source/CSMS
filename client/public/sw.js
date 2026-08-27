// CSMS PWA Service Worker —— 网络优先 + HTML 不缓存（破除微信/浏览器顽固缓存旧包）
// 关键修复：导航请求（index.html）强制 cache:'no-cache'，确保每次都拿到最新入口，
// 从而引用最新哈希 chunk；否则微信 WebView 会顽固缓存旧 index.html → 旧 chunk → 永远旧版。
const CACHE = 'csms-shell-v2'
const SHELL = ['/', '/index.html', '/vite.svg', '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// 安装页调用 → 跳过 waiting，立即激活新 SW（配合 main.jsx 的「刷新」提示）
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  // 导航请求：网络优先 + 不缓存 HTML（强制每次拿最新 index.html，破除微信/浏览器顽固缓存）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' }).catch(() => caches.match('/index.html'))
    )
    return
  }

  // 静态资源（哈希 chunk）：缓存优先（URL 随内容变化，安全且可离线）；缺失再回源并写回
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(() => cached)
    })
  )
})
