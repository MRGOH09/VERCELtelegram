import { useState } from 'react'
import Head from 'next/head'

export default function SimpleSettings() {
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadUserData = async () => {
    setLoading(true)
    setMessage('正在加载...')
    
    try {
      // 使用已验证工作的API
      const response = await fetch('/api/pwa/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'profile' })
      })

      if (response.ok) {
        const result = await response.json()
        setUserData(result)
        setMessage('✅ 数据加载成功')
      } else {
        setMessage(`❌ 加载失败: ${response.status}`)
      }
    } catch (error) {
      setMessage(`❌ 错误: ${error.message}`)
    }
    
    setLoading(false)
  }

  const updateField = async (field, value) => {
    setMessage('更新中...')
    
    // 这里先简单模拟更新，实际可以调用更新API
    setMessage(`✅ ${field} 已更新为: ${value}`)
    
    // 重新加载数据
    setTimeout(loadUserData, 1000)
  }

  return (
    <>
      <Head>
        <title>简单Settings测试 - LEARNER CLUB</title>
      </Head>

      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          
          <div className="bg-green-600 text-white rounded-lg shadow p-6 mb-6">
            <h1 className="text-2xl font-bold mb-2">⚙️ 简单Settings测试</h1>
            <p className="text-green-100">使用已验证的API端点测试用户数据</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <button
              onClick={loadUserData}
              disabled={loading}
              className={`w-full p-4 rounded-lg font-semibold text-white transition-colors ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? '🔄 加载中...' : '📋 加载用户数据'}
            </button>
            
            {message && (
              <div className="mt-4 p-3 bg-gray-100 rounded-lg text-center">
                {message}
              </div>
            )}
          </div>

          {userData && (
            <div className="space-y-6">
              
              {/* 用户基本信息 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">👤 用户信息</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">姓名</label>
                    <div className="mt-1 text-lg">{userData.user?.name || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">分行</label>
                    <div className="mt-1 text-lg">{userData.user?.branch || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">加入日期</label>
                    <div className="mt-1 text-sm text-gray-500">
                      {userData.user?.joined_date ? new Date(userData.user.joined_date).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Telegram ID</label>
                    <div className="mt-1 text-sm text-gray-500">{userData.user?.telegram_id || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* 个人资料 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">📝 个人资料</h2>
                <div className="space-y-4">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">显示名称</label>
                      <input 
                        type="text"
                        className="mt-1 w-full p-2 border border-gray-300 rounded-lg"
                        defaultValue={userData.profile?.display_name || ''}
                        onBlur={(e) => updateField('显示名称', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">电话</label>
                      <input 
                        type="text"
                        className="mt-1 w-full p-2 border border-gray-300 rounded-lg"
                        defaultValue={userData.profile?.phone || ''}
                        onBlur={(e) => updateField('电话', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">邮箱</label>
                      <input 
                        type="email"
                        className="mt-1 w-full p-2 border border-gray-300 rounded-lg"
                        defaultValue={userData.profile?.email || ''}
                        onBlur={(e) => updateField('邮箱', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">月收入</label>
                      <input 
                        type="number"
                        className="mt-1 w-full p-2 border border-gray-300 rounded-lg"
                        defaultValue={userData.profile?.income || 0}
                        onBlur={(e) => updateField('月收入', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">A类支出百分比 (%)</label>
                      <input 
                        type="number"
                        min="0" max="100"
                        className="mt-1 w-full p-2 border border-gray-300 rounded-lg"
                        defaultValue={userData.profile?.a_pct || 0}
                        onBlur={(e) => updateField('A类百分比', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">年度旅游预算</label>
                      <input 
                        type="number"
                        className="mt-1 w-full p-2 border border-gray-300 rounded-lg"
                        defaultValue={userData.profile?.travel_budget || 0}
                        onBlur={(e) => updateField('旅游预算', e.target.value)}
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* 统计信息 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">📊 统计数据</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{userData.stats?.record_days || 0}</div>
                    <div className="text-sm text-blue-600">记录天数</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{userData.stats?.total_records || 0}</div>
                    <div className="text-sm text-green-600">总记录数</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{userData.stats?.current_streak || 0}</div>
                    <div className="text-sm text-orange-600">当前连续天数</div>
                  </div>
                </div>
              </div>

              {/* 原始数据 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">🔍 原始数据</h2>
                <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-xs">
{JSON.stringify(userData, null, 2)}
                </pre>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  )
}