import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const handleAuthCallback = async () => {
      try {
        // 获取URL中的code和state参数
        const { code } = router.query

        if (code) {
          console.log('处理OAuth回调...')
          
          // Supabase会自动处理OAuth交换
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          
          if (error) {
            console.error('OAuth交换失败:', error)
            throw error
          }

          if (data.session) {
            console.log('OAuth成功，会话已建立:', data.session.user)
            
            // 保存用户信息到localStorage（兼容现有系统）
            localStorage.setItem('jwt_token', data.session.access_token)
            localStorage.setItem('user_info', JSON.stringify({
              id: data.session.user.id,
              email: data.session.user.email,
              name: data.session.user.user_metadata.name || data.session.user.user_metadata.full_name,
              picture: data.session.user.user_metadata.picture || data.session.user.user_metadata.avatar_url,
              provider: 'google'
            }))
            
            // 跳转到首页
            router.push('/')
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