import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard from '../components/ModernCard'
import { SmoothTransition } from '../components/SmoothTransition'
import WebAppWrapper from '../components/WebAppWrapper'
import PWAClient, { formatCurrency } from '../lib/api'

// 与Telegram系统完全一致的分类系统
const TELEGRAM_CATEGORIES = {
  A: {
    name: '生活开销',
    icon: '🛒',
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    items: [
      { code: '餐饮', name: '餐饮', icon: '🍽️' },
      { code: '娱乐', name: '娱乐', icon: '🎬' },
      { code: '购物', name: '购物', icon: '🛍️' },
      { code: '交通', name: '交通', icon: '🚗' },
      { code: '水电', name: '水电', icon: '💡' },
      { code: '手机', name: '手机', icon: '📱' },
      { code: '家用', name: '家用', icon: '🏠' },
      { code: '其他', name: '其他', icon: '📦' }
    ]
  },
  B: {
    name: '学习投资',
    icon: '📚',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    items: [
      { code: '书籍', name: '书籍', icon: '📖' },
      { code: '课程', name: '课程', icon: '🎓' },
      { code: '培训', name: '培训', icon: '🔧' },
      { code: '认证', name: '认证', icon: '📜' }
    ]
  },
  C: {
    name: '储蓄投资',
    icon: '💎',
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    items: [
      { code: '股票', name: '股票', icon: '📈' },
      { code: '定存', name: '定存', icon: '🏦' },
      { code: '保险', name: '保险', icon: '🛡️' },
      { code: '紧急基金', name: '紧急基金', icon: '🚨' },
      { code: '其他', name: '其他', icon: '💰' }
    ]
  }
}

// 创建空记录行
const createEmptyRecord = (index) => ({
  id: `temp-${Date.now()}-${index}`,
  date: new Date().toISOString().split('T')[0],
  group: 'A',
  category: '餐饮',
  amount: '',
  note: '',
  isValid: false
})

