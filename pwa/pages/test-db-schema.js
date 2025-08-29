import { useState, useEffect } from 'react'

export default function TestDBSchema() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const testSchema = async () => {
    setLoading(true)
    try {
      // 检查users表结构
      const response = await fetch('/api/pwa/test-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_schema' })
      })
      
      if (response.ok) {
        const data = await response.json()
        setResult(data)
      } else {
        const error = await response.text()
        setResult({ error })
      }
    } catch (error) {
      setResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    testSchema()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-8">数据库模式检查</h1>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <button
            onClick={testSchema}
            disabled={loading}
            className="mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '检查中...' : '重新检查'}
          </button>
          
          {result && (
            <div>
              <h2 className="text-lg font-semibold mb-4">检查结果</h2>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}