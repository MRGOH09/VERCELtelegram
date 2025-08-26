import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import PWAClient from '../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  
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
                <p className="text-sm text-gray-600 mb-6">
                  点击下方按钮在Telegram应用中完成登录
                </p>
                
                {/* Telegram App登录按钮 */}
                <div className="text-center">
                  <a
                    href={`https://t.me/LeanerClubEXEbot?start=webapp_login`}
                    className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg text-base font-medium hover:bg-blue-600 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <span className="text-xl mr-3">📱</span>
                    使用Telegram登录
                  </a>
                  <p className="text-xs text-gray-500 mt-4">
                    点击按钮将跳转到Telegram应用完成认证
                  </p>
                </div>
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