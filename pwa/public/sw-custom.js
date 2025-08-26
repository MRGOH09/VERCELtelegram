// Custom Service Worker with Push Notification Support
// 导入推送处理功能
importScripts('/sw-push.js')

// 基本的Service Worker功能
self.addEventListener('install', function(event) {
  console.log('🔧 Service Worker 安装中...')
  self.skipWaiting()
})

self.addEventListener('activate', function(event) {
  console.log('🚀 Service Worker 激活中...')
  event.waitUntil(self.clients.claim())
})

// 网络请求缓存策略 - 简化版本
self.addEventListener('fetch', function(event) {
  // 只缓存同源请求
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response
          }
          return fetch(event.request)
        })
    )
  }
})

console.log('✅ Custom Service Worker 加载完成')