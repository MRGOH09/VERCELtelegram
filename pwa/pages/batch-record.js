import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard from '../components/ModernCard'
import { SmoothTransition } from '../components/SmoothTransition'
import WebAppWrapper from '../components/WebAppWrapper'
import PWAClient from '../lib/api'

// 与Telegram系统一致的分类
const TELEGRAM_CATEGORIES = {
  A: {
    name: '生活开销',
    icon: '🛒',
    color: 'text-red-600',
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
    color: 'text-blue-600',
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
    color: 'text-green-600',
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

export default function BatchRecordPage() {
  const router = useRouter()
  const [records, setRecords] = useState(() => 
    Array.from({ length: 5 }, (_, i) => createEmptyRecord(i))
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errors, setErrors] = useState({})

  // 更新记录
  const updateRecord = (index, field, value) => {
    setRecords(prev => prev.map((record, i) => {
      if (i === index) {
        const updated = { ...record, [field]: value }
        // 实时验证
        updated.isValid = updated.date && updated.amount && parseFloat(updated.amount) > 0
        return updated
      }
      return record
    }))
    
    // 清除该行错误
    if (errors[index]) {
      setErrors(prev => ({ ...prev, [index]: null }))
    }
  }

  // 获取所有分类选项
  const getAllCategories = (group) => {
    return TELEGRAM_CATEGORIES[group]?.items || []
  }

  // 计算总计
  const calculateTotal = () => {
    return records.reduce((total, record) => {
      const amount = parseFloat(record.amount) || 0
      return total + amount
    }, 0)
  }

  // 获取有效记录数
  const getValidRecordsCount = () => {
    return records.filter(record => record.isValid).length
  }

  // 验证并提交
  const handleSubmit = async () => {
    const validRecords = records.filter(record => record.isValid)
    
    if (validRecords.length === 0) {
      alert('请至少填写一条完整记录')
      return
    }

    try {
      setIsSubmitting(true)
      setErrors({})

      // 调用批量创建API
      await PWAClient.call('data', 'batch-add-records', { records: validRecords })

      // 显示成功状态
      setShowSuccess(true)
      
      // 重置表格
      setRecords(Array.from({ length: 5 }, (_, i) => createEmptyRecord(i)))
      
      // 2秒后隐藏成功提示
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

  // 清空表格
  const handleClear = () => {
    if (confirm('确定要清空所有记录吗？')) {
      setRecords(Array.from({ length: 5 }, (_, i) => createEmptyRecord(i)))
      setErrors({})
    }
  }

  return (
    <WebAppWrapper>
      <Layout title="批量记录 - Learner Club">
        <SmoothTransition>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            
            {/* 头部 */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => router.back()}
                    className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <span className="text-xl">←</span>
                  </button>
                  <div>
                    <h1 className="text-xl font-bold">📊 批量记录</h1>
                    <p className="text-blue-100 text-sm">表格式快速输入</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-3 pb-8 space-y-4">
              
              {/* 成功提示 */}
              {showSuccess && (
                <div className="-mt-4 relative z-20">
                  <ModernCard className="p-4 bg-green-50 border border-green-200 text-center">
                    <div className="text-3xl mb-2">✅</div>
                    <p className="text-green-800 font-semibold">批量记录成功！</p>
                    <p className="text-green-600 text-sm">已保存 {getValidRecordsCount()} 条记录</p>
                  </ModernCard>
                </div>
              )}

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
                  {records.map((record, index) => (
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
                          onChange={(e) => updateRecord(index, 'date', e.target.value)}
                          className="w-full text-xs p-1 border rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* 类型 */}
                      <div className="col-span-2">
                        <select
                          value={record.group}
                          onChange={(e) => {
                            updateRecord(index, 'group', e.target.value)
                            // 重置分类为该组的第一个
                            const firstCategory = TELEGRAM_CATEGORIES[e.target.value]?.items[0]?.code || ''
                            updateRecord(index, 'category', firstCategory)
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
                          onChange={(e) => updateRecord(index, 'category', e.target.value)}
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
                            onChange={(e) => updateRecord(index, 'amount', e.target.value)}
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
                          onChange={(e) => updateRecord(index, 'note', e.target.value)}
                          placeholder="备注"
                          className="w-full text-xs p-1 border rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ModernCard>

              {/* 操作按钮 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleClear}
                  disabled={isSubmitting}
                  className="py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  🗑️ 清空
                </button>
                
                <button
                  onClick={handleSubmit}
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

            </div>
          </div>
        </SmoothTransition>
      </Layout>
    </WebAppWrapper>
  )
}