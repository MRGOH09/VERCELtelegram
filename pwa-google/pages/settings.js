import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard from '../components/ModernCard'
import { SmoothTransition, PageSkeleton } from '../components/SmoothTransition'
import WebAppWrapper from '../components/WebAppWrapper'
import PWAClient from '../lib/api'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushStatus, setPushStatus] = useState('检查中...')
  const [testingPush, setTestingPush] = useState(false)
  
  // 个人资料相关状态
  const [userData, setUserData] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

  useEffect(() => {
    checkAuthAndInitialize()
  }, [])

  const checkAuthAndInitialize = async () => {
    try {
      const authResult = await PWAClient.checkAuth()
      if (!authResult.authenticated) {
        router.replace('/auth')
        return
      }
      
      await initializePushSettings()
      await loadUserProfile()
    } catch (error) {
      console.error('认证检查失败:', error)
      router.replace('/auth')
    }
  }

  const loadUserProfile = async () => {
    try {
      setLoadingProfile(true)
      
      const response = await fetch('/api/pwa/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'profile' })
      })

      if (response.ok) {
        const result = await response.json()
        setUserData(result)
        setProfileMessage('个人资料已加载')
      } else {
        throw new Error(`加载失败: ${response.status}`)
      }
    } catch (error) {
      console.error('加载个人资料失败:', error)
      setProfileMessage('个人资料加载失败')
    } finally {
      setLoadingProfile(false)
    }
  }

  const updateField = async (field, value, tableName = 'user_profile', fieldName = null) => {
    setProfileMessage(`正在更新 ${field}...`)
    
    try {
      // 映射字段名到数据库字段
      const fieldMapping = {
        '显示名称': 'display_name',
        '电话': 'phone_e164', 
        '邮箱': 'email',
        '月收入': 'monthly_income',
        'A类百分比': 'a_pct',
        '旅游预算': 'travel_budget_annual',
        '年度医疗保险': 'annual_medical_insurance',
        '年度车险': 'annual_car_insurance'
      }
      
      const dbField = fieldName || fieldMapping[field] || field
      
      // 调用更新API
      const response = await fetch('/api/pwa/test-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          action: 'update_field',
          tableName: tableName,
          fieldName: dbField,
          value: value
        })
      })

      const result = await response.json()
      
      if (response.ok && result.ok) {
        setProfileMessage(`✅ ${field} 已更新为: ${value}`)
        // 1秒后重新加载数据以显示更新结果
        setTimeout(loadUserProfile, 1000)
      } else {
        setProfileMessage(`❌ 更新失败: ${result.error || '未知错误'}`)
      }
    } catch (error) {
      setProfileMessage(`❌ 更新错误: ${error.message}`)
    }
  }

  const initializePushSettings = async () => {
    try {
      setLoading(true)
      
      // 检查浏览器推送支持
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushSupported(false)
        setPushStatus('浏览器不支持推送通知')
        setLoading(false)
        return
      }

      setPushSupported(true)

      // 检查当前推送状态
      const permission = Notification.permission
      console.log('当前推送权限:', permission)

      if (permission === 'denied') {
        setPushStatus('推送权限被拒绝，请在浏览器设置中允许')
        setPushEnabled(false)
      } else if (permission === 'granted') {
        // 检查是否有活跃订阅
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        
        if (subscription) {
          setPushEnabled(true)
          setPushStatus('推送通知已启用')
        } else {
          setPushEnabled(false)
          setPushStatus('需要订阅推送服务')
        }
      } else {
        setPushEnabled(false)
        setPushStatus('需要请求推送权限')
      }

    } catch (error) {
      console.error('推送设置初始化失败:', error)
      setPushStatus('推送设置检查失败')
    } finally {
      setLoading(false)
    }
  }

  const handlePushToggle = async () => {
    if (!pushSupported) {
      alert('您的浏览器不支持推送通知')
      return
    }

    try {
      if (pushEnabled) {
        // 关闭推送通知
        await disablePushNotifications()
      } else {
        // 开启推送通知
        await enablePushNotifications()
      }
    } catch (error) {
      console.error('推送切换失败:', error)
      alert(error.message || '操作失败，请重试')
    }
  }

  const enablePushNotifications = async () => {
    try {
      // 1. 请求权限
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('推送权限被拒绝')
      }

      // 2. 订阅推送服务
      const registration = await navigator.serviceWorker.ready
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY || 'BHn7QgZMASGfPzs_t1h604Z5ku_HlpZufjZZgDO1qiPopryzLII_GaInmuHqiNMhypVkz99dy2ES8tknl8n-ncE'
      })

      // 3. 发送订阅信息到服务器
      const response = await fetch('/api/pwa/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'subscribe-push',
          subscription: subscription,
          service: 'fcm',
          deviceInfo: {
            userAgent: navigator.userAgent,
            timestamp: Date.now()
          }
        })
      })

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '服务器订阅失败')
      }

      setPushEnabled(true)
      setPushStatus('推送通知已启用')
      console.log('✅ 推送通知启用成功')

    } catch (error) {
      console.error('启用推送通知失败:', error)
      setPushEnabled(false)
      setPushStatus('推送通知启用失败')
      throw error
    }
  }

  const disablePushNotifications = async () => {
    try {
      // 1. 取消浏览器订阅
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
      }

      // 2. 通知服务器取消订阅
      const response = await fetch('/api/pwa/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'unsubscribe-push'
        })
      })

      const result = await response.json()
      
      if (!result.success) {
        console.warn('服务器取消订阅失败:', result.error)
        // 即使服务器失败，也继续更新本地状态
      }

      setPushEnabled(false)
      setPushStatus('推送通知已关闭')
      console.log('✅ 推送通知关闭成功')

    } catch (error) {
      console.error('关闭推送通知失败:', error)
      setPushStatus('推送通知关闭失败')
      throw error
    }
  }

  const sendTestNotification = async () => {
    if (!pushEnabled) {
      alert('请先启用推送通知')
      return
    }

    try {
      setTestingPush(true)

      const response = await fetch('/api/pwa/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'test-push-notification'
        })
      })

      const result = await response.json()
      
      if (result.success) {
        alert('测试推送发送成功！请查看通知。')
      } else {
        throw new Error(result.message || '测试推送发送失败')
      }

    } catch (error) {
      console.error('测试推送失败:', error)
      alert(error.message || '测试推送发送失败')
    } finally {
      setTestingPush(false)
    }
  }

  if (loading) {
    return (
      <Layout title="设置 - Learner Club">
        <PageSkeleton type="settings" />
      </Layout>
    )
  }

  return (
    <WebAppWrapper>
      <Layout title="设置 - Learner Club">
        <SmoothTransition>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            
            {/* 头部 */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => router.back()}
                  className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <span className="text-xl">←</span>
                </button>
                <div>
                  <h1 className="text-2xl font-bold">⚙️ 设置</h1>
                  <p className="text-blue-100 text-sm">个性化你的应用体验</p>
                </div>
              </div>
            </div>

            <div className="px-4 pb-8 space-y-6">
              
              {/* 推送通知设置 */}
              <div className="-mt-16 relative z-10">
                <ModernCard className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">🔔</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">推送通知</h3>
                        <p className="text-sm text-gray-600">接收理财提醒和排名更新</p>
                      </div>
                    </div>
                    
                    {pushSupported && (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pushEnabled}
                          onChange={handlePushToggle}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    )}
                  </div>
                  
                  <div className={`p-3 rounded-lg text-sm ${
                    pushEnabled ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-600'
                  }`}>
                    <p className="flex items-center">
                      <span className="mr-2">
                        {pushEnabled ? '✅' : pushSupported ? '⚪' : '❌'}
                      </span>
                      {pushStatus}
                    </p>
                  </div>

                  {pushEnabled && (
                    <div className="mt-4">
                      <button
                        onClick={sendTestNotification}
                        disabled={testingPush}
                        className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {testingPush ? '发送中...' : '🧪 发送测试通知'}
                      </button>
                    </div>
                  )}

                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">推送通知包含：</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• 🌅 晨间理财报告（8:00 AM）</li>
                      <li>• ⏰ 记账提醒（6:00 PM）</li>
                      <li>• 🏆 排名变化通知</li>
                      <li>• 📊 月度报告摘要</li>
                    </ul>
                  </div>
                </ModernCard>
              </div>

              {/* 个人资料设置 */}
              <ModernCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">👤</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">个人资料</h3>
                      <p className="text-sm text-gray-600">管理你的个人信息和财务设置</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={loadUserProfile}
                    disabled={loadingProfile}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {loadingProfile ? '加载中...' : '刷新'}
                  </button>
                </div>
                
                {profileMessage && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                    {profileMessage}
                  </div>
                )}

                {userData && (
                  <div className="space-y-4">
                    
                    {/* 基本信息 */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-900 mb-3">基本信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">显示名称</label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              id="display_name"
                              className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500"
                              defaultValue={userData.profile?.display_name || ''}
                            />
                            <button
                              onClick={() => {
                                const value = document.getElementById('display_name').value
                                updateField('显示名称', value)
                              }}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">电话</label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              id="phone_e164"
                              className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500"
                              defaultValue={userData.profile?.phone || ''}
                            />
                            <button
                              onClick={() => {
                                const value = document.getElementById('phone_e164').value
                                updateField('电话', value)
                              }}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1">邮箱</label>
                        <div className="flex gap-2">
                          <input 
                            type="email"
                            id="email"
                            className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500"
                            defaultValue={userData.profile?.email || ''}
                          />
                          <button
                            onClick={() => {
                              const value = document.getElementById('email').value
                              updateField('邮箱', value)
                            }}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 财务设置 */}
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-900 mb-3">财务设置</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">月收入 (RM)</label>
                          <div className="flex gap-2">
                            <input 
                              type="number"
                              id="monthly_income"
                              className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500"
                              defaultValue={userData.profile?.income || 0}
                            />
                            <button
                              onClick={() => {
                                const value = document.getElementById('monthly_income').value
                                updateField('月收入', parseFloat(value) || 0)
                              }}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">A类支出百分比 (%)</label>
                          <div className="flex gap-2">
                            <input 
                              type="number"
                              id="a_pct"
                              min="0" max="100"
                              className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500"
                              defaultValue={userData.profile?.a_pct || 0}
                            />
                            <button
                              onClick={() => {
                                const value = document.getElementById('a_pct').value
                                updateField('A类百分比', parseInt(value) || 0)
                              }}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">年度旅游预算 (RM)</label>
                          <div className="flex gap-2">
                            <input 
                              type="number"
                              id="travel_budget_annual"
                              className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500"
                              defaultValue={userData.profile?.travel_budget || 0}
                            />
                            <button
                              onClick={() => {
                                const value = document.getElementById('travel_budget_annual').value
                                updateField('旅游预算', parseFloat(value) || 0)
                              }}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs"
                            >
                              保存
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            月度分摊: RM {((userData.profile?.travel_budget || 0) / 12).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 保险设置 */}
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-orange-900 mb-3">保险设置</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">年度医疗保险 (RM)</label>
                          <div className="flex gap-2">
                            <input 
                              type="number"
                              id="annual_medical_insurance"
                              className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500"
                              defaultValue={userData.profile?.annual_medical_insurance || 0}
                            />
                            <button
                              onClick={() => {
                                const value = document.getElementById('annual_medical_insurance').value
                                updateField('年度医疗保险', parseFloat(value) || 0)
                              }}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs"
                            >
                              保存
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            月度分摊: RM {((userData.profile?.annual_medical_insurance || 0) / 12).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">年度车险 (RM)</label>
                          <div className="flex gap-2">
                            <input 
                              type="number"
                              id="annual_car_insurance"
                              className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500"
                              defaultValue={userData.profile?.annual_car_insurance || 0}
                            />
                            <button
                              onClick={() => {
                                const value = document.getElementById('annual_car_insurance').value
                                updateField('年度车险', parseFloat(value) || 0)
                              }}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs"
                            >
                              保存
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            月度分摊: RM {((userData.profile?.annual_car_insurance || 0) / 12).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 自动计算说明 */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-800 mb-2">💡 自动计算说明</h4>
                      <div className="text-sm text-blue-700 space-y-1">
                        <p><strong>EPF (固定24%)</strong>: RM {((userData.profile?.income || 0) * 0.24).toFixed(2)}/月</p>
                        <p><strong>旅游基金</strong>: RM {((userData.profile?.travel_budget || 0) / 12).toFixed(2)}/月</p>
                        <p><strong>医疗保险</strong>: RM {((userData.profile?.annual_medical_insurance || 0) / 12).toFixed(2)}/月</p>
                        <p><strong>车险</strong>: RM {((userData.profile?.annual_car_insurance || 0) / 12).toFixed(2)}/月</p>
                        <p className="text-xs mt-2">这些金额会自动分摊到每月的相应分类中</p>
                      </div>
                    </div>

                  </div>
                )}
              </ModernCard>

              {/* 应用信息 */}
              <ModernCard className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">应用信息</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">📱</span>
                      <span className="text-gray-700">应用版本</span>
                    </div>
                    <span className="font-medium text-gray-900">PWA v1.0.0</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">🌐</span>
                      <span className="text-gray-700">浏览器</span>
                    </div>
                    <span className="font-medium text-gray-900 text-sm">
                      {typeof navigator !== 'undefined' ? navigator.userAgent.split(' ')[0] : 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">📶</span>
                      <span className="text-gray-700">Service Worker</span>
                    </div>
                    <span className={`font-medium ${
                      'serviceWorker' in navigator ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {'serviceWorker' in navigator ? '已支持' : '不支持'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">💾</span>
                      <span className="text-gray-700">离线缓存</span>
                    </div>
                    <span className="font-medium text-green-600">已启用</span>
                  </div>
                </div>
              </ModernCard>

              {/* 数据和隐私 */}
              <ModernCard className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">数据和隐私</h3>
                
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      if (confirm('这将清除应用的本地缓存，但不会删除服务器数据。确定继续吗？')) {
                        if ('caches' in window) {
                          caches.keys().then(names => {
                            names.forEach(name => caches.delete(name))
                          })
                        }
                        localStorage.clear()
                        sessionStorage.clear()
                        alert('缓存清理完成！')
                        window.location.reload()
                      }
                    }}
                    className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                  >
                    <span className="text-xl mr-3">🧹</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">清理应用缓存</p>
                      <p className="text-sm text-gray-500">清除本地存储的数据缓存</p>
                    </div>
                    <span className="text-gray-400">›</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      alert('隐私政策：我们只收集必要的财务记录数据，不会与第三方分享您的个人信息。所有数据都经过加密保护。')
                    }}
                    className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                  >
                    <span className="text-xl mr-3">🔒</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">隐私政策</p>
                      <p className="text-sm text-gray-500">了解我们如何保护您的数据</p>
                    </div>
                    <span className="text-gray-400">›</span>
                  </button>
                </div>
              </ModernCard>

              {/* 帮助和反馈 */}
              <ModernCard className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">帮助和反馈</h3>
                
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'learner_club_bot'
                      if (confirm('需要帮助？我们将跳转到Telegram Bot')) {
                        window.open(`https://t.me/${botUsername}`, '_blank')
                      }
                    }}
                    className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                  >
                    <span className="text-xl mr-3">💬</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">联系客服</p>
                      <p className="text-sm text-gray-500">通过Telegram Bot获取帮助</p>
                    </div>
                    <span className="text-gray-400">›</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      alert('使用帮助：\n\n1. 使用Telegram Bot记录收支\n2. 查看PWA应用获取分析报告\n3. 开启推送通知获取提醒\n4. 坚持记账养成理财习惯\n\n有问题请联系客服！')
                    }}
                    className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                  >
                    <span className="text-xl mr-3">❓</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">使用帮助</p>
                      <p className="text-sm text-gray-500">了解如何使用应用功能</p>
                    </div>
                    <span className="text-gray-400">›</span>
                  </button>
                </div>
              </ModernCard>

            </div>
          </div>
        </SmoothTransition>
      </Layout>
    </WebAppWrapper>
  )
}