import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import PWAClient from '../lib/api'
import ModernCard from '../components/ModernCard'
import PageHeader from '../components/PageHeader'
import Toast from '../components/Toast'
import { SmoothTransition } from '../components/SmoothTransition'

export default function BranchRankingsPage() {
  const router = useRouter()
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    // 默认选择今天
    const today = new Date().toISOString().slice(0, 10)
    setSelectedDate(today)
    loadRankings(today)
  }, [])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
  }

  const loadRankings = async (date = null) => {
    try {
      setLoading(true)
      setError('')
      
      const result = await PWAClient.getBranchRankings(date)
      
      if (result.success) {
        setRankings(result.rankings || [])
        console.log('分行排行榜数据:', result.rankings)
      } else {
        setError('获取排行榜失败')
      }
    } catch (error) {
      console.error('获取分行排行榜失败:', error)
      setError(error.message || '加载失败，请重试')
      
      if (error.message.includes('Unauthorized')) {
        router.replace('/login')
        return
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = (e) => {
    const newDate = e.target.value
    setSelectedDate(newDate)
    loadRankings(newDate)
  }

  // 获取排名奖章
  const getRankMedal = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  // 获取积分颜色
  const getScoreColor = (score) => {
    if (score >= 10) return 'text-green-600 bg-green-50'
    if (score >= 7) return 'text-blue-600 bg-blue-50'
    if (score >= 4) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  if (loading) {
    return (
      <Layout title="分行排行榜 - Learner Club">
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">正在加载排行榜...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="分行积分排行榜 - Learner Club">
      <SmoothTransition>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
          
          <PageHeader
            title={
              <>
                <span>🏆</span>
                <span>分行积分排行榜</span>
              </>
            }
            subtitle="各分行积分竞赛实时排名"
            onBack={() => router.back()}
          />

          <div className="px-4 pb-8 space-y-6">
            
            {/* 日期选择 */}
            <div className="-mt-16 relative z-10">
              <ModernCard className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">选择日期</h3>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </ModernCard>
            </div>

            {/* 排行榜统计 */}
            {rankings.length > 0 && (
              <ModernCard className="p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{rankings.length}</div>
                    <div className="text-sm text-gray-600">参与分行</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(rankings.reduce((sum, r) => sum + (r.avg_score || r.rate || 0), 0) / rankings.length * 10) / 10}
                    </div>
                    <div className="text-sm text-gray-600">平均积分</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {rankings.find(r => r.rank === 1)?.avg_score || rankings.find(r => r.rank === 1)?.rate || 0}
                    </div>
                    <div className="text-sm text-gray-600">最高积分</div>
                  </div>
                </div>
              </ModernCard>
            )}

            {/* 排行榜列表 */}
            {error && !rankings.length ? (
              <ModernCard className="p-8 text-center">
                <div className="text-6xl mb-4">😞</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">加载失败</h3>
                <p className="text-gray-600 mb-6">{error}</p>
                <button
                  onClick={() => loadRankings(selectedDate)}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all"
                >
                  重新加载
                </button>
              </ModernCard>
            ) : rankings.length === 0 ? (
              <ModernCard className="p-8 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">暂无数据</h3>
                <p className="text-gray-600">
                  {selectedDate === new Date().toISOString().slice(0, 10) 
                    ? '今日还没有排行榜数据'
                    : `${selectedDate} 没有排行榜数据`}
                </p>
              </ModernCard>
            ) : (
              <div className="space-y-3">
                {rankings.map((branch) => (
                  <ModernCard key={branch.branch_code} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl font-bold text-gray-700 min-w-[3rem]">
                          {getRankMedal(branch.rank)}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900">
                            {branch.branch_code} 分行
                          </h3>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>完成人数：{branch.done}/{branch.total}人</div>
                            <div>平均记录：{branch.avg_record_days}天</div>
                            {branch.max_streak > 0 && (
                              <div>最高连续：{branch.max_streak}天 ({branch.max_streak_user})</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${getScoreColor(branch.avg_score || branch.rate || 0)}`}>
                          {(branch.avg_score || branch.rate || 0).toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          平均积分
                        </div>
                      </div>
                    </div>
                  </ModernCard>
                ))}
              </div>
            )}

            {/* 说明 */}
            <ModernCard className="p-4 bg-blue-50 border-blue-200">
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-2">📖 积分排行榜说明</p>
                <ul className="space-y-1">
                  <li>• 基础分：每日记录或打卡获得1分</li>
                  <li>• 连续分：连续记录获得1分</li>
                  <li>• 奖励分：达成里程碑获得奖励(3天+2分，5天+3分...)</li>
                  <li>• 分行积分 = 分行总积分 ÷ 分行总人数</li>
                  <li>• 数据每日上午10:00自动更新</li>
                </ul>
              </div>
            </ModernCard>

          </div>
        </div>
      </SmoothTransition>

      {/* Toast 提示 */}
      {toast && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </Layout>
  )
}