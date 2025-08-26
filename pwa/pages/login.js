import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import PWAClient from '../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  
  useEffect(() => {
    // 检查是否已登录
    checkAuthStatus()
  }, [])
  
  const checkAuthStatus = async () => {
    try {
      const result = await PWAClient.checkAuth()
      if (result.authenticated) {
        router.replace('/')
        return
      }
    } catch (error) {
      console.log('Not authenticated')
    } finally {
      setChecking(false)
    }
  }
  
  useEffect(() => {
    if (!checking) {
      // 加载Telegram Widget
      loadTelegramWidget()
    }
  }, [checking])
  
  const loadTelegramWidget = () => {
    // 清理现有的script
    const existingScript = document.getElementById('telegram-widget-script')
    if (existingScript) {
      existingScript.remove()
    }
    
    // 创建新的script
    const script = document.createElement('script')
    script.id = 'telegram-widget-script'
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'LeanerClubEXEbot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-auth-url', `${typeof window !== 'undefined' ? window.location.origin : ''}/api/pwa/auth`)
    script.setAttribute('data-request-access', 'write')
    
    // 添加到DOM
    const container = document.getElementById('telegram-widget-container')
    if (container) {
      container.appendChild(script)
    }
    
    // 监听错误
    script.onerror = () => {
      setError('无法加载Telegram登录组件，请检查网络连接')
    }
  }
  
  if (checking) {
    return (
      <Layout title="登录 - Learner Club">
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="large" />
        </div>
      </Layout>
    )
  }
  
  return (
    <Layout title="登录 - Learner Club">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo和标题 */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">📊</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Learner Club
            </h1>
            <p className="text-gray-600">
              财务管理习惯养成
            </p>
          </div>
          
          {/* 登录卡片 */}
          <Card>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                使用Telegram账号登录
              </h2>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  点击下方按钮使用您的Telegram账号安全登录
                </p>
                
                {/* Telegram Widget容器 */}
                <div 
                  id="telegram-widget-container" 
                  className="flex justify-center"
                />
                
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                    <button 
                      onClick={() => {
                        setError('')
                        loadTelegramWidget()
                      }}
                      className="mt-2 text-sm text-red-700 underline"
                    >
                      重试
                    </button>
                  </div>
                )}
              </div>
              
              <div className="text-xs text-gray-500">
                <p className="mb-1">
                  首次登录将自动创建账号
                </p>
                <p>
                  我们不会存储您的Telegram密码
                </p>
              </div>
            </div>
          </Card>
          
          {/* 功能介绍 */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center text-sm text-gray-600">
              <span className="text-lg mr-3">📊</span>
              <span>查看详细的财务数据分析</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <span className="text-lg mr-3">🏆</span>
              <span>参与排行榜和挑战活动</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <span className="text-lg mr-3">📱</span>
              <span>随时随地查看理财进度</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}