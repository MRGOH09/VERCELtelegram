import { performanceMonitor, errorTracker } from '../lib/monitoring.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      performance: {
        leaderboard: performanceMonitor.getMetrics('computeLeaderboards'),
        dailyReports: performanceMonitor.getMetrics('dailyReports'),
        breakStreaks: performanceMonitor.getMetrics('breakStreaksOneShot'),
        sendBatch: performanceMonitor.getMetrics('sendBatchMessages')
      },
      errors: errorTracker.getErrorStats(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV || 'development'
      }
    }

    // 检查关键指标
    const hasErrors = Object.values(health.errors).some(stat => stat.count > 0)
    const hasPerformanceIssues = Object.values(health.performance).some(metrics => 
      metrics.duration && metrics.duration.average > 5000 // 5秒以上平均耗时
    )

    if (hasErrors || hasPerformanceIssues) {
      health.status = 'degraded'
      health.warnings = []
      if (hasErrors) health.warnings.push('检测到错误')
      if (hasPerformanceIssues) health.warnings.push('检测到性能问题')
    }

    res.status(200).json(health)
  } catch (error) {
    console.error('Health check error:', error)
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

