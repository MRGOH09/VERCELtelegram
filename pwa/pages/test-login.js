import { useState } from 'react'

export default function TestLogin() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const testLogin = async () => {
    setLoading(true)
    setResult(null)

    try {
      // 模拟一个真实的Telegram用户登录
      const authParams = {
        id: '123456789',
        first_name: 'Test User', 
        username: 'testuser',
        auth_date: Math.floor(Date.now() / 1000),
        returnTo: '/'
      }

      console.log('发起认证请求:', authParams)

      // 调用认证API
      const url = `/api/pwa/auth?${new URLSearchParams(authParams)}`
      console.log('认证URL:', url)

      // 直接跳转到认证端点（这会触发重定向）
      window.location.href = url

    } catch (error) {
      console.error('登录测试失败:', error)
      setResult({ error: error.message })
      setLoading(false)
    }
  }

  const testAuthCallback = () => {
    // 模拟auth-callback的情况
    const callbackUrl = '/auth-callback?token=test_token&returnTo=/'
    window.location.href = callbackUrl
  }

  const checkCurrentAuth = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/pwa/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-auth' }),
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setResult({ 
          type: 'auth_check',
          success: true, 
          authenticated: data.authenticated,
          data 
        })
      } else {
        const errorText = await response.text()
        setResult({ 
          type: 'auth_check',
          success: false, 
          error: `HTTP ${response.status}: ${errorText}` 
        })
      }
    } catch (error) {
      setResult({ 
        type: 'auth_check',
        success: false, 
        error: error.message 
      })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-8">登录流程测试</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">测试操作</h2>
          <div className="space-y-4">
            <button
              onClick={testLogin}
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? '处理中...' : '测试完整登录流程'}
            </button>
            
            <button
              onClick={testAuthCallback}
              className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
            >
              测试Auth Callback页面
            </button>
            
            <button
              onClick={checkCurrentAuth}
              disabled={loading}
              className="w-full bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600 disabled:opacity-50"
            >
              检查当前认证状态
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">localStorage检查</h2>
          <div className="text-sm">
            <p><strong>JWT Token:</strong> {typeof window !== 'undefined' && localStorage.getItem('jwt_token') ? 'Found' : 'Not found'}</p>
            <p><strong>User Info:</strong> {typeof window !== 'undefined' && localStorage.getItem('user_info') ? 'Found' : 'Not found'}</p>
          </div>
          
          <button
            onClick={() => {
              localStorage.removeItem('jwt_token')
              localStorage.removeItem('user_info')
              alert('已清除localStorage')
              window.location.reload()
            }}
            className="mt-4 bg-red-500 text-white py-1 px-3 rounded text-sm hover:bg-red-600"
          >
            清除localStorage
          </button>
        </div>

        {result && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">测试结果</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/auth-diagnostic" className="text-blue-600 hover:underline mr-4">前往诊断页面</a>
          <a href="/login" className="text-blue-600 hover:underline">前往登录页</a>
        </div>
      </div>
    </div>
  )
}