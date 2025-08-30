import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function TestAuthFlow() {
  const [logs, setLogs] = useState([])
  
  // 关键修复：配置detectSessionInUrl让Supabase自动处理hash中的token
  const [supabase] = useState(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        detectSessionInUrl: true,     // 自动检测并处理URL中的session
        persistSession: true,          // 持久化session到localStorage
        autoRefreshToken: true,        // 自动刷新token
        flowType: 'implicit'           // 明确使用implicit flow
      }
    }
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
    
    // 显示当前URL信息用于调试
    addLog(`当前URL: ${window.location.href}`)
    
    // 检查URL中是否有token（用于调试，Supabase会自动处理）
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    if (hashParams.has('access_token')) {
      addLog('🔄 检测到OAuth token在URL hash中')
      addLog('⏳ Supabase正在自动处理token...')
      
      // 给Supabase一点时间处理token，然后检查结果
      setTimeout(async () => {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (session) {
          addLog('✅ 会话已自动建立成功！')
          addLog(`用户: ${session.user.email}`)
        } else if (error) {
          addLog(`❌ 会话建立失败: ${error.message}`)
        }
      }, 500)
    }
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      addLog(`认证状态变化: ${event}`)
      
      if (event === 'SIGNED_IN' && session) {
        addLog(`✅ 用户登录成功: ${session.user.email}`)
        
        // 测试用户存在性检查API
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
              addLog('✅ 用户存在 - 可以正常使用系统')
            } else {
              addLog('❌ 用户不存在 - 需要完成注册')
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
      
      if (event === 'TOKEN_REFRESHED') {
        addLog('Token已刷新')
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
          redirectTo: `${window.location.origin}/test-auth-flow`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          }
        }
      })
      
      if (error) {
        addLog(`OAuth失败: ${error.message}`)
      } else {
        addLog('OAuth重定向中...')
        addLog(`重定向URL: ${data.url}`)
      }
    } catch (error) {
      addLog(`OAuth错误: ${error.message}`)
    }
  }

  const handleLogout = async () => {
    addLog('开始登出...')
    const { error } = await supabase.auth.signOut()
    if (error) {
      addLog(`登出失败: ${error.message}`)
    } else {
      addLog('登出成功')
    }
  }

  const clearLogs = () => {
    setLogs([])
    localStorage.removeItem('test-auth-logs')
  }

  const checkSession = async () => {
    addLog('检查当前会话...')
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      addLog(`获取会话失败: ${error.message}`)
    } else if (session) {
      addLog(`✅ 活跃会话存在`)
      addLog(`用户: ${session.user.email}`)
      addLog(`会话ID: ${session.access_token.substring(0, 20)}...`)
    } else {
      addLog('⚠️ 没有活跃会话')
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🧪 认证流程测试页面</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleGoogleLogin} style={{ marginRight: '10px', padding: '10px' }}>
          🔑 Google登录测试
        </button>
        <button onClick={checkSession} style={{ marginRight: '10px', padding: '10px' }}>
          🔍 检查会话
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
          <li>Supabase会自动处理返回的token（使用detectSessionInUrl）</li>
          <li>登录后会自动检查用户是否在数据库中存在</li>
          <li>所有步骤都会显示在日志中</li>
        </ul>
        
        <h4>✅ 关键配置：</h4>
        <ul>
          <li>detectSessionInUrl: true - 自动处理URL中的token</li>
          <li>flowType: 'implicit' - 使用implicit flow</li>
          <li>不手动调用setSession - 让Supabase自动管理</li>
        </ul>
      </div>
    </div>
  )
}