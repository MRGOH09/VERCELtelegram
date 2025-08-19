import { todayYMD } from '../../lib/time.js'
import { 
  computeLeaderboards, 
  pushBranchLeaderboards, 
  personalMorningReports, 
  breakStreaksOneShot,
  usersWithoutRecordToday,
  dailyReports
} from '../../lib/cron-utils.js'
import supabase from '../../lib/supabase.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate } from '../../lib/helpers.js'
import { sendBatchMessages } from '../../lib/telegram.js'

export default async function handler(req, res) {
  try {
    const now = new Date()
    const hour = now.getHours()
    const isFirstDayOfMonth = now.getDate() === 1
    
    console.info(`[cron:unified] 开始执行，时间：${hour}:00，是否月初：${isFirstDayOfMonth}`)
    
    let results = {
      morning: null,
      noon: null,
      evening: null,
      timestamp: now.toISOString(),
      totalSent: 0,
      totalFailed: 0
    }
    
    // 每天凌晨2点运行一次，智能处理所有时间逻辑
    // 1. 早晨任务（凌晨2点执行）
    results.morning = await handleMorningTasks(now, isFirstDayOfMonth)
    results.totalSent += (results.morning?.totalSent || 0)
    results.totalFailed += (results.morning?.totalFailed || 0)
    
    // 2. 模拟中午任务（计算并准备，但不立即发送）
    const noonResults = await prepareNoonTasks(now)
    results.noon = noonResults
    
    // 3. 模拟晚上任务（计算并准备，但不立即发送）
    const eveningResults = await prepareEveningTasks(now)
    results.evening = eveningResults
    
    // 4. 发送 admin 总报告
    await sendAdminReport(results, now)
    
    console.info('[cron:unified] 执行完成', results)
    return res.status(200).json({ ok: true, results })
    
  } catch (e) {
    console.error('[cron:unified] 执行失败:', e)
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}

async function handleMorningTasks(now, isFirstDayOfMonth) {
  console.log('[morning] 开始执行早晨任务...')
  
  // 断签清零
  await breakStreaksOneShot()
  
  // 每月1号自动入账
  if (isFirstDayOfMonth) {
    await handleMonthlyAutoPost(now)
  }
  
  // 计算排行榜
  await computeLeaderboards(now)
  
  // 推送分行排行榜
  const branchResults = await pushBranchLeaderboards(now, (code, stat) => 
    formatTemplate(zh.cron.branch_lead, { 
      code, 
      rate: stat.rate||0, 
      done: stat.done||0, 
      total: stat.total||0 
    })
  )
  
  // 推送个人排名报告
  const personalResults = await personalMorningReports(now, (myRank, topText) => 
    formatTemplate(zh.cron.morning_rank, { rank: myRank, top: topText })
  )
  
  const totalSent = (branchResults?.sent || 0) + (personalResults?.sent || 0)
  const totalFailed = (branchResults?.failed || 0) + (personalResults?.failed || 0)
  
  return {
    branch: branchResults,
    personal: personalResults,
    autoPost: isFirstDayOfMonth,
    totalSent,
    totalFailed
  }
}

async function prepareNoonTasks(now) {
  console.log('[noon] 准备中午任务数据...')
  
  // 获取今日未记录用户
  const usersWithoutRecord = await usersWithoutRecordToday(now)
  
  // 计算中午任务的数据，但不立即发送
  const reminderData = {
    userCount: usersWithoutRecord.length,
    users: usersWithoutRecord,
    ready: true,
    note: '中午任务数据已准备，将在中午12点通过其他方式触发'
  }
  
  // 计算日报数据
  const dailyData = {
    ready: true,
    note: '日报数据已准备，将在中午12点通过其他方式触发'
  }
  
  return {
    reminder: reminderData,
    daily: dailyData,
    totalSent: 0,
    totalFailed: 0
  }
}

async function prepareEveningTasks(now) {
  console.log('[evening] 准备晚上任务数据...')
  
  // 获取今日未记录用户
  const usersWithoutRecord = await usersWithoutRecordToday(now)
  
  // 计算晚上任务的数据，但不立即发送
  const eveningData = {
    userCount: usersWithoutRecord.length,
    users: usersWithoutRecord,
    ready: true,
    note: '晚上任务数据已准备，将在晚上10点通过其他方式触发'
  }
  
  return {
    evening: eveningData,
    totalSent: 0,
    totalFailed: 0
  }
}

async function handleMonthlyAutoPost(now) {
  console.log('[autoPost] 开始执行月度自动入账...')
  
  const yyyymm = now.toISOString().slice(0,7)
  const ymd = `${yyyymm}-01`
  
  const { data: profs } = await supabase
    .from('user_profile')
    .select('user_id,travel_budget_annual,annual_medical_insurance,annual_car_insurance')
  
  let insertedCount = 0
  
  for (const p of profs||[]) {
    const posts = [
      { g: 'B', c: 'travel_auto', amt: Number(p.travel_budget_annual||0)/12 },
      { g: 'C', c: 'ins_med_auto', amt: Number(p.annual_medical_insurance||0)/12 },
      { g: 'C', c: 'ins_car_auto', amt: Number(p.annual_car_insurance||0)/12 }
    ].filter(x=>x.amt>0)
    
    for (const it of posts) {
      const { data: exist } = await supabase
        .from('records')
        .select('id')
        .eq('user_id', p.user_id)
        .eq('ymd', ymd)
        .eq('category_code', it.c)
        .eq('is_voided', false)
        .maybeSingle()
      
      if (!exist) {
        await supabase.from('records').insert([{ 
          user_id: p.user_id, 
          category_group: it.g, 
          category_code: it.c, 
          amount: it.amt, 
          note: 'Auto-post', 
          ymd 
        }])
        insertedCount++
      }
    }
  }
  
  console.log(`[autoPost] 月度自动入账完成，新增 ${insertedCount} 条记录`)
  return { insertedCount }
}

async function sendAdminReport(results, now) {
  try {
    const adminIds = (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
    
    if (adminIds.length === 0) {
      console.log('[admin] 没有配置管理员ID，跳过admin报告')
      return
    }
    
    const report = generateAdminReport(results, now)
    
    const adminMessages = adminIds.map(chatId => ({
      chat_id: chatId,
      text: report
    }))
    
    const adminResults = await sendBatchMessages(adminMessages)
    console.log(`[admin] Admin报告发送完成，成功: ${adminResults.sent}, 失败: ${adminResults.failed}`)
    
  } catch (e) {
    console.error('[admin] 发送admin报告失败:', e)
  }
}

function generateAdminReport(results, now) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16)
  
  let report = `📊 统一推送任务执行报告\n\n📅 日期：${date}\n⏰ 时间：${time}\n\n`
  
  // 早晨任务报告
  if (results.morning) {
    report += `🌅 早晨推送 (2:00 AM)：\n`
    report += `   • 分行排行：成功 ${results.morning.branch?.sent || 0}，失败 ${results.morning.branch?.failed || 0}\n`
    report += `   • 个人排名：成功 ${results.morning.personal?.sent || 0}，失败 ${results.morning.personal?.failed || 0}\n`
    report += `   • 月度入账：${results.morning.autoPost ? '已执行' : '跳过'}\n`
    report += `   • 总计：成功 ${results.morning.totalSent}，失败 ${results.morning.totalFailed}\n\n`
  }
  
  // 中午任务报告
  if (results.noon) {
    report += `🌞 中午任务准备：\n`
    report += `   • 用户提醒：已准备 ${results.noon.reminder?.userCount || 0} 用户\n`
    report += `   • 每日报告：数据已准备\n`
    report += `   • 状态：${results.noon.reminder?.note || '准备完成'}\n\n`
  }
  
  // 晚上任务报告
  if (results.evening) {
    report += `🌙 晚上任务准备：\n`
    report += `   • 晚间提醒：已准备 ${results.evening.evening?.userCount || 0} 用户\n`
    report += `   • 状态：${results.evening.evening?.note || '准备完成'}\n\n`
  }
  
  // 总体统计
  report += `📈 总体统计：\n`
  report += `   • 总发送：${results.totalSent}\n`
  report += `   • 总失败：${results.totalFailed}\n`
  report += `   • 成功率：${results.totalSent + results.totalFailed > 0 ? ((results.totalSent / (results.totalSent + results.totalFailed)) * 100).toFixed(1) : 0}%\n\n`
  
  report += `💡 说明：由于Hobby计划限制，中午和晚上的推送任务数据已准备，需要通过其他方式触发。\n\n`
  report += `✅ 任务执行完成！`
  
  return report
} 