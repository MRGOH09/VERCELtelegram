import { useState, useEffect } from 'react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import { useRouter } from 'next/router'

// Google OAuth Client ID - 需要从Google Console获取
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'

export default function TestGoogleLogin() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [userInfo, setUserInfo] = useState(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // 解码Google JWT token获取用户信息
  const decodeGoogleToken = (credential) => {
    try {
      const base64Url = credential.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(jsonPayload)
    } catch (error) {
      console.error('Failed to decode token:', error)
      return null
    }
  }

  // 处理Google登录成功
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true)
    setError(null)
    
    try {
      // 解码Google token获取用户信息
      const decoded = decodeGoogleToken(credentialResponse.credential)
      console.log('Google用户信息:', decoded)
      
      setUserInfo({
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        googleId: decoded.sub
      })
      
      // 进入电话验证步骤（模拟Telegram流程）
      setCurrentStep(2)
    } catch (error) {
      console.error('Google登录处理失败:', error)
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 发送验证码
  const sendVerificationCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('请输入有效的手机号码')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // 模拟发送验证码
      console.log('发送验证码到:', phoneNumber)
      
      // 实际应用中这里调用后端API发送SMS
      // const response = await fetch('/api/pwa/send-sms', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ phone: phoneNumber })
      // })
      
      // 模拟：生成一个6位验证码
      const mockCode = Math.floor(100000 + Math.random() * 900000).toString()
      console.log('模拟验证码:', mockCode)
      
      // 开发环境下显示验证码
      if (process.env.NODE_ENV === 'development') {
        alert(`开发模式验证码: ${mockCode}`)
      }
      
      setCurrentStep(3)
    } catch (error) {
      setError('发送验证码失败')
    } finally {
      setLoading(false)
    }
  }

  // 验证手机号码
  const verifyPhoneNumber = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('请输入6位验证码')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // 模拟验证过程
      console.log('验证码验证:', verificationCode)
      
      // 实际应用中调用后端API验证并创建用户
      const response = await fetch('/api/pwa/google-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleId: userInfo.googleId,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          phone: phoneNumber,
          verificationCode
        }),
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // 保存JWT token
        if (data.token) {
          localStorage.setItem('jwt_token', data.token)
          localStorage.setItem('user_info', JSON.stringify({
            ...userInfo,
            phone: phoneNumber
          }))
        }
        
        setCurrentStep(4)
        
        // 2秒后跳转到首页
        setTimeout(() => {
          router.push('/')
        }, 2000)
      } else {
        const errorData = await response.json()
        setError(errorData.message || '验证失败')
      }
    } catch (error) {
      console.error('验证失败:', error)
      setError('验证失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-md mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">📱</div>
            <h1 className="text-2xl font-bold text-gray-900">
              PWA Google登录测试
            </h1>
            <p className="text-gray-600 mt-2">
              模拟Telegram注册流程
            </p>
          </div>

          {/* 步骤指示器 */}
          <div className="flex justify-between mb-8">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 mx-1 rounded-full transition-colors ${
                  currentStep >= step ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* 主要内容区 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            {/* 步骤1: Google登录 */}
            {currentStep === 1 && (
              <div className="text-center">
                <h2 className="text-lg font-semibold mb-4">
                  使用Google账号登录
                </h2>
                
                {GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID' ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                    <p className="text-sm text-yellow-700">
                      ⚠️ 请先配置Google OAuth Client ID
                    </p>
                    <p className="text-xs text-yellow-600 mt-2">
                      在.env.local中设置NEXT_PUBLIC_GOOGLE_CLIENT_ID
                    </p>
                  </div>
                ) : (
                  <div className="flex justify-center mb-6">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError('Google登录失败')}
                      text="signin_with"
                      shape="rectangular"
                      theme="outline"
                      size="large"
                      locale="zh_CN"
                    />
                  </div>
                )}
                
                <div className="mt-6 text-sm text-gray-500">
                  <p>这是一个测试页面</p>
                  <p>模拟使用Google账号注册PWA</p>
                </div>
              </div>
            )}

            {/* 步骤2: 输入手机号 */}
            {currentStep === 2 && (
              <div>
                <div className="text-center mb-6">
                  {userInfo?.picture && (
                    <img
                      src={userInfo.picture}
                      alt={userInfo.name}
                      className="w-20 h-20 rounded-full mx-auto mb-3"
                    />
                  )}
                  <h3 className="font-semibold">{userInfo?.name}</h3>
                  <p className="text-sm text-gray-500">{userInfo?.email}</p>
                </div>
                
                <h2 className="text-lg font-semibold mb-4">
                  验证手机号码
                </h2>
                
                <p className="text-sm text-gray-600 mb-4">
                  请输入您的手机号码，我们将发送验证码
                </p>
                
                <div className="mb-4">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="请输入手机号码"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
                
                <button
                  onClick={sendVerificationCode}
                  disabled={loading || !phoneNumber}
                  className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '发送中...' : '发送验证码'}
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
                  验证码已发送至 {phoneNumber}
                </p>
                
                <div className="mb-4">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="输入6位验证码"
                    maxLength="6"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
                
                <button
                  onClick={verifyPhoneNumber}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '验证中...' : '验证'}
                </button>
                
                <button
                  onClick={() => setCurrentStep(2)}
                  className="w-full mt-2 text-blue-500 hover:underline text-sm"
                >
                  重新发送验证码
                </button>
              </div>
            )}

            {/* 步骤4: 注册成功 */}
            {currentStep === 4 && (
              <div className="text-center">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-xl font-semibold mb-2">
                  注册成功！
                </h2>
                <p className="text-gray-600 mb-4">
                  欢迎加入Learner Club
                </p>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-700">
                    账号信息已保存，即将跳转到首页...
                  </p>
                </div>
                
                <button
                  onClick={() => router.push('/')}
                  className="text-blue-500 hover:underline"
                >
                  立即跳转
                </button>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* 底部链接 */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <a href="/login" className="text-blue-500 hover:underline mr-4">
              返回登录
            </a>
            <a href="/test-login" className="text-blue-500 hover:underline">
              Telegram测试
            </a>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  )
}