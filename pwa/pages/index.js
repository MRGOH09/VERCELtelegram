import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard, { DataCard, CircularProgress, BalanceCard, CategoryCard } from '../components/ModernCard'
import { SmoothTransition, useSmartPreload, PageSkeleton } from '../components/SmoothTransition'
import WebAppWrapper from '../components/WebAppWrapper'
import TelegramJumpOut, { TelegramJumpBanner } from '../components/TelegramJumpOut'
import QuickActions from '../components/QuickActions'
import PWAClient, { formatCurrency, formatDateTime, getCategoryInfo } from '../lib/api'
import { BarChart, DonutChart, CategoryBredown } from '../components/Charts'
import SpendingInsights, { BudgetControl, RecordStatistics } from '../components/SpendingInsights'

export default function ModernDashboard() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [showTelegramJump, setShowTelegramJump] = useState(false)
  const { preloadPage } = useSmartPreload()
  
  useEffect(() => {
    checkAuthAndLoadDashboard()
    
    // 预加载相关页面数据
    setTimeout(() => {
      preloadPage('profile')
      preloadPage('history')
    }, 2000)
  }, [])
  
  const checkAuthAndLoadDashboard = async () => {
    try {
      const authResult = await PWAClient.checkAuth()
      if (!authResult.authenticated) {
        router.replace('/login')
        return
      }
      loadDashboard()
    } catch (error) {
      console.error('认证检查失败:', error)
      router.replace('/login')
    }
  }
  
  const loadDashboard = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
        // 刷新时显示骨架屏而不是loading页面
        setShowSkeleton(true)
        // 强制获取最新数据
        const result = await PWAClient.getFreshDashboard()
        setData(result)
      } else {
        setLoading(true)
        // 首次加载时使用缓存数据
        const result = await PWAClient.getDashboard()
        setData(result)
      }
      
      setError('')
      
    } catch (error) {
      console.error('Dashboard load error:', error)
      
      if (error.message.includes('Unauthorized')) {
        router.replace('/login')
        return
      }
      
      setError(error.message || '加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setShowSkeleton(false)
    }
  }
  
  const handleRefresh = () => {
    loadDashboard(true)
  }
  
  // 使用骨架屏替代传统loading页面
  if (loading && !data) {
    return (
      <Layout title="首页 - Learner Club">
        <PageSkeleton type="dashboard" />
      </Layout>
    )
  }
  
  // 刷新时显示骨架屏覆盖
  if (showSkeleton) {
    return (
      <Layout title="首页 - Learner Club">
        <PageSkeleton type="dashboard" />
      </Layout>
    )
  }
  
  if (error && !data) {
    return (
      <Layout title="首页 - Learner Club">
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
          <ModernCard className="p-8 text-center">
            <div className="text-6xl mb-4">💸</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              暂时无法连接
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => loadDashboard()}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-200"
            >
              重新加载
            </button>
          </ModernCard>
        </div>
      </Layout>
    )
  }
  
  return (
    <WebAppWrapper>
      <Layout title="首页 - Learner Club">
        {/* Telegram跳转横幅 */}
        <TelegramJumpBanner 
          onShow={() => setShowTelegramJump(true)}
          onDismiss={() => {}}
        />
        
      <SmoothTransition>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        
        {/* LEARNER CLUB 品牌标语 */}
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 text-white px-4 py-3 text-center shadow-lg">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-2xl">🎯</span>
            <div>
              <h1 className="text-lg font-bold tracking-wide">LEARNER CLUB</h1>
              <p className="text-xs opacity-90">学习改变命运 · 记录成就未来</p>
            </div>
            <span className="text-2xl">📚</span>
          </div>
        </div>
        
        {/* 现代化头部 */}
        <ModernHeader 
          user={data?.user} 
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
        
        {/* 主要内容区域 */}
        <div className="px-4 pb-8 space-y-6">
          
          {/* 强化版目标控制 - 替代原本月总览 */}
          <div className="-mt-16 relative z-10">
            <EnhancedBudgetControl data={data} />
          </div>
          
          {/* 支出占比图表 - 强调百分比 */}
          <EnhancedExpenseChart data={data} />
          
          {/* 快速数据卡片组 */}
          <QuickStats data={data?.monthly} stats={data?.stats} />
          
          {/* 记录统计 */}
          <RecordStatistics data={data} />
          
          {/* 支出分析 */}
          <SpendingAnalysis data={data?.monthly} />
          
          {/* 详细分类明细 */}
          <CategoryBredown 
            title="📋 分类明细"
            categoryDetails={data?.categoryDetails} 
            groupConfig={{
              A: { name: '开销', icon: '🛒', color: '#3B82F6' },
              B: { name: '学习', icon: '📚', color: '#10B981' },
              C: { name: '储蓄', icon: '💎', color: '#F59E0B' }
            }}
          />
          
          {/* 智能建议 */}
          <SpendingInsights data={data} categoryDetails={data?.categoryDetails} />
          
          {/* 最近活动 */}
          <RecentActivity records={data?.recent} />
          
        </div>
        
        
        </div>
      </SmoothTransition>
      
      {/* Telegram跳转引导弹窗 */}
      {showTelegramJump && (
        <TelegramJumpOut onDismiss={() => setShowTelegramJump(false)} />
      )}
      
      {/* 快速操作按钮 */}
      <QuickActions />
      
      </Layout>
    </WebAppWrapper>
  )
}

