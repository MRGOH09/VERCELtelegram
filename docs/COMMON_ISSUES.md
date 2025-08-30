# ❓ 常见问题手册

> 📋 相关规则请参考：[项目开发规则](../CLAUDE.md)

本文档收集项目中常见的问题模式、解决方案和预防措施。

## 📋 代码审查检查清单

### 数据库操作检查
- [ ] 确认字段在正确的表中
- [ ] JOIN查询语法正确
- [ ] 数据类型匹配无误
- [ ] UPSERT/UPDATE选择合适

### 功能逻辑检查
- [ ] 数据流从源到终的完整性
- [ ] 错误处理覆盖边界情况
- [ ] 日志信息足够详细便于调试
- [ ] 用户体验流程合理

### 性能和维护性
- [ ] 查询语句高效无冗余
- [ ] 代码复用现有函数
- [ ] 变量命名清晰易懂
- [ ] 注释说明复杂逻辑

## 🔧 常见技术问题

### 数据库Schema一致性问题
**症状**: 查询字段不存在，返回undefined或null
**原因**: 字段位置错误查询（如`user_profile.branch_code`实际在`users`表）
**解决方案**:
1. 使用Linux思维系统性检查所有相关查询
2. 每次修改前确认字段所在表的准确性
3. 添加字段存在性检查日志

### JOIN查询性能问题
**症状**: 查询超时或返回意外结果
**原因**: 复杂的嵌套JOIN导致性能问题
**解决方案**:
1. **推荐**: 使用`user_profile.users(branch_code)`进行关联查询
2. **避免**: 复杂的嵌套JOIN，优先使用分步查询
3. **调试**: 添加详细日志追踪JOIN结果的数据结构

### 数据类型匹配错误
**症状**: Map查找失败，条件判断异常
**原因**: `chat_id`等字段可能是number/bigint/string类型
**解决方案**:
1. 在Map查找时添加类型检查和转换
2. 记录数据类型信息便于调试匹配问题
3. 使用严格的类型转换函数

```javascript
// 正确的类型安全查找
const chatIdKey = String(chat_id); // 统一转换为字符串
const userData = userMap.get(chatIdKey);

// 添加类型检查日志
console.log(`[Debug] chat_id类型: ${typeof chat_id}, 值: ${chat_id}`);
```

### UPSERT vs UPDATE误用
**症状**: 数据被意外覆盖或重置
**原因**: 错误选择了UPSERT而非UPDATE操作
**解决方案**:
1. **UPSERT**: 仅用于确实需要"不存在则创建"的场景
2. **UPDATE**: 用于更新已知存在的记录，避免意外覆盖
3. **分行设置**: 使用UPDATE避免重置现有配置

### PWA与Telegram数据不一致
**症状**: 同一用户在不同平台看到的数据不同
**原因**: 分类去重逻辑、预算计算方式不统一
**解决方案**:
1. **分类去重**: 实现与Telegram `/my`命令相同的mergedCategories逻辑
2. **预算计算**: 优先使用user_month_budget，备选user_profile百分比计算
3. **分类映射**: 统一使用category_code (food/shop/ent) 而非英文全称
4. **React Hook**: 使用useState而非React.useState避免导入错误
5. **品牌一致性**: PWA界面必须体现LEARNER CLUB理念和标语

## 🚨 紧急问题处理

### 核心功能失效处理流程
1. **立即确认影响范围**: 哪些用户、哪些功能受影响
2. **检查最近更改**: 查看git log，定位可能原因
3. **快速回滚**: 如果是部署问题，立即回滚到稳定版本
4. **深度排查**: 使用调试指南进行系统性问题定位
5. **修复验证**: 在测试环境验证修复效果
6. **监控部署**: 部署后持续监控相关指标

### 数据一致性问题处理
1. **数据对比**: 比较不同数据源的同一记录
2. **同步状态检查**: 确认GAS同步是否正常运行
3. **事务完整性**: 检查是否有未提交的事务
4. **缓存刷新**: 清除相关缓存，强制重新查询
5. **手动修复**: 必要时进行数据修复操作

## 🔍 快速诊断命令

### 数据库状态检查
```sql
-- 检查表结构
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'target_table';

-- 检查数据一致性
SELECT count(*), category_code 
FROM records 
WHERE created_at >= current_date 
GROUP BY category_code;
```

### 日志查询
```bash
# 查找错误日志
grep -r "ERROR" logs/ --include="*.log"

# 查找特定功能相关日志
grep -r "WhatsApp\|PWA\|Branch" logs/ -A 5 -B 5
```

---
*此文档专注于常见问题的快速解决，持续更新项目中遇到的问题模式*
*v2.3更新：新增PWA数据一致性问题解决方案*
*v2.2更新：新增数据库和类型匹配常见问题*