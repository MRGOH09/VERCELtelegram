// 统一的日期处理工具函数
// 解决时区不一致导致的数据显示问题

/**
 * 获取马来西亚本地时间的YMD格式 (UTC+8)
 * @param {Date} date - 可选，默认为当前时间
 * @returns {string} YYYY-MM-DD格式的日期字符串
 */
export function getLocalYMD(date = new Date()) {
  // 马来西亚时区 UTC+8
  const malaysiaOffset = 8 * 60 * 60 * 1000
  const malaysiaTime = new Date(date.getTime() + malaysiaOffset)
  return malaysiaTime.toISOString().slice(0, 10)
}

/**
 * 获取指定月份的日期范围 - 完全模仿Telegram逻辑
 * @param {string} month - YYYY-MM格式
 * @returns {object} {startDate, endDate}
 */
export function getMonthRange(month) {
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  
  const year = parseInt(month.split('-')[0])
  const monthNum = parseInt(month.split('-')[1])
  
  const startDate = `${month}-01`
  
  let endDate
  if (month === currentMonth) {
    // 如果是当前月份，查询到今天 (模仿Telegram逻辑)
    endDate = today.toISOString().slice(0, 10)
  } else {
    // 如果是历史月份，查询整个月
    const lastDay = new Date(year, monthNum, 0).getDate()
    endDate = `${month}-${lastDay.toString().padStart(2, '0')}`
  }
  
  return { startDate, endDate }
}

/**
 * 验证日期格式
 * @param {string} ymd - YYYY-MM-DD格式
 * @returns {boolean}
 */
export function isValidYMD(ymd) {
  if (!ymd || typeof ymd !== 'string') return false
  
  const pattern = /^\d{4}-\d{2}-\d{2}$/
  if (!pattern.test(ymd)) return false
  
  // 验证日期是否真实存在
  const date = new Date(ymd + 'T00:00:00.000Z')
  return date.toISOString().slice(0, 10) === ymd
}

/**
 * 格式化显示日期（本地化）
 * @param {string} ymd - YYYY-MM-DD格式
 * @returns {string} 本地化的日期字符串
 */
export function formatDisplayDate(ymd) {
  if (!isValidYMD(ymd)) return ymd || 'Invalid Date'
  
  const date = new Date(ymd + 'T00:00:00.000Z')
  const now = new Date()
  const diffTime = Math.abs(now - date)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 1) return '今天'
  if (diffDays === 2) return '昨天'
  if (diffDays <= 7) return `${diffDays}天前`
  
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

/**
 * 转换UTC时间戳为本地YMD
 * @param {string} isoString - ISO时间戳
 * @returns {string} YYYY-MM-DD格式
 */
export function utcToLocalYMD(isoString) {
  if (!isoString) return getLocalYMD()
  
  const date = new Date(isoString)
  return getLocalYMD(date)
}

// 导出默认的日期工具对象
export default {
  getLocalYMD,
  getMonthRange,
  isValidYMD,
  formatDisplayDate,
  utcToLocalYMD
}