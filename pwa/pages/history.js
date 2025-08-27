import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard from '../components/ModernCard'
import { SmoothTransition, PageSkeleton } from '../components/SmoothTransition'
import WebAppWrapper from '../components/WebAppWrapper'
import BrandHeader, { PageHeader } from '../components/BrandHeader'
import PWAClient, { formatCurrency, formatDate, getCategoryInfo } from '../lib/api'
import { formatDisplayDate } from '../../lib/date-utils'

// 分类说明函数
function getCategoryDescription(group) {
  const descriptions = {
    'A': '开销 - 生活必需支出',
    'B': '学习 - 投资未来成长', 
    'C': '储蓄 - 财富积累保障'
  }
  return descriptions[group] || `${group}类`
}

export default function HistoryPage() {
  const router = useRouter()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [stats, setStats] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    // 默认选择当前月份
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    setSelectedMonth(currentMonth)
    loadHistory(currentMonth)
  }, [])

  const loadHistory = async (month = selectedMonth, offset = 0, append = false) => {
    try {
      if (!append) setLoading(true)
      else setLoadingMore(true)

      const result = await PWAClient.getHistory({ 
        month, 
        limit: 20, 
        offset 
      })
      
      // 防御性检查 - 确保返回数据格式正确
      if (!result || typeof result !== 'object') {
        throw new Error('API返回数据格式错误')
      }
      
      console.log('[History] API返回数据:', result.debug || 'no debug info')
      
      const safeRecords = Array.isArray(result.records) ? result.records : []
      
      if (append) {
        setRecords(prev => [...prev, ...safeRecords])
      } else {
        setRecords(safeRecords)
        setStats(result.stats || {})
      }
      
      setHasMore(safeRecords.length === 20) // 如果返回20条记录，可能还有更多
      setError('')

    } catch (error) {
      console.error('History load error:', error)
      
      if (error.message.includes('Unauthorized')) {
        router.replace('/login')
        return
      }
      
      setError(error.message || '加载失败')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMore = () => {
    if (!hasMore || loadingMore) return
    loadHistory(selectedMonth, records.length, true)
  }

  const handleMonthChange = (newMonth) => {
    setSelectedMonth(newMonth)
    setRecords([])
    loadHistory(newMonth, 0, false)
  }

  const handleDeleteRecord = async (recordId) => {
    if (!confirm('确定要删除这条记录吗？')) return

    try {
      await PWAClient.deleteRecord(recordId)
      
      // 从本地状态中移除记录
      setRecords(prev => prev.filter(record => record.id !== recordId))
      
      // 重新加载统计数据
      loadHistory(selectedMonth, 0, false)
      
    } catch (error) {
      console.error('删除记录失败:', error)
      alert(error.message || '删除失败，请重试')
    }
  }

  if (loading && !records.length) {
    return (
      <Layout title="历史记录 - Learner Club">
        <PageSkeleton type="history" />
      </Layout>
    )
  }

  return (
    <WebAppWrapper>
      <Layout title="历史记录 - Learner Club">
        <BrandHeader />
        
        <SmoothTransition>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            
            <PageHeader
              title={
                <>
                  <span>📊</span>
                  <span>LEARNER历史记录</span>
                </>
              }
              subtitle="回顾财务轨迹 · 掌握消费规律"
              onBack={() => router.back()}
              rightButton={
                <button 
                  onClick={() => router.push('/add-record')}
                  className="bg-white/20 backdrop-blur-sm p-3 rounded-xl hover:bg-white/30 transition-colors"
                >
                  <span className="text-xl">➕</span>
                </button>
              }
            />

            <div className="px-4 pb-8 space-y-6">
              
              {/* 月份选择和统计 */}
              <div className="-mt-16 relative z-10">
                <ModernCard className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">选择月份</h3>
                    <MonthSelector 
                      selectedMonth={selectedMonth}
                      onMonthChange={handleMonthChange}
                    />
                  </div>
                  
                  {stats && <MonthlyStats stats={stats} />}
                </ModernCard>
              </div>

              {/* 记录列表 */}
              {error && !records.length ? (
                <ModernCard className="p-8 text-center">
                  <div className="text-6xl mb-4">😞</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">加载失败</h3>
                  <p className="text-gray-600 mb-6">{error}</p>
                  <button
                    onClick={() => loadHistory()}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all"
                  >
                    重新加载
                  </button>
                </ModernCard>
              ) : records.length === 0 ? (
                <ModernCard className="p-8 text-center">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">暂无记录</h3>
                  <p className="text-gray-600 mb-6">
                    {selectedMonth === new Date().toISOString().slice(0, 7) 
                      ? '还没有记录，开始你的理财之旅吧！'
                      : `${selectedMonth} 没有消费记录`}
                  </p>
                  <button
                    onClick={() => router.push('/add-record')}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all"
                  >
                    💰 开始记账
                  </button>
                </ModernCard>
              ) : (
                <>
                  <RecordsList 
                    records={records} 
                    onDeleteRecord={handleDeleteRecord}
                  />
                  
                  {/* 加载更多 */}
                  {hasMore && (
                    <div className="text-center">
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium hover:from-gray-200 hover:to-gray-300 transition-all disabled:opacity-50"
                      >
                        {loadingMore ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                            <span>加载中...</span>
                          </div>
                        ) : (
                          '📄 加载更多'
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        </SmoothTransition>
      </Layout>
    </WebAppWrapper>
  )
}

// 月份选择器组件
function MonthSelector({ selectedMonth, onMonthChange }) {
  // 生成最近12个月的选项
  const months = []
  for (let i = 0; i < 12; i++) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const monthStr = date.toISOString().slice(0, 7)
    const monthName = date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long' 
    })
    months.push({ value: monthStr, label: monthName })
  }

  return (
    <select
      value={selectedMonth}
      onChange={(e) => onMonthChange(e.target.value)}
      className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      {months.map(month => (
        <option key={month.value} value={month.value}>
          {month.label}
        </option>
      ))}
    </select>
  )
}

// 月度统计组件
function MonthlyStats({ stats }) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
      <h4 className="font-semibold text-blue-900 mb-3">本月统计</h4>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {stats.totalRecords || 0}
          </div>
          <div className="text-sm text-blue-700">总记录数</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(Math.abs(stats.totalSpent || 0))}
          </div>
          <div className="text-sm text-blue-700">总支出</div>
        </div>
      </div>
      
      {stats.categoryBreakdown && (
        <div className="mt-4 space-y-2">
          <h5 className="text-sm font-medium text-blue-800">分类占比</h5>
          {Object.entries(stats.categoryBreakdown).map(([category, amount]) => (
            <div key={category} className="flex justify-between text-sm">
              <span className="text-blue-700">{category}</span>
              <span className="font-medium text-blue-900">{formatCurrency(amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 记录列表组件 - 时间流展示（参考银行应用设计）
function RecordsList({ records, onDeleteRecord }) {
  // 直接按时间排序，不分组 - 最新记录在上
  const sortedRecords = [...records].sort((a, b) => {
    const dateA = new Date(`${a.ymd || a.date} ${a.created_at || '00:00:00'}`)
    const dateB = new Date(`${b.ymd || b.date} ${b.created_at || '00:00:00'}`)
    return dateB.getTime() - dateA.getTime() // 倒序排列，最新在上
  })

  return (
    <ModernCard className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">交易记录</h3>
      
      <div className="space-y-4">
        {sortedRecords.map((record) => (
          <TimelineRecordItem 
            key={record.id} 
            record={record} 
            onDelete={onDeleteRecord}
          />
        ))}
      </div>
    </ModernCard>
  )
}

// 时间线记录项组件 - 银行应用风格
function TimelineRecordItem({ record, onDelete }) {
  const categoryInfo = getCategoryInfo(record.category_code, record.category_group)
  const isExpense = record.amount < 0
  
  // 格式化日期时间 - 参考银行应用的显示方式
  const formatDateTime = (record) => {
    const dateStr = record.ymd || record.date
    const timeStr = record.created_at
    
    // 调试信息
    console.log('[TimelineRecord] 调试数据:', { dateStr, timeStr, record })
    
    // 处理不同的时间格式
    let date
    if (timeStr) {
      // 如果created_at是完整的ISO字符串 (如: 2024-08-27T10:30:00.000Z)
      if (timeStr.includes('T')) {
        date = new Date(timeStr)
      } 
      // 如果created_at只是时间部分 (如: 10:30:00)
      else if (dateStr) {
        date = new Date(`${dateStr} ${timeStr}`)
      }
      // 如果只有created_at，尝试直接解析
      else {
        date = new Date(timeStr)
      }
    } 
    // 如果没有created_at，只用日期
    else if (dateStr) {
      date = new Date(dateStr)
    }
    
    // 验证日期有效性
    if (!date || isNaN(date.getTime())) {
      console.warn('[TimelineRecord] 无效日期:', { dateStr, timeStr })
      return formatDisplayDate(dateStr || '未知时间')
    }
    
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    
    // 判断是否为今天、昨天
    if (date.toDateString() === today.toDateString()) {
      return `今天, ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `昨天, ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    } else {
      return `${date.getDate()} ${date.toLocaleDateString('zh-CN', { month: 'short' })}, ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    }
  }

  return (
    <div className="flex items-start space-x-4 p-4 hover:bg-gray-50 rounded-lg transition-all duration-200 group border-b border-gray-100">
      
      {/* 左侧：时间和交易信息 */}
      <div className="flex-1 min-w-0">
        {/* 时间戳 - 银行应用风格 */}
        <div className="text-sm text-gray-500 mb-1">
          {formatDateTime(record)}
        </div>
        
        {/* 交易描述 - 主要信息 */}
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-xl">{categoryInfo.icon}</span>
          <p className="font-medium text-gray-900 truncate">
            {categoryInfo.name}
          </p>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full" 
                title={getCategoryDescription(record.category_group)}>
            {record.category_group}类
          </span>
        </div>
        
        {/* 备注信息 */}
        {record.note && (
          <div className="text-sm text-gray-500 mt-1 truncate">
            {record.note}
          </div>
        )}
      </div>
      
      {/* 右侧：金额和操作按钮 */}
      <div className="text-right flex items-center space-x-3">
        <div>
          <p className={`font-bold text-lg ${
            isExpense ? 'text-red-500' : 'text-blue-500'
          }`}>
            {isExpense ? '-' : '+'}RM{Math.abs(record.amount).toFixed(2)}
          </p>
        </div>
        
        {/* 删除按钮 */}
        <button
          onClick={() => onDelete(record.id)}
          className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
          title="删除记录"
        >
          <span className="text-sm">🗑️</span>
        </button>
      </div>
    </div>
  )
}