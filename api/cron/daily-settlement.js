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
      monthlyAutoPost: null,
      reminderQueue: null
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
    
    // 3. 生成WhatsApp提醒队列
    console.log('[daily-settlement] 生成WhatsApp提醒队列...')
    results.reminderQueue = await generateReminderQueue(now)
    
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

// 生成WhatsApp提醒队列
async function generateReminderQueue(now) {
  console.log('[reminderQueue] 开始生成WhatsApp提醒队列...')
  
  // 1. 清空旧的提醒队列
  const { error: deleteError } = await supabase
    .from('daily_reminder_queue')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // 删除所有记录
  
  if (deleteError) {
    console.error('[reminderQueue] 清空队列失败:', deleteError)
    return { error: deleteError.message }
  }
  
  // 2. 获取昨天日期
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayYmd = yesterday.toISOString().split('T')[0]
  
  console.log(`[reminderQueue] 查找 ${yesterdayYmd} 未记录的用户...`)
  
  // 3. 找出昨天没有记录的活跃用户（有电话号码）
  const { data: inactiveUsers, error: queryError } = await supabase
    .from('users')
    .select(`
      id, name, created_at,
      user_profile!inner(phone_e164, last_record)
    `)
    .eq('status', 'active')
    .not('user_profile.phone_e164', 'is', null)
    .not('id', 'in', 
      supabase.from('records')
        .select('user_id')
        .eq('ymd', yesterdayYmd)
        .eq('is_voided', false)
    )
  
  if (queryError) {
    console.error('[reminderQueue] 查询用户失败:', queryError)
    return { error: queryError.message }
  }
  
  console.log(`[reminderQueue] 找到 ${inactiveUsers?.length || 0} 个需要提醒的用户`)
  
  // 4. 为每个用户生成个性化消息并插入队列
  let insertedCount = 0
  const todayYmd = now.toISOString().split('T')[0]
  
  for (const user of inactiveUsers || []) {
    // 计算总天数（从注册到今天）
    const createdAt = new Date(user.created_at)
    const daysSinceStart = Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24))
    
    // 计算距离最后记录天数
    let daysSinceLast = 1 // 默认1天（昨天没记录）
    if (user.user_profile.last_record) {
      const lastRecord = new Date(user.user_profile.last_record)
      daysSinceLast = Math.ceil((now - lastRecord) / (1000 * 60 * 60 * 24))
    }
    
    // 生成个性化消息
    const message = `Hi ${user.name}! 今天是建立记录开销的第${daysSinceStart}天，你已${daysSinceLast}天没有记录开销了。加油建立起习惯，改变从今天开始！💪`
    
    // 插入提醒队列
    const { error: insertError } = await supabase
      .from('daily_reminder_queue')
      .insert({
        user_id: user.id,
        phone_e164: user.user_profile.phone_e164,
        message: message,
        ymd: todayYmd
      })
    
    if (insertError) {
      console.error(`[reminderQueue] 插入用户 ${user.name} 失败:`, insertError)
    } else {
      insertedCount++
    }
  }
  
  console.log(`[reminderQueue] 提醒队列生成完成，插入 ${insertedCount} 条记录`)
  return { insertedCount, totalFound: inactiveUsers?.length || 0 }
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
    
    if (results.reminderQueue) {
      if (results.reminderQueue.error) {
        report += `📱 提醒队列：生成失败 - ${results.reminderQueue.error}\n`
      } else {
        report += `📱 提醒队列：生成 ${results.reminderQueue.insertedCount} 条提醒 (共找到 ${results.reminderQueue.totalFound} 个未记录用户)\n`
      }
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