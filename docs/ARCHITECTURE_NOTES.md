# 🏗️ 架构设计记录

> 📋 相关规则请参考：[项目开发规则](../CLAUDE.md)

本文档记录重要的架构决策和设计经验，帮助理解系统设计背景和技术选择。

## 📋 架构决策记录 (ADR)

### ADR-001: WhatsApp提醒队列系统设计

- **日期**: 2025-08-25
- **状态**: 已接受
- **决策者**: 开发团队

#### 背景 (Context)
需要每日自动识别未记录用户并生成WhatsApp提醒队列，提升用户记录习惯的养成。系统需要在不增加维护复杂度的前提下，实现自动化的用户提醒功能。

#### 技术约束
- Vercel Hobby计划限制：最多2个Cron任务（当前已满）
- 需要与现有Google Apps Script同步系统集成
- 电话号码等敏感数据需要脱敏处理
- 避免积累历史数据，减少存储和维护成本

#### 决策 (Decision)

**核心设计原则**：
- **重用原则**: 利用现有daily-settlement cron，避免新增cron任务
- **零维护策略**: 每天覆盖旧数据，不积累历史记录
- **KISS原则**: 简单的数据型消息模板，避免复杂逻辑
- **架构一致性**: 集成到现有GAS同步系统，保持数据流一致

**技术实现方案**：
1. **数据层设计**
   - 数据表: `daily_reminder_queue` 
   - 核心字段: phone_e164, message_text, created_at
   - 包含完整消息文本，避免实时生成的复杂性

2. **查询策略**
   - 基于昨天records表的NOT EXISTS查询
   - 识别在昨日未记录任何消费的用户
   - 结合user_profile获取用户个性化信息

3. **消息生成逻辑**
   - 数据驱动的个性化模板（包含天数统计）
   - 预生成完整消息文本存储在队列中
   - 避免WhatsApp发送时的复杂模板处理

4. **同步和集成策略**
   - daily级别同步（24小时）
   - full_replace策略确保数据新鲜度
   - 集成到现有GAS enhanced-main.gs系统

#### 后果 (Consequences)

**正面影响**：
- ✅ 零维护成本：每日自动覆盖，无需清理历史数据
- ✅ 系统简单：避免了复杂的状态管理和消息模板逻辑
- ✅ 便于调试：Google Sheets作为中间层可视化队列状态
- ✅ 隐私安全：电话号码脱敏处理（high sensitive level）
- ✅ 架构一致：完美融入现有数据同步体系

**负面影响和缓解**：
- ⚠️ 存储冗余：消息文本预生成导致数据体积增加
  - 缓解：daily覆盖策略控制数据总量
- ⚠️ 灵活性降低：消息模板修改需要重新生成队列
  - 缓解：simple template设计，减少变更需求

**技术债务**：
- 消息模板硬编码在生成逻辑中，未来可能需要配置化
- 缺少A/B测试能力，消息效果难以量化优化

#### 实施细节

**数据库Schema**：
```sql
CREATE TABLE daily_reminder_queue (
  id SERIAL PRIMARY KEY,
  phone_e164 VARCHAR(20) NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  user_id UUID REFERENCES users(id)
);
```

**核心查询逻辑**：
```sql
-- 识别昨日未记录用户
SELECT u.id, up.phone_e164, up.name
FROM users u
JOIN user_profile up ON u.id = up.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM records r 
  WHERE r.user_id = u.id 
  AND DATE(r.created_at) = CURRENT_DATE - INTERVAL '1 day'
)
AND up.phone_e164 IS NOT NULL;
```

**GAS同步配置**：
```javascript
{
  table: 'daily_reminder_queue',
  sheet: 'WhatsApp队列',
  syncLevel: 'daily',
  sensitiveFields: ['phone_e164'],
  strategy: 'full_replace'
}
```

#### 关键经验总结

1. **扩展现有系统优于独立系统**
   - 新功能优先考虑在现有cron中扩展，而非独立cron
   - 减少系统复杂度和维护成本

2. **中间层设计的价值**
   - Google Sheets作为中间层便于调试和监控WhatsApp发送状态
   - 提供非技术人员可访问的数据视图

3. **隐私设计的重要性**
   - 电话号码脱敏处理确保隐私安全（high sensitive level）
   - 敏感数据处理需要从设计阶段就考虑

4. **零维护理念**
   - 设计时考虑长期维护成本
   - 优先选择自动清理、自动修复的设计模式

---

### ADR-002: 待补充

后续架构决策将在此处记录...

---
*此文档专注于架构设计决策的记录和传承，帮助理解系统设计背景*
*v2.3更新：新增ADR格式的架构决策记录*
*v2.2更新：记录WhatsApp提醒队列系统的完整设计过程*