# 状态管理改进功能文档

## 🎯 改进目标

本次改进主要针对 Telegram Bot 的状态管理系统，解决以下问题：
1. 用户注册流程中断后无法恢复
2. 状态长期存在导致的内存占用
3. 不同流程间的状态冲突
4. 用户体验不佳的状态提示

## ✨ 主要改进

### 1. 状态过期机制

**功能描述：** 自动清理超过24小时的过期状态

**实现位置：** `lib/state.js` - `getState()` 函数

**核心逻辑：**
```javascript
if (data) {
  const now = new Date()
  const updatedAt = new Date(data.updated_at)
  const diffHours = (now - updatedAt) / (1000 * 60 * 60)
  
  // 如果状态超过24小时，自动过期
  if (diffHours > 24) {
    console.log(`State expired for user ${userId}, clearing...`)
    await clearState(userId)
    return null
  }
}
```

**优势：**
- 自动清理过期状态，减少数据库存储
- 防止状态长期占用内存
- 提高系统稳定性

### 2. 状态恢复机制

**功能描述：** 用户可以通过 `/start` 命令恢复未完成的注册流程

**实现位置：** `api/telegram.js` - `/start` 命令处理

**核心功能：**
- 检测未完成的注册流程
- 显示当前进度和操作选项
- 支持继续注册或重新开始

**用户界面：**
```
📋 检测到未完成的注册流程

当前进度：输入手机号

请选择操作：
[🔄 继续注册] [❌ 重新开始]
```

### 3. 状态冲突检测

**功能描述：** 自动检测和处理不同流程间的状态冲突

**实现位置：** `api/telegram.js` - 记录和批量记录流程

**冲突处理：**
```javascript
// 检查是否有其他流程的状态冲突
if (st.flow !== 'record') {
  await clearState(userIdForState)
  await sendTelegramMessage(chatId, '⚠️ 检测到状态冲突，已重置状态。请重新开始记录。')
  return res.status(200).json({ ok: true })
}
```

**优势：**
- 防止状态混乱
- 自动恢复系统状态
- 提供清晰的用户提示

### 4. 步骤描述函数

**功能描述：** 提供用户友好的步骤进度显示

**实现位置：** `lib/state.js` - `getStepDescription()` 函数

**步骤映射：**
```javascript
const stepDescriptions = {
  'nickname': '输入昵称',
  'phone': '输入手机号',
  'income': '输入月收入',
  'a_pct': '设置开销占比',
  'b_pct': '设置学习投资占比',
  'travel': '设置旅游目标',
  'prev': '输入上月开销占比',
  'branch': '选择分行'
}
```

**使用场景：**
- 状态恢复提示
- 进度显示
- 用户引导

### 5. 改进的用户提示

**功能描述：** 更清晰、更友好的用户提示信息

**改进内容：**
- 状态恢复选项
- 进度显示
- 冲突处理提示
- 操作指导

## 🔧 技术实现

### 数据库要求

确保 `user_state` 表包含 `updated_at` 字段：
```sql
CREATE TABLE user_state (
  user_id bigint PRIMARY KEY,
  flow text NOT NULL,
  step text NOT NULL,
  payload jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_state_updated ON user_state(updated_at DESC);
```

### 代码结构

```
lib/state.js
├── getState() - 添加过期检查
├── setState() - 自动更新时间戳
├── clearState() - 状态清理
└── getStepDescription() - 步骤描述

api/telegram.js
├── /start 命令 - 状态恢复检查
├── 文本处理 - 状态冲突检测
└── 回调处理 - 状态恢复操作
```

## 🧪 测试场景

### 测试1：状态过期
```
1. 开始注册，输入昵称
2. 等待24小时
3. 发送任何消息
4. 预期：状态自动过期，提示重新开始
```

### 测试2：状态恢复
```
1. 开始注册，输入昵称和手机号
2. 停止操作
3. 重新发送 /start
4. 预期：显示"继续注册"选项
```

### 测试3：状态冲突
```
1. 在注册流程中发送 /record
2. 预期：提示完成注册或重新开始
```

## 📈 性能影响

### 正面影响
- 减少过期状态占用
- 提高系统响应速度
- 改善用户体验

### 注意事项
- 每次状态查询增加时间计算
- 状态过期时增加一次数据库删除操作

## 🚀 部署说明

### 前置条件
1. 确保数据库包含 `updated_at` 字段
2. 验证所有依赖函数正常工作

### 部署步骤
1. 更新 `lib/state.js`
2. 更新 `api/telegram.js`
3. 重启服务
4. 测试功能

### 回滚方案
如果出现问题，可以回滚到之前的版本：
1. 恢复 `lib/state.js` 的原始版本
2. 恢复 `api/telegram.js` 的原始版本
3. 重启服务

## 🔮 未来改进

### 短期改进
- 添加状态过期时间配置
- 增加状态统计信息

### 长期改进
- 状态持久化策略
- 状态同步机制
- 高级状态管理

## 📞 技术支持

如有问题，请检查：
1. 数据库连接状态
2. 环境变量配置
3. 日志输出信息
4. 用户状态数据

---

**文档版本：** 1.0  
**最后更新：** 2025-01-27  
**维护人员：** 开发团队 