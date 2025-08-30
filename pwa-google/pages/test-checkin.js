import { useState } from 'react'
import Head from 'next/head'

export default function TestCheckIn() {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [checkinStatus, setCheckinStatus] = useState(null)
  
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { message, type, timestamp }])
    console.log(`[${type.toUpperCase()}] ${message}`)
  }

  const clearLogs = () => {
    setLogs([])
  }

  // 测试认证状态
  const testAuth = async () => {
    addLog('🔐 测试认证状态...', 'info')
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/pwa/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'check-auth'
        })
      })

      const result = await response.json()
      
      addLog(`认证响应状态: ${response.status}`, response.ok ? 'success' : 'error')
      addLog(`认证响应内容: ${JSON.stringify(result, null, 2)}`, 'info')
      
      if (result.authenticated) {
        addLog(`✅ 认证成功 - 用户: ${result.user.name}, 分行: ${result.user.branch}`, 'success')
      } else {
        addLog('❌ 认证失败 - 请先通过Telegram登录', 'error')
      }
      
    } catch (error) {
      addLog(`❌ 认证请求失败: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // 检查打卡状态
  const checkCheckinStatus = async () => {
    addLog('📊 检查今日打卡状态...', 'info')
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/pwa/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'check-checkin-status'
        })
      })

      const result = await response.json()
      
      addLog(`打卡状态响应: ${response.status}`, response.ok ? 'success' : 'error')
      addLog(`打卡状态内容: ${JSON.stringify(result, null, 2)}`, 'info')
      
      setCheckinStatus(result)
      
      if (result.success) {
        if (result.hasCheckedIn) {
          addLog(`✅ 今日已打卡 - 时间: ${result.checkinTime}`, 'success')
        } else {
          addLog('⭕ 今日未打卡', 'info')
        }
      } else {
        addLog(`❌ 检查打卡状态失败: ${result.error}`, 'error')
      }
      
    } catch (error) {
      addLog(`❌ 检查打卡状态请求失败: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // 执行打卡
  const performCheckin = async () => {
    addLog('🎯 开始执行打卡...', 'info')
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/pwa/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'checkin'
        })
      })

      const responseText = await response.text()
      addLog(`打卡响应状态: ${response.status}`, response.ok ? 'success' : 'error')
      addLog(`打卡响应原文: ${responseText}`, 'info')
      
      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        addLog(`❌ 响应不是有效JSON: ${parseError.message}`, 'error')
        return
      }
      
      addLog(`打卡响应内容: ${JSON.stringify(result, null, 2)}`, 'info')
      
      if (result.success) {
        addLog('🎉 打卡成功！', 'success')
        
        if (result.score) {
          addLog(`🏆 积分信息: 总分${result.score.total_score}, 基础${result.score.base_score}, 连续${result.score.streak_score}, 奖励${result.score.bonus_score}`, 'success')
        }
        
        if (result.scoreMessage) {
          addLog(`💬 积分消息: ${result.scoreMessage}`, 'success')
        }
        
        if (result.record) {
          addLog(`📝 记录信息: ID=${result.record.id}, 分组=${result.record.category_group}`, 'info')
        }
        
      } else {
        addLog(`❌ 打卡失败: ${result.error}`, 'error')
        
        // 显示调试信息
        if (result.debug) {
          addLog(`🔍 调试信息: ${JSON.stringify(result.debug, null, 2)}`, 'error')
        }
      }
      
    } catch (error) {
      addLog(`❌ 打卡请求失败: ${error.message}`, 'error')
      addLog(`❌ 错误详情: ${error.stack}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // 测试数据库权限
  const testDatabasePermissions = async () => {
    addLog('🗄️ 测试数据库权限...', 'info')
    setIsLoading(true)
    
    try {
      // 测试读取records表
      const response = await fetch('/api/pwa/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'history',
          limit: 1
        })
      })

      const result = await response.json()
      
      addLog(`数据库读取测试: ${response.status}`, response.ok ? 'success' : 'error')
      addLog(`数据库响应: ${JSON.stringify(result, null, 2)}`, 'info')
      
      if (result.records) {
        addLog(`✅ 数据库连接正常 - 找到 ${result.records.length} 条记录`, 'success')
      }
      
    } catch (error) {
      addLog(`❌ 数据库连接失败: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>PWA打卡功能测试</title>
      </Head>
      
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          
          {/* 标题 */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">🧪 PWA打卡功能测试</h1>
            <p className="text-gray-600">用于调试PWA打卡功能的测试页面</p>
          </div>

          {/* 控制面板 */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">🎮 测试控制面板</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button 
                onClick={testAuth}
                disabled={isLoading}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {isLoading ? '测试中...' : '🔐 测试认证'}
              </button>
              
              <button 
                onClick={checkCheckinStatus}
                disabled={isLoading}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {isLoading ? '检查中...' : '📊 检查状态'}
              </button>
              
              <button 
                onClick={performCheckin}
                disabled={isLoading}
                className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {isLoading ? '打卡中...' : '🎯 执行打卡'}
              </button>
              
              <button 
                onClick={testDatabasePermissions}
                disabled={isLoading}
                className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {isLoading ? '测试中...' : '🗄️ 测试数据库'}
              </button>
            </div>
            
            <div className="mt-4">
              <button 
                onClick={clearLogs}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                🗑️ 清空日志
              </button>
            </div>
          </div>

          {/* 状态显示 */}
          {checkinStatus && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">📊 当前状态</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-semibold">打卡状态</div>
                  <div className={checkinStatus.hasCheckedIn ? 'text-green-600' : 'text-red-600'}>
                    {checkinStatus.hasCheckedIn ? '✅ 已打卡' : '❌ 未打卡'}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-semibold">日期</div>
                  <div>{checkinStatus.today}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-semibold">打卡时间</div>
                  <div>{checkinStatus.checkinTime || '未打卡'}</div>
                </div>
              </div>
            </div>
          )}

          {/* 日志显示 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">📋 调试日志 ({logs.length}条)</h2>
            
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">等待测试操作...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-2">
                    <span className="text-gray-400">[{log.timestamp}]</span>
                    <span className={`ml-2 ${
                      log.type === 'error' ? 'text-red-400' : 
                      log.type === 'success' ? 'text-green-400' : 
                      log.type === 'warning' ? 'text-yellow-400' : 
                      'text-blue-400'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 使用说明 */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6">
            <h3 className="font-semibold mb-2">📝 使用说明</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>首先点击"测试认证"确认用户已登录</li>
              <li>点击"检查状态"查看今日打卡状态</li>
              <li>点击"执行打卡"进行实际打卡操作</li>
              <li>点击"测试数据库"检查数据库连接和权限</li>
              <li>查看调试日志了解详细的请求响应过程</li>
            </ol>
          </div>
          
        </div>
      </div>
    </>
  )
}