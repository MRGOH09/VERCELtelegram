import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Card, { StatCard } from '../components/Card'
import Button from '../components/Button'
import { LoadingPage, LoadingCard } from '../components/LoadingSpinner'
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
    return <LoadingPage message="正在加载个人信息..." />
  }
  
  if (error && !data) {
    return (
      <Layout title="个人中心 - Learner Club">
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card>
            <div className="text-center py-8">
              <div className="text-4xl mb-4">😞</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                加载失败
              </h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => loadProfile()}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                重试
              </button>
            </div>
          </Card>
        </div>
      </Layout>
    )
  }
  
  return (
    <Layout title="个人中心 - Learner Club">
      {/* 个人信息头部 */}
      <ProfileHeader user={data?.user} profile={data?.profile} />
      
      {/* 统计数据 */}
      <div className="px-4 mt-6">
        <UserStatistics stats={data?.stats} />
      </div>
      
      {/* 个人信息 */}
      <div className="px-4 mt-6">
        <PersonalInfo profile={data?.profile} user={data?.user} />
      </div>
      
      {/* 功能菜单 */}
      <div className="px-4 mt-6">
        <FunctionMenu />
      </div>
      
      {/* 退出登录 */}
      <div className="px-4 mt-6 mb-8">
        <Card>
          <Button
            variant="danger"
            size="large"
            onClick={handleLogout}
            loading={loggingOut}
            className="w-full"
          >
            {loggingOut ? '正在退出...' : '退出登录'}
          </Button>
        </Card>
      </div>
    </Layout>
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
    return <LoadingCard message="加载统计数据..." />
  }
  
  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">我的统计</h3>
      
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="记录天数"
          value={stats.record_days || 0}
          suffix="天"
          color="blue"
          icon="📅"
        />
        <StatCard
          label="总记录数"
          value={stats.total_records || 0}
          suffix="笔"
          color="green"
          icon="📝"
        />
        <StatCard
          label="连续记录"
          value={stats.current_streak || 0}
          suffix="天"
          color="orange"
          icon="🔥"
        />
      </div>
      
      {stats.max_streak > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center">
          <p className="text-blue-800 text-sm">
            🏆 最长连续记录：<span className="font-semibold">{stats.max_streak}</span> 天
          </p>
        </div>
      )}
    </Card>
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
    <Card>
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
    </Card>
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
    <Card>
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
    </Card>
  )
}