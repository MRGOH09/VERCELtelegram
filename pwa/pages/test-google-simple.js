import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function TestGoogleSimple() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [mockUser, setMockUser] = useState(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mockVerificationCode, setMockVerificationCode] = useState('')

  // 模拟Google用户数据
  const mockGoogleUsers = [
    {
      email: 'john.doe@gmail.com',
      name: 'John Doe',
      picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
      googleId: 'mock_google_id_123'
    },
    {
      email: 'jane.smith@gmail.com', 
      name: 'Jane Smith',
      picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
      googleId: 'mock_google_id_456'
    },
    {
      email: 'test.user@gmail.com',
      name: 'Test User',
      picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c', 
      googleId: 'mock_google_id_789'
    }
  ]

  // 模拟Google登录选择
  const selectMockUser = (user) => {
    setLoading(true)
    setError(null)
    
    // 模拟网络延迟
    setTimeout(() => {
      setMockUser(user)
      setCurrentStep(2)
      setLoading(false)
    }, 1000)
  }

  // 发送验证码（模拟）
  const sendVerificationCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('请输入有效的手机号码')
      return
    }
    
    setLoading(true)
    setError(null)
    
    // 模拟发送SMS
    setTimeout(() => {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      setMockVerificationCode(code)
      console.log('模拟验证码:', code)
      
      // 在开发环境显示验证码
      alert(`📱 验证码已发送: ${code}`)
      
      setCurrentStep(3)
      setLoading(false)
    }, 1500)
  }

  // 验证手机号码
  const verifyPhoneNumber = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('请输入6位验证码')
      return
    }
    
    if (verificationCode !== mockVerificationCode) {
      setError('验证码不正确')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // 调用后端API创建用户
      const response = await fetch('/api/pwa/google-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleId: mockUser.googleId,
          email: mockUser.email,
          name: mockUser.name,
          picture: mockUser.picture,
          phone: phoneNumber,
          verificationCode
        }),
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('注册成功:', data)
        
        // 保存JWT token
        if (data.token) {
          localStorage.setItem('jwt_token', data.token)
          localStorage.setItem('user_info', JSON.stringify({
            ...mockUser,
            phone: phoneNumber,
            userId: data.user.id
          }))
        }
        
        setCurrentStep(4)
        
        // 3秒后跳转到首页
        setTimeout(() => {
          router.push('/')
        }, 3000)
      } else {
        const errorData = await response.json()
        setError(errorData.message || '验证失败')
      }
    } catch (error) {
      console.error('验证失败:', error)
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 py-8">
      <div className="max-w-md mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-gray-900">
            Google登录模拟器
          </h1>
          <p className="text-gray-600 mt-2">
            模拟Telegram注册流程 - 无需真实Google账号
          </p>
        </div>

        {/* 步骤指示器 */}
        <div className="flex justify-between mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  currentStep >= step 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-300 text-gray-500'
                }`}
              >
                {step}
              </div>
              <div className="text-xs mt-1 text-gray-500">
                {step === 1 && 'Google'}
                {step === 2 && '手机'}
                {step === 3 && '验证'}
                {step === 4 && '完成'}
              </div>
            </div>
          ))}
        </div>

        {/* 主要内容区 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* 步骤1: 选择模拟Google账号 */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-center">
                选择模拟Google账号
              </h2>
              
              <div className="space-y-3">
                {mockGoogleUsers.map((user, index) => (
                  <button
                    key={index}
                    onClick={() => selectMockUser(user)}
                    disabled={loading}
                    className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {loading && (
                <div className="text-center mt-4">
                  <div className="inline-flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500 mr-2"></div>
                    <span className="text-sm text-gray-600">登录中...</span>
                  </div>
                </div>
              )}
              
              <div className="mt-6 text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
                    💡 这是一个模拟环境，选择任何账号都可以继续测试流程
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 步骤2: 输入手机号 */}
          {currentStep === 2 && (
            <div>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                  {mockUser?.name.charAt(0)}
                </div>
                <h3 className="font-semibold">{mockUser?.name}</h3>
                <p className="text-sm text-gray-500">{mockUser?.email}</p>
              </div>
              
              <h2 className="text-lg font-semibold mb-4">
                验证手机号码
              </h2>
              
              <p className="text-sm text-gray-600 mb-4">
                请输入您的手机号码，我们将发送验证码进行验证
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  手机号码
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+60 123456789"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              
              <button
                onClick={sendVerificationCode}
                disabled={loading || !phoneNumber}
                className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    发送中...
                  </div>
                ) : '发送验证码'}
              </button>
            </div>
          )}

          {/* 步骤3: 输入验证码 */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">
                输入验证码
              </h2>
              
              <p className="text-sm text-gray-600 mb-4">
                验证码已发送至 <span className="font-medium">{phoneNumber}</span>
              </p>
              
              {mockVerificationCode && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-700">
                    🔍 开发模式验证码: <span className="font-mono font-bold">{mockVerificationCode}</span>
                  </p>
                </div>
              )}
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  验证码
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="输入6位验证码"
                  maxLength="6"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              
              <button
                onClick={verifyPhoneNumber}
                disabled={loading || verificationCode.length !== 6}
                className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    验证中...
                  </div>
                ) : '验证并注册'}
              </button>
              
              <button
                onClick={() => setCurrentStep(2)}
                className="w-full mt-3 text-green-600 hover:underline text-sm"
                disabled={loading}
              >
                修改手机号码
              </button>
            </div>
          )}

          {/* 步骤4: 注册成功 */}
          {currentStep === 4 && (
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-xl font-semibold mb-2">
                注册成功！
              </h2>
              <p className="text-gray-600 mb-6">
                欢迎加入Learner Club PWA
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="text-center">
                  <p className="text-sm text-green-700 font-medium mb-2">
                    ✅ 账号创建成功
                  </p>
                  <div className="text-xs text-green-600 space-y-1">
                    <p>📧 邮箱: {mockUser?.email}</p>
                    <p>📱 手机: {phoneNumber}</p>
                    <p>🔑 JWT Token 已保存</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  前往首页
                </button>
                
                <button
                  onClick={() => router.push('/settings')}
                  className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition-colors"
                >
                  查看设置页面
                </button>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="mt-8 text-center space-y-2">
          <div className="text-sm text-gray-500">
            <a href="/test-login" className="text-blue-500 hover:underline mr-4">
              Telegram测试
            </a>
            <a href="/auth-diagnostic" className="text-blue-500 hover:underline mr-4">
              认证诊断
            </a>
            <a href="/login" className="text-blue-500 hover:underline">
              返回登录
            </a>
          </div>
          
          {currentStep > 1 && (
            <button
              onClick={() => {
                localStorage.removeItem('jwt_token')
                localStorage.removeItem('user_info') 
                setCurrentStep(1)
                setMockUser(null)
                setPhoneNumber('')
                setVerificationCode('')
                setError(null)
              }}
              className="text-red-500 hover:underline text-sm"
            >
              重新开始测试
            </button>
          )}
        </div>
      </div>
    </div>
  )
}