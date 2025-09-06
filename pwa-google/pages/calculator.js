import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard from '../components/ModernCard'
import { SmoothTransition } from '../components/SmoothTransition'
import WebAppWrapper from '../components/WebAppWrapper'
import BrandHeader, { PageHeader } from '../components/BrandHeader'

export default function LoanCalculatorPage() {
  const router = useRouter()
  const [loanAmount, setLoanAmount] = useState('50000')
  const [loanTermYears, setLoanTermYears] = useState('5')
  const [flatRate, setFlatRate] = useState('2.20')
  
  const [results, setResults] = useState({
    monthlyPayment: 0,
    yearlyPayment: 0,
    totalPayment: 0,
    totalInterest: 0,
    yearlyBreakdown: []
  })

  useEffect(() => {
    const principal = parseFloat(loanAmount) || 0
    const years = parseFloat(loanTermYears) || 0
    const rate = parseFloat(flatRate) / 100 || 0
    const months = years * 12

    if (principal > 0 && years > 0) {
      // 固定利率计算
      const totalInterest = principal * rate * years
      const totalPayment = principal + totalInterest
      const monthlyPayment = totalPayment / months
      const yearlyPayment = monthlyPayment * 12

      // 计算每年的还款明细
      const yearlyBreakdown = []
      const principalPerYear = principal / years
      const interestPerYear = totalInterest / years
      
      for (let year = 1; year <= years; year++) {
        const remainingBalance = principal - (principalPerYear * (year - 1))
        const balanceAfterPayment = principal - (principalPerYear * year)
        
        yearlyBreakdown.push({
          year: year,
          startBalance: remainingBalance,
          principalPayment: principalPerYear,
          interestPayment: interestPerYear,
          totalYearlyPayment: yearlyPayment,
          endBalance: balanceAfterPayment > 0 ? balanceAfterPayment : 0
        })
      }

      setResults({
        monthlyPayment,
        yearlyPayment,
        totalPayment,
        totalInterest,
        yearlyBreakdown
      })
    }
  }, [loanAmount, loanTermYears, flatRate])

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  return (
    <WebAppWrapper>
      <Layout title="车贷计算器 - Learner Club">
        <BrandHeader />
        
        <SmoothTransition>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            {/* 页面头部 */}
            <PageHeader 
              title={
                <div className="flex items-center space-x-2">
                  <span>🚗</span>
                  <span>车贷还款计算器</span>
                </div>
              }
              subtitle="固定利率 - 每年供期与剩余欠款明细"
              onBack={() => router.back()}
            />
            
            <div className="px-4 pb-8 -mt-8 space-y-6">
              
              {/* 输入参数卡片 */}
              <ModernCard className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">💰</span>
                  贷款参数
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      贷款金额 (RM)
                    </label>
                    <input
                      type="number"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      placeholder="50000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      贷款期限 (年)
                    </label>
                    <input
                      type="number"
                      value={loanTermYears}
                      onChange={(e) => setLoanTermYears(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      placeholder="5"
                      step="0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      固定利率 (% 年利率)
                    </label>
                    <input
                      type="number"
                      value={flatRate}
                      onChange={(e) => setFlatRate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      placeholder="2.20"
                      step="0.01"
                    />
                  </div>
                </div>
              </ModernCard>

              {/* 快速总览卡片 */}
              <ModernCard variant="gradient" className="p-6 text-white">
                <h3 className="text-lg font-semibold mb-4 opacity-90 flex items-center">
                  <span className="mr-2">📊</span>
                  快速总览
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                    <div className="text-xs opacity-75 mb-1">月供</div>
                    <div className="text-lg font-bold break-all">
                      RM {formatCurrency(results.monthlyPayment)}
                    </div>
                  </div>
                  
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                    <div className="text-xs opacity-75 mb-1">年供</div>
                    <div className="text-lg font-bold break-all">
                      RM {formatCurrency(results.yearlyPayment)}
                    </div>
                  </div>
                  
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                    <div className="text-xs opacity-75 mb-1">总利息</div>
                    <div className="text-lg font-bold break-all">
                      RM {formatCurrency(results.totalInterest)}
                    </div>
                  </div>
                  
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                    <div className="text-xs opacity-75 mb-1">总还款</div>
                    <div className="text-lg font-bold break-all">
                      RM {formatCurrency(results.totalPayment)}
                    </div>
                  </div>
                </div>
              </ModernCard>

              {/* 年度明细表格 */}
              <ModernCard className="overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <span className="mr-2">📅</span>
                    每年还款明细
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">年份</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700">年初欠款</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700">本金</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700">利息</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700">年供</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700">年末欠款</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {results.yearlyBreakdown.map((year, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900">
                            第{year.year}年
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-gray-700">
                            {formatCurrency(year.startBalance)}
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-green-600 font-medium">
                            {formatCurrency(year.principalPayment)}
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-red-600 font-medium">
                            {formatCurrency(year.interestPayment)}
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-blue-600 font-bold">
                            {formatCurrency(year.totalYearlyPayment)}
                          </td>
                          <td className="px-3 py-3 text-sm text-right font-medium">
                            {year.endBalance > 0 ? (
                              <span className="text-gray-900">{formatCurrency(year.endBalance)}</span>
                            ) : (
                              <span className="text-green-600 font-bold">已还清</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ModernCard>

              {/* 欠款变化趋势 */}
              <ModernCard className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">📉</span>
                  欠款变化趋势
                </h3>
                
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-end justify-between h-40 relative">
                    {results.yearlyBreakdown.map((year, index) => {
                      const heightPercent = Math.max(5, (year.startBalance / parseFloat(loanAmount)) * 100)
                      return (
                        <div key={index} className="flex flex-col items-center flex-1 relative">
                          <div className="w-full px-1 flex flex-col items-center">
                            <div className="text-xs text-gray-600 mb-1">
                              {(year.startBalance / 1000).toFixed(0)}k
                            </div>
                            <div 
                              className="bg-gradient-to-t from-blue-500 to-blue-400 w-full rounded-t transition-all duration-500 shadow-sm"
                              style={{ height: `${heightPercent}px` }}
                            />
                          </div>
                          <div className="text-xs text-gray-600 mt-2 font-medium">Y{year.year}</div>
                        </div>
                      )
                    })}
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-full px-1 flex flex-col items-center">
                        <div className="text-xs text-green-600 font-bold mb-1">0</div>
                        <div 
                          className="bg-gradient-to-t from-green-500 to-green-400 w-full rounded-t shadow-sm"
                          style={{ height: '5px' }}
                        />
                      </div>
                      <div className="text-xs text-green-600 mt-2 font-bold">完成</div>
                    </div>
                  </div>
                </div>
              </ModernCard>

              {/* 固定利率说明 */}
              <ModernCard className="p-4 bg-yellow-50 border-yellow-200">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">💡</span>
                  固定利率说明
                </h4>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>每年本金还款固定：<strong className="text-green-600">RM {formatCurrency(parseFloat(loanAmount) / parseFloat(loanTermYears) || 0)}</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>每年利息固定：<strong className="text-red-600">RM {formatCurrency(parseFloat(loanAmount) * parseFloat(flatRate) / 100 || 0)}</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>利息始终按原始贷款金额 <strong>RM {formatCurrency(parseFloat(loanAmount) || 0)}</strong> 计算</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>月供固定：<strong className="text-blue-600">RM {formatCurrency(results.monthlyPayment)}</strong> × 12个月 = <strong className="text-blue-600">RM {formatCurrency(results.yearlyPayment)}</strong></span>
                  </li>
                </ul>
              </ModernCard>

              {/* 快捷输入按钮 */}
              <ModernCard className="p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">快捷输入</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-600 mb-2">常见贷款金额</p>
                    <div className="flex flex-wrap gap-2">
                      {['30000', '50000', '80000', '100000', '150000'].map(amount => (
                        <button
                          key={amount}
                          onClick={() => setLoanAmount(amount)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            loanAmount === amount 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {parseInt(amount) >= 1000 ? `${parseInt(amount)/1000}k` : amount}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600 mb-2">贷款期限</p>
                    <div className="flex flex-wrap gap-2">
                      {['3', '5', '7', '9'].map(years => (
                        <button
                          key={years}
                          onClick={() => setLoanTermYears(years)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            loanTermYears === years 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {years}年
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600 mb-2">常见利率</p>
                    <div className="flex flex-wrap gap-2">
                      {['2.00', '2.20', '2.50', '2.80', '3.00'].map(rate => (
                        <button
                          key={rate}
                          onClick={() => setFlatRate(rate)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            flatRate === rate 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </ModernCard>
            </div>
          </div>
        </SmoothTransition>
      </Layout>
    </WebAppWrapper>
  )
}