export default function AddRecordPage() {
  const router = useRouter()
  
  // 模式切换状态
  const [isBatchMode, setIsBatchMode] = useState(false)
  
  // 单条记录状态
  const [selectedGroup, setSelectedGroup] = useState('A')
  const [selectedCategory, setSelectedCategory] = useState('餐饮')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  
  // 批量记录状态
  const [batchRecords, setBatchRecords] = useState(() => 
    Array.from({ length: 5 }, (_, i) => createEmptyRecord(i))
  )

  useEffect(() => {
    // 从URL参数中获取预选分类
    const { group, category } = router.query
    if (group && TELEGRAM_CATEGORIES[group]) {
      setSelectedGroup(group)
      if (category) {
        const categoryExists = TELEGRAM_CATEGORIES[group].items.some(item => item.code === category)
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

      await PWAClient.call('data', 'add-record', recordData)

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

  // 批量记录函数
  const updateBatchRecord = (index, field, value) => {
    setBatchRecords(prev => prev.map((record, i) => {
      if (i === index) {
        const updated = { ...record, [field]: value }
        // 实时验证
        updated.isValid = updated.date && updated.amount && parseFloat(updated.amount) > 0
        return updated
      }
      return record
    }))
  }

  const calculateTotal = () => {
    return batchRecords.reduce((total, record) => {
      const amount = parseFloat(record.amount) || 0
      return total + amount
    }, 0)
  }

  const getValidRecordsCount = () => {
    return batchRecords.filter(record => record.isValid).length
  }

  const getAllCategories = (group) => {
    return TELEGRAM_CATEGORIES[group]?.items || []
  }

  const handleBatchSubmit = async () => {
    const validRecords = batchRecords.filter(record => record.isValid)
    
    if (validRecords.length === 0) {
      alert('请至少填写一条完整记录')
      return
    }

    try {
      setIsSubmitting(true)
      await PWAClient.call('data', 'batch-add-records', { records: validRecords })
      
      setShowSuccess(true)
      setBatchRecords(Array.from({ length: 5 }, (_, i) => createEmptyRecord(i)))
      
      setTimeout(() => {
        setShowSuccess(false)
      }, 3000)

    } catch (error) {
      console.error('批量记录失败:', error)
      alert(error.message || '批量记录失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClearBatch = () => {
    if (confirm('确定要清空所有记录吗？')) {
      setBatchRecords(Array.from({ length: 5 }, (_, i) => createEmptyRecord(i)))
    }
  }

  const selectedCategoryInfo = selectedCategory ? 
    TELEGRAM_CATEGORIES[selectedGroup].items.find(item => item.code === selectedCategory) : null

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
                    <p className="text-blue-100 text-sm">{isBatchMode ? '表格式批量输入' : '记录你的每一笔支出'}</p>
                  </div>
                </div>
                
                {/* 模式切换按钮 */}
                <div className="flex bg-white/20 rounded-xl p-1 mt-4">
                  <button
                    onClick={() => setIsBatchMode(false)}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                      !isBatchMode 
                        ? 'bg-white text-blue-700 shadow-sm' 
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    💰 单条记录
                  </button>
                  <button
                    onClick={() => setIsBatchMode(true)}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                      isBatchMode 
                        ? 'bg-white text-blue-700 shadow-sm' 
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    📋 批量记录
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 pb-8 space-y-6">
              
              {/* 成功提示 */}
              {showSuccess && (
                <div className="-mt-4 relative z-20">
                  <ModernCard className="p-4 bg-green-50 border border-green-200 text-center">
                    <div className="text-4xl mb-2">✅</div>
                    <p className="text-green-800 font-semibold">
                      {isBatchMode ? '批量记录成功！' : '记录添加成功！'}
                    </p>
                    {isBatchMode && (
                      <p className="text-green-600 text-sm">已保存 {getValidRecordsCount()} 条记录</p>
                    )}
                  </ModernCard>
                </div>
              )}

              {/* 根据模式显示不同内容 */}
              {isBatchMode ? (
                // 批量记录模式
                <>
                  {/* 统计卡片 */}
                  <div className={showSuccess ? '-mt-4' : '-mt-16'} style={{ position: 'relative', zIndex: 10 }}>
                    <ModernCard className="p-4">
                      <div className="flex justify-between items-center text-sm">
                        <div>
                          <span className="text-gray-600">有效记录: </span>
                          <span className="font-bold text-blue-600">{getValidRecordsCount()}</span>
                          <span className="text-gray-500">/5</span>
                        </div>
                        <div>
                          <span className="text-gray-600">总计: </span>
                          <span className="font-bold text-red-600">RM {calculateTotal().toFixed(2)}</span>
                        </div>
                      </div>
                    </ModernCard>
                  </div>

                  {/* 批量记录表格 */}
                  <ModernCard className="p-3">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">记录明细</h3>
                    
                    {/* 表格头部 */}
                    <div className="grid grid-cols-12 gap-1 mb-3 text-xs font-semibold text-gray-600 bg-gray-50 p-2 rounded-lg">
                      <div className="col-span-3">日期</div>
                      <div className="col-span-2">类型</div>
                      <div className="col-span-2">项目</div>
                      <div className="col-span-3">金额</div>
                      <div className="col-span-2">备注</div>
                    </div>

                    {/* 记录行 */}
                    <div className="space-y-2">
                      {batchRecords.map((record, index) => (
                        <div 
                          key={record.id}
                          className={`grid grid-cols-12 gap-1 p-2 rounded-lg border-2 transition-colors ${
                            record.isValid 
                              ? 'border-green-200 bg-green-50/30' 
                              : record.amount || record.note 
                                ? 'border-yellow-200 bg-yellow-50/30'
                                : 'border-gray-200 bg-white'
                          }`}
                        >
                          {/* 日期 */}
                          <div className="col-span-3">
                            <input
                              type="date"
                              value={record.date}
                              onChange={(e) => updateBatchRecord(index, 'date', e.target.value)}
                              className="w-full text-xs p-1 border rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>

                          {/* 类型 */}
                          <div className="col-span-2">
                            <select
                              value={record.group}
                              onChange={(e) => {
                                updateBatchRecord(index, 'group', e.target.value)
                                // 重置分类为该组的第一个
                                const firstCategory = TELEGRAM_CATEGORIES[e.target.value]?.items[0]?.code || ''
                                updateBatchRecord(index, 'category', firstCategory)
                              }}
                              className="w-full text-xs p-1 border rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="A">🛒开销</option>
                              <option value="B">📚学习</option>
                              <option value="C">💎储蓄</option>
                            </select>
                          </div>

                          {/* 项目 */}
                          <div className="col-span-2">
                            <select
                              value={record.category}
                              onChange={(e) => updateBatchRecord(index, 'category', e.target.value)}
                              className="w-full text-xs p-1 border rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            >
                              {getAllCategories(record.group).map(cat => (
                                <option key={cat.code} value={cat.code}>
                                  {cat.icon}{cat.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 金额 */}
                          <div className="col-span-3">
                            <div className="relative">
                              <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">RM</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={record.amount}
                                onChange={(e) => updateBatchRecord(index, 'amount', e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-6 pr-1 py-1 text-xs border rounded text-right font-bold focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>

                          {/* 备注 */}
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={record.note}
                              onChange={(e) => updateBatchRecord(index, 'note', e.target.value)}
                              placeholder="备注"
                              className="w-full text-xs p-1 border rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ModernCard>

                  {/* 批量操作按钮 */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleClearBatch}
                      disabled={isSubmitting}
                      className="py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      🗑️ 清空
                    </button>
                    
                    <button
                      onClick={handleBatchSubmit}
                      disabled={isSubmitting || getValidRecordsCount() === 0}
                      className="py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>保存中...</span>
                        </div>
                      ) : (
                        `💾 保存记录 (${getValidRecordsCount()})`
                      )}
                    </button>
                  </div>

                  {/* 使用提示 */}
                  <ModernCard className="p-4 bg-blue-50/50">
                    <h4 className="font-semibold text-blue-900 mb-2">💡 使用提示</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>• 填写完整的记录会显示绿色边框</p>
                      <p>• 只需填写有数据的行，空行会自动忽略</p>
                      <p>• 默认日期为今天，可手动调整</p>
                      <p>• 实时显示有效记录数和总金额</p>
                    </div>
                  </ModernCard>
                </>
              ) : (
                // 单条记录模式（原来的内容）
                <>
                  {/* 分组选择 */}
              <div className={showSuccess ? '-mt-4' : '-mt-16'} style={{ position: 'relative', zIndex: 10 }}>
                <ModernCard className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">选择分组</h3>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(TELEGRAM_CATEGORIES).map(([groupKey, groupInfo]) => (
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
                  选择具体分类 - {TELEGRAM_CATEGORIES[selectedGroup].name}
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {TELEGRAM_CATEGORIES[selectedGroup].items.map((category) => (
                    <button
                      key={category.code}
                      onClick={() => setSelectedCategory(category.code)}
                      className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                        selectedCategory === category.code
                          ? `${TELEGRAM_CATEGORIES[selectedGroup].bgColor} border-current ${TELEGRAM_CATEGORIES[selectedGroup].color.replace('bg-', 'text-')}`
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
                            <p className="text-sm text-blue-700">{TELEGRAM_CATEGORIES[selectedGroup].name}</p>
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
                </>
              )}

            </div>
          </div>
        </SmoothTransition>
      </Layout>
    </WebAppWrapper>
  )
}