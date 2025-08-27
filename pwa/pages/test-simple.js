import { useState } from 'react'
import Layout from '../components/Layout'

export default function TestSimple() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  
  const testRecord = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/simple-record-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          group: 'A',
          category: 'food',
          amount: '10.00',
          date: new Date().toISOString().slice(0, 10),
          note: '简陋测试记录'
        })
      })
      
      const data = await response.json()
      setResult(data)
      console.log('🧪 简陋测试结果:', data)
      
    } catch (error) {
      console.error('🧪 测试失败:', error)
      setResult({
        success: false,
        step: 'fetch_error',
        error: error.message
      })
    }
    setLoading(false)
  }
  
  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">🧪 简陋版本测试</h1>
        
        <button
          onClick={testRecord}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? '测试中...' : '🚀 测试记录功能'}
        </button>
        
        {result && (
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <h2 className="font-bold mb-2">测试结果:</h2>
            <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Layout>
  )
}