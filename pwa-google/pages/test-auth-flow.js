import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function TestAuthFlow() {
  const [logs, setLogs] = useState([])
  const [supabase] = useState(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ))

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    const newLog = `[${timestamp}] ${message}`
    setLogs(prev => {
      const updatedLogs = [...prev, newLog]
      // 保存日志到localStorage
      localStorage.setItem('test-auth-logs', JSON.stringify(updatedLogs))
      return updatedLogs
    })
    console.log(`[TEST] ${message}`)
  }

  useEffect(() => {
    // 从localStorage恢复之前的日志
    const savedLogs = localStorage.getItem('test-auth-logs')
    if (savedLogs) {
      const parsedLogs = JSON.parse(savedLogs)
      setLogs(parsedLogs)
      addLog('📁 恢复之前的日志记录')
    } else {
      addLog('页面加载完成')
    }
    
    // 检查是否是OAuth回调
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has('code')) {
      addLog('🔄 检测到OAuth回调，处理中...')
      // 清除URL参数以避免重复处理
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    
    // 监听认证状态
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      addLog(`认证状态变化: ${event}`)
      
      if (event === 'SIGNED_IN' && session) {
        addLog(`用户登录: ${session.user.email}`)
        
        // 测试用户存在性检查
        try {
          addLog('开始检查用户是否存在...')
          const response = await fetch('/api/pwa/auth-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: session.user.email })
          })
          
          if (response.ok) {
            const result = await response.json()
            addLog(`用户存在检查结果: ${JSON.stringify(result)}`)
            
            if (result.userExists) {
              addLog('✅ 用户存在 - 应该跳转到首页')
            } else {
              addLog('❌ 用户不存在 - 应该显示注册提示')
            }
          } else {
            addLog(`API调用失败: ${response.status}`)
          }
        } catch (error) {
          addLog(`检查用户存在失败: ${error.message}`)
        }
      }
      
      if (event === 'SIGNED_OUT') {
        addLog('用户登出')
      }
    })

    return () => subscription?.unsubscribe()
  }, [supabase])

  const handleGoogleLogin = async () => {
    addLog('开始Google OAuth登录...')
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?mode=test&next=/test-auth-flow`
        }
      })
      
      if (error) {
        addLog(`OAuth失败: ${error.message}`)
      } else {
        addLog('OAuth重定向中...')
      }
    } catch (error) {
      addLog(`OAuth错误: ${error.message}`)
    }
  }

  const handleLogout = async () => {
    addLog('开始登出...')
    await supabase.auth.signOut()
  }

  const clearLogs = () => {
    setLogs([])
    localStorage.removeItem('test-auth-logs')
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🧪 认证流程测试页面</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleGoogleLogin} style={{ marginRight: '10px', padding: '10px' }}>
          🔑 Google登录测试
        </button>
        <button onClick={handleLogout} style={{ marginRight: '10px', padding: '10px' }}>
          🚪 登出测试
        </button>
        <button onClick={clearLogs} style={{ padding: '10px' }}>
          🧹 清空日志
        </button>
      </div>

      <div style={{ 
        border: '1px solid #ccc', 
        padding: '10px', 
        height: '400px', 
        overflow: 'auto',
        backgroundColor: '#f5f5f5' 
      }}>
        <h3>📋 实时日志：</h3>
        {logs.length === 0 ? (
          <p>等待操作...</p>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '5px' }}>
              {log}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <h4>📖 测试说明：</h4>
        <ul>
          <li>点击"Google登录测试"会触发OAuth流程</li>
          <li>登录后会自动检查用户是否在数据库中存在</li>
          <li>所有步骤都会显示在日志中</li>
          <li>可以清楚看到每一步的执行情况</li>
        </ul>
      </div>
    </div>
  )
}