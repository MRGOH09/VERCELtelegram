import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function ExperimentalHome() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('exp_token')
    const userData = localStorage.getItem('exp_user')
    
    if (!token || !userData) {
      router.push('/experimental-login')
      return
    }
    
    setUser(JSON.parse(userData))
    setLoading(false)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('exp_token')
    localStorage.removeItem('exp_user')
    router.push('/experimental-login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-cyan-50">
      {/* 顶部导航栏 */}
      <div className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold">LC</span>
              </div>
              <h1 className="ml-3 text-xl font-bold text-gray-900">
                Learner Club
              </h1>
              <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                实验版
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name || '用户'}</p>
                <p className="text-xs text-gray-500">{user?.email || user?.phone}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 标签导航 */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="bg-white rounded-xl shadow-md p-1">
          <div className="flex gap-1">
            {[
              { id: 'dashboard', name: '仪表板', icon: '📊' },
              { id: 'records', name: '记录', icon: '📝' },
              { id: 'analytics', name: '分析', icon: '📈' },
              { id: 'settings', name: '设置', icon: '⚙️' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-6xl mx-auto px-4 mt-6 pb-8">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 欢迎卡片 */}
            <div className="col-span-full bg-gradient-to-r from-purple-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
              <h2 className="text-2xl font-bold mb-2">
                欢迎回来，{user?.name || '用户'}！
              </h2>
              <p className="opacity-90">
                这是您的独立PWA财务管理应用
              </p>
              <div className="mt-4 flex gap-4">
                <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-sm opacity-90">本月记录</div>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-sm opacity-90">连续天数</div>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-sm opacity-90">总积分</div>
                </div>
              </div>
            </div>

            {/* 功能卡片 */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="text-lg font-semibold mb-2">记录开销</h3>
              <p className="text-gray-600 text-sm mb-4">
                记录您的日常支出，培养理财习惯
              </p>
              <button className="w-full bg-purple-100 text-purple-600 py-2 rounded-lg hover:bg-purple-200 transition-colors">
                立即记录
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="text-lg font-semibold mb-2">查看分析</h3>
              <p className="text-gray-600 text-sm mb-4">
                详细的财务报表和趋势分析
              </p>
              <button className="w-full bg-cyan-100 text-cyan-600 py-2 rounded-lg hover:bg-cyan-200 transition-colors">
                查看报表
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="text-lg font-semibold mb-2">设定目标</h3>
              <p className="text-gray-600 text-sm mb-4">
                设置月度预算和储蓄目标
              </p>
              <button className="w-full bg-green-100 text-green-600 py-2 rounded-lg hover:bg-green-200 transition-colors">
                管理目标
              </button>
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">📝 记录管理</h2>
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-lg mb-2">还没有记录</p>
              <p className="text-sm mb-6">开始记录您的第一笔开销吧</p>
              <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-xl hover:opacity-90 transition-opacity">
                添加记录
              </button>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">📈 数据分析</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold mb-3">月度趋势</h3>
                <div className="h-40 bg-gray-50 rounded flex items-center justify-center text-gray-400">
                  图表区域
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold mb-3">分类统计</h3>
                <div className="h-40 bg-gray-50 rounded flex items-center justify-center text-gray-400">
                  饼图区域
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">⚙️ 设置</h2>
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-2">账户信息</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-500">姓名：</span> {user?.name}</p>
                  <p><span className="text-gray-500">邮箱：</span> {user?.email || '未设置'}</p>
                  <p><span className="text-gray-500">手机：</span> {user?.phone || '未设置'}</p>
                  <p><span className="text-gray-500">注册时间：</span> {new Date().toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-2">偏好设置</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm">接收通知</span>
                    <input type="checkbox" className="toggle" defaultChecked />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm">每日提醒</span>
                    <input type="checkbox" className="toggle" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm">月度报告</span>
                    <input type="checkbox" className="toggle" defaultChecked />
                  </label>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">危险区域</h3>
                <button className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                  删除账户
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部导航（移动端） */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex">
          {[
            { id: 'dashboard', icon: '🏠', name: '首页' },
            { id: 'records', icon: '➕', name: '记录' },
            { id: 'analytics', icon: '📊', name: '分析' },
            { id: 'settings', icon: '👤', name: '我的' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 ${
                activeTab === tab.id ? 'text-purple-600' : 'text-gray-500'
              }`}
            >
              <div className="text-xl">{tab.icon}</div>
              <div className="text-xs">{tab.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}