// 现代化头部组件
function ModernHeader({ user, onRefresh, refreshing }) {
  const currentHour = new Date().getHours()
  const greeting = currentHour < 12 ? '早上好' : currentHour < 18 ? '下午好' : '晚上好'
  
  return (
    <div className="relative overflow-hidden">
      {/* 背景渐变 */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-6 pt-12 pb-24">
        
        {/* 装饰性元素 */}
        <div className="absolute top-0 right-0 opacity-10">
          <div className="w-64 h-64 rounded-full bg-white transform translate-x-20 -translate-y-20"></div>
        </div>
        <div className="absolute bottom-0 left-0 opacity-5">
          <div className="w-48 h-48 rounded-full bg-white transform -translate-x-12 translate-y-12"></div>
        </div>
        
        {/* 内容 */}
        <div className="relative z-10 flex justify-between items-start text-white">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl">👋</span>
              <h1 className="text-2xl font-bold">
                {greeting}
              </h1>
            </div>
            <p className="text-xl font-semibold text-blue-100">
              {user?.name || 'Learner'}
            </p>
            <p className="text-blue-200 text-sm mt-1">
              {user?.branch ? `${user.branch} 分行` : 'Learner Club 会员'}
            </p>
          </div>
          
          {/* 刷新按钮 */}
          <button 
            onClick={onRefresh}
            disabled={refreshing}
            className="bg-white/20 backdrop-blur-sm p-3 rounded-2xl hover:bg-white/30 transition-all duration-200 transform hover:scale-105"
          >
            <span className={`text-xl ${refreshing ? 'animate-spin' : ''}`}>
              🔄
            </span>
          </button>
        </div>
        
      </div>
    </div>
  )
}

// 余额总览组件
function BalanceOverview({ data }) {
  if (!data) {
    return (
      <ModernCard className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
          <div className="h-12 bg-gray-200 rounded w-2/3 mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
      </ModernCard>
    )
  }
  
  const { income, spent_a, spent_b, spent_c, days_left } = data
  const totalSpent = spent_a + spent_b + spent_c
  const remaining = Math.max(0, income - totalSpent)
  
  return (
    <BalanceCard 
      income={income}
      spent={totalSpent}
      remaining={remaining}
      daysLeft={days_left}
    />
  )
}

// 快速统计组件
function QuickStats({ data, stats }) {
  if (!data || !stats) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <ModernCard key={i} className="p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-10 bg-gray-200 rounded-full w-10 mx-auto"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            </div>
          </ModernCard>
        ))}
      </div>
    )
  }
  
  const { spent_a, spent_b, spent_c, percentage_a, percentage_b, percentage_c } = data
  
  return (
    <div className="grid grid-cols-3 gap-4">
      <DataCard
        icon="🛒"
        label="生活开销"
        value={`RM ${spent_a.toLocaleString()}`}
        change={`${percentage_a}%`}
        trend={percentage_a > 60 ? 'down' : 'neutral'}
      />
      <DataCard
        icon="📚"
        label="学习投资"
        value={`RM ${spent_b.toLocaleString()}`}
        change={`${percentage_b}%`}
        trend={percentage_b > 15 ? 'up' : 'neutral'}
      />
      <DataCard
        icon="💎"
        label="储蓄投资"
        value={`RM ${spent_c.toLocaleString()}`}
        change={`${percentage_c}%`}
        trend={percentage_c > 20 ? 'up' : 'neutral'}
      />
    </div>
  )
}

