import { useState } from 'react'
import Head from 'next/head'

export default function TestBudgetDisplay() {
  // 模拟数据
  const mockData = {
    monthlyIncome: 5000,
    monthlyBudget: 3000,  // 月预算
    spent: 1850,          // 已花费
    remaining: 1150,      // 剩余
    daysInMonth: 31,      // 本月天数
    currentDay: 15,       // 当前是第15天
    daysRemaining: 16     // 剩余16天
  }

  const [selectedOption, setSelectedOption] = useState(null)

  // 方案A：大字突出剩余金额 + 进度条
  const OptionA = () => (
    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium opacity-90">本月还可以花</h3>
        <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
          还剩 {mockData.daysRemaining} 天
        </span>
      </div>
      
      <div className="text-4xl font-bold mb-4">
        RM {mockData.remaining.toLocaleString()}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm opacity-90">
          <span>预算进度</span>
          <span>{((mockData.spent / mockData.monthlyBudget) * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-3">
          <div 
            className="bg-white rounded-full h-3 transition-all duration-500"
            style={{ width: `${(mockData.spent / mockData.monthlyBudget) * 100}%` }}
          />
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="opacity-70">月预算</div>
          <div className="font-semibold">RM {mockData.monthlyBudget}</div>
        </div>
        <div>
          <div className="opacity-70">已支出</div>
          <div className="font-semibold">RM {mockData.spent}</div>
        </div>
      </div>
    </div>
  )

  // 方案B：卡片式显示每日可用金额
  const OptionB = () => {
    const dailyBudget = mockData.remaining / mockData.daysRemaining
    const recommendedDaily = mockData.monthlyBudget / mockData.daysInMonth
    
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">剩余预算</p>
              <p className="text-3xl font-bold">RM {mockData.remaining}</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">剩余天数</p>
              <p className="text-2xl font-bold">{mockData.daysRemaining} 天</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white text-xl">
                💰
              </div>
              <div>
                <p className="text-sm text-gray-600">每日可用</p>
                <p className="text-xl font-bold text-green-600">
                  RM {dailyBudget.toFixed(0)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">建议每日</p>
              <p className="text-sm text-gray-600">RM {recommendedDaily.toFixed(0)}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">今日已花</p>
              <p className="font-semibold">RM 85</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">本周已花</p>
              <p className="font-semibold">RM 420</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">本月已花</p>
              <p className="font-semibold">RM {mockData.spent}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 方案C：仪表盘风格
  const OptionC = () => {
    const percentUsed = (mockData.spent / mockData.monthlyBudget) * 100
    const percentRemaining = 100 - percentUsed
    const dailyBudget = mockData.remaining / mockData.daysRemaining
    
    // 根据剩余比例决定颜色
    const getColor = () => {
      if (percentRemaining > 50) return 'from-green-400 to-green-600'
      if (percentRemaining > 25) return 'from-yellow-400 to-orange-500'
      return 'from-red-400 to-red-600'
    }
    
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">预算控制台</h3>
        
        <div className="relative mb-6">
          {/* 半圆仪表盘 */}
          <div className="relative w-48 h-24 mx-auto">
            <svg className="w-full h-full" viewBox="0 0 200 100">
              {/* 背景弧 */}
              <path
                d="M 20 90 A 80 80 0 0 1 180 90"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="20"
                strokeLinecap="round"
              />
              {/* 进度弧 */}
              <path
                d="M 20 90 A 80 80 0 0 1 180 90"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${251 * (percentUsed / 100)} 251`}
              />
              <defs>
                <linearGradient id="gradient">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center mt-2">
              <div className="text-3xl font-bold text-gray-800">
                {percentRemaining.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500">剩余</div>
            </div>
          </div>
        </div>
        
        <div className={`bg-gradient-to-r ${getColor()} rounded-xl p-4 text-white mb-4`}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm opacity-90">可用余额</p>
              <p className="text-2xl font-bold">RM {mockData.remaining}</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">建议日均</p>
              <p className="text-xl font-bold">RM {dailyBudget.toFixed(0)}</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">预算</span>
              <span className="font-semibold">RM {mockData.monthlyBudget}</span>
            </div>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">已花</span>
              <span className="font-semibold text-red-600">RM {mockData.spent}</span>
            </div>
          </div>
        </div>
        
        {percentRemaining < 30 && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ 预算使用超过70%，请注意控制支出
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>预算显示测试 - 选择您喜欢的样式</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              预算显示方案测试
            </h1>
            <p className="text-gray-600">
              请选择您喜欢的"还可以花多少钱"显示方式
            </p>
            
            {selectedOption && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-blue-800">
                  您选择了：<strong>方案 {selectedOption}</strong>
                </p>
              </div>
            )}
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* 方案A */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">
                  方案 A：突出剩余金额
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  大字显示剩余金额，配合进度条展示预算使用情况
                </p>
                <OptionA />
                <button
                  onClick={() => setSelectedOption('A')}
                  className={`mt-4 w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    selectedOption === 'A' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  选择方案 A
                </button>
              </div>
            </div>
            
            {/* 方案B */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">
                  方案 B：每日预算指导
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  强调每日可用金额，帮助用户合理分配日常开支
                </p>
                <OptionB />
                <button
                  onClick={() => setSelectedOption('B')}
                  className={`mt-4 w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    selectedOption === 'B' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  选择方案 B
                </button>
              </div>
            </div>
            
            {/* 方案C */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">
                  方案 C：仪表盘风格
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  视觉化展示预算使用比例，直观显示剩余情况
                </p>
                <OptionC />
                <button
                  onClick={() => setSelectedOption('C')}
                  className={`mt-4 w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    selectedOption === 'C' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  选择方案 C
                </button>
              </div>
            </div>
          </div>
          
          {/* 对比说明 */}
          <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">方案对比</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">特点</th>
                    <th className="text-center py-2">方案 A</th>
                    <th className="text-center py-2">方案 B</th>
                    <th className="text-center py-2">方案 C</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">核心展示</td>
                    <td className="text-center">剩余总额</td>
                    <td className="text-center">每日可用</td>
                    <td className="text-center">使用比例</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">视觉风格</td>
                    <td className="text-center">简洁明快</td>
                    <td className="text-center">信息丰富</td>
                    <td className="text-center">仪表可视化</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">适合用户</td>
                    <td className="text-center">快速查看</td>
                    <td className="text-center">精细管理</td>
                    <td className="text-center">视觉导向</td>
                  </tr>
                  <tr>
                    <td className="py-2">预警提示</td>
                    <td className="text-center">进度条</td>
                    <td className="text-center">对比建议</td>
                    <td className="text-center">颜色+文字</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}