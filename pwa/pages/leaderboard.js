import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'branch'
  const [leaderboardData, setLeaderboardData] = useState({
    allUsers: [],
    branchUsers: [],
    userBranch: null,
    loading: true
  })

  useEffect(() => {
    loadLeaderboardData()
  }, [])

  const loadLeaderboardData = async () => {
    try {
      setLeaderboardData(prev => ({ ...prev, loading: true }))

      // 调用积分排行榜API
      const response = await fetch('/api/pwa/leaderboard')
      const result = await response.json()

      if (result.ok) {
        setLeaderboardData({
          allUsers: result.data.allUsers || [],
          branchUsers: result.data.branchUsers || [],
          userBranch: result.data.userBranch || null,
          loading: false
        })
      } else {
        throw new Error(result.error || '获取排行榜失败')
      }
    } catch (error) {
      console.error('加载排行榜失败:', error)
      setLeaderboardData(prev => ({ ...prev, loading: false }))
    }
  }

  const LeaderboardCard = ({ title, users, showBranch = true }) => (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
        <span className="mr-2">🏆</span>
        {title}
      </h3>
      
      {users.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <p>暂无排行数据</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user, index) => (
            <div
              key={user.user_id}
              className={`flex items-center p-4 rounded-xl transition-colors ${
                index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200' :
                index === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200' :
                index === 2 ? 'bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200' :
                'bg-gray-50'
              }`}
            >
              {/* 排名 */}
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center mr-4">
                {index === 0 && <span className="text-xl">🥇</span>}
                {index === 1 && <span className="text-xl">🥈</span>}
                {index === 2 && <span className="text-xl">🥉</span>}
                {index > 2 && (
                  <span className="text-sm font-bold text-gray-600">#{index + 1}</span>
                )}
              </div>

              {/* 用户信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 truncate">
                      {user.display_name || user.name || '匿名用户'}
                    </p>
                    {showBranch && user.branch_name && (
                      <p className="text-sm text-gray-500">
                        {user.branch_name}
                      </p>
                    )}
                  </div>
                  
                  {/* 积分信息 */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">
                      {user.total_score || 0}分
                    </div>
                    <div className="text-xs text-gray-500">
                      连续{user.current_streak || 0}天
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (leaderboardData.loading) {
    return (
      <Layout title="排行榜 - Learner Club">
        <div className="p-4">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">加载排行榜中...</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="排行榜 - Learner Club">
      <div className="p-4">
        {/* 头部标题 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">🏆 积分排行榜</h1>
          <p className="text-gray-600">看看谁是理财达人！</p>
        </div>

        {/* 切换标签 */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600'
            }`}
          >
            🌟 全部用户
          </button>
          <button
            onClick={() => setActiveTab('branch')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'branch'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600'
            }`}
          >
            🏢 我的分院
          </button>
        </div>

        {/* 排行榜内容 */}
        {activeTab === 'all' ? (
          <LeaderboardCard 
            title="全分院积分排行" 
            users={leaderboardData.allUsers} 
            showBranch={true}
          />
        ) : (
          <>
            {leaderboardData.userBranch ? (
              <LeaderboardCard 
                title={`${leaderboardData.userBranch}分院排行`} 
                users={leaderboardData.branchUsers} 
                showBranch={false}
              />
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🏢</div>
                  <p className="mb-2">您还未设置分院</p>
                  <p className="text-sm">请先在个人资料中设置分院信息</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* 说明文字 */}
        <div className="bg-blue-50 rounded-xl p-4 mt-6">
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">💡</span>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">积分规则：</p>
              <p>• 每日记录/打卡：2分（基础1分+连续1分）</p>
              <p>• 连续里程碑：3天+2分，5天+3分，10天+5分...</p>
              <p>• 分院排名按平均积分计算，鼓励全员参与！</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}