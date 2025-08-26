import { useEffect, useState } from 'react'

/**
 * 统一的WebApp包装组件 - 确保所有页面一致的webapp行为
 * 不依赖安装引导，直接提供webapp体验
 */
export default function WebAppWrapper({ children }) {
  const [webappReady, setWebappReady] = useState(false)
  
  useEffect(() => {
    // 统一的WebApp初始化逻辑
    const initWebApp = () => {
      try {
        // 1. 设置webapp专用样式类
        document.documentElement.classList.add('webapp-mode')
        
        // 2. 禁用Safari的弹性滚动（橡皮筋效果）
        document.addEventListener('touchstart', function(e) {
          if (e.touches.length > 1) {
            e.preventDefault()
          }
        }, { passive: false })
        
        document.addEventListener('touchmove', function(e) {
          if (e.touches.length > 1) {
            e.preventDefault()
          }
        }, { passive: false })
        
        // 3. 防止双击缩放
        let lastTouchEnd = 0
        document.addEventListener('touchend', function(e) {
          const now = (new Date()).getTime()
          if (now - lastTouchEnd <= 300) {
            e.preventDefault()
          }
          lastTouchEnd = now
        }, { passive: false })
        
        // 4. 统一处理状态栏
        const viewport = document.querySelector('meta[name="viewport"]')
        if (viewport) {
          viewport.setAttribute('content', 
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
          )
        }
        
        // 5. 添加webapp状态检测
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           window.navigator.standalone ||
                           document.referrer.includes('android-app://')
        
        if (isStandalone) {
          document.documentElement.classList.add('pwa-standalone')
        } else {
          document.documentElement.classList.add('pwa-browser')
        }
        
        // 6. iOS Safari专用处理
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        
        if (isIOS && isSafari) {
          document.documentElement.classList.add('ios-safari')
          
          // 强制隐藏Safari UI元素
          setTimeout(() => {
            window.scrollTo(0, 1)
            setTimeout(() => {
              window.scrollTo(0, 0)
            }, 100)
          }, 100)
        }
        
        console.log('🚀 WebApp模式初始化完成', {
          standalone: isStandalone,
          ios: isIOS,
          safari: isSafari
        })
        
        setWebappReady(true)
        
      } catch (error) {
        console.error('WebApp初始化失败:', error)
        setWebappReady(true) // 即使失败也要显示内容
      }
    }
    
    // 确保DOM加载完成后执行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWebApp)
    } else {
      initWebApp()
    }
    
    return () => {
      document.removeEventListener('DOMContentLoaded', initWebApp)
    }
  }, [])
  
  if (!webappReady) {
    return (
      <div className="webapp-loading">
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">正在初始化应用...</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="webapp-container">
      {children}
    </div>
  )
}

/**
 * WebApp状态Hook - 获取当前webapp运行状态
 */
export function useWebAppStatus() {
  const [status, setStatus] = useState({
    isStandalone: false,
    isIOS: false,
    isSafari: false,
    isPWA: false
  })
  
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone ||
                       document.referrer.includes('android-app://')
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    const isPWA = isStandalone || document.documentElement.classList.contains('webapp-mode')
    
    setStatus({
      isStandalone,
      isIOS,
      isSafari,
      isPWA
    })
  }, [])
  
  return status
}