import { useState } from 'react'
import { useRouter } from 'next/router'

export default function GoogleRegisterTest() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    birthDate: '',
    gender: ''
  })
  const [verificationCode, setVerificationCode] = useState('')
  const [mockCode, setMockCode] = useState('')
  const [errors, setErrors] = useState({})
  const [accountCreated, setAccountCreated] = useState(false)

  // 验证表单
  const validateStep = (step) => {
    const newErrors = {}
    
    if (step === 1) {
      if (!formData.firstName) newErrors.firstName = '请输入名字'
      if (!formData.lastName) newErrors.lastName = '请输入姓氏'
      if (!formData.email) {
        newErrors.email = '请输入邮箱'
      } else if (!formData.email.includes('@')) {
        newErrors.email = '请输入有效的邮箱地址'
      } else if (!formData.email.endsWith('@gmail.com')) {
        // 检查是否已经是gmail邮箱
        formData.email = formData.email.split('@')[0] + '@gmail.com'
      }
      if (!formData.password) {
        newErrors.password = '请输入密码'
      } else if (formData.password.length < 8) {
        newErrors.password = '密码至少需要8位'
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = '两次密码不一致'
      }
    }
    
    if (step === 2) {
      if (!formData.phone) {
        newErrors.phone = '请输入手机号码'
      } else if (formData.phone.length < 10) {
        newErrors.phone = '请输入有效的手机号码'
      }
    }
    
    if (step === 3) {
      if (!formData.birthDate) newErrors.birthDate = '请选择出生日期'
      if (!formData.gender) newErrors.gender = '请选择性别'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 处理下一步
  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 2) {
        // 发送验证码
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        setMockCode(code)
        alert(`📱 验证码已发送: ${code}`)
      }
      setCurrentStep(currentStep + 1)
    }
  }

  // 处理上一步
  const handleBack = () => {
    setCurrentStep(currentStep - 1)
    setErrors({})
  }

  // 验证手机号
  const handleVerifyPhone = () => {
    if (verificationCode === mockCode) {
      setCurrentStep(3)
    } else {
      setErrors({ code: '验证码错误' })
    }
  }

  // 创建账号
  const handleCreateAccount = async () => {
    if (!validateStep(3)) return
    
    setLoading(true)
    
    // 模拟创建账号
    setTimeout(async () => {
      try {
        // 调用API创建Google账号（模拟）
        const response = await fetch('/api/experimental/create-google-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            googleId: `google_${Date.now()}`,
            verified: true
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          
          // 保存登录信息
          localStorage.setItem('google_account', JSON.stringify(data.user))
          localStorage.setItem('google_token', data.token)
          
          setAccountCreated(true)
          setCurrentStep(5)
        }
      } catch (error) {
        console.error('创建账号失败:', error)
      } finally {
        setLoading(false)
      }
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Google风格的顶部栏 */}
      <div className="border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="text-2xl font-bold">
              <span className="text-blue-500">G</span>
              <span className="text-red-500">o</span>
              <span className="text-yellow-500">o</span>
              <span className="text-blue-500">g</span>
              <span className="text-green-500">l</span>
              <span className="text-red-500">e</span>
            </div>
            <span className="ml-4 text-gray-600">创建账号</span>
          </div>
          {currentStep < 5 && (
            <div className="text-sm text-gray-500">
              步骤 {currentStep} / 4
            </div>
          )}
        </div>
      </div>

      {/* 主要内容 */}
      <div className="max-w-md mx-auto px-4 py-8">
        {/* 步骤1: 基本信息 */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-normal mb-2">创建您的 Google 账号</h1>
              <p className="text-gray-600">一个账号，畅享 Google 所有服务</p>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="名字"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="姓氏"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                  )}
                </div>
              </div>
              
              <div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="用户名"
                    value={formData.email.split('@')[0]}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className={`w-full px-3 py-2 pr-28 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <span className="absolute right-3 top-2.5 text-gray-500">@gmail.com</span>
                </div>
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">您可以使用字母、数字和句点</p>
              </div>
              
              <div>
                <input
                  type="password"
                  placeholder="密码"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
              </div>
              
              <div>
                <input
                  type="password"
                  placeholder="确认密码"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">使用8个或更多字符，包含字母、数字和符号</p>
              </div>
              
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">显示密码</span>
              </label>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => router.push('/experimental-login')}
                className="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded"
              >
                改为登录
              </button>
              <button
                onClick={handleNext}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* 步骤2: 手机验证 */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-normal mb-2">验证您的手机号码</h1>
              <p className="text-gray-600">为了您的安全，Google 希望确认是您本人</p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <span className="text-blue-600 mr-2">📱</span>
                <div className="text-sm">
                  <p className="font-medium text-blue-900">获取验证码</p>
                  <p className="text-blue-700">Google 会向您的手机发送验证码</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">手机号码</label>
                <input
                  type="tel"
                  placeholder="+60 123456789"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded"
              >
                返回
              </button>
              <button
                onClick={handleNext}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                发送验证码
              </button>
            </div>
          </div>
        )}

        {/* 验证码输入 */}
        {currentStep === 2.5 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-normal mb-2">输入验证码</h1>
              <p className="text-gray-600">验证码已发送至 {formData.phone}</p>
            </div>
            
            {mockCode && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">
                  🔔 测试模式验证码: <span className="font-mono font-bold">{mockCode}</span>
                </p>
              </div>
            )}
            
            <div>
              <input
                type="text"
                placeholder="输入6位验证码"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength="6"
                className={`w-full px-3 py-3 text-center text-2xl tracking-widest border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.code ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.code && (
                <p className="text-red-500 text-xs mt-1 text-center">{errors.code}</p>
              )}
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(2)}
                className="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded"
              >
                重新发送
              </button>
              <button
                onClick={handleVerifyPhone}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                验证
              </button>
            </div>
          </div>
        )}

        {/* 步骤3: 个人信息 */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-normal mb-2">添加一些详细信息</h1>
              <p className="text-gray-600">输入您的生日和性别</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">生日</label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.birthDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.birthDate && (
                  <p className="text-red-500 text-xs mt-1">{errors.birthDate}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  您的生日用于确定您的年龄
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">性别</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.gender ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">请选择</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">其他</option>
                  <option value="prefer_not_say">不愿透露</option>
                </select>
                {errors.gender && (
                  <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(2)}
                className="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded"
              >
                返回
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* 步骤4: 条款确认 */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-normal mb-2">隐私权和条款</h1>
              <p className="text-gray-600">创建账号即表示您同意 Google 的服务条款</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto text-sm text-gray-600">
              <h3 className="font-medium text-gray-900 mb-2">服务条款</h3>
              <p className="mb-4">
                欢迎使用 Google！这是一个模拟的注册流程，仅用于测试目的。
              </p>
              <h3 className="font-medium text-gray-900 mb-2">隐私政策</h3>
              <p className="mb-4">
                我们重视您的隐私。此测试页面不会收集或存储任何真实的个人信息。
              </p>
              <h3 className="font-medium text-gray-900 mb-2">数据使用</h3>
              <p>
                所有输入的数据仅存储在浏览器本地，不会上传到任何服务器。
              </p>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-start">
                <input type="checkbox" className="mt-1 mr-2" defaultChecked />
                <span className="text-sm text-gray-600">
                  我同意 Google 服务条款和隐私政策
                </span>
              </label>
              <label className="flex items-start">
                <input type="checkbox" className="mt-1 mr-2" />
                <span className="text-sm text-gray-600">
                  向我发送 Google 的新闻和优惠信息
                </span>
              </label>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(3)}
                className="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded"
              >
                返回
              </button>
              <button
                onClick={handleCreateAccount}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '创建中...' : '创建账号'}
              </button>
            </div>
          </div>
        )}

        {/* 步骤5: 完成 */}
        {currentStep === 5 && (
          <div className="space-y-6 text-center">
            <div className="text-6xl">🎉</div>
            <div>
              <h1 className="text-2xl font-normal mb-2">欢迎使用 Google</h1>
              <p className="text-gray-600">您的账号已创建成功</p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="text-green-800">
                <p className="font-medium mb-2">账号信息</p>
                <p className="text-sm">邮箱: {formData.email || formData.email + '@gmail.com'}</p>
                <p className="text-sm">姓名: {formData.firstName} {formData.lastName}</p>
                <p className="text-sm">手机: {formData.phone}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => router.push('/experimental-home')}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
              >
                进入应用
              </button>
              <button
                onClick={() => router.push('/experimental-login')}
                className="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded hover:bg-gray-50"
              >
                返回登录
              </button>
            </div>
            
            <p className="text-xs text-gray-500">
              这是一个测试页面，所有数据仅保存在本地
            </p>
          </div>
        )}

        {/* 调试信息 */}
        {process.env.NODE_ENV === 'development' && currentStep < 5 && (
          <div className="mt-8 p-4 bg-gray-100 rounded text-xs">
            <p className="font-bold mb-2">调试信息（仅开发环境）</p>
            <pre>{JSON.stringify(formData, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}