# 🐛 调试指南

> 📋 相关规则请参考：[项目开发规则](../CLAUDE.md)

本文档包含项目调试的方法论、经验总结和最佳实践。

## 🔍 Linux思维调试方法

### 系统性问题定位
1. **grep搜索**: 查找所有相关代码位置
2. **数据流追踪**: 从数据源到最终显示的完整链路
3. **分层验证**: 数据库→业务逻辑→用户界面逐层检查
4. **KISS原则**: 优先选择最简单可行的解决方案

### 调试日志策略
```javascript
// 数据查询日志
console.log(`[Function] 查询参数:`, queryParams)
console.log(`[Function] 查询结果:`, queryResult)

// 数据类型检查日志  
console.log(`[Function] 数据类型: ${typeof data}, 值: ${data}`)

// 映射过程日志
console.log(`[Function] 映射前:`, sourceMap.entries())
console.log(`[Function] 映射后:`, targetMap.entries())
```

### 问题分类和优先级
1. **Critical**: 核心功能完全失效（如分行无法设置）
2. **High**: 功能异常但有备选方案（如排行榜显示问题）
3. **Medium**: 用户体验问题（如提示文本不准确）
4. **Low**: 非关键优化项

## 🐛 重要调试经验

### 数据库Schema一致性检查
- **问题**: 字段位置错误查询（如`user_profile.branch_code`实际在`users`表）
- **解决**: 使用Linux思维系统性检查所有相关查询
- **预防**: 每次修改前确认字段所在表的准确性

### JOIN查询最佳实践
- **推荐**: 使用`user_profile.users(branch_code)`进行关联查询
- **避免**: 复杂的嵌套JOIN，优先使用分步查询
- **调试**: 添加详细日志追踪JOIN结果的数据结构

### 数据类型匹配问题
- **注意**: `chat_id`可能是number/bigint/string类型
- **解决**: 在Map查找时添加类型检查和转换
- **日志**: 记录数据类型信息便于调试匹配问题

### UPSERT vs UPDATE选择
- **UPSERT**: 仅用于确实需要"不存在则创建"的场景
- **UPDATE**: 用于更新已知存在的记录，避免意外覆盖
- **分行设置**: 使用UPDATE避免重置现有配置

### PWA与Telegram数据一致性
- **分类去重**: 实现与Telegram `/my`命令相同的mergedCategories逻辑
- **预算计算**: 优先使用user_month_budget，备选user_profile百分比计算
- **分类映射**: 统一使用category_code (food/shop/ent) 而非英文全称
- **React Hook**: 使用useState而非React.useState避免导入错误
- **品牌一致性**: PWA界面必须体现LEARNER CLUB理念和标语

---
*此文档专注于调试方法和经验，帮助快速定位和解决开发中遇到的问题*
*v2.3更新：新增PWA数据一致性调试经验*
*v2.2更新：新增数据库和数据类型相关调试经验*