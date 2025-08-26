// PWA API客户端
class PWAClient {
  getBaseURL() {
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:3001'
    }
    return typeof window !== 'undefined' ? window.location.origin : ''
  }
  
  async call(endpoint, action, params = {}) {
    try {
      const response = await fetch(`${this.getBaseURL()}/api/pwa/${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ action, ...params })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // 401错误跳转到登录页
        if (response.status === 401 && typeof window !== 'undefined') {
          console.log('用户未认证，跳转到登录页')
          window.location.href = '/login'
          return
        }
        
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      return data
    } catch (error) {
      console.error(`API call failed: ${endpoint}/${action}`, error)
      throw error
    }
  }
  
  // 获取仪表板数据
  async getDashboard() {
    return this.call('data', 'dashboard')
  }
  
  // 获取个人资料
  async getProfile() {
    return this.call('data', 'profile')
  }
  
  // 检查认证状态
  async checkAuth() {
    try {
      return await this.call('data', 'check-auth')
    } catch (error) {
      return { authenticated: false }
    }
  }
}

export default new PWAClient()

// React Hook for API calls
export function useApi() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)
  
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
export const CATEGORIES = {
  A: {
    food: { name: '餐饮', icon: '🍽️' },
    transport: { name: '交通', icon: '🚗' },
    shopping: { name: '购物', icon: '🛍️' },
    entertainment: { name: '娱乐', icon: '🎬' },
    daily: { name: '日用品', icon: '🏠' },
    health: { name: '医疗', icon: '🏥' },
    other_a: { name: '其他', icon: '📝' }
  },
  B: {
    education: { name: '教育', icon: '📚' },
    investment: { name: '投资', icon: '📈' },
    course: { name: '课程', icon: '💻' },
    books: { name: '图书', icon: '📖' },
    skill: { name: '技能', icon: '🎯' },
    other_b: { name: '其他', icon: '📝' }
  },
  C: {
    savings: { name: '储蓄', icon: '💰' },
    insurance: { name: '保险', icon: '🛡️' },
    emergency: { name: '应急基金', icon: '🆘' },
    retirement: { name: '养老', icon: '🏖️' },
    other_c: { name: '其他', icon: '📝' }
  }
}

export function getCategoryInfo(categoryCode, categoryGroup) {
  return CATEGORIES[categoryGroup]?.[categoryCode] || { 
    name: categoryCode, 
    icon: '📝' 
  }
}