import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard from '../components/ModernCard'
import { SmoothTransition } from '../components/SmoothTransition'
import WebAppWrapper from '../components/WebAppWrapper'
import BrandHeader, { PageHeader } from '../components/BrandHeader'

// 车贷计算器组件
function LoanCalculator() {
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
      const totalInterest = principal * rate * years
      const totalPayment = principal + totalInterest
      const monthlyPayment = totalPayment / months
      const yearlyPayment = monthlyPayment * 12

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
    <div className="space-y-6">
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
        </div>
      </ModernCard>
    </div>
  )
}

// EPF计算器组件
function EPFCalculator() {
  const [formData, setFormData] = useState({
    currentAge: 17,
    startingSalary: 1700,
    salaryIncreaseRate: 3,
    epfReturn: 5.8
  })

  const [results, setResults] = useState(null)
  const [chartData, setChartData] = useState([])

  const EPF_CONTRIBUTION_RATE = 0.23
  const RETIREMENT_AGE = 55
  const FINAL_AGE = 90

  const calculateEPF = () => {
    const { currentAge, startingSalary, salaryIncreaseRate, epfReturn } = formData
    const salaryGrowthRate = salaryIncreaseRate / 100
    const returnRate = epfReturn / 100
    
    let totalBalance = 0
    let totalContributions = 0
    const yearlyData = []

    // 工作期间 (到55岁)
    for (let age = currentAge; age <= FINAL_AGE; age++) {
      if (age <= RETIREMENT_AGE) {
        // 55岁前：有工资和贡献
        const yearsWorked = age - currentAge
        const currentSalary = startingSalary * Math.pow(1 + salaryGrowthRate, yearsWorked)
        const yearlyContribution = currentSalary * 12 * EPF_CONTRIBUTION_RATE
        
        totalContributions += yearlyContribution
        totalBalance = (totalBalance + yearlyContribution / 2) * (1 + returnRate) + yearlyContribution / 2
      } else {
        // 55岁后：只有利息增长，没有新贡献
        totalBalance = totalBalance * (1 + returnRate)
      }
      
      const interest = totalBalance - totalContributions
      const currentSalary = age <= RETIREMENT_AGE 
        ? startingSalary * Math.pow(1 + salaryGrowthRate, age - currentAge)
        : 0
      
      yearlyData.push({
        age,
        年龄: age,
        总金额: Math.round(totalBalance),
        本金贡献: Math.round(totalContributions),
        利息收益: Math.round(interest),
        月薪: Math.round(currentSalary),
        年贡献: age <= RETIREMENT_AGE ? Math.round(currentSalary * 12 * EPF_CONTRIBUTION_RATE) : 0,
        阶段: age <= RETIREMENT_AGE ? '工作期' : '退休期'
      })
    }

    setResults({
      finalBalance: totalBalance,
      totalContributions,
      totalInterest: totalBalance - totalContributions,
      yearsToRetirement: RETIREMENT_AGE - currentAge,
      balanceAt55: yearlyData.find(d => d.年龄 === RETIREMENT_AGE)?.总金额 || 0,
      balanceAt90: totalBalance
    })

    setChartData(yearlyData)
  }

  useEffect(() => {
    calculateEPF()
  }, [formData])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }))
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* 输入参数 */}
      <ModernCard className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">🏦</span>
          EPF参数设置
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              当前年龄
            </label>
            <input
              type="number"
              value={formData.currentAge}
              onChange={(e) => handleInputChange('currentAge', e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="16"
              max="54"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              起薪 (RM/月)
            </label>
            <input
              type="number"
              value={formData.startingSalary}
              onChange={(e) => handleInputChange('startingSalary', e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              年薪增长率 (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.salaryIncreaseRate}
              onChange={(e) => handleInputChange('salaryIncreaseRate', e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              EPF年回报率 (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.epfReturn}
              onChange={(e) => handleInputChange('epfReturn', e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 bg-blue-50 p-4 rounded-xl">
          <h4 className="font-semibold text-blue-800 mb-2">💡 EPF贡献说明</h4>
          <p className="text-sm text-blue-700">
            • 员工贡献：11% | 雇主贡献：12% | 总贡献率：23%<br/>
            • 55岁退休后不再有新贡献，但余额继续产生利息至90岁
          </p>
        </div>
      </ModernCard>

      {/* 结果显示 */}
      {results && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ModernCard variant="gradient" className="p-6 text-white">
            <h3 className="text-lg font-semibold mb-4 opacity-90">
              🎯 55岁退休时
            </h3>
            <div className="text-3xl font-bold mb-2">{formatCurrency(results.balanceAt55)}</div>
            <p className="text-sm opacity-75">工作年限：{results.yearsToRetirement}年</p>
          </ModernCard>

          <ModernCard className="p-6 bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <h3 className="text-lg font-semibold mb-4 opacity-90">
              💰 90岁时总额
            </h3>
            <div className="text-3xl font-bold mb-2">{formatCurrency(results.balanceAt90)}</div>
            <p className="text-sm opacity-75">纯利息增长35年</p>
          </ModernCard>
        </div>
      )}

      {/* 累积趋势图表 */}
      {chartData.length > 0 && (
        <ModernCard className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📈 EPF累积趋势 (至90岁)
          </h3>
          
          <div className="overflow-x-auto">
            <div className="min-w-[600px] h-64 flex items-end space-x-1">
              {chartData.filter((_, i) => i % 2 === 0).map((data, index) => {
                const height = (data.总金额 / chartData[chartData.length - 1].总金额) * 100
                const isRetired = data.年龄 > RETIREMENT_AGE
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col items-center">
                      <div 
                        className={`w-full rounded-t transition-all duration-500 ${
                          isRetired ? 'bg-gradient-to-t from-green-500 to-green-400' : 'bg-gradient-to-t from-blue-500 to-blue-400'
                        }`}
                        style={{ height: `${height * 2}px` }}
                      />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {data.年龄}
                      {data.年龄 === RETIREMENT_AGE && '🎯'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
              <span className="text-gray-600">工作期 (贡献+利息)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
              <span className="text-gray-600">退休期 (纯利息)</span>
            </div>
          </div>
        </ModernCard>
      )}

      {/* 快捷输入 */}
      <ModernCard className="p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">快捷输入</h4>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-600 mb-2">常见起薪</p>
            <div className="flex flex-wrap gap-2">
              {['1500', '1700', '2000', '2500', '3000'].map(salary => (
                <button
                  key={salary}
                  onClick={() => setFormData(prev => ({ ...prev, startingSalary: parseFloat(salary) }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    formData.startingSalary === parseFloat(salary) 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  RM{salary}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <p className="text-xs text-gray-600 mb-2">EPF年回报率</p>
            <div className="flex flex-wrap gap-2">
              {['5.0', '5.5', '5.8', '6.0', '6.5'].map(rate => (
                <button
                  key={rate}
                  onClick={() => setFormData(prev => ({ ...prev, epfReturn: parseFloat(rate) }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    formData.epfReturn === parseFloat(rate) 
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
  )
}

// 主计算器页面
export default function CalculatorPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('loan')

  const tabs = [
    { id: 'loan', name: '车贷计算', icon: '🚗', color: 'blue' },
    { id: 'epf', name: 'EPF模拟', icon: '🏦', color: 'green' },
    { id: 'more', name: '更多', icon: '➕', color: 'gray', disabled: true }
  ]

  return (
    <WebAppWrapper>
      <Layout title="财务计算器 - Learner Club">
        <BrandHeader />
        
        <SmoothTransition>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            {/* 页面头部 */}
            <PageHeader 
              title={
                <div className="flex items-center space-x-2">
                  <span>🧮</span>
                  <span>财务计算器</span>
                </div>
              }
              subtitle="专业的财务规划工具集"
              onBack={() => router.back()}
            />
            
            <div className="px-4 pb-8 -mt-12 space-y-6">
              
              {/* 标签页选择器 - 放在顶部 */}
              <ModernCard className="p-2 relative z-20">
                <div className="flex space-x-2">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id
                    const activeClasses = {
                      'loan': 'bg-gradient-to-r from-blue-500 to-blue-600',
                      'epf': 'bg-gradient-to-r from-green-500 to-green-600',
                      'more': 'bg-gradient-to-r from-gray-500 to-gray-600'
                    }
                    
                    return (
                      <button
                        key={tab.id}
                        onClick={() => !tab.disabled && setActiveTab(tab.id)}
                        disabled={tab.disabled}
                        className={`
                          flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg
                          font-medium transition-all duration-200
                          ${isActive 
                            ? `${activeClasses[tab.id]} text-white shadow-lg transform scale-105` 
                            : tab.disabled 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md'
                          }
                        `}
                      >
                        <span className="text-lg">{tab.icon}</span>
                        <span className="text-sm">{tab.name}</span>
                        {tab.disabled && (
                          <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full ml-1">
                            即将推出
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </ModernCard>

              {/* 标签内容 */}
              <div className="transition-all duration-300">
                {activeTab === 'loan' && <LoanCalculator />}
                {activeTab === 'epf' && <EPFCalculator />}
                {activeTab === 'more' && (
                  <ModernCard className="p-12 text-center">
                    <div className="text-6xl mb-4">🚧</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      更多计算器即将推出
                    </h3>
                    <p className="text-gray-600">
                      我们正在开发更多实用的财务计算工具
                    </p>
                  </ModernCard>
                )}
              </div>

              {/* 底部说明 */}
              <ModernCard className="p-4 bg-yellow-50 border-yellow-200">
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-600 text-lg">⚠️</span>
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">免责声明</p>
                    <p>此计算器仅供参考，实际结果可能因政策、利率等因素有所不同。请咨询专业财务顾问获取准确建议。</p>
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