import { useEffect, useState } from 'react'

export default function TestAuth() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  
  const testAuth = async () => {
    setLoading(true)
    try {
      const testParams = {
        id: '123456789',
        first_name: 'Test User',
        username: 'testuser'
      }
      
      const params = new URLSearchParams(testParams)
      const response = await fetch(`/api/pwa/auth?${params}`, {
        method: 'GET'
      })
      
      const text = await response.text()
      setResult({
        status: response.status,
        ok: response.ok,
        redirected: response.redirected,
        url: response.url,
        body: text.substring(0, 500) + (text.length > 500 ? '...' : '')
      })
    } catch (error) {
      setResult({
        error: error.message
      })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-8">PWA认证测试</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <button
            onClick={testAuth}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '测试中...' : '测试认证端点'}
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
        
        <div className="mt-8 bg-yellow-50 border border-yellow-200 p-4 rounded">
          <h3 className="font-semibold text-yellow-800 mb-2">诊断信息</h3>
          <p className="text-sm text-yellow-700">
            这个页面用于测试PWA认证端点是否正常工作。
          </p>
          <ul className="list-disc list-inside text-sm text-yellow-700 mt-2">
            <li>测试参数: id=123456789, first_name=Test User, username=testuser</li>
            <li>预期: 应该返回重定向到首页或错误信息</li>
            <li>如果返回HTML内容，说明被重定向了</li>
          </ul>
        </div>
      </div>
    </div>
  )
}