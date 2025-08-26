import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard, { DataCard } from '../components/ModernCard'
import { SmoothTransition, PageSkeleton } from '../components/SmoothTransition'
import WebAppWrapper from '../components/WebAppWrapper'
import PWAClient, { formatCurrency, formatDate } from '../lib/api'

export default function ProfilePage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  
  useEffect(() => {
    loadProfile()
  }, [])
  
  const loadProfile = async () => {
    try {
      setLoading(true)
      const result = await PWAClient.getProfile()
      setData(result)
      setError('')
    } catch (error) {
      console.error('Profile load error:', error)
      
      if (error.message.includes('Unauthorized')) {
        router.replace('/login')
        return
      }
      
      setError(error.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }
  
  const handleLogout = async () => {
    if (!confirm('确定要退出登录吗？')) return
    
    try {
      setLoggingOut(true)
      
      // 清除Cookie
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
      document.cookie = 'user_name=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
      
      // 清除本地存储
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
      }
      
      // 重定向到登录页
      router.replace('/login')
      
    } catch (error) {
      console.error('Logout error:', error)
      setLoggingOut(false)
    }
  }
  
  if (loading) {
    return (
      <Layout title="个人中心 - Learner Club">
        <PageSkeleton type="profile" />
      </Layout>
    )
  }
  
  if (error && !data) {
    return (
      <Layout title="个人中心 - Learner Club">
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
          <ModernCard className="p-8 text-center">
            <div className="text-6xl mb-4">😞</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              加载失败
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => loadProfile()}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-200"
            >
              重新加载
            </button>
          </ModernCard>
        </div>
      </Layout>
    )
  }
  
  return (
    <WebAppWrapper>
      <Layout title="个人中心 - Learner Club">
      <SmoothTransition>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
          
          {/* 现代化个人信息头部 */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 text-white relative overflow-hidden">
            <div className="flex items-center space-x-4 relative z-10">
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-3xl">👤</span>
              </div>
              
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2">
                  {data?.profile?.display_name || data?.user?.name || 'User'}
                </h1>
                <div className="space-y-1 text-blue-100">
                  {data?.user?.branch && (
                    <p className="flex items-center">
                      <span className="mr-2">🏢</span>
                      {data.user.branch} 分行
                    </p>
                  )}
                  {data?.user?.joined_date && (
                    <p className="flex items-center">
                      <span className="mr-2">📅</span>
                      {formatDate(data.user.joined_date)} 加入
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          </div>
          
          <div className="px-4 pb-8 space-y-6">
            
            {/* 统计数据卡片 */}
            <div className="-mt-16 relative z-10">
              <UserStatistics stats={data?.stats} />
            </div>
            
            {/* 个人信息卡片 */}
            <PersonalInfo profile={data?.profile} user={data?.user} />
            
            {/* 功能菜单 */}
            <FunctionMenu />
            
            {/* 退出登录 */}
            <ModernCard className="p-6">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50"
              >
                {loggingOut ? '正在退出...' : '🚪 退出登录'}
              </button>
            </ModernCard>
            
          </div>
        </div>
      </SmoothTransition>
      </Layout>
    </WebAppWrapper>
  )
}

function ProfileHeader({ user, profile }) {
  return (
    <div className="bg-gradient-to-r from-primary to-blue-600 p-6 text-white">
      <div className="flex items-center space-x-4">
        {/* 用户头像占位符 */}
        <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
          <span className="text-2xl">👤</span>
        </div>
        
        <div className="flex-1">
          <h1 className="text-xl font-bold mb-1">
            {profile?.display_name || user?.name || 'User'}
          </h1>
          <div className="space-y-1 text-sm text-blue-100">
            {user?.branch && (
              <p>🏢 {user.branch} 分行</p>
            )}
            {user?.joined_date && (
              <p>📅 {formatDate(user.joined_date)} 加入</p>
            )}
          </div>
        </div>
      </div>
      
      {/* 装饰性元素 */}
      <div className="absolute top-4 right-4 opacity-10">
        <span className="text-4xl">👤</span>
      </div>
    </div>
  )
}

function UserStatistics({ stats }) {
  if (!stats) {
    return (
      <ModernCard className="p-6 animate-pulse">
        <div className="text-center">
          <div className="w-8 h-8 bg-gray-300 rounded-full mx-auto mb-3"></div>
          <p className="text-gray-500">加载统计数据...</p>
        </div>
      </ModernCard>
    )
  }
  
  return (
    <ModernCard className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">我的统计</h3>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded-xl">
          <div className="text-2xl mb-2">📅</div>
          <div className="text-xl font-bold text-blue-600">{stats.record_days || 0}</div>
          <div className="text-sm text-gray-600">记录天数</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-xl">
          <div className="text-2xl mb-2">📝</div>
          <div className="text-xl font-bold text-green-600">{stats.total_records || 0}</div>
          <div className="text-sm text-gray-600">总记录数</div>
        </div>
        <div className="text-center p-4 bg-orange-50 rounded-xl">
          <div className="text-2xl mb-2">🔥</div>
          <div className="text-xl font-bold text-orange-600">{stats.current_streak || 0}</div>
          <div className="text-sm text-gray-600">连续记录</div>
        </div>
      </div>
      
      {stats.max_streak > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center">
          <p className="text-blue-800 text-sm">
            🏆 最长连续记录：<span className="font-semibold">{stats.max_streak}</span> 天
          </p>
        </div>
      )}
    </ModernCard>
  )
}

function PersonalInfo({ profile, user }) {
  const infoItems = [
    {
      label: '昵称',
      value: profile?.display_name || '-',
      icon: '👤'
    },
    {
      label: '联系方式',
      value: profile?.phone || '-',
      icon: '📱'
    },
    {
      label: '邮箱',
      value: profile?.email || '-',
      icon: '📧'
    },
    {
      label: '月收入',
      value: profile?.income ? formatCurrency(profile.income) : '-',
      icon: '💰'
    },
    {
      label: '生活开销占比',
      value: profile?.a_pct ? `${profile.a_pct}%` : '-',
      icon: '🛒'
    },
    {
      label: '年度旅游预算',
      value: profile?.travel_budget ? formatCurrency(profile.travel_budget) : '-',
      icon: '✈️'
    }
  ]
  
  return (
    <ModernCard className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">个人信息</h3>
      
      <div className="space-y-4">
        {infoItems.map((item, index) => (
          <div key={index} className="flex items-center justify-between py-2">
            <div className="flex items-center space-x-3">
              <span className="text-lg">{item.icon}</span>
              <span className="text-gray-700">{item.label}</span>
            </div>
            <span className="font-medium text-gray-900">{item.value}</span>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 text-center">
          💡 如需修改个人信息，请使用Telegram Bot的 /settings 命令
        </p>
      </div>
    </ModernCard>
  )
}

function FunctionMenu() {
  const menuItems = [
    {
      icon: '📊',
      label: '数据分析',
      description: '查看详细的支出分析报告',
      action: () => alert('功能开发中，敬请期待！')
    },
    {
      icon: '🏆',
      label: '排行榜',
      description: '查看个人和分行排名',
      action: () => alert('功能开发中，敬请期待！')
    },
    {
      icon: '🎯',
      label: '目标管理',
      description: '设置和追踪财务目标',
      action: () => alert('功能开发中，敬请期待！')
    },
    {
      icon: '📤',
      label: '数据导出',
      description: '导出记账数据到Excel',
      action: () => alert('功能开发中，敬请期待！')
    },
    {
      icon: '❓',
      label: '帮助反馈',
      description: '使用帮助和问题反馈',
      action: () => {
        if (confirm('需要帮助？我们将跳转到Telegram Bot')) {
          window.open('https://t.me/' + (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'your_bot_username'), '_blank')
        }
      }
    }
  ]
  
  return (
    <ModernCard className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">功能菜单</h3>
      
      <div className="space-y-1">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={item.action}
            className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
          >
            <span className="text-xl mr-3">{item.icon}</span>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{item.label}</p>
              <p className="text-sm text-gray-500">{item.description}</p>
            </div>
            <span className="text-gray-400">›</span>
          </button>
        ))}
      </div>
    </ModernCard>
  )
}