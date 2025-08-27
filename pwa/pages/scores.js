import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

export default function ScoresPage() {
  const [scoreData, setScoreData] = useState({
    dailyScores: [],
    summary: {
      totalScore: 0,
      currentStreak: 0,
      thisMonthScore: 0,
      todayScore: 0
    },
    loading: true
  })

  useEffect(() => {
    loadScoreData()
  }, [])

  const loadScoreData = async () => {
    try {
      setScoreData(prev => ({ ...prev, loading: true }))

      // 调用积分历史API
      const response = await fetch('/api/pwa/scores')
      const result = await response.json()

      if (result.ok) {
        setScoreData({
          dailyScores: result.data.dailyScores || [],
          summary: result.data.summary || {},
          loading: false
        })
      } else {
        throw new Error(result.error || '获取积分数据失败')
      }
    } catch (error) {
      console.error('加载积分数据失败:', error)
      setScoreData(prev => ({ ...prev, loading: false }))
    }
  }

  const ScoreCard = ({ score }) => {
    const formatDate = (dateStr) => {
      const date = new Date(dateStr)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      if (dateStr === today.toISOString().split('T')[0]) {
        return '今天'
      } else if (dateStr === yesterday.toISOString().split('T')[0]) {
        return '昨天'
      } else {
        return `${date.getMonth() + 1}/${date.getDate()}`
      }
    }

    const getRecordTypeIcon = (recordType) => {
      return recordType === 'checkin' ? '✅' : '💰'
    }

    const getRecordTypeText = (recordType) => {
      return recordType === 'checkin' ? '每日打卡' : '开销记录'
    }

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <span className="text-lg mr-2">{getRecordTypeIcon(score.record_type)}</span>
            <div>
              <h3 className="font-medium text-gray-900">{formatDate(score.ymd)}</h3>
              <p className="text-sm text-gray-500">{getRecordTypeText(score.record_type)}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-primary">{score.total_score}分</div>
            <div className="text-xs text-gray-500">连续{score.current_streak}天</div>
          </div>
        </div>

        {/* 积分明细 */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <div className="text-xs text-green-600 mb-1">基础分</div>
            <div className="font-medium text-green-700">{score.base_score}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="text-xs text-blue-600 mb-1">连续分</div>
            <div className="font-medium text-blue-700">{score.streak_score}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-2 text-center">
            <div className="text-xs text-orange-600 mb-1">奖励分</div>
            <div className="font-medium text-orange-700">{score.bonus_score}</div>
          </div>
        </div>

        {/* 里程碑成就 */}
        {score.bonus_details && score.bonus_details.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-2">🎉 成就：</span>
              <div className="flex flex-wrap gap-1">
                {score.bonus_details.map((bonus, index) => (
                  <span
                    key={index}
                    className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full"
                  >
                    {bonus.name} +{bonus.score}分
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (scoreData.loading) {
    return (
      <Layout title="我的积分 - Learner Club">
        <div className="p-4">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">加载积分数据中...</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="我的积分 - Learner Club">
      <div className="p-4">
        {/* 头部标题 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">⭐ 我的积分</h1>
          <p className="text-gray-600">记录你的理财成长轨迹</p>
        </div>

        {/* 积分概览 */}
        <div className="bg-gradient-to-br from-primary to-blue-600 rounded-2xl p-6 mb-6 text-white">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">{scoreData.summary.totalScore || 0}</div>
              <div className="text-sm opacity-90">历史总分</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">{scoreData.summary.currentStreak || 0}</div>
              <div className="text-sm opacity-90">连续天数</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20">
            <div className="text-center">
              <div className="text-xl font-semibold mb-1">{scoreData.summary.thisMonthScore || 0}</div>
              <div className="text-xs opacity-90">本月积分</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold mb-1">{scoreData.summary.todayScore || 0}</div>
              <div className="text-xs opacity-90">今日积分</div>
            </div>
          </div>
        </div>

        {/* 每日积分记录 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">📅</span>
            每日积分记录
          </h2>
          
          {scoreData.dailyScores.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-gray-500 mb-2">还没有积分记录</p>
              <p className="text-sm text-gray-400">开始记录或打卡来获得积分吧！</p>
            </div>
          ) : (
            <div className="space-y-0">
              {scoreData.dailyScores.map((score, index) => (
                <ScoreCard key={`${score.user_id}-${score.ymd}`} score={score} />
              ))}
            </div>
          )}
        </div>

        {/* 积分规则说明 */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
          <div className="flex items-start">
            <span className="text-purple-500 mr-2">🎯</span>
            <div className="text-sm text-purple-700">
              <p className="font-medium mb-2">积分获取规则：</p>
              <div className="space-y-1">
                <p>• <strong>基础分</strong>：每次记录或打卡获得1分</p>
                <p>• <strong>连续分</strong>：保持连续记录额外获得1分</p>
                <p>• <strong>奖励分</strong>：达成里程碑获得bonus分</p>
                <p>• <strong>里程碑</strong>：3天(+2)、5天(+3)、10天(+5)、15天(+8)、21天(+12)、31天(+20)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}