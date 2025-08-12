export const zh = {
  system: {
    authFailed: '⚠️ 认证失败，请检查访问权限',
    welcome: '👋 欢迎使用 LEARNER CLUB 财务记录助手！',
  },
  registration: {
    nickname: {
      prompt: '😊 请问我们该怎样称呼你呢？',
      validation: '❌ 昵称不能为空，请重新输入'
    },
    phone: {
      prompt: '📱 请提供你的联系方式\n例如：0123456789 或 +60123456789',
      validation: '❌ 手机号格式错误，请重新输入\n例如：0123456789 或 +60123456789'
    },
    income: {
      prompt: '💰 请告诉我们你的月收入（RM）\n例如：5000',
      validation: '❌ 请输入有效金额（大于0，最多两位小数）\n例如：5000'
    },
    budgetA: {
      prompt: '🛒 请设置【生活开销】预算占比\n*包含日常消费、餐饮、交通等\n例如：60 或 60%\n💡 设置后可随时调整',
      validation: '❌ 请输入0-100之间的百分比\n例如：60 或 60%'
    },
    budgetB: {
      prompt: '📚 请设置【学习投资】预算占比\n例如：30 或 30%',
      validation: '❌ 请输入0-100之间的百分比'
    },
    budgetOverflow: '❌ 生活开销 + 学习投资 超过100%\n当前总计：{total}%\n请重新设置学习投资占比',
    travelBudget: {
      prompt: '✈️ 设置你的年度旅游目标（RM）\n将按年额÷12计入【学习投资】月度进度（不直接入账）\n例如：12000',
      validation: '❌ 请输入有效金额\n例如：3600'
    },
    lastMonthSpendingPct: {
      prompt: '📊 请输入上月实际开销占收入的百分比\n*用于本月预算参考对比\n例如：如上月花费3000，收入5000，则输入60%',
      validation: '❌ 请输入有效百分比（0-100）\n例如：60 或 60%'
    },
    branch: {
      prompt: '🏢 请选择你所属的分行：'
    },
    sessionExpired: '⏰ 会话已过期，请重新执行 /start',
    success: '🎉 欢迎加入 LEARNER CLUB！\n\n💡 你的预算配置：\n• 生活开销：{budgetA}%\n• 学习投资：{budgetB}%\n• 储蓄投资：{budgetC}%\n🏢 所属分行：{branch}\n\n✨ 开始你的财务管理之旅：\n• /record - 记录支出\n• /my month - 查看进度'
    ,alreadyRegistered: '✅ 你已完成设置。\n• /record - 记录支出\n• /my - 查看统计报告\n• /settings - 修改资料',
    settingsStart: '🛠️ 进入资料修改向导（可随时取消）。'
  },
  settings: {
    choose: '🛠️ 请选择要修改的项目：',
    updated: '✅ 已更新。',
    summary: '📄 当前资料\n昵称：{nickname}\n电话：{phone}\n收入：RM {income}\n生活开销占比：{a_pct}%\n学习投资占比：{b_pct}%\n旅游年额：RM {travel}\n年度医疗保险：RM {ins_med}\n年度车险：RM {ins_car}\n分行：{branch}',
    fields: {
      nickname: '昵称',
      phone: '联系方式',
      income: '月收入',
      a_pct: '生活开销占比',
      b_pct: '学习投资占比',
      travel: '年度旅游目标',
      branch: '所属分行'
    }
  },
  quickStart: {
    start_hint: '📝 请一次性提供你的基本信息：\n例如：收入 5000；生活开销% 60；学习投资% 10；旅游年额 3600；上月开销% 60；分行 MAIN',
    start_saved: '✅ 资料保存成功！\n\n快速开始：\n• /record - 记录一笔支出\n• /my month - 查看本月进度'
  },
  record: {
    choose_group: '💡 请选择支出类别：',
    choose_category: '✅ 已选择：{group}\n请选择具体分类：',
    amount_prompt: '💰 请输入金额：\n*支持整数或小数，如：12.50',
    amount_invalid: '❌ 金额格式错误\n请输入0-1,000,000之间的数值',
    note_prompt: '📝 添加备注（可选）：\n*发送 /skip 跳过此步骤',
    preview: '📋 确认信息：\n类别：{groupLabel}\n分类：{category}\n金额：RM {amount}\n备注：{note}\n\n确认无误请点击 ✅',
    save_failed: '❌ 保存失败，请重试',
    canceled: '❌ 操作已取消',
    saved: '✅ 记录成功！\n{groupLabel}：RM {amount}'
  },
  my: {
    need_start: '⚠️ 请先完成设置：/start',
    summary: '📊 {range} 数据总览\n\n💰 实际支出：\n• 开销：RM {a}\n• 学习：RM {b}\n• 储蓄：RM {c}\n\n🎯 实时占比：\n• 开销 {ra}% | 学习 {rb}% | 储蓄 {rc}%*\n🎯 目标占比：\n• 开销 {a_pct}%\n偏差：开销 {da}%\n💡 开销额度：{a_gap_line}\n\n🗓 当前资料：\n• 收入：RM {income}\n• 目标：开销 RM {cap_a}\n• EPF（含入储蓄）：RM {epf}\n• 旅游基金（月）：RM {travel}\n*储蓄含EPF'
  },
  admin: {
    no_perm: '⚠️ 权限不足',
    usage: '❌ 用法：/broadcast 消息内容',
    sent: '✅ 广播完成，已发送 {n} 条消息'
  },
  help: '❓ LEARNER CLUB 功能指南：\n• /start - 初始设置\n• /record - 记录支出\n• /my - 查看统计报告',
  post: {
    again: '再记一笔',
    my: '查看统计'
  },
  cron: {
    morning_rank: '🌅 早安！今日参与榜\n\n🏆 我的排名：第 {rank} 名\n\n🔥 今日TOP15：\n{top}',
    branch_lead: '📈 分行日报 - {code}\n完成率：{rate}%\n参与情况：{done}/{total} 人',
    reminder: '💡 别忘了记账哦！\n今天还没有记录，点击 /record 开始吧～',
    daily_report: '📊 今日账单\n开销 RM {a} | 学习 RM {b} | 储蓄 RM {c}\n\n🎯 实时占比\n开销 {ra}% | 学习 {rb}% | 储蓄 {rc}%*\n\n✈️ 旅游基金（月）：RM {travel}\n*储蓄含EPF'
  }
}

export default { zh }

