import { breakStreaksOneShot } from '../../lib/cron-utils.js'
import supabase from '../../lib/supabase.js'
import { sendBatchMessages } from '../../lib/telegram.js'

export default async function handler(req, res) {
  try {
    const now = new Date()
    console.info(`[daily-settlement] 凌晨2点：执行每日结算，时间：${now.toISOString()}`)
    
    const results = {
      action: 'daily-settlement',
      timestamp: now.toISOString(),
      hour: now.getHours(),
      breakStreaks: null,
      monthlyAutoPost: null
    }
    
    // 1. 断签清零
    console.log('[daily-settlement] 执行断签清零...')
    results.breakStreaks = await breakStreaksOneShot()
    
    // 2. 每月1号自动入账
    const isFirstDayOfMonth = now.getDate() === 1
    if (isFirstDayOfMonth) {
      console.log('[daily-settlement] 执行月度自动入账...')
      results.monthlyAutoPost = await handleMonthlyAutoPost(now)
    }
    
    // 发送管理员报告
    await sendAdminReport(results, now)
    
    console.log('[daily-settlement] 每日结算完成')
    return res.status(200).json({ ok: true, results })
    
  } catch (error) {
    console.error('[daily-settlement] 执行失败:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
}

// 月度自动入账
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

// 发送管理员报告
async function sendAdminReport(results, now) {
  try {
    const adminIds = (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
    
    if (adminIds.length === 0) {
      console.log('[admin-report] 没有配置管理员ID，跳过报告')
      return
    }
    
    const date = now.toISOString().slice(0, 10)
    const time = now.toISOString().slice(11, 16)
    
    let report = `📊 每日结算报告 (2:00 AM)\n\n📅 日期：${date}\n⏰ 时间：${time}\n\n`
    
    if (results.breakStreaks) {
      report += `⏰ 断签清零：重置 ${results.breakStreaks.resetCount || 0} 个用户\n`
    }
    
    if (results.monthlyAutoPost) {
      report += `💰 月度入账：新增 ${results.monthlyAutoPost.insertedCount} 条记录\n`
    } else {
      report += `💰 月度入账：跳过（非月初）\n`
    }
    
    report += `\n✅ 每日结算完成！`
    
    const adminMessages = adminIds.map(chatId => ({
      chat_id: chatId,
      text: report
    }))
    
    const adminResults = await sendBatchMessages(adminMessages)
    console.log(`[admin-report] 报告发送完成，成功: ${adminResults.sent}, 失败: ${adminResults.failed}`)
    
  } catch (e) {
    console.error('[admin-report] 发送报告失败:', e)
  }
}