// 支出分析组件
function SpendingAnalysis({ data }) {
  if (!data) return null
  
  const { spent_a, spent_b, spent_c, percentage_a, percentage_b, percentage_c } = data
  
  const categories = [
    {
      name: '生活开销',
      amount: spent_a,
      percentage: percentage_a,
      items: 12, // 假设数据
      icon: '🛒',
      color: 'bg-red-500',
      bgColor: 'bg-red-50'
    },
    {
      name: '学习投资', 
      amount: spent_b,
      percentage: percentage_b,
      items: 5,
      icon: '📚',
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      name: '储蓄投资',
      amount: spent_c,
      percentage: percentage_c,
      items: 8,
      icon: '💎',
      color: 'bg-green-500',
      bgColor: 'bg-green-50'
    }
  ]
  
  return <CategoryCard categories={categories} />
}

// 最近活动组件
function RecentActivity({ records }) {
  if (!records || records.length === 0) {
    return (
      <ModernCard className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">最近活动</h3>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-gray-500 text-lg">暂无活动记录</p>
          <p className="text-sm text-gray-400 mt-2">
            使用Telegram Bot开始记录财务数据
          </p>
        </div>
      </ModernCard>
    )
  }
  
  return (
    <ModernCard className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">最近活动</h3>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          近5笔
        </span>
      </div>
      
      <div className="space-y-4">
        {records.map((record, index) => (
          <ModernActivityItem key={record.id || index} record={record} />
        ))}
      </div>
    </ModernCard>
  )
}

