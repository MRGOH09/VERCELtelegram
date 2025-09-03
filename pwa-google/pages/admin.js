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
      console.log('[Admin] 加载仪表板数据...')
      
      // 调用真实的仪表板API
      const response = await fetch('/api/admin/dashboard')
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('[Admin] 仪表板数据加载成功:', data)
      
      setAdminData({
        totalUsers: data.totalUsers,
        totalScores: data.totalScores,
        recentIssues: data.issues || [],
        systemHealth: data.systemHealth,
        milestones: data.milestones || [],
        recentStats: data.recentStats || [],
        lastUpdated: data.lastUpdated
      })
      
    } catch (error) {
      console.error('加载管理员数据失败:', error)
      // 设置错误状态
      setAdminData(prev => ({
        ...prev,
        systemHealth: 'error',
        recentIssues: [{
          type: 'api_error',
          description: '无法加载仪表板数据: ' + error.message
        }]
      }))
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
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  // 加载分院列表
  const loadBranches = async () => {
    try {
      const response = await fetch('/api/admin/users?action=branches')
      if (!response.ok) {
        throw new Error(`获取分院列表失败: ${response.status}`)
      }
      
      const data = await response.json()
      setBranches(data.branches || [])
      
    } catch (error) {
      console.error('获取分院列表失败:', error)
    }
  }

  // 加载用户列表
  const loadUsers = async (branch = 'all') => {
    setLoading(true)
    try {
      console.log('[Admin] 加载用户列表:', branch)
      
      const url = branch === 'all' 
        ? '/api/admin/users' 
        : `/api/admin/users?branch=${encodeURIComponent(branch)}`
        
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`加载用户失败: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('[Admin] 用户列表:', data)
      
      setUsers(data.users || [])
      
    } catch (error) {
      console.error('加载用户失败:', error)
      alert('加载用户失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 处理分院选择变化
  const handleBranchChange = (branch) => {
    setSelectedBranch(branch)
    loadUsers(branch)
  }

  // 组件加载时自动加载数据
  useEffect(() => {
    loadBranches()
    loadUsers('all')
  }, [])

  const viewUserScores = async (userId, username) => {
    try {
      console.log('[Admin] 查看用户积分:', userId)
      
      const response = await fetch(`/api/admin/scores?userId=${userId}&action=user-scores`)
      if (!response.ok) {
        throw new Error(`获取用户积分失败: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('[Admin] 用户积分数据:', data)
      
      setSelectedUser({
        ...data,
        username
      })
      
    } catch (error) {
      console.error('获取用户积分失败:', error)
      alert('获取用户积分失败: ' + error.message)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
      
      {/* 分院筛选 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">按分院筛选:</label>
          <select
            value={selectedBranch}
            onChange={(e) => handleBranchChange(e.target.value)}
            disabled={loading}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {branches.map(branch => (
              <option key={branch.code} value={branch.code}>
                {branch.name} ({branch.userCount}人)
              </option>
            ))}
          </select>
          <button
            onClick={() => loadUsers(selectedBranch)}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            用户列表 {users.length > 0 && `(${users.length} 个用户)`}
          </h3>
          
          {users.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {loading ? '加载中...' : '暂无用户数据'}
            </div>
          ) : (
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {user.name}
                          </h4>
                          <p className="text-xs text-gray-500">
                            ID: {user.id.slice(0, 8)}... | 分行: {user.branch_code || '未设置'}
                          </p>
                          <p className="text-xs text-gray-400">
                            Telegram ID: {user.telegram_id || '未绑定'} | 状态: {user.status}
                          </p>
                          <p className="text-xs text-gray-400">
                            注册时间: {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-gray-900 font-medium">
                            总积分: {user.stats.totalScore}
                          </div>
                          <div className="text-gray-600">
                            最大连续: {user.stats.maxStreak}天
                          </div>
                          <div className="text-gray-500 text-xs">
                            活跃天数: {user.stats.activeDays}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => viewUserScores(user.id, user.name)}
                        className="text-blue-600 hover:text-blue-800 text-sm px-3 py-1 border border-blue-300 rounded"
                      >
                        查看积分
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 用户积分详情弹窗 */}
      {selectedUser && (
        <UserScoreModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
        />
      )}
    </div>
  )
}

// 积分管理面板
function ScoreManagementPanel() {
  const [analyzing, setAnalyzing] = useState(false)
  const [errorUsers, setErrorUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [fixing, setFixing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)

  // 分析积分错误
  const analyzeScoreErrors = async () => {
    setAnalyzing(true)
    try {
      console.log('[Admin] 开始分析积分错误...')
      
      const response = await fetch('/api/admin/fix-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' })
      })

      if (!response.ok) {
        throw new Error(`分析失败: ${response.status}`)
      }

      const data = await response.json()
      console.log('[Admin] 分析结果:', data)
      
      setErrorUsers(data.errorUsers || [])
      setAnalysisResult(data.summary)
      setSelectedUsers([]) // 重置选择

      if (data.errorUsers.length === 0) {
        alert('🎉 恭喜！没有发现积分计算错误')
      } else {
        alert(`发现 ${data.errorUsers.length} 个用户存在积分错误，请检查并选择需要修复的用户`)
      }

    } catch (error) {
      console.error('分析积分错误失败:', error)
      alert('分析失败: ' + error.message)
    } finally {
      setAnalyzing(false)
    }
  }

  // 选择/取消选择用户
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  // 全选/全不选
  const toggleAllSelection = () => {
    if (selectedUsers.length === errorUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(errorUsers.map(u => u.user.id))
    }
  }

  // 修复选定用户
  const fixSelectedUsers = async () => {
    if (selectedUsers.length === 0) {
      alert('请选择要修复的用户')
      return
    }

    const confirmed = confirm(`确认修复选定的 ${selectedUsers.length} 个用户的积分？\n\n⚠️ 注意：这将删除现有积分记录并重新计算，此操作不可撤销！`)
    
    if (!confirmed) return

    setFixing(true)
    try {
      console.log('[Admin] 开始修复积分:', selectedUsers)
      
      const response = await fetch('/api/admin/fix-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'fix-selected',
          userIds: selectedUsers 
        })
      })

      if (!response.ok) {
        throw new Error(`修复失败: ${response.status}`)
      }

      const data = await response.json()
      console.log('[Admin] 修复结果:', data)
      
      alert(`修复完成！\n成功: ${data.summary.success} 个用户\n失败: ${data.summary.errors} 个用户`)
      
      // 重新分析以更新列表
      if (data.summary.success > 0) {
        await analyzeScoreErrors()
      }

    } catch (error) {
      console.error('修复积分失败:', error)
      alert('修复失败: ' + error.message)
    } finally {
      setFixing(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">积分修复工具</h2>
      
      {/* 操作控制 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">积分错误检测与修复</h3>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-4">
            <button
              onClick={analyzeScoreErrors}
              disabled={analyzing}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {analyzing ? '分析中...' : '🔍 分析积分错误'}
            </button>
            
            {errorUsers.length > 0 && (
              <button
                onClick={fixSelectedUsers}
                disabled={fixing || selectedUsers.length === 0}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {fixing ? '修复中...' : `🔧 修复选定用户 (${selectedUsers.length})`}
              </button>
            )}
          </div>
          
          {analysisResult && (
            <div className="text-sm text-gray-600">
              共 {analysisResult.total} 用户，发现 {analysisResult.errors} 个错误用户
            </div>
          )}
        </div>

        {/* 分析结果 */}
        {errorUsers.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">
                发现 {errorUsers.length} 个用户存在积分计算错误
              </h4>
              <button
                onClick={toggleAllSelection}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {selectedUsers.length === errorUsers.length ? '全不选' : '全选'}
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {errorUsers.map(errorUser => (
                <div key={errorUser.user.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(errorUser.user.id)}
                        onChange={() => toggleUserSelection(errorUser.user.id)}
                        className="rounded border-gray-300"
                      />
                      <div>
                        <span className="font-medium text-gray-900">{errorUser.user.name}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          {errorUser.user.branch_code} | {errorUser.totalErrors} 个错误
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      记录: {errorUser.totalRecords} | 积分: {errorUser.totalScores}
                    </div>
                  </div>

                  {/* 错误详情 */}
                  <div className="ml-6 text-xs text-gray-600 space-y-1">
                    {errorUser.errors.slice(0, 3).map((error, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className="text-red-500">•</span>
                        <span>{error.date}: {error.description}</span>
                        {error.type === 'calculation_error' && (
                          <span className="text-gray-500">
                            (当前: {error.current.total} → 应为: {error.expected.total})
                          </span>
                        )}
                      </div>
                    ))}
                    {errorUser.errors.length > 3 && (
                      <div className="text-gray-500">
                        还有 {errorUser.errors.length - 3} 个错误...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">⚠️ 使用说明</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>1. 点击"分析积分错误"检测所有用户的积分计算是否正确</li>
            <li>2. 仔细检查发现的错误用户，确认需要修复的用户</li>
            <li>3. 选择要修复的用户，点击"修复选定用户"</li>
            <li>4. <strong>修复操作会删除现有积分记录并重新计算，不可撤销！</strong></li>
          </ul>
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

// 用户积分详情弹窗
function UserScoreModal({ user, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {user.username || '未知用户'} - 积分详情
              </h2>
              <p className="text-sm text-gray-600">{user.user?.email}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* 统计概览 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {user.analysis?.totalScore || 0}
              </div>
              <div className="text-sm text-gray-600">总积分</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {user.analysis?.totalDays || 0}
              </div>
              <div className="text-sm text-gray-600">活跃天数</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {user.analysis?.maxStreak || 0}
              </div>
              <div className="text-sm text-gray-600">最长连续</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {user.analysis?.totalBonus || 0}
              </div>
              <div className="text-sm text-gray-600">奖励积分</div>
            </div>
          </div>

          {/* 积分历史 */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">积分历史（最近30天）</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      日期
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      总分
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      基础分
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      连续分
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      奖励分
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      连续天数
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {user.scores?.slice(0, 10).map((score, index) => (
                    <tr key={index} className={score.bonus_score > 0 ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {score.ymd}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {score.total_score}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {score.base_score}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {score.streak_score}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                        {score.bonus_score || 0}
                        {score.bonus_score > 0 && score.bonus_details && (
                          <div className="text-xs text-gray-500">
                            {score.bonus_details.map(b => b.name).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {score.current_streak}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}