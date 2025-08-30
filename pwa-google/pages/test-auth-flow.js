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
    
    // 调试：显示当前URL和参数
    addLog(`当前URL: ${window.location.href}`)
    const urlParams = new URLSearchParams(window.location.search)
    const allParams = Array.from(urlParams.entries())
    addLog(`URL参数: ${JSON.stringify(allParams)}`)
    
    // 检查Supabase环境变量
    addLog(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '已配置' : '未配置'}`)
    addLog(`Supabase Key: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已配置' : '未配置'}`)
    
    // 检查是否是OAuth回调 - 检查hash fragment
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const hashEntries = Array.from(hashParams.entries())
    addLog(`Hash参数: ${JSON.stringify(hashEntries)}`)
    
    if (hashParams.has('access_token')) {
      addLog('🔄 检测到OAuth Token回调（Implicit Flow），处理中...')
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const expiresAt = hashParams.get('expires_at')
      
      addLog(`Access Token: ${accessToken ? accessToken.substring(0, 50) + '...' : 'null'}`)
      addLog(`Refresh Token: ${refreshToken ? refreshToken.substring(0, 20) + '...' : 'null'}`)
      addLog(`Expires At: ${expiresAt}`)
      
      // 手动设置会话
      const sessionData = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: parseInt(expiresAt),
        token_type: 'bearer',
        user: null // Supabase会自动从token中解析用户信息
      }
      
      addLog('正在设置Supabase会话...')
      supabase.auth.setSession(sessionData).then(({ data: { session }, error }) => {
        if (error) {
          addLog(`设置会话失败: ${error.message}`)
        } else if (session) {
          addLog(`✅ 会话已建立: ${session.user.email}`)
          addLog(`用户ID: ${session.user.id}`)
          addLog(`用户名: ${session.user.user_metadata?.name || session.user.user_metadata?.full_name}`)
        } else {
          addLog(`❌ 会话设置失败，没有返回session`)
        }
      })
      
      // 清除hash参数以避免重复处理
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (urlParams.has('code')) {
      addLog('🔄 检测到OAuth Code回调（Authorization Code Flow），处理中...')
      const code = urlParams.get('code')
      addLog(`OAuth code: ${code}`)
      
      // 手动处理OAuth交换
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          addLog(`OAuth交换失败: ${error.message}`)
        } else {
          addLog(`OAuth交换成功: ${data.session?.user?.email}`)
        }
      })
      
      // 清除URL参数以避免重复处理
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (urlParams.has('error') || hashParams.has('error')) {
      const error = urlParams.get('error') || hashParams.get('error')
      const errorDescription = urlParams.get('error_description') || hashParams.get('error_description')
      addLog(`❌ OAuth错误: ${error}`)
      if (errorDescription) {
        addLog(`错误描述: ${decodeURIComponent(errorDescription)}`)
      }
    } else {
      addLog('📍 正常页面加载，无OAuth参数')
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
      const redirectUrl = `${window.location.origin}/test-auth-flow`
      addLog(`OAuth重定向URL: ${redirectUrl}`)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
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