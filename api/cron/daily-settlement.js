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
      reminderQueue: null,
      webPushReminders: null
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
    
    // 4. 发送Web推送提醒
    console.log('[daily-settlement] 发送Web推送提醒...')
    results.webPushReminders = await sendWebPushReminders(now)
    
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
    const message = generatePersonalizedMessage(user.name, daysSinceStart, daysSinceLast)
    
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

// 生成个性化WhatsApp提醒消息
function generatePersonalizedMessage(userName, daysSinceStart, daysSinceLast) {
  // 基于天数选择不同的消息风格
  if (daysSinceLast === 1) {
    // 昨天忘记记录
    return `🌟 ${userName}，昨天忘记记账了吗？

📱 今天是你理财成长的第${daysSinceStart}天
💎 "你不理财，财不理你" - 每一天都很珍贵
🎯 立即记录昨天的支出，保持习惯不中断

⚡ 财商比智商情商逆商更重要！
🔥 点击链接继续挑战：t.me/your_bot_link`

  } else if (daysSinceLast <= 3) {
    // 2-3天未记录
    return `🚨 ${userName}，习惯养成关键期！

⏰ 已经${daysSinceLast}天没有记账了
📈 第${daysSinceStart}天的挑战不能放弃
💪 "行动力 = 被动学习知识转换成主动学习"

🎯 立即行动，重新拾起记账习惯
✨ 改变从现在开始！`

  } else if (daysSinceLast <= 7) {
    // 4-7天未记录  
    return `💔 ${userName}，我们想念你的记录！

📊 距离上次记账已经${daysSinceLast}天
🏆 但你的${daysSinceStart}天理财之旅还在继续
💎 记住："对的比例让你富，错的比例让你穷"

🔄 重启记账，复利的力量在等你！
🚀 每一次重新开始都是成长！`

  } else {
    // 超过7天未记录
    return `🌟 ${userName}，理财高手在召唤！

⚡ 已经${daysSinceLast}天没见到你了
🎓 第${daysSinceStart}天，Learner Club在等你回来
📚 "18岁后最需要搞定的是财商！"

💪 重新开始，永远不晚
🏆 300位伙伴期待你的归来！
✨ 今天就是最好的重启日！`
  }
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
    
    if (results.webPushReminders) {
      if (results.webPushReminders.error) {
        report += `📲 Web推送提醒：发送失败 - ${results.webPushReminders.error}\n`
      } else {
        report += `📲 Web推送提醒：成功 ${results.webPushReminders.sent}，失败 ${results.webPushReminders.failed}\n`
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

// 发送Web推送记账提醒
async function sendWebPushReminders(now) {
  try {
    // 动态导入web-push模块
    const { sendWebPushNotification, pushTemplates } = await import('../../lib/web-push.js')
    
    console.log('[webPush] 开始发送记账提醒Web推送...')
    
    // 获取昨天日期
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayYmd = yesterday.toISOString().split('T')[0]
    
    console.log(`[webPush] 查找 ${yesterdayYmd} 未记录的启用推送用户...`)
    
    // 查找昨天没有记录且启用推送的活跃用户
    const { data: inactiveUsers, error: queryError } = await supabase
      .from('users')
      .select(`
        id, name, created_at,
        user_profile!inner(last_record),
        push_subscriptions!inner(id)
      `)
      .eq('status', 'active')
      .not('push_subscriptions.id', 'is', null)
      .not('id', 'in', 
        supabase.from('records')
          .select('user_id')
          .eq('ymd', yesterdayYmd)
          .eq('is_voided', false)
      )
    
    if (queryError) {
      console.error('[webPush] 查询未记录用户失败:', queryError)
      return { sent: 0, failed: 1, error: queryError.message }
    }
    
    if (!inactiveUsers || inactiveUsers.length === 0) {
      console.log('[webPush] 没有找到需要提醒的启用推送用户')
      return { sent: 0, failed: 0, note: '无需提醒的用户' }
    }
    
    console.log(`[webPush] 找到 ${inactiveUsers.length} 个需要提醒的启用推送用户`)
    
    let totalSent = 0
    let totalFailed = 0
    
    // 为每个用户发送个性化提醒
    for (const user of inactiveUsers) {
      try {
        // 计算总天数和断档天数
        const createdAt = new Date(user.created_at)
        const daysSinceStart = Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24))
        
        let daysSinceLast = 1 // 默认1天（昨天没记录）
        if (user.user_profile?.last_record) {
          const lastRecord = new Date(user.user_profile.last_record)
          daysSinceLast = Math.ceil((now - lastRecord) / (1000 * 60 * 60 * 24))
        }
        
        // 根据断档天数选择不同的提醒消息
        let title, body
        if (daysSinceLast === 1) {
          title = '⏰ 记账提醒'
          body = `${user.name}，昨天忘记记录了？第${daysSinceStart}天挑战不能断！`
        } else if (daysSinceLast <= 3) {
          title = '🚨 习惯养成关键期'
          body = `${user.name}，已经${daysSinceLast}天没记账了，立即行动重启习惯！`
        } else if (daysSinceLast <= 7) {
          title = '💔 我们想念你的记录'
          body = `${user.name}，第${daysSinceStart}天理财之旅还在继续，重启记账吧！`
        } else {
          title = '🌟 理财高手在召唤'
          body = `${user.name}，第${daysSinceStart}天，Learner Club在等你回来！`
        }
        
        const result = await sendWebPushNotification(
          user.id,
          title,
          body,
          {
            tag: 'daily-reminder',
            data: { 
              type: 'daily-reminder',
              userId: user.id,
              daysSinceStart,
              daysSinceLast
            }
          }
        )
        
        if (result.sent > 0) {
          totalSent++
        } else {
          totalFailed++
        }
        
      } catch (error) {
        console.error(`[webPush] 发送提醒给用户 ${user.name} 失败:`, error)
        totalFailed++
      }
    }
    
    console.log(`[webPush] 记账提醒Web推送完成: 成功${totalSent}, 失败${totalFailed}`)
    return { sent: totalSent, failed: totalFailed }
    
  } catch (error) {
    console.error('[webPush] 记账提醒Web推送异常:', error)
    return { sent: 0, failed: 1, error: error.message }
  }
}