// 现代化活动项组件
function ModernActivityItem({ record }) {
  const categoryInfo = getCategoryInfo(record.category, record.group)
  const isExpense = record.amount < 0
  
  return (
    <div className="flex items-center space-x-4 p-4 hover:bg-gray-50 rounded-2xl transition-all duration-200 group">
      {/* 分类图标 */}
      <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
        <span className="text-2xl">{categoryInfo.icon}</span>
      </div>
      
      {/* 记录信息 */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate text-lg">
          {categoryInfo.name}
        </p>
        <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
          <span>{formatDateTime(record.date)}</span>
          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
          <span className="bg-gray-100 px-2 py-0.5 rounded-md text-xs font-medium">
            {record.group}类
          </span>
        </div>
        {record.note && (
          <p className="text-sm text-gray-400 truncate mt-2 bg-gray-50 px-3 py-1 rounded-lg">
            💬 {record.note}
          </p>
        )}
      </div>
      
      {/* 金额 */}
      <div className="text-right">
        <p className={`font-bold text-xl ${
          isExpense ? 'text-red-500' : 'text-emerald-500'
        }`}>
          {isExpense ? '-' : '+'}{formatCurrency(Math.abs(record.amount))}
        </p>
        <div className="text-xs text-gray-400 mt-1">
          {isExpense ? '支出' : '收入'}
        </div>
      </div>
    </div>
  )
}

// 支出占比圆环图
function ExpenseDonutChart({ data }) {
  if (!data) return null
  
  const { monthly } = data
  const total = monthly.total_expenses
  
  if (total === 0) {
    return (
      <ModernCard className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 现时支出与占比</h3>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500">本月暂无支出记录</p>
        </div>
      </ModernCard>
    )
  }
  
  const chartData = [
    {
      name: '开销',
      value: monthly.spent_a,
      color: '#3B82F6',
      icon: '🛒'
    },
    {
      name: '学习',
      value: monthly.spent_b,
      color: '#10B981', 
      icon: '📚'
    },
    {
      name: '储蓄',
      value: monthly.spent_c,
      color: '#F59E0B',
      icon: '💎'
    }
  ].filter(item => item.value > 0)
  
  return (
    <DonutChart 
      title="💰 现时支出与占比"
      data={chartData}
      total={total}
      centerText="总支出"
    />
  )
}

// 强化版目标控制组件
function EnhancedBudgetControl({ data }) {
  if (!data) return null
  
  const { monthly, budget_details } = data
  const { income, spent_a, budget_a, remaining_a, percentage_a } = monthly
  
  // 计算目标达成状态
  const isOverBudget = spent_a > budget_a
  const budgetProgress = budget_a > 0 ? (spent_a / budget_a * 100) : 0
  const daysLeft = monthly.days_left || 0
  const dailyBudget = remaining_a > 0 ? (remaining_a / Math.max(1, daysLeft)) : 0
  
  return (
    <ModernCard className="p-6 bg-gradient-to-br from-white to-blue-50 shadow-xl">
      <div className="space-y-4">
        {/* 标题区域 - LEARNER CLUB 理念 */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🎯 目标控制系统
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            "控制开销，投资学习，成就未来"
          </p>
        </div>
        
        {/* 核心指标展示 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">月收入</span>
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">RM {income.toLocaleString()}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">剩余天数</span>
              <span className="text-2xl">📅</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{daysLeft} 天</p>
          </div>
        </div>
        
        {/* 开销控制进度条 - 更强烈的视觉提醒 */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                <span>🛒</span>
                <span>开销控制目标</span>
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                把开销控制在 RM {budget_a.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">当前支出</p>
              <p className={`text-xl font-bold ${isOverBudget ? 'text-red-600' : 'text-blue-600'}`}>
                RM {spent_a.toLocaleString()}
              </p>
            </div>
          </div>
          
          {/* 进度条 */}
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  isOverBudget 
                    ? 'bg-gradient-to-r from-red-500 to-red-600' 
                    : budgetProgress > 80 
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                      : 'bg-gradient-to-r from-green-400 to-emerald-500'
                }`}
                style={{ width: `${Math.min(100, budgetProgress)}%` }}
              >
                <div className="h-full flex items-center justify-end pr-2">
                  <span className="text-xs font-bold text-white">
                    {Math.round(budgetProgress)}%
                  </span>
                </div>
              </div>
            </div>
            
            {/* 目标线 */}
            {!isOverBudget && (
              <div className="absolute top-0 right-0 h-6 w-0.5 bg-gray-800" 
                   style={{ right: '0%' }}>
                <span className="absolute -top-5 -right-6 text-xs text-gray-600">目标</span>
              </div>
            )}
          </div>
          
          {/* 状态提示 */}
          <div className={`mt-4 p-3 rounded-lg ${
            isOverBudget 
              ? 'bg-red-50 border border-red-200' 
              : budgetProgress > 80
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-green-50 border border-green-200'
          }`}>
            <p className={`text-sm font-medium ${
              isOverBudget ? 'text-red-800' : budgetProgress > 80 ? 'text-yellow-800' : 'text-green-800'
            }`}>
              {isOverBudget 
                ? `⚠️ 已超支 RM ${(spent_a - budget_a).toLocaleString()}！请立即控制开销！`
                : budgetProgress > 80
                  ? `⏰ 注意：仅剩 RM ${remaining_a.toLocaleString()} 额度，请谨慎消费`
                  : `✅ 状态良好，还有 RM ${remaining_a.toLocaleString()} 可用额度`
              }
            </p>
            
            {!isOverBudget && daysLeft > 0 && (
              <p className="text-xs text-gray-600 mt-2">
                💡 建议每日开销控制在 RM {dailyBudget.toFixed(2)} 以内
              </p>
            )}
          </div>
        </div>
        
        {/* LEARNER CLUB 激励语 */}
        <div className="text-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
          <p className="text-sm italic text-gray-700">
            {budgetProgress < 50 
              ? "🌟 优秀！继续保持理性消费"
              : budgetProgress < 80
                ? "💪 加油！合理规划每一笔开销"
                : isOverBudget
                  ? "🚨 警惕！学会延迟满足，投资未来"
                  : "⚡ 关键时刻！每一分钱都要精打细算"
            }
          </p>
        </div>
      </div>
    </ModernCard>
  )
}

// 强化版支出占比图表 - 强调百分比
function EnhancedExpenseChart({ data }) {
  if (!data) return null
  
  const { monthly } = data
  const { percentage_a, percentage_b, percentage_c, spent_a, spent_b, spent_c } = monthly
  const total = spent_a + spent_b + spent_c
  
  if (total === 0) {
    return (
      <ModernCard className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 支出占比分析</h3>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">💭</div>
          <p className="text-gray-500">开始记录，掌控财务</p>
        </div>
      </ModernCard>
    )
  }
  
  // 找出最大占比类别
  const maxPercentage = Math.max(percentage_a, percentage_b, percentage_c)
  const dominantCategory = percentage_a === maxPercentage ? '开销' : 
                          percentage_b === maxPercentage ? '学习' : '储蓄'
  
  // 为圆环图准备数据，强调百分比
  const chartData = [
    {
      name: '开销',
      value: spent_a,
      percentage: percentage_a,
      color: percentage_a > 60 ? '#EF4444' : '#3B82F6',
      icon: '🛒'
    },
    {
      name: '学习',
      value: spent_b,
      percentage: percentage_b,
      color: '#10B981',
      icon: '📚'
    },
    {
      name: '储蓄', 
      value: spent_c,
      percentage: percentage_c,
      color: percentage_c < 20 ? '#F59E0B' : '#10B981',
      icon: '💎'
    }
  ].filter(item => item.value > 0)
  
  return (
    <ModernCard className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center justify-between">
          <span>📊 支出占比分析</span>
          <span className="text-sm font-normal text-gray-500">基于月收入计算</span>
        </h3>
      </div>
      
      {/* 自定义百分比圆环图 */}
      <div className="relative">
        <PercentageDonutChart 
          data={chartData}
          dominantCategory={dominantCategory}
          maxPercentage={maxPercentage}
        />
      </div>
      
      {/* 占比分析建议 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 LEARNER CLUB 理财建议</h4>
        <div className="space-y-1">
          <p className="text-xs text-blue-800">
            {percentage_a > 60 
              ? '• 开销占比偏高，建议优化日常支出结构'
              : '• 开销控制良好，继续保持理性消费'}
          </p>
          <p className="text-xs text-blue-800">
            {percentage_b < 10
              ? '• 学习投资偏低，建议增加自我提升投入'
              : '• 学习投资合理，知识就是力量'}
          </p>
          <p className="text-xs text-blue-800">
            {percentage_c < 20
              ? '• 储蓄率偏低，建议提高财务安全边际'
              : '• 储蓄习惯良好，财务未来可期'}
          </p>
        </div>
      </div>
    </ModernCard>
  )
}

// 百分比专用圆环图组件
function PercentageDonutChart({ data, dominantCategory, maxPercentage }) {
  const [hoveredIndex, setHoveredIndex] = React.useState(null)
  
  const radius = 80
  const strokeWidth = 20
  const center = 100
  const circumference = 2 * Math.PI * radius
  
  let cumulativePercentage = 0
  const total = data.reduce((sum, item) => sum + item.value, 0)
  
  return (
    <div>
      <div className="flex items-center justify-center mb-6">
        <div className="relative">
          {/* SVG圆环 */}
          <svg width="200" height="200" className="transform -rotate-90">
            {/* 背景圆环 */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#f3f4f6"
              strokeWidth={strokeWidth}
            />
            
            {/* 数据圆环 */}
            {data.map((item, index) => {
              const percentage = total > 0 ? (item.value / total) * 100 : 0
              const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
              const strokeDashoffset = -((cumulativePercentage / 100) * circumference)
              
              cumulativePercentage += percentage
              
              return (
                <circle
                  key={index}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className={`transition-all duration-300 ${hoveredIndex === index ? 'opacity-80' : ''}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              )
            })}
          </svg>
          
          {/* 中心显示百分比 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {Math.round(maxPercentage)}%
              </div>
              <div className="text-sm text-gray-500">{dominantCategory}占比</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 图例 - 显示所有类别百分比 */}
      <div className="grid grid-cols-3 gap-4">
        {data.map((item, index) => (
          <div 
            key={index}
            className={`text-center p-3 rounded-lg transition-all duration-200 cursor-pointer ${
              hoveredIndex === index ? 'bg-gray-50 scale-105' : 'hover:bg-gray-50'
            }`}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="text-2xl mb-1">{item.icon}</div>
            <div className="text-xs text-gray-600">{item.name}</div>
            <div className="text-xl font-bold" style={{ color: item.color }}>
              {item.percentage}%
            </div>
            <div className="text-xs text-gray-500">
              RM {item.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}