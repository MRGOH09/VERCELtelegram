import { useState, useEffect } from 'react'
import Head from 'next/head'

export default function BranchStats() {
  const [stats, setStats] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  // 分院信息配置 - 包含新增的小天使分院
  const branchConfig = {
    'PU': { name: 'PU分院', color: '#3B82F6', icon: '🏛️' },
    'MM': { name: 'MM分院', color: '#EF4444', icon: '🏢' },
    'KL': { name: 'KL分院', color: '#10B981', icon: '🏙️' },
    'JB': { name: 'JB分院', color: '#F59E0B', icon: '🌉' },
    'PG': { name: 'PG分院', color: '#8B5CF6', icon: '🏝️' },
    'KK': { name: 'KK分院', color: '#06B6D4', icon: '🏔️' },
    'KC': { name: 'KC分院', color: '#84CC16', icon: '🌾' },
    '小天使': { name: '小天使分院', color: '#EC4899', icon: '👼' }
  }

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/pwa/branch-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'get_stats' })
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setLastUpdate(new Date().toLocaleTimeString('zh-CN'))
      }
    } catch (error) {
      console.error('加载分院统计失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // 页面打开立即加载实时数据
    loadStats()
    // 每15秒自动刷新，确保实时性
    const interval = setInterval(loadStats, 15000)
    return () => clearInterval(interval)
  }, [])

  const maxCount = Math.max(...stats.map(s => s.count), 1)

  return (
    <>
      <Head>
        <title>分院报名统计 - LEARNER CLUB</title>
        <meta name="description" content="实时显示各分院报名人数统计" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* 标题区域 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-3xl font-bold mb-2">🏆 LEARNER CLUB</h1>
            <p className="text-xl opacity-90">分院报名统计</p>
            <p className="text-sm opacity-75 mt-2">
              实时更新 • 最后刷新: {lastUpdate || '加载中...'}
            </p>
          </div>
        </div>

        {/* 统计内容 */}
        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              <p className="mt-4 text-gray-600">正在加载分院数据...</p>
            </div>
          ) : (
            <>
              {/* 总计卡片 */}
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 text-center">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">📊 总报名人数</h2>
                <div className="text-4xl font-bold text-blue-600 animate-pulse">
                  {stats.reduce((sum, branch) => sum + branch.count, 0)}
                </div>
                <p className="text-gray-500 text-sm mt-1">人已加入LEARNER CLUB</p>
              </div>

              {/* 分院统计网格 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {stats.map((branch, index) => {
                  const config = branchConfig[branch.branch_code] || { 
                    name: branch.branch_code, 
                    color: '#6B7280', 
                    icon: '🏫' 
                  }
                  const percentage = (branch.count / maxCount) * 100

                  return (
                    <div
                      key={branch.branch_code}
                      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden transform hover:scale-105"
                      style={{ 
                        animationDelay: `${index * 100}ms`,
                        animation: 'fadeInUp 0.6s ease-out forwards'
                      }}
                    >
                      {/* 分院标头 */}
                      <div 
                        className="p-4 text-white text-center"
                        style={{ backgroundColor: config.color }}
                      >
                        <div className="text-2xl mb-1">{config.icon}</div>
                        <h3 className="font-bold text-lg">{config.name}</h3>
                      </div>

                      {/* 数据区域 */}
                      <div className="p-6 text-center">
                        {/* 大号数字显示 */}
                        <div className="mb-4">
                          <div 
                            className="text-6xl font-bold mb-2 transform transition-all duration-1000"
                            style={{ 
                              color: config.color,
                              textShadow: `0 0 20px ${config.color}40`,
                              animation: `countUp 2s ease-out ${index * 0.3}s forwards`
                            }}
                            data-target={branch.count}
                          >
                            {branch.count}
                          </div>
                          <p className="text-gray-600 font-medium">注册用户</p>
                        </div>

                        {/* 视觉指示器 - 圆点大小表示规模 */}
                        <div className="flex justify-center items-center space-x-2 mt-4">
                          {[...Array(Math.min(5, Math.ceil(branch.count / 10) || 1))].map((_, i) => (
                            <div
                              key={i}
                              className="rounded-full animate-pulse"
                              style={{
                                backgroundColor: config.color,
                                width: `${8 + i * 2}px`,
                                height: `${8 + i * 2}px`,
                                animationDelay: `${i * 0.2}s`
                              }}
                            ></div>
                          ))}
                        </div>

                        {/* 活跃度指示 */}
                        <div className="mt-4 text-sm">
                          {branch.count >= 50 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              🔥 超活跃
                            </span>
                          )}
                          {branch.count >= 20 && branch.count < 50 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              ⚡ 活跃
                            </span>
                          )}
                          {branch.count >= 5 && branch.count < 20 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              🌱 成长中
                            </span>
                          )}
                          {branch.count < 5 && branch.count > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              🆕 新起步
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 刷新按钮 */}
              <div className="text-center">
                <button
                  onClick={loadStats}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white px-6 py-3 rounded-full font-semibold shadow-lg transform transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <>
                      <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                      刷新中...
                    </>
                  ) : (
                    <>🔄 立即刷新</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 底部品牌标识 */}
        <div className="bg-gray-800 text-white text-center py-6 mt-12">
          <p className="text-sm opacity-75">
            💡 <strong>LEARNER CLUB</strong> - 一起学习，共同成长
          </p>
          <p className="text-xs opacity-50 mt-1">
            让每一次记录都成为成长的见证
          </p>
        </div>

        <style jsx>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes countUp {
            from {
              transform: scale(0.5);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          .animate-bounce {
            animation: bounce 2s infinite;
          }

          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
              transform: translateY(0);
            }
            40% {
              transform: translateY(-10px);
            }
            60% {
              transform: translateY(-5px);
            }
          }
        `}</style>
      </div>
    </>
  )
}