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
    
    // 凌晨 2:00 - 早晨推送 + 断签清零
    if (hour === 2) {
      results.morning = await handleMorningTasks(now, isFirstDayOfMonth)
      results.totalSent += (results.morning?.totalSent || 0)
      results.totalFailed += (results.morning?.totalFailed || 0)
    }
    
    // 中午 12:00 - 提醒 + 日报
    if (hour === 12) {
      results.noon = await handleNoonTasks(now)
      results.totalSent += (results.noon?.totalSent || 0)
      results.totalFailed += (results.noon?.totalFailed || 0)
    }
    
    // 晚上 10:00 - 晚间提醒
if (hour === 22) {
  results.evening = await handleEveningTasks(now)
  results.totalSent += (results.evening?.totalSent || 0)
  results.totalFailed += (results.evening?.totalFailed || 0)
}
    
    // 发送 admin 总报告
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

async function handleNoonTasks(now) {
  console.log('[noon] 开始执行中午任务...')
  
  // 获取今日未记录用户
  const usersWithoutRecord = await usersWithoutRecordToday(now)
  
  // 生成个性化提醒消息
  const reminderMessages = usersWithoutRecord.map(chatId => ({
    chat_id: chatId,
    text: generatePersonalizedReminder(chatId, now)
  }))
  
  // 发送提醒消息
  const reminderResults = await sendBatchMessages(reminderMessages)
  
  // 发送日报（包含分行排行和个人排行）
  const dailyResults = await dailyReports(now, ({a,b,c, ra, rb, rc, travel}) =>
    formatTemplate(zh.cron.daily_report, { 
      a: a.toFixed?.(2) || a, 
      b: b.toFixed?.(2) || b, 
      c: c.toFixed?.(2) || c, 
      ra, rb, rc, travel 
    })
  )
  
  const totalSent = (reminderResults?.sent || 0) + (dailyResults?.sent || 0)
  const totalFailed = (reminderResults?.failed || 0) + (dailyResults?.failed || 0)
  
  return {
    reminder: reminderResults,
    daily: dailyResults,
    totalSent,
    totalFailed
  }
}

async function handleEveningTasks(now) {
  console.log('[evening] 开始执行晚上任务...')
  
  // 获取今日未记录用户（晚间提醒）
  const usersWithoutRecord = await usersWithoutRecordToday(now)
  
  // 生成晚间提醒消息
  const eveningMessages = usersWithoutRecord.map(chatId => ({
    chat_id: chatId,
    text: generateEveningReminder(chatId, now)
  }))
  
  // 发送晚间提醒
  const eveningResults = await sendBatchMessages(eveningMessages)
  
  return {
    evening: eveningResults,
    totalSent: eveningResults?.sent || 0,
    totalFailed: eveningResults?.failed || 0
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

function generatePersonalizedReminder(chatId, now) {
  return formatTemplate(zh.cron.reminder, {
    date: now.toISOString().slice(0, 10),
    a: '0.00',
    b: '0.00', 
    c: '0.00',
    ra: '0%',
    rb: '0%',
    rc: '0%'
  })
}

function generateEveningReminder(chatId, now) {
  return `🌙 晚间提醒\n\n📅 今天是 ${now.toISOString().slice(0, 10)}\n⏰ 现在是晚上 10:00\n💡 今天还没有记录支出哦！\n\n🌃 趁着晚上时间，记录一下今天的支出吧！\n💰 保持记录，管理财务！\n\n💪 记得记账哦！`
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
  
  let report = `📊 推送任务执行报告\n\n📅 日期：${date}\n⏰ 时间：${time}\n\n`
  
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
    report += `🌞 中午推送 (12:00 PM)：\n`
    report += `   • 用户提醒：成功 ${results.noon.reminder?.sent || 0}，失败 ${results.noon.reminder?.failed || 0}\n`
    report += `   • 每日报告：成功 ${results.noon.daily?.sent || 0}，失败 ${results.noon.daily?.failed || 0}\n`
    report += `   • 总计：成功 ${results.noon.totalSent}，失败 ${results.noon.totalFailed}\n\n`
  }
  
  // 晚上任务报告
  if (results.evening) {
    report += `🌙 晚上推送 (10:00 PM)：\n`
    report += `   • 晚间提醒：成功 ${results.evening.evening?.sent || 0}，失败 ${results.evening.evening?.failed || 0}\n`
    report += `   • 总计：成功 ${results.evening.totalSent}，失败 ${results.evening.totalFailed}\n\n`
  }
  
  // 总体统计
  report += `📈 总体统计：\n`
  report += `   • 总发送：${results.totalSent}\n`
  report += `   • 总失败：${results.totalFailed}\n`
  report += `   • 成功率：${results.totalSent + results.totalFailed > 0 ? ((results.totalSent / (results.totalSent + results.totalFailed)) * 100).toFixed(1) : 0}%\n\n`
  
  report += `✅ 任务执行完成！`
  
  return report
} 