import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard from '../components/ModernCard'
import { SmoothTransition, PageSkeleton } from '../components/SmoothTransition'
import WebAppWrapper from '../components/WebAppWrapper'
import PWAClient, { formatCurrency, formatDate, getCategoryInfo } from '../lib/api'

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
      
      if (append) {
        setRecords(prev => [...prev, ...result.records])
      } else {
        setRecords(result.records)
        setStats(result.stats)
      }
      
      setHasMore(result.records.length === 20) // 如果返回20条记录，可能还有更多
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
        <SmoothTransition>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            
            {/* 头部 */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => router.back()}
                    className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <span className="text-xl">←</span>
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold">📊 历史记录</h1>
                    <p className="text-blue-100 text-sm">查看你的消费历史</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => router.push('/add-record')}
                  className="bg-white/20 backdrop-blur-sm p-3 rounded-xl hover:bg-white/30 transition-colors"
                >
                  <span className="text-xl">➕</span>
                </button>
              </div>
            </div>

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
            RM {formatCurrency(Math.abs(stats.totalSpent || 0))}
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
              <span className="font-medium text-blue-900">RM {formatCurrency(amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 记录列表组件
function RecordsList({ records, onDeleteRecord }) {
  // 按日期分组记录
  const groupedRecords = records.reduce((groups, record) => {
    const date = formatDate(record.date)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(record)
    return groups
  }, {})

  return (
    <ModernCard className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">记录详情</h3>
      
      <div className="space-y-6">
        {Object.entries(groupedRecords).map(([date, dayRecords]) => (
          <div key={date}>
            {/* 日期标题 */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800">{date}</h4>
              <div className="text-sm text-gray-500">
                {dayRecords.length} 笔记录
              </div>
            </div>
            
            {/* 当日记录 */}
            <div className="space-y-3">
              {dayRecords.map((record) => (
                <RecordItem 
                  key={record.id} 
                  record={record} 
                  onDelete={onDeleteRecord}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ModernCard>
  )
}

// 单个记录项组件
function RecordItem({ record, onDelete }) {
  const categoryInfo = getCategoryInfo(record.category, record.group)
  const isExpense = record.amount < 0

  return (
    <div className="flex items-center space-x-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all duration-200 group">
      {/* 分类图标 */}
      <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
        <span className="text-xl">{categoryInfo.icon}</span>
      </div>
      
      {/* 记录信息 */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">
          {categoryInfo.name}
        </p>
        <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
          <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-medium">
            {record.group}类
          </span>
          {record.note && (
            <>
              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
              <span className="truncate">💬 {record.note}</span>
            </>
          )}
        </div>
      </div>
      
      {/* 金额和操作 */}
      <div className="text-right flex items-center space-x-3">
        <div>
          <p className={`font-bold text-lg ${
            isExpense ? 'text-red-500' : 'text-emerald-500'
          }`}>
            {isExpense ? '-' : '+'}RM {formatCurrency(Math.abs(record.amount))}
          </p>
          <div className="text-xs text-gray-400">
            {record.time ? record.time.slice(0, 5) : ''}
          </div>
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