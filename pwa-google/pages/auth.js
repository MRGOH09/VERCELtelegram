import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import ModernCard from '../components/ModernCard'
import WebAppWrapper from '../components/WebAppWrapper'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // 'login' or 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(true)
  
  // Supabase客户端
  const [supabase] = useState(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ))
  
  // 表单数据（用于注册后的额外信息）
  const [formData, setFormData] = useState({
    displayName: '',
    branchCode: '',
    monthlyIncome: '',
    expensePercentage: ''
  })
  
  // 分行选项
  const BRANCH_OPTIONS = [
    'PJY', 'BLS', 'OTK', 'PU', 'UKT', 'TLK', 
    'M2', 'BP', 'MTK', 'HQ', 'VIVA', 'STL', 
    'SRD', 'PDMR', 'KK', '小天使'
  ]
  
  useEffect(() => {
    checkAuthStatus()
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session)
      
      if (event === 'SIGNED_IN' && session) {
        console.log('用户登录成功:', session.user)
        
        // 保存基本信息到localStorage
        localStorage.setItem('jwt_token', session.access_token)
        localStorage.setItem('user_info', JSON.stringify({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata.name || session.user.user_metadata.full_name,
          picture: session.user.user_metadata.picture || session.user.user_metadata.avatar_url,
          provider: 'google'
        }))
        
        // 如果是注册模式，需要完成额外信息
        if (mode === 'register') {
          // 切换到完成注册步骤
          setMode('complete-registration')
        } else {
          // 登录模式 - 检查用户是否已在系统中存在
          console.log('登录模式：开始检查用户是否存在')
          checkUserExists(session.user.email)
        }
      }
    })

    return () => subscription?.unsubscribe()
  }, [supabase, router, mode])
  
  const checkAuthStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        console.log('用户已登录:', session.user)
        router.replace('/')
        return
      }
    } catch (error) {
      console.log('Not authenticated:', error)
    } finally {
      setChecking(false)
    }
  }
  
  // 检查用户是否已在系统中存在
  const checkUserExists = async (email) => {
    try {
      console.log(`检查用户是否存在: ${email}`)
      
      // 调用API检查用户是否存在
      const response = await fetch('/api/pwa/auth-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })
      
      if (!response.ok) {
        throw new Error('检查用户状态失败')
      }
      
      const result = await response.json()
      console.log('API返回结果:', result)
      
      if (result.userExists) {
        console.log('用户已存在，允许登录')
        // 用户存在，跳转到首页
        router.push('/')
      } else {
        console.log('用户不存在，提示需要注册')
        // 用户不存在，先登出，然后提示注册
        await supabase.auth.signOut()
        localStorage.removeItem('jwt_token')
        localStorage.removeItem('user_info')
        
        // 显示错误信息并切换到注册模式
        console.log('设置错误信息并切换到注册模式')
        setError('此Google账号尚未注册，请先完成注册流程')
        setMode('register')
        setLoading(false)
      }
    } catch (error) {
      console.error('检查用户存在失败:', error)
      setError('登录检查失败，请重试')
      setLoading(false)
    }
  }
  
  // Google OAuth处理
  const handleGoogleAuth = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log(`启动Google OAuth ${mode === 'register' ? '注册' : '登录'}...`)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: mode === 'register' ? 'consent' : 'select_account',
          }
        }
      })
      
      if (error) throw error
      
      console.log('重定向到Google OAuth...')
      
    } catch (error) {
      console.error('Google认证错误:', error)
      setError(error.message || 'Google认证失败')
      setLoading(false)
    }
  }
  
  // 完成注册（添加额外信息）
  const handleCompleteRegistration = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // 验证表单
      if (!formData.displayName || !formData.branchCode || 
          !formData.monthlyIncome || !formData.expensePercentage) {
        throw new Error('请填写所有必填字段')
      }
      
      // 获取当前用户和会话
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!user || !session) throw new Error('用户未登录')
      
      // 调用API保存额外信息
      const response = await fetch('/api/pwa/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          ...formData
        })
      })
      
      if (!response.ok) {
        throw new Error('注册信息保存失败')
      }
      
      console.log('注册完成，跳转到首页')
      router.push('/')
      
    } catch (error) {
      console.error('完成注册失败:', error)
      setError(error.message)
      setLoading(false)
    }
  }
  
  // 加载中状态
  if (checking) {
    return (
      <WebAppWrapper>
        <Layout title="Learner Club">
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">正在检查登录状态...</p>
            </div>
          </div>
        </Layout>
      </WebAppWrapper>
    )
  }
  
  // 完成注册步骤
  if (mode === 'complete-registration') {
    return (
      <WebAppWrapper>
        <Layout title="完成注册 - Learner Club">
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-md mx-auto pt-8">
              <ModernCard>
                <h2 className="text-xl font-bold text-center mb-6">完成注册信息</h2>
                
                <div className="space-y-4">
                  {/* 昵称 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      昵称
                    </label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="输入您的昵称"
                    />
                  </div>
                  
                  {/* 分行选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      所属分行
                    </label>
                    <select
                      value={formData.branchCode}
                      onChange={(e) => setFormData({...formData, branchCode: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">选择分行</option>
                      {BRANCH_OPTIONS.map(branch => (
                        <option key={branch} value={branch}>{branch}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* 月收入 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      月收入 (RM)
                    </label>
                    <input
                      type="number"
                      value={formData.monthlyIncome}
                      onChange={(e) => setFormData({...formData, monthlyIncome: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="例如: 5000"
                    />
                  </div>
                  
                  {/* 开销占比 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      生活开销占比 (%)
                    </label>
                    <input
                      type="number"
                      value={formData.expensePercentage}
                      onChange={(e) => setFormData({...formData, expensePercentage: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="例如: 60"
                      min="0"
                      max="100"
                    />
                  </div>
                  
                  {/* 错误提示 */}
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}
                  
                  {/* 提交按钮 */}
                  <button
                    onClick={handleCompleteRegistration}
                    disabled={loading}
                    className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {loading ? '保存中...' : '完成注册'}
                  </button>
                </div>
              </ModernCard>
            </div>
          </div>
        </Layout>
      </WebAppWrapper>
    )
  }
  
  // 主认证页面（登录/注册）
  return (
    <WebAppWrapper>
      <Layout title={`${mode === 'register' ? '注册' : '登录'} - Learner Club`}>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Logo和标题 */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">📊</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Learner Club
              </h1>
              <p className="text-gray-600">
                智能财务管理助手
              </p>
            </div>
            
            {/* 模式切换标签 */}
            <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                  mode === 'login' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                登录
              </button>
              <button
                onClick={() => setMode('register')}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                  mode === 'register' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                注册
              </button>
            </div>
            
            {/* 认证卡片 */}
            <ModernCard>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {mode === 'register' ? '创建新账号' : '欢迎回来'}
                </h2>
                
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-6">
                    {mode === 'register' 
                      ? '使用Google账号快速注册' 
                      : '使用Google账号登录'}
                  </p>
                  
                  {/* Google认证按钮 */}
                  <button
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg text-base font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="w-5 h-5 mr-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    )}
                    {loading 
                      ? '处理中...' 
                      : mode === 'register' ? '使用Google注册' : '使用Google登录'}
                  </button>
                  
                  {/* 错误提示 */}
                  {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{error}</p>
                      {error.includes('尚未注册') && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-xs text-blue-700">
                            💡 请切换到"注册"模式，使用相同的Google账号完成注册流程
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-gray-500">
                  {mode === 'register' ? (
                    <>
                      <p className="mb-1">新用户注册后需要填写额外信息</p>
                      <p>已有账号？<button 
                        onClick={() => {setMode('login'); setError(null)}}
                        className="text-blue-600 hover:underline"
                      >立即登录</button></p>
                    </>
                  ) : (
                    <>
                      <p className="mb-1">请确认您的Google账号已经注册过</p>
                      <p>首次使用？<button 
                        onClick={() => {setMode('register'); setError(null)}}
                        className="text-blue-600 hover:underline"
                      >立即注册</button></p>
                    </>
                  )}
                </div>
              </div>
            </ModernCard>
            
            {/* 功能介绍 */}
            <div className="mt-8 space-y-3">
              <div className="flex items-center text-sm text-gray-600">
                <span className="text-lg mr-3">📊</span>
                <span>智能财务数据分析</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <span className="text-lg mr-3">🏆</span>
                <span>分院排行榜系统</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <span className="text-lg mr-3">📱</span>
                <span>PWA离线支持</span>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </WebAppWrapper>
  )
}