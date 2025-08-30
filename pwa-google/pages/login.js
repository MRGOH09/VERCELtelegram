import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard from '../components/ModernCard'
import WebAppWrapper from '../components/WebAppWrapper'
import TelegramJumpOut, { TelegramJumpBanner } from '../components/TelegramJumpOut'
import { getBrowserInfo } from '../lib/browser-detection'
import PWAClient from '../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [browserInfo, setBrowserInfo] = useState(null)
  const [fromTelegram, setFromTelegram] = useState(false)
  const [showTelegramJump, setShowTelegramJump] = useState(false)
  
  useEffect(() => {
    // 检查浏览器信息和来源
    const info = getBrowserInfo()
    setBrowserInfo(info)
    
    // 检测是否从Telegram跳转过来
    const referrer = document.referrer
    const isTelegramReferrer = referrer.includes('telegram') || referrer.includes('t.me')
    const hasTelegramUA = navigator.userAgent.includes('Telegram')
    
    setFromTelegram(isTelegramReferrer || hasTelegramUA)
    
    // 检查URL参数，如果有Telegram认证参数，直接处理
    const urlParams = new URLSearchParams(window.location.search)
    const hasAuthParams = urlParams.has('id') && urlParams.has('first_name')
    
    if (hasAuthParams) {
      // 如果URL中有认证参数，说明是从Bot跳转过来的直接认证
      console.log('检测到Telegram认证参数，开始自动登录...')
      handleTelegramAuth(urlParams)
    } else {
      // 否则检查是否已登录
      checkAuthStatus()
    }
  }, [])
  
  const handleTelegramAuth = async (params) => {
    try {
      const authParams = {}
      for (const [key, value] of params.entries()) {
        authParams[key] = value
      }
      
      console.log('开始Telegram认证...', authParams)
      
      // 检查是否有returnTo参数，如果有就添加到auth URL
      const urlParams = new URLSearchParams(window.location.search)
      const returnTo = urlParams.get('returnTo')
      if (returnTo && !params.has('returnTo')) {
        params.append('returnTo', returnTo)
      }
      
      // 构造认证URL并跳转
      const authUrl = `/api/pwa/auth?${params.toString()}`
      window.location.href = authUrl
      
    } catch (error) {
      console.error('Telegram认证失败:', error)
      setChecking(false)
    }
  }
  
  const checkAuthStatus = async () => {
    try {
      const result = await PWAClient.checkAuth()
      if (result.authenticated) {
        // 检查是否有returnTo参数
        const urlParams = new URLSearchParams(window.location.search)
        const returnTo = urlParams.get('returnTo')
        
        if (returnTo) {
          // 如果有returnTo，跳转到指定页面
          router.replace(returnTo)
        } else {
          // 否则跳转到主页
          router.replace('/')
        }
        return
      }
    } catch (error) {
      console.log('Not authenticated')
    } finally {
      setChecking(false)
    }
  }
  
  
  if (checking) {
    return (
      <WebAppWrapper>
        <Layout title="登录 - Learner Club">
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">正在检查登录状态...</p>
            </div>
          </div>
        </Layout>
      </WebAppWrapper>
    )
  }
  
  return (
    <WebAppWrapper>
      <Layout title="登录 - Learner Club">
        {/* Telegram跳转横幅 */}
        <TelegramJumpBanner 
          onShow={() => setShowTelegramJump(true)}
          onDismiss={() => {}}
        />
        
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
            
            {/* 从Telegram跳转的欢迎信息 */}
            {fromTelegram && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-center text-blue-700">
                  <span className="text-lg mr-2">🎉</span>
                  <span className="text-sm font-medium">
                    欢迎从Telegram跳转过来！现在您在{' '}
                    {browserInfo?.device === 'huawei' ? '华为' :
                     browserInfo?.device === 'ios' ? 'iPhone' : 
                     browserInfo?.device === 'android' ? 'Android' : ''}设备的{' '}
                    {browserInfo?.browser === 'chrome' ? 'Chrome' :
                     browserInfo?.browser === 'safari' ? 'Safari' :
                     browserInfo?.browser === 'huawei' ? '华为' : ''}浏览器中
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* 登录卡片 */}
          <ModernCard>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                使用Telegram账号登录
              </h2>
              
              <div className="mb-6">
                {fromTelegram ? (
                  // 从Telegram跳转过来的用户
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      ✅ 您已经从Telegram成功跳转到浏览器
                    </p>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                      <div className="text-center">
                        <div className="text-2xl mb-2">🎯</div>
                        <p className="text-green-800 font-medium mb-2">认证即将开始</p>
                        <p className="text-sm text-green-700">
                          系统正在为您准备登录...
                        </p>
                      </div>
                    </div>
                    
                    {/* 华为设备特别提示 */}
                    {browserInfo?.device === 'huawei' && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                        <div className="text-center">
                          <span className="text-orange-700 text-sm">
                            💡 华为设备用户：登录后可以将此应用添加到桌面，获得更好体验
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // 直接访问的用户
                  <>
                    <p className="text-sm text-gray-600 mb-6">
                      点击下方按钮在Telegram应用中完成登录
                    </p>
                    
                    {/* Telegram App登录按钮 */}
                    <div className="text-center">
                      <a
                        href={(() => {
                          const urlParams = new URLSearchParams(window.location.search)
                          const returnTo = urlParams.get('returnTo')
                          const baseUrl = `https://t.me/LeanerClubEXEbot?start=webapp_login`
                          // 如果有returnTo参数，可以考虑编码后传递给bot
                          return baseUrl
                        })()}
                        className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg text-base font-medium hover:bg-blue-600 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <span className="text-xl mr-3">📱</span>
                        使用Telegram登录
                      </a>
                      <p className="text-xs text-gray-500 mt-4">
                        点击按钮将跳转到Telegram应用完成认证
                      </p>
                    </div>
                  </>
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
          </ModernCard>
          
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
      
      {/* Telegram跳转引导弹窗 */}
      {showTelegramJump && (
        <TelegramJumpOut onDismiss={() => setShowTelegramJump(false)} />
      )}
      
      </Layout>
    </WebAppWrapper>
  )
}