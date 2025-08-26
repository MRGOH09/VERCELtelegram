import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard from '../components/ModernCard'
import { SmoothTransition } from '../components/SmoothTransition'
import WebAppWrapper from '../components/WebAppWrapper'
import PWAClient, { formatCurrency } from '../lib/api'

const CATEGORIES = {
  A: {
    name: '生活开销',
    icon: '🛒',
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    items: [
      { code: 'food', name: '餐饮', icon: '🍽️' },
      { code: 'transport', name: '交通', icon: '🚗' },
      { code: 'shopping', name: '购物', icon: '🛍️' },
      { code: 'utilities', name: '水电费', icon: '💡' },
      { code: 'rent', name: '房租', icon: '🏠' },
      { code: 'healthcare', name: '医疗', icon: '🏥' },
      { code: 'entertainment', name: '娱乐', icon: '🎬' },
      { code: 'other_a', name: '其他生活', icon: '📦' }
    ]
  },
  B: {
    name: '学习投资',
    icon: '📚',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    items: [
      { code: 'education', name: '教育培训', icon: '🎓' },
      { code: 'books', name: '书籍资料', icon: '📖' },
      { code: 'courses', name: '在线课程', icon: '💻' },
      { code: 'skills', name: '技能培训', icon: '🔧' },
      { code: 'certification', name: '认证考试', icon: '📜' },
      { code: 'seminars', name: '研讨会', icon: '👥' },
      { code: 'tools', name: '学习工具', icon: '🔨' },
      { code: 'other_b', name: '其他学习', icon: '📝' }
    ]
  },
  C: {
    name: '储蓄投资',
    icon: '💎',
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    items: [
      { code: 'savings', name: '储蓄', icon: '🏦' },
      { code: 'investment', name: '投资理财', icon: '📈' },
      { code: 'insurance', name: '保险', icon: '🛡️' },
      { code: 'pension', name: '养老金', icon: '👴' },
      { code: 'emergency', name: '应急基金', icon: '🚨' },
      { code: 'property', name: '房产投资', icon: '🏘️' },
      { code: 'crypto', name: '数字货币', icon: '₿' },
      { code: 'other_c', name: '其他投资', icon: '💰' }
    ]
  }
}

export default function AddRecordPage() {
  const router = useRouter()
  const [selectedGroup, setSelectedGroup] = useState('A')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    // 从URL参数中获取预选分类
    const { group, category } = router.query
    if (group && CATEGORIES[group]) {
      setSelectedGroup(group)
      if (category) {
        const categoryExists = CATEGORIES[group].items.some(item => item.code === category)
        if (categoryExists) {
          setSelectedCategory(category)
        }
      }
    }
  }, [router.query])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedCategory || !amount) {
      alert('请选择分类并输入金额')
      return
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('请输入有效的金额')
      return
    }

    try {
      setIsSubmitting(true)

      const recordData = {
        group: selectedGroup,
        category: selectedCategory,
        amount: numAmount,
        note: note.trim() || null,
        date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
      }

      await PWAClient.addRecord(recordData)

      // 显示成功状态
      setShowSuccess(true)
      
      // 重置表单
      setSelectedCategory('')
      setAmount('')
      setNote('')
      
      // 2秒后隐藏成功提示
      setTimeout(() => {
        setShowSuccess(false)
      }, 2000)

    } catch (error) {
      console.error('添加记录失败:', error)
      alert(error.message || '添加记录失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCategoryInfo = selectedCategory ? 
    CATEGORIES[selectedGroup].items.find(item => item.code === selectedCategory) : null

  return (
    <WebAppWrapper>
      <Layout title="记账 - Learner Club">
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
                    <h1 className="text-2xl font-bold">💰 快速记账</h1>
                    <p className="text-blue-100 text-sm">记录你的每一笔支出</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 pb-8 space-y-6">
              
              {/* 成功提示 */}
              {showSuccess && (
                <div className="-mt-4 relative z-20">
                  <ModernCard className="p-4 bg-green-50 border border-green-200 text-center">
                    <div className="text-4xl mb-2">✅</div>
                    <p className="text-green-800 font-semibold">记录添加成功！</p>
                  </ModernCard>
                </div>
              )}

              {/* 分组选择 */}
              <div className={showSuccess ? '-mt-4' : '-mt-16'} style={{ position: 'relative', zIndex: 10 }}>
                <ModernCard className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">选择分组</h3>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(CATEGORIES).map(([groupKey, groupInfo]) => (
                      <button
                        key={groupKey}
                        onClick={() => {
                          setSelectedGroup(groupKey)
                          setSelectedCategory('') // 重置分类选择
                        }}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                          selectedGroup === groupKey
                            ? `${groupInfo.bgColor} border-current ${groupInfo.color.replace('bg-', 'text-')}`
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-2xl mb-2">{groupInfo.icon}</div>
                        <div className="text-sm font-medium">{groupInfo.name}</div>
                      </button>
                    ))}
                  </div>
                </ModernCard>
              </div>

              {/* 分类选择 */}
              <ModernCard className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  选择具体分类 - {CATEGORIES[selectedGroup].name}
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES[selectedGroup].items.map((category) => (
                    <button
                      key={category.code}
                      onClick={() => setSelectedCategory(category.code)}
                      className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                        selectedCategory === category.code
                          ? `${CATEGORIES[selectedGroup].bgColor} border-current ${CATEGORIES[selectedGroup].color.replace('bg-', 'text-')}`
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{category.icon}</span>
                        <span className="font-medium text-sm">{category.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ModernCard>

              {/* 金额和备注输入 */}
              <ModernCard className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">金额和备注</h3>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* 金额输入 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      金额 (RM)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-xl">
                        💰
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  {/* 备注输入 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      备注 (可选)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="添加一些备注..."
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* 记录预览 */}
                  {selectedCategoryInfo && amount && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                      <h4 className="font-semibold text-blue-900 mb-2">记录预览</h4>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{selectedCategoryInfo.icon}</span>
                          <div>
                            <p className="font-medium text-blue-900">{selectedCategoryInfo.name}</p>
                            <p className="text-sm text-blue-700">{CATEGORIES[selectedGroup].name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-red-600">
                            -RM {parseFloat(amount || 0).toFixed(2)}
                          </p>
                          <p className="text-sm text-blue-700">支出</p>
                        </div>
                      </div>
                      {note && (
                        <div className="mt-3 p-2 bg-white/50 rounded-lg">
                          <p className="text-sm text-blue-800">💬 {note}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 提交按钮 */}
                  <button
                    type="submit"
                    disabled={!selectedCategory || !amount || isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>添加中...</span>
                      </div>
                    ) : (
                      '💾 添加记录'
                    )}
                  </button>
                </form>
              </ModernCard>

              {/* 快速金额按钮 */}
              <ModernCard className="p-6">
                <h4 className="font-semibold text-gray-900 mb-3">快速金额</h4>
                <div className="grid grid-cols-4 gap-3">
                  {[10, 20, 50, 100, 200, 500, 1000, 2000].map((quickAmount) => (
                    <button
                      key={quickAmount}
                      onClick={() => setAmount(quickAmount.toString())}
                      className="py-3 px-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
                    >
                      {quickAmount}
                    </button>
                  ))}
                </div>
              </ModernCard>

            </div>
          </div>
        </SmoothTransition>
      </Layout>
    </WebAppWrapper>
  )
}