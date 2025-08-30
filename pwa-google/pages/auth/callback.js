import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // 确保使用ANON_KEY，不是SERVICE_KEY
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const handleAuthCallback = async () => {
      try {
        console.log('=== [CALLBACK] 开始处理 ===')
        console.log('[CALLBACK] 当前URL:', window.location.href)
        console.log('[CALLBACK] Router query:', router.query)
        console.log('[CALLBACK] Router isReady:', router.isReady)
        
        // 检查URL hash中的token（Implicit Flow）
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const errorInHash = hashParams.get('error')
        
        // 获取URL query中的code参数（Authorization Code Flow）
        const { code, state, error: oauthError } = router.query

        console.log('[CALLBACK] 检查参数:', {
          hasAccessToken: !!accessToken,
          hasCode: !!code,
          hasError: !!oauthError || !!errorInHash
        })

        if (oauthError || errorInHash) {
          console.error('[CALLBACK] OAuth返回错误:', oauthError || errorInHash)
          throw new Error(`OAuth错误: ${oauthError || errorInHash}`)
        }

        // 处理Implicit Flow（token在hash中）
        if (accessToken && refreshToken) {
          console.log('[CALLBACK] 检测到Implicit Flow token')
          console.log('[CALLBACK] Access Token:', accessToken.substring(0, 20) + '...')
          console.log('[CALLBACK] Refresh Token:', refreshToken.substring(0, 20) + '...')
          
          // 不在这里处理会话，直接带着hash跳转到目标页面
          // 让目标页面的Supabase客户端自动处理hash中的token
          
          const urlParams = new URLSearchParams(window.location.search)
          const mode = urlParams.get('mode') || 'login'
          const next = urlParams.get('next')
          
          console.log('[CALLBACK] 跳转参数:', { mode, next })
          console.log('[CALLBACK] 直接跳转，让目标页面处理token...')
          
          // 保留hash中的token信息进行跳转
          const hashString = window.location.hash
          
          if (mode === 'test' && next) {
            console.log('[CALLBACK] 测试模式，带hash跳转到:', next + hashString)
            // 使用window.location直接跳转，保留hash
            window.location.href = next + hashString
          } else {
            console.log('[CALLBACK] 正常模式，带hash跳转到:', `/auth?mode=${mode}` + hashString)
            // 使用window.location直接跳转，保留hash
            window.location.href = `/auth?mode=${mode}` + hashString
          }
          
          return
        }
        
        // 处理Authorization Code Flow（code在query中）
        if (code) {
          console.log('[CALLBACK] 处理OAuth回调，code:', code.substring(0, 20) + '...')
          console.log('[CALLBACK] State参数:', state)
          
          // Supabase会自动处理OAuth交换
          console.log('[CALLBACK] 开始交换code为session...')
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          
          if (error) {
            console.error('[CALLBACK] OAuth交换失败:', error)
            console.error('[CALLBACK] 错误详情:', JSON.stringify(error, null, 2))
            throw error
          }

          console.log('[CALLBACK] exchangeCodeForSession返回:', { 
            hasSession: !!data.session,
            hasUser: !!data.user,
            sessionId: data.session?.access_token?.substring(0, 20) + '...' 
          })

          if (data.session) {
            console.log('[CALLBACK] ✅ OAuth成功，会话已建立!')
            console.log('[CALLBACK] 用户信息:', {
              id: data.session.user.id,
              email: data.session.user.email,
              name: data.session.user.user_metadata?.name || data.session.user.user_metadata?.full_name
            })
            
            // 验证会话是否真的保存了
            const { data: { session: savedSession } } = await supabase.auth.getSession()
            console.log('[CALLBACK] 验证保存的会话:', !!savedSession)
            
            // Supabase会话已自动保存，不需要手动处理localStorage
            
            // 根据mode参数决定跳转目标
            const urlParams = new URLSearchParams(window.location.search)
            const mode = urlParams.get('mode') || 'login'
            const next = urlParams.get('next')
            
            console.log('[CALLBACK] 跳转参数:', { mode, next })
            
            if (mode === 'test' && next) {
              // 测试模式，跳转回测试页面
              console.log('[CALLBACK] 测试模式，跳转到:', next)
              router.push(next)
            } else {
              // 正常模式，跳转回认证页面
              console.log('[CALLBACK] 正常模式，跳转到:', `/auth?mode=${mode}`)
              router.push(`/auth?mode=${mode}`)
            }
          }
        } else {
          // 没有code参数，可能是直接访问
          console.log('没有找到OAuth code参数')
          router.push('/auth')
        }
      } catch (error) {
        console.error('Auth回调处理失败:', error)
        
        // 跳转到登录页面并显示错误
        router.push('/auth?error=' + encodeURIComponent(error.message))
      }
    }

    // 只有在router准备好时才处理回调
    if (router.isReady) {
      handleAuthCallback()
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          正在处理登录...
        </h2>
        <p className="text-gray-600">
          请稍候，我们正在完成您的Google登录
        </p>
      </div>
    </div>
  )
}