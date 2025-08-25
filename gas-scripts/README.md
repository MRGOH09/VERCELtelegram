# 📊 Google Apps Script 数据同步系统

**智能全量数据库同步到Google Sheets** - 支持10个数据表完整同步！

## 🚀 快速开始

### 一键部署
```bash
./deploy.sh        # 首次部署
./quick-update.sh  # 日常更新
```

### 立即配置
参考 [快速开始指南](QUICK_START.md) - 30秒完成配置！

## 📁 文件结构

### 核心同步文件
- `enhanced-main.gs` - 🆕 **增强版全量同步脚本**（推荐）
- `main.gs` - 原版同步脚本
- `config.gs` - API配置和敏感信息管理
- `utils.gs` - 工具函数库
- `triggers.gs` - 定时触发器管理

### 部署和配置
- `deploy.sh` - 自动部署脚本
- `quick-update.sh` - 快速更新脚本
- `appsscript.json` - GAS项目配置

### 📚 文档
- `QUICK_START.md` - 🚀 30秒快速开始
- `ENHANCED_SETUP_GUIDE.md` - 增强版详细指南
- `SETUP_GUIDE.md` - 原版设置指南
- `clasp-guide.md` - clasp部署工具指南

## ⭐ 增强版功能亮点

- **📊 全数据库同步**: 10个数据表完整覆盖
- **🛡️ 智能脱敏**: 敏感数据自动保护
- **⚡ 分级同步**: 智能频率调整（1小时/4小时/12小时/24小时）
- **🔄 自动化部署**: clasp一键推送更新

## 🎯 推荐使用增强版

增强版 (`enhanced-main.gs`) 提供：
- ✅ 比原版多同步7个数据表
- ✅ 敏感数据脱敏保护
- ✅ 智能性能优化
- ✅ 完整的系统监控

## 📋 数据同步覆盖

| 数据表 | 原版 | 增强版 | 频率 |
|-------|------|--------|------|
| records | ✅ | ✅ | 每小时 |
| user_profile | ✅ | ✅ | 每小时 |
| branch_daily | ✅ | ✅ | 每4小时 |
| users | ❌ | ✅ | 每4小时 |
| user_month_budget | ❌ | ✅ | 每4小时 |
| daily_summary | ❌ | ✅ | 每小时 |
| user_state | ❌ | ✅ | 每12小时 |
| leaderboard_daily | ❌ | ✅ | 每12小时 |
| event_audit | ❌ | ✅ | 每24小时（脱敏） |
| branch_leads | ❌ | ✅ | 每24小时（脱敏） |

## ⚡ 使用建议

1. **新用户**: 直接使用增强版获得完整功能
2. **现有用户**: 升级到增强版享受全量同步
3. **开发者**: 使用clasp工具提升开发效率