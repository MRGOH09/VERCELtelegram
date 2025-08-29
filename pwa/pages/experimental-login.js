import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'

// 实验性独立登录页面 - 不依赖Telegram
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'

export default function ExperimentalLogin() {
  const router = useRouter()
  const [loginMethod, setLoginMethod] = useState('email') // 'email' | 'google' | 'phone'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Email登录状态
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  // 手机登录状态
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  
  // 注册模式
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')

  // 解码Google JWT token
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

  // Google登录处理
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true)
    setError(null)
    
    try {
      const decoded = decodeGoogleToken(credentialResponse.credential)
      console.log('Google用户信息:', decoded)
      
      // 调用独立的认证API
      const response = await fetch('/api/experimental/auth-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleId: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture
        }),
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // 保存认证信息
        localStorage.setItem('exp_token', data.token)
        localStorage.setItem('exp_user', JSON.stringify(data.user))
        
        // 跳转到实验性首页
        router.push('/experimental-home')
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Google登录失败')
      }
    } catch (error) {
      console.error('Google登录错误:', error)
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // Email登录/注册
  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    if (!email || !password) {
      setError('请输入邮箱和密码')
      setLoading(false)
      return
    }
    
    if (isSignUp && !name) {
      setError('请输入姓名')
      setLoading(false)
      return
    }
    
    try {
      const response = await fetch('/api/experimental/auth-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name: isSignUp ? name : undefined,
          action: isSignUp ? 'signup' : 'login'
        }),
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        
        localStorage.setItem('exp_token', data.token)
        localStorage.setItem('exp_user', JSON.stringify(data.user))
        
        router.push('/experimental-home')
      } else {
        const errorData = await response.json()
        setError(errorData.message || '操作失败')
      }
    } catch (error) {
      console.error('Email认证错误:', error)
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 发送手机验证码
  const sendPhoneCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('请输入有效的手机号码')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/experimental/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber })
      })
      
      if (response.ok) {
        setCodeSent(true)
        // 开发环境显示验证码
        if (process.env.NODE_ENV === 'development') {
          const data = await response.json()
          if (data.code) {
            alert(`开发模式验证码: ${data.code}`)
          }
        }
      } else {
        const errorData = await response.json()
        setError(errorData.message || '发送失败')
      }
    } catch (error) {
      setError('发送验证码失败')
    } finally {
      setLoading(false)
    }
  }

  // 手机号码登录
  const handlePhoneAuth = async (e) => {
    e.preventDefault()
    
    if (!verificationCode || verificationCode.length !== 6) {
      setError('请输入6位验证码')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/experimental/auth-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneNumber,
          code: verificationCode,
          name: isSignUp ? name : undefined
        }),
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        
        localStorage.setItem('exp_token', data.token)
        localStorage.setItem('exp_user', JSON.stringify(data.user))
        
        router.push('/experimental-home')
      } else {
        const errorData = await response.json()
        setError(errorData.message || '验证失败')
      }
    } catch (error) {
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl w-full max-w-md p-8">
            {/* Logo和标题 */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-3xl text-white font-bold">LC</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Learner Club
              </h1>
              <p className="text-gray-600">
                实验性独立PWA应用
              </p>
              <div className="mt-2 inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                🧪 实验版本
              </div>
            </div>

            {/* 登录方式选择 */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => setLoginMethod('email')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  loginMethod === 'email' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-600'
                }`}
              >
                📧 邮箱
              </button>
              <button
                onClick={() => setLoginMethod('phone')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  loginMethod === 'phone' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-600'
                }`}
              >
                📱 手机
              </button>
              <button
                onClick={() => setLoginMethod('google')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  loginMethod === 'google' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-600'
                }`}
              >
                🔷 Google
              </button>
            </div>

            {/* Email登录表单 */}
            {loginMethod === 'email' && (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      姓名
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="输入您的姓名"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={loading}
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    邮箱地址
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    密码
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignUp ? "设置密码（至少6位）" : "输入密码"}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 text-white py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all transform hover:scale-[1.02]"
                >
                  {loading ? '处理中...' : (isSignUp ? '创建账号' : '登录')}
                </button>
                
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-purple-600 hover:underline text-sm"
                  >
                    {isSignUp ? '已有账号？点击登录' : '还没有账号？点击注册'}
                  </button>
                </div>
              </form>
            )}

            {/* 手机登录表单 */}
            {loginMethod === 'phone' && (
              <form onSubmit={handlePhoneAuth} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      姓名
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="输入您的姓名"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={loading}
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    手机号码
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+60 123456789"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={loading || codeSent}
                    />
                    {!codeSent && (
                      <button
                        type="button"
                        onClick={sendPhoneCode}
                        disabled={loading}
                        className="px-6 py-3 bg-purple-100 text-purple-600 rounded-xl font-medium hover:bg-purple-200 disabled:opacity-50"
                      >
                        发送验证码
                      </button>
                    )}
                  </div>
                </div>
                
                {codeSent && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        验证码
                      </label>
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="输入6位验证码"
                        maxLength="6"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        disabled={loading}
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 text-white py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all transform hover:scale-[1.02]"
                    >
                      {loading ? '验证中...' : '验证并登录'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setCodeSent(false)
                        setVerificationCode('')
                      }}
                      className="w-full text-purple-600 hover:underline text-sm"
                    >
                      重新发送验证码
                    </button>
                  </>
                )}
              </form>
            )}

            {/* Google登录 */}
            {loginMethod === 'google' && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <p className="text-gray-600 mb-4">
                    使用Google账号快速登录
                  </p>
                  
                  {GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID' ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-sm text-yellow-700 mb-2">
                        ⚠️ Google OAuth未配置
                      </p>
                      <p className="text-xs text-yellow-600">
                        请在.env.local中设置NEXT_PUBLIC_GOOGLE_CLIENT_ID
                      </p>
                      <button
                        onClick={() => {
                          // 模拟Google登录
                          handleGoogleSuccess({
                            credential: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.eyJzdWIiOiJtb2NrXzEyMzQ1NiIsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsIm5hbWUiOiJUZXN0IFVzZXIiLCJwaWN0dXJlIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9hdmF0YXIuanBnIn0.signature'
                          })
                        }}
                        className="mt-3 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                      >
                        使用模拟账号登录
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError('Google登录失败')}
                        text="continue_with"
                        shape="rectangular"
                        theme="outline"
                        size="large"
                        locale="zh_CN"
                      />
                    </div>
                  )}
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">或</span>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setLoginMethod('email')}
                    className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    使用邮箱
                  </button>
                  <button
                    onClick={() => setLoginMethod('phone')}
                    className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    使用手机
                  </button>
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* 底部信息 */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                这是一个实验性的独立PWA应用
              </p>
              <p className="text-xs text-gray-400 text-center mt-1">
                完全不依赖Telegram系统
              </p>
            </div>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  )
}