import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ModernCard from '../components/ModernCard'
import { SmoothTransition } from '../components/SmoothTransition'
import WebAppWrapper from '../components/WebAppWrapper'
import BrandHeader from '../components/BrandHeader'

export default function CalculatorPage() {
  const router = useRouter()
  const [display, setDisplay] = useState('0')
  const [previousValue, setPreviousValue] = useState('')
  const [operation, setOperation] = useState('')
  const [waitingForNewValue, setWaitingForNewValue] = useState(false)
  const [history, setHistory] = useState([])

  // 处理数字输入
  const inputNumber = (num) => {
    if (waitingForNewValue) {
      setDisplay(String(num))
      setWaitingForNewValue(false)
    } else {
      setDisplay(display === '0' ? String(num) : display + num)
    }
  }

  // 处理小数点
  const inputDecimal = () => {
    if (waitingForNewValue) {
      setDisplay('0.')
      setWaitingForNewValue(false)
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.')
    }
  }

  // 清除功能
  const clear = () => {
    setDisplay('0')
    setPreviousValue('')
    setOperation('')
    setWaitingForNewValue(false)
  }

  // 删除最后一位
  const deleteLast = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1))
    } else {
      setDisplay('0')
    }
  }

  // 处理运算操作
  const performOperation = (nextOperation) => {
    const inputValue = parseFloat(display)

    if (previousValue === '') {
      setPreviousValue(inputValue)
    } else if (operation) {
      const currentValue = previousValue || 0
      const newValue = calculate(currentValue, inputValue, operation)

      setDisplay(String(newValue))
      setPreviousValue(newValue)
      
      // 添加到历史记录
      const calculation = `${currentValue} ${operation} ${inputValue} = ${newValue}`
      setHistory(prev => [calculation, ...prev.slice(0, 9)]) // 保留最近10条记录
    }

    setWaitingForNewValue(true)
    setOperation(nextOperation)
  }

  // 计算结果
  const calculate = (firstValue, secondValue, operation) => {
    switch (operation) {
      case '+':
        return firstValue + secondValue
      case '-':
        return firstValue - secondValue
      case '×':
        return firstValue * secondValue
      case '÷':
        return firstValue / secondValue
      case '%':
        return firstValue % secondValue
      default:
        return secondValue
    }
  }

  // 等于操作
  const performEqual = () => {
    if (operation && previousValue !== '') {
      performOperation('')
    }
  }

  // 键盘支持
  useEffect(() => {
    const handleKeyPress = (event) => {
      const { key } = event
      
      if (!isNaN(key)) {
        inputNumber(parseInt(key))
      } else if (key === '.') {
        inputDecimal()
      } else if (key === '+') {
        performOperation('+')
      } else if (key === '-') {
        performOperation('-')
      } else if (key === '*') {
        performOperation('×')
      } else if (key === '/') {
        event.preventDefault()
        performOperation('÷')
      } else if (key === '%') {
        performOperation('%')
      } else if (key === 'Enter' || key === '=') {
        performEqual()
      } else if (key === 'Escape' || key === 'c' || key === 'C') {
        clear()
      } else if (key === 'Backspace') {
        deleteLast()
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [display, operation, previousValue, waitingForNewValue])

  // 格式化显示数字
  const formatDisplay = (value) => {
    if (value.length > 12) {
      const num = parseFloat(value)
      if (Math.abs(num) >= 1e12) {
        return num.toExponential(4)
      } else {
        return num.toPrecision(6)
      }
    }
    return value
  }

  const buttonClass = "h-16 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md"

  return (
    <WebAppWrapper>
      <Layout title="计算器 - Learner Club">
        <BrandHeader />
        
        <SmoothTransition>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="px-4 py-6 space-y-6">
              
              {/* 页面标题 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => router.back()}
                    className="w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
                  >
                    <span className="text-gray-600">←</span>
                  </button>
                  <h1 className="text-2xl font-bold text-gray-900">🧮 计算器</h1>
                </div>
              </div>

              {/* 计算器主体 */}
              <ModernCard className="p-6">
                
                {/* 显示屏 */}
                <div className="bg-gray-900 rounded-xl p-6 mb-6">
                  <div className="text-right">
                    {/* 运算表达式显示 */}
                    {operation && previousValue && (
                      <div className="text-gray-400 text-sm mb-1">
                        {previousValue} {operation}
                      </div>
                    )}
                    
                    {/* 主显示 */}
                    <div className="text-white text-4xl font-light leading-none">
                      {formatDisplay(display)}
                    </div>
                  </div>
                </div>

                {/* 按钮区域 */}
                <div className="grid grid-cols-4 gap-3">
                  
                  {/* 第一行 - 清除和删除 */}
                  <button
                    onClick={clear}
                    className={`${buttonClass} col-span-2 bg-red-500 hover:bg-red-600 text-white`}
                  >
                    清除 (C)
                  </button>
                  <button
                    onClick={deleteLast}
                    className={`${buttonClass} bg-orange-500 hover:bg-orange-600 text-white`}
                  >
                    ⌫
                  </button>
                  <button
                    onClick={() => performOperation('÷')}
                    className={`${buttonClass} bg-blue-500 hover:bg-blue-600 text-white`}
                  >
                    ÷
                  </button>

                  {/* 第二行 - 7, 8, 9, × */}
                  <button
                    onClick={() => inputNumber(7)}
                    className={`${buttonClass} bg-white hover:bg-gray-50 text-gray-900 border border-gray-200`}
                  >
                    7
                  </button>
                  <button
                    onClick={() => inputNumber(8)}
                    className={`${buttonClass} bg-white hover:bg-gray-50 text-gray-900 border border-gray-200`}
                  >
                    8
                  </button>
                  <button
                    onClick={() => inputNumber(9)}
                    className={`${buttonClass} bg-white hover:bg-gray-50 text-gray-900 border border-gray-200`}
                  >
                    9
                  </button>
                  <button
                    onClick={() => performOperation('×')}
                    className={`${buttonClass} bg-blue-500 hover:bg-blue-600 text-white`}
                  >
                    ×
                  </button>

                  {/* 第三行 - 4, 5, 6, - */}
                  <button
                    onClick={() => inputNumber(4)}
                    className={`${buttonClass} bg-white hover:bg-gray-50 text-gray-900 border border-gray-200`}
                  >
                    4
                  </button>
                  <button
                    onClick={() => inputNumber(5)}
                    className={`${buttonClass} bg-white hover:bg-gray-50 text-gray-900 border border-gray-200`}
                  >
                    5
                  </button>
                  <button
                    onClick={() => inputNumber(6)}
                    className={`${buttonClass} bg-white hover:bg-gray-50 text-gray-900 border border-gray-200`}
                  >
                    6
                  </button>
                  <button
                    onClick={() => performOperation('-')}
                    className={`${buttonClass} bg-blue-500 hover:bg-blue-600 text-white`}
                  >
                    -
                  </button>

                  {/* 第四行 - 1, 2, 3, + */}
                  <button
                    onClick={() => inputNumber(1)}
                    className={`${buttonClass} bg-white hover:bg-gray-50 text-gray-900 border border-gray-200`}
                  >
                    1
                  </button>
                  <button
                    onClick={() => inputNumber(2)}
                    className={`${buttonClass} bg-white hover:bg-gray-50 text-gray-900 border border-gray-200`}
                  >
                    2
                  </button>
                  <button
                    onClick={() => inputNumber(3)}
                    className={`${buttonClass} bg-white hover:bg-gray-50 text-gray-900 border border-gray-200`}
                  >
                    3
                  </button>
                  <button
                    onClick={() => performOperation('+')}
                    className={`${buttonClass} bg-blue-500 hover:bg-blue-600 text-white`}
                  >
                    +
                  </button>

                  {/* 第五行 - 0, ., %, = */}
                  <button
                    onClick={() => inputNumber(0)}
                    className={`${buttonClass} col-span-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-200`}
                  >
                    0
                  </button>
                  <button
                    onClick={inputDecimal}
                    className={`${buttonClass} bg-white hover:bg-gray-50 text-gray-900 border border-gray-200`}
                  >
                    .
                  </button>
                  <button
                    onClick={performEqual}
                    className={`${buttonClass} bg-green-500 hover:bg-green-600 text-white`}
                  >
                    =
                  </button>
                </div>
              </ModernCard>

              {/* 历史记录 */}
              {history.length > 0 && (
                <ModernCard className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    📝 计算历史
                    <button
                      onClick={() => setHistory([])}
                      className="ml-auto text-sm text-red-500 hover:text-red-600"
                    >
                      清空历史
                    </button>
                  </h3>
                  <div className="space-y-2">
                    {history.map((calc, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-600 py-2 px-3 bg-gray-50 rounded-lg font-mono"
                      >
                        {calc}
                      </div>
                    ))}
                  </div>
                </ModernCard>
              )}

              {/* 使用提示 */}
              <ModernCard className="p-4 bg-blue-50 border-blue-200">
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-2">💡 使用提示：</p>
                  <ul className="space-y-1 text-blue-700">
                    <li>• <strong>键盘支持</strong>：可使用数字键、运算符号和回车键</li>
                    <li>• <strong>快捷键</strong>：C键清除，Backspace删除，ESC重置</li>
                    <li>• <strong>历史记录</strong>：自动保存最近10次计算结果</li>
                    <li>• <strong>科学计数</strong>：支持大数字的科学计数法显示</li>
                  </ul>
                </div>
              </ModernCard>
            </div>
          </div>
        </SmoothTransition>
      </Layout>
    </WebAppWrapper>
  )
}