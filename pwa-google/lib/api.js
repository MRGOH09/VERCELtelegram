import { smartCache } from './cache.js'
import { useState } from 'react'

// PWA API客户端 - 带智能缓存
class PWAClient {
  getBaseURL() {
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:3001'
    }
    return typeof window !== 'undefined' ? window.location.origin : ''
  }
  
  async call(endpoint, action, params = {}, options = {}) {
    const { useCache = true, cacheTTL, forceRefresh = false } = options
    
    // 检查缓存（除非强制刷新）
    if (useCache && !forceRefresh) {
      const cachedData = smartCache.get(endpoint, action, params, cacheTTL)
      if (cachedData) {
        return cachedData
      }
    }
    
    try {
      // 从localStorage获取JWT token
      const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null
      
      const headers = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${this.getBaseURL()}/api/pwa/${endpoint}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ action, ...params })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // 401错误处理 - 除非明确禁用跳转
        if (response.status === 401 && typeof window !== 'undefined' && !options.skipRedirect) {
          // 避免在认证页重复跳转
          if (!window.location.pathname.includes('/auth') && !window.location.pathname.includes('/login')) {
            console.log('用户未认证，跳转到统一认证页')
            window.location.href = '/auth'
            return
          }
        }
        
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      // 缓存成功响应
      if (useCache && data) {
        smartCache.set(endpoint, action, params, data)
      }
      
      return data
    } catch (error) {
      console.error(`API call failed: ${endpoint}/${action}`, error)
      throw error
    }
  }

  // 带缓存的快速调用
  async cachedCall(endpoint, action, params = {}, cacheTTL = 60000) {
    return this.call(endpoint, action, params, { 
      useCache: true, 
      cacheTTL 
    })
  }

  // 强制刷新调用
  async freshCall(endpoint, action, params = {}) {
    return this.call(endpoint, action, params, { 
      forceRefresh: true 
    })
  }
  
  // 获取仪表板数据 (5分钟缓存)
  async getDashboard() {
    return this.cachedCall('data', 'dashboard', {}, 5 * 60 * 1000)
  }

  // 获取最新仪表板数据 (强制刷新)
  async getFreshDashboard() {
    return this.freshCall('data', 'dashboard')
  }
  
  // 获取个人资料 (10分钟缓存)
  async getProfile() {
    return this.cachedCall('data', 'profile', {}, 10 * 60 * 1000)
  }

  // 获取最近记录 (2分钟缓存)
  async getRecentRecords() {
    return this.cachedCall('data', 'history', { limit: 10, offset: 0 }, 2 * 60 * 1000)
  }
  
  // 检查认证状态 (30秒缓存)
  async checkAuth() {
    try {
      // 直接调用auth-check端点（GET请求）
      const response = await fetch(`${this.getBaseURL()}/api/pwa/auth-check`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        return { authenticated: false }
      }
      
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Auth check failed:', error)
      return { authenticated: false }
    }
  }

  // 获取历史记录 (1分钟缓存)
  async getHistory(params = {}) {
    return this.cachedCall('data', 'history', params, 1 * 60 * 1000)
  }

  // 添加记录
  async addRecord(recordData) {
    return this.call('data', 'add-record', recordData, { useCache: false })
  }

  // 删除记录 - Safari强化版
  async deleteRecord(recordId) {
    // 强制无缓存请求，绕过所有缓存层
    const isSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                     /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
                     window.matchMedia('(display-mode: standalone)').matches
    
    if (isSafari) {
      // Safari专用：直接发送fetch请求绕过所有缓存
      const response = await fetch(`${this.getBaseURL()}/api/pwa/data`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        credentials: 'include',
        cache: 'no-store', // 关键：强制不使用缓存
        body: JSON.stringify({ action: 'delete-record', recordId })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      
      return data
    }
    
    return this.call('data', 'delete-record', { recordId }, { useCache: false })
  }


  // 修改记录 - Safari强化版
  async updateRecord(recordId, recordData) {
    // 强制无缓存请求，绕过所有缓存层
    const isSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                     /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
                     window.matchMedia('(display-mode: standalone)').matches
    
    if (isSafari) {
      // Safari专用：直接发送fetch请求绕过所有缓存
      const response = await fetch(`${this.getBaseURL()}/api/pwa/data`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        credentials: 'include',
        cache: 'no-store', // 关键：强制不使用缓存
        body: JSON.stringify({ action: 'update-record', recordId, ...recordData })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      
      return data
    }
    
    return this.call('data', 'update-record', { recordId, ...recordData }, { useCache: false })
  }
}

export default new PWAClient()

// React Hook for API calls
export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const call = async (apiCall) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await apiCall()
      setLoading(false)
      return result
    } catch (err) {
      setError(err.message)
      setLoading(false)
      throw err
    }
  }
  
  return { call, loading, error }
}

// 工具函数
export function formatCurrency(amount) {
  return `RM ${Math.abs(amount).toLocaleString('en-MY', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`
}

export function formatDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now - date)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 1) return '今天'
  if (diffDays === 2) return '昨天'
  if (diffDays <= 7) return `${diffDays}天前`
  
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

export function formatDateTime(dateString) {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 分类映射
// 分类定义 - 与Telegram /my命令和数据库保持一致
export const CATEGORIES = {
  A: {
    food: { name: '餐饮', icon: '🍽️' },
    ent: { name: '娱乐', icon: '🎬' },
    shop: { name: '购物', icon: '🛍️' },
    transport: { name: '交通', icon: '🚗' },
    utilities: { name: '水电', icon: '💡' },
    mobile: { name: '手机', icon: '📱' },
    home: { name: '家用', icon: '🏠' },
    other: { name: '其他', icon: '📦' }
  },
  B: {
    books: { name: '书籍', icon: '📖' },
    course: { name: '课程', icon: '📚' },
    training: { name: '培训', icon: '🎓' },
    cert: { name: '认证', icon: '🏆' }
  },
  C: {
    stock: { name: '股票', icon: '📈' },
    fixed: { name: '定存', icon: '🏦' },
    insurance: { name: '保险', icon: '🛡️' },
    emerg: { name: '紧急基金', icon: '🚨' }
  }
}

export function getCategoryInfo(categoryCode, categoryGroup) {
  return CATEGORIES[categoryGroup]?.[categoryCode] || { 
    name: categoryCode, 
    icon: '📝' 
  }
}