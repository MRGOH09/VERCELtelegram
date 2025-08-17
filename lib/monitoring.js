// 性能监控和日志增强模块

export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map()
    this.startTimes = new Map()
  }

  startTimer(operation) {
    this.startTimes.set(operation, Date.now())
  }

  endTimer(operation) {
    const startTime = this.startTimes.get(operation)
    if (startTime) {
      const duration = Date.now() - startTime
      this.recordMetric(operation, 'duration', duration)
      this.startTimes.delete(operation)
      return duration
    }
    return 0
  }

  recordMetric(operation, metric, value) {
    const key = `${operation}_${metric}`
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    this.metrics.get(key).push({
      value,
      timestamp: Date.now()
    })
    
    // 保持最近100个记录
    if (this.metrics.get(key).length > 100) {
      this.metrics.get(key).shift()
    }
  }

  getMetrics(operation) {
    const result = {}
    for (const [key, values] of this.metrics) {
      if (key.startsWith(operation + '_')) {
        const metric = key.replace(operation + '_', '')
        const recent = values.slice(-10) // 最近10个
        result[metric] = {
          current: recent[recent.length - 1]?.value || 0,
          average: recent.reduce((sum, v) => sum + v.value, 0) / recent.length || 0,
          min: Math.min(...recent.map(v => v.value)) || 0,
          max: Math.max(...recent.map(v => v.value)) || 0,
          count: recent.length
        }
      }
    }
    return result
  }

  logMetrics(operation) {
    const metrics = this.getMetrics(operation)
    console.info(`[Performance] ${operation}:`, JSON.stringify(metrics, null, 2))
  }

  reset() {
    this.metrics.clear()
    this.startTimes.clear()
  }
}

export class ErrorTracker {
  constructor() {
    this.errors = []
    this.maxErrors = 100
  }

  trackError(operation, error, context = {}) {
    const errorInfo = {
      operation,
      error: error?.message || String(error),
      stack: error?.stack,
      context,
      timestamp: new Date().toISOString()
    }
    
    this.errors.push(errorInfo)
    
    // 保持最近100个错误
    if (this.errors.length > this.maxErrors) {
      this.errors.shift()
    }
    
    // 记录到控制台
    console.error(`[ErrorTracker] ${operation}:`, errorInfo)
    
    return errorInfo
  }

  getRecentErrors(operation = null, limit = 10) {
    let filtered = this.errors
    if (operation) {
      filtered = filtered.filter(e => e.operation === operation)
    }
    return filtered.slice(-limit)
  }

  getErrorStats() {
    const stats = {}
    for (const error of this.errors) {
      if (!stats[error.operation]) {
        stats[error.operation] = { count: 0, lastError: null }
      }
      stats[error.operation].count++
      if (!stats[error.operation].lastError || error.timestamp > stats[error.operation].lastError) {
        stats[error.operation].lastError = error.timestamp
      }
    }
    return stats
  }

  reset() {
    this.errors = []
  }
}

// 全局监控实例
export const performanceMonitor = new PerformanceMonitor()
export const errorTracker = new ErrorTracker()

// 便捷函数
export function trackOperation(operation, fn) {
  return async (...args) => {
    performanceMonitor.startTimer(operation)
    try {
      const result = await fn(...args)
      performanceMonitor.endTimer(operation)
      performanceMonitor.recordMetric(operation, 'success', 1)
      return result
    } catch (error) {
      performanceMonitor.endTimer(operation)
      performanceMonitor.recordMetric(operation, 'success', 0)
      errorTracker.trackError(operation, error, { args })
      throw error
    }
  }
}

export function logPerformance(operation) {
  performanceMonitor.logMetrics(operation)
}

export function logErrors(operation = null) {
  const errors = errorTracker.getRecentErrors(operation)
  const stats = errorTracker.getErrorStats()
  console.info(`[ErrorStats] ${operation || 'All'}:`, stats)
  console.info(`[RecentErrors] ${operation || 'All'}:`, errors)
} 