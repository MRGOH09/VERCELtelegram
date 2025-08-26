/**
 * Web推送个性化提醒模板
 * 融合WhatsApp提醒逻辑到PWA推送系统
 */

export const webPushReminderTemplates = {
  // 1天未记录 - 昨天忘记记录
  oneDay: {
    title: "🌟 昨天忘记记账了吗？",
    getBody: (userName, daysSinceStart) => 
      `📱 今天是你理财成长的第${daysSinceStart}天\n💎 每一天都很珍贵`,
    action: "记录一下",
    icon: "/icons/icon-192.png",
    tag: "missed-1day"
  },

  // 2-3天未记录 - 短期中断提醒
  shortBreak: {
    title: "💪 理财习惯需要坚持！",
    getBody: (userName, daysSinceStart, daysSinceLast) =>
      `⏰ 已经${daysSinceLast}天没有记录了\n📈 第${daysSinceStart}天的你，不要让习惯断链！`,
    action: "马上记录",
    icon: "/icons/icon-192.png", 
    tag: "missed-short"
  },

  // 4-7天未记录 - 中期唤醒
  mediumBreak: {
    title: "🌟 你的理财目标还在吗？",
    getBody: (userName, daysSinceStart, daysSinceLast) =>
      `📅 从第${daysSinceStart}天到今天，${daysSinceLast}天的空白...\n💎 每一次重新开始都是成长！`,
    action: "重新开始",
    icon: "/icons/icon-192.png",
    tag: "missed-medium"
  },

  // 8天以上未记录 - 长期唤醒
  longBreak: {
    title: "🎯 LEARNER CLUB在等你回来！",
    getBody: (userName, daysSinceStart, daysSinceLast) =>
      `⏳ ${daysSinceLast}天了，但第${daysSinceStart}天的初心还记得吗？\n🌟 300位伙伴还在坚持，你也可以！`,
    action: "重新开始",
    icon: "/icons/icon-192.png",
    tag: "missed-long"
  },

  // 正常情况 - 连续记录中
  normal: {
    title: "🌅 早安理财报告",
    getBody: (userName, daysSinceStart, streak) =>
      `第${daysSinceStart}天挑战，连续记录${streak}天！\n🔥 查看你的理财进度`,
    action: "查看进度",
    icon: "/icons/icon-192.png",
    tag: "morning-report"
  }
}

/**
 * 根据用户记录状态选择合适的提醒模板
 */
export function selectReminderTemplate(daysSinceLast, hasRecordToday, streak) {
  // 今天已有记录，发送正常的晨间报告
  if (hasRecordToday) {
    return webPushReminderTemplates.normal
  }
  
  // 根据距离上次记录的天数选择提醒类型
  if (daysSinceLast === 1) {
    return webPushReminderTemplates.oneDay
  } else if (daysSinceLast >= 2 && daysSinceLast <= 3) {
    return webPushReminderTemplates.shortBreak
  } else if (daysSinceLast >= 4 && daysSinceLast <= 7) {
    return webPushReminderTemplates.mediumBreak
  } else if (daysSinceLast >= 8) {
    return webPushReminderTemplates.longBreak
  }
  
  // 默认返回正常模板
  return webPushReminderTemplates.normal
}

/**
 * 计算距离上次记录的天数
 */
export function calculateDaysSinceLastRecord(lastRecordDate, currentDate = new Date()) {
  if (!lastRecordDate) {
    return 999 // 从未记录，返回大数值
  }
  
  const lastDate = new Date(lastRecordDate)
  const diffTime = currentDate - lastDate
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return Math.max(0, diffDays)
}

/**
 * 生成个性化推送通知
 */
export function generatePersonalizedPushNotification(user, daysSinceStart, daysSinceLast, hasRecordToday, streak) {
  const template = selectReminderTemplate(daysSinceLast, hasRecordToday, streak)
  const userName = user.name || user.display_name || '朋友'
  
  return {
    title: template.title,
    body: template.getBody(userName, daysSinceStart, daysSinceLast || streak),
    options: {
      icon: template.icon,
      badge: "/icons/icon-72.png",
      tag: template.tag,
      requireInteraction: daysSinceLast > 1, // 超过1天未记录时需要用户交互
      actions: [
        {
          action: 'record',
          title: template.action,
          icon: "/icons/icon-72.png"
        },
        {
          action: 'close',
          title: '稍后'
        }
      ],
      data: {
        type: 'personalized-reminder',
        userId: user.id,
        daysSinceStart,
        daysSinceLast,
        hasRecordToday,
        streak,
        reminderType: template.tag
      }
    }
  }
}