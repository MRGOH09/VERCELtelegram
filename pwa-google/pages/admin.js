import { useState, useEffect } from 'react'
import Head from 'next/head'

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [adminData, setAdminData] = useState({
    totalUsers: 0,
    totalScores: 0,
    recentIssues: [],
    systemHealth: 'good'
  })

  // 检查是否已登录
  useEffect(() => {
    const adminToken = localStorage.getItem('admin_token')
    if (adminToken === 'admin_logged_in') {
      setIsLoggedIn(true)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (isLoggedIn) {
      loadAdminData()
    }
  }, [isLoggedIn])

  const loadAdminData = async () => {
    try {
      // 模拟加载数据 - 实际项目中可以调用真实的API
      setAdminData({
        totalUsers: 125,
        totalScores: 1843,
        recentIssues: [],
        systemHealth: 'good'
      })
    } catch (error) {
      console.error('加载管理员数据失败:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return <AdminLoginForm setIsLoggedIn={setIsLoggedIn} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>LEARNER CLUB - 管理面板</title>
      </Head>

      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">LEARNER CLUB 管理面板</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">👋 管理员 AUSTIN</span>
              <button
                onClick={() => {
                  localStorage.removeItem('admin_token')
                  setIsLoggedIn(false)
                }}
                className="text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded text-red-700"
              >
                退出登录
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
              >
                返回应用
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 标签导航 */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', name: '概览', icon: '📊' },
                { id: 'users', name: '用户管理', icon: '👥' },
                { id: 'scores', name: '积分管理', icon: '🏆' },
                { id: 'milestones', name: '里程碑配置', icon: '⚡' },
                { id: 'tools', name: '修复工具', icon: '🛠️' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* 内容区域 */}
        {activeTab === 'overview' && <OverviewPanel adminData={adminData} />}
        {activeTab === 'users' && <UserManagementPanel />}
        {activeTab === 'scores' && <ScoreManagementPanel />}
        {activeTab === 'milestones' && <MilestoneConfigPanel />}
        {activeTab === 'tools' && <RepairToolsPanel />}
      </div>
    </div>
  )
}

// 概览面板
function OverviewPanel({ adminData }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">系统概览</h2>
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="总用户数"
          value={adminData.totalUsers || 0}
          icon="👥"
          color="blue"
        />
        <StatCard
          title="总积分记录"
          value={adminData.totalScores || 0}
          icon="🏆"
          color="green"
        />
        <StatCard
          title="系统状态"
          value={adminData.systemHealth === 'good' ? '正常' : '异常'}
          icon={adminData.systemHealth === 'good' ? '✅' : '⚠️'}
          color={adminData.systemHealth === 'good' ? 'green' : 'yellow'}
        />
        <StatCard
          title="待处理问题"
          value={adminData.recentIssues?.length || 0}
          icon="🔧"
          color="orange"
        />
      </div>

      {/* 快速操作 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">快速操作</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            title="检测积分问题"
            description="扫描并检测积分系统异常"
            icon="🔍"
            onClick={() => window.open('/admin-score-repair.js', '_blank')}
          />
          <QuickAction
            title="备份数据"
            description="创建积分数据备份"
            icon="💾"
            onClick={() => alert('备份功能开发中')}
          />
          <QuickAction
            title="系统日志"
            description="查看系统操作日志"
            icon="📋"
            onClick={() => alert('日志功能开发中')}
          />
        </div>
      </div>

      {/* 近期问题 */}
      {adminData.recentIssues && adminData.recentIssues.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">近期问题</h3>
          <div className="space-y-3">
            {adminData.recentIssues.map((issue, index) => (
              <div key={index} className="flex items-center p-3 bg-yellow-50 rounded-lg">
                <span className="text-yellow-600 mr-3">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{issue.type}</p>
                  <p className="text-xs text-gray-600">{issue.description}</p>
                </div>
                <button className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                  处理
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 用户管理面板
function UserManagementPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const searchUsers = async () => {
    if (!searchQuery.trim()) return
    
    setLoading(true)
    try {
      // 实现用户搜索逻辑
      console.log('搜索用户:', searchQuery)
      // 这里调用实际的用户搜索API
    } catch (error) {
      console.error('搜索失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
      
      {/* 搜索栏 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex space-x-4">
          <input
            type="text"
            placeholder="搜索用户 (用户名/邮箱/用户ID)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={searchUsers}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">用户列表</h3>
          <div className="text-center text-gray-500 py-8">
            {searchQuery ? '请点击搜索按钮查找用户' : '请输入搜索条件查找用户'}
          </div>
        </div>
      </div>
    </div>
  )
}

// 积分管理面板
function ScoreManagementPanel() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">积分管理</h2>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">积分操作</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">手动调整积分</h4>
            <p className="text-sm text-gray-600 mb-4">为特定用户增加或减少积分</p>
            <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              调整积分
            </button>
          </div>
          
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">重新计算积分</h4>
            <p className="text-sm text-gray-600 mb-4">重新计算指定时间段的积分</p>
            <button className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700">
              重新计算
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 里程碑配置面板
function MilestoneConfigPanel() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">里程碑配置</h2>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">当前里程碑配置</h3>
        <div className="space-y-3">
          {[
            { days: 3, score: 2, name: '坚持三天' },
            { days: 5, score: 3, name: '持续五天' },
            { days: 10, score: 5, name: '稳定十天' },
            { days: 15, score: 8, name: '半月坚持' },
            { days: 21, score: 12, name: '三周习惯' }
          ].map(milestone => (
            <div key={milestone.days} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <span className="font-medium">{milestone.name}</span>
                <span className="text-sm text-gray-600 ml-2">({milestone.days}天)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-green-600 font-medium">{milestone.score}分</span>
                <button className="text-blue-600 hover:text-blue-800 text-sm">编辑</button>
              </div>
            </div>
          ))}
        </div>
        
        <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          添加新里程碑
        </button>
      </div>
    </div>
  )
}

// 修复工具面板
function RepairToolsPanel() {
  const [repairLog, setRepairLog] = useState([])
  const [isRunning, setIsRunning] = useState(false)

  const runRepairTool = async () => {
    setIsRunning(true)
    try {
      // 运行修复工具
      const response = await fetch('/admin-score-repair.js')
      const result = await response.text()
      setRepairLog(prev => [...prev, {
        timestamp: new Date().toISOString(),
        type: 'repair',
        message: '积分修复工具执行完成',
        details: result
      }])
    } catch (error) {
      setRepairLog(prev => [...prev, {
        timestamp: new Date().toISOString(),
        type: 'error',
        message: '修复工具执行失败',
        details: error.message
      }])
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">修复工具</h2>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">积分修复工具</h3>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            检测并自动修复积分系统中的常见问题：缺失积分、重复记录、连续天数异常、遗漏奖励等
          </p>
          
          <button
            onClick={runRepairTool}
            disabled={isRunning}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isRunning ? '运行中...' : '🛠️ 运行修复工具'}
          </button>
          
          {repairLog.length > 0 && (
            <div className="mt-6 border rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">执行日志</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {repairLog.map((log, index) => (
                  <div key={index} className={`text-xs p-2 rounded ${
                    log.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-800'
                  }`}>
                    <div className="font-medium">[{new Date(log.timestamp).toLocaleString()}] {log.message}</div>
                    {log.details && <div className="mt-1 opacity-75">{log.details}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 统计卡片组件
function StatCard({ title, value, icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    orange: 'bg-orange-50 text-orange-600'
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className={`flex-shrink-0 ${colorClasses[color]} p-3 rounded-lg`}>
            <span className="text-2xl">{icon}</span>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-lg font-medium text-gray-900">{value}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

// 快速操作组件
function QuickAction({ title, description, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 border rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
    >
      <div className="flex items-center mb-2">
        <span className="text-xl mr-2">{icon}</span>
        <h4 className="font-medium text-gray-900">{title}</h4>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </button>
  )
}

// Admin登录表单组件
function AdminLoginForm({ setIsLoggedIn }) {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // 硬编码的管理员凭证
    const ADMIN_CREDENTIALS = {
      username: 'AUSTIN',
      password: 'Abcd1234'
    }

    try {
      // 验证用户名和密码
      if (credentials.username === ADMIN_CREDENTIALS.username && 
          credentials.password === ADMIN_CREDENTIALS.password) {
        
        // 登录成功，保存token到localStorage
        localStorage.setItem('admin_token', 'admin_logged_in')
        setIsLoggedIn(true)
        
      } else {
        setError('用户名或密码错误')
      }
    } catch (error) {
      setError('登录失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>管理员登录 - LEARNER CLUB</title>
      </Head>
      
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <span className="text-2xl">🛡️</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            LEARNER CLUB
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            管理员登录
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="用户名"
                value={credentials.username}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="密码"
                value={credentials.password}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md">
              ❌ {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  登录中...
                </>
              ) : (
                '登录管理面板'
              )}
            </button>
          </div>

          <div className="text-center text-xs text-gray-500 mt-4">
            <p>🔐 安全提示：请使用授权的管理员账户登录</p>
            <div className="mt-2 text-blue-600">
              <p>用户名: AUSTIN</p>
              <p>密码: Abcd1234</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}