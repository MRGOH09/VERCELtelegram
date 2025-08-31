import { useState, useEffect, useRef } from 'react'

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [touchStart, setTouchStart] = useState(0)
  const containerRef = useRef(null)
  
  const threshold = 80 // 触发刷新的阈值
  const maxPull = 120 // 最大下拉距离

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let startY = 0
    let currentY = 0

    const handleTouchStart = (e) => {
      if (container.scrollTop === 0) {
        startY = e.touches[0].pageY
        setTouchStart(startY)
      }
    }

    const handleTouchMove = (e) => {
      if (!startY) return
      
      currentY = e.touches[0].pageY
      const distance = currentY - startY
      
      if (distance > 0 && container.scrollTop === 0) {
        e.preventDefault()
        const actualDistance = Math.min(distance * 0.5, maxPull) // 添加阻尼效果
        setPullDistance(actualDistance)
      }
    }

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true)
        setPullDistance(60) // 保持在刷新位置
        
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setPullDistance(0)
      }
      
      startY = 0
      setTouchStart(0)
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pullDistance, isRefreshing, onRefresh])

  const getRefreshIcon = () => {
    if (isRefreshing) {
      return '🔄'
    } else if (pullDistance >= threshold) {
      return '↑'
    } else if (pullDistance > 20) {
      return '↓'
    }
    return ''
  }

  const getRefreshText = () => {
    if (isRefreshing) {
      return '正在刷新...'
    } else if (pullDistance >= threshold) {
      return '松开刷新'
    } else if (pullDistance > 20) {
      return '下拉刷新'
    }
    return ''
  }

  return (
    <div 
      ref={containerRef}
      className="relative h-full overflow-y-auto"
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: touchStart ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {/* 刷新指示器 */}
      <div 
        className="absolute top-0 left-0 right-0 flex flex-col items-center justify-center pointer-events-none"
        style={{
          height: `${pullDistance}px`,
          marginTop: `-${pullDistance}px`,
          opacity: Math.min(pullDistance / threshold, 1)
        }}
      >
        <div className={`text-2xl mb-1 ${isRefreshing ? 'animate-spin' : ''}`}>
          {getRefreshIcon()}
        </div>
        <div className="text-sm text-gray-600">
          {getRefreshText()}
        </div>
      </div>
      
      {/* 主要内容 */}
      {children}
    </div>
  )
}