# Google Apps Script 设置指南

## 1. 准备工作

### 1.1 获取Supabase信息
- 登录你的Supabase项目
- 在Settings > API中获取：
  - Project URL (格式: `https://xxx.supabase.co`)
  - Anon public key

### 1.2 准备Google Sheets
- 创建新的Google Sheets文档
- 记录Sheets的ID（从URL中获取）
- 准备以下工作表名称：
  - `支出记录` - 存放所有支出记录
  - `用户统计` - 存放用户统计信息
  - `分支统计` - 存放分支数据
  - `每日汇总` - 存放每日汇总数据
  - `周报告` - 存放周报告数据

## 2. 在Google Sheets中设置Apps Script

### 2.1 打开Apps Script编辑器
1. 在Google Sheets中，点击"扩展程序" > "Apps Script"
2. 删除默认的`Code.gs`文件

### 2.2 创建脚本文件
创建以下4个.gs文件：

1. **config.gs** - 复制 `config.js` 的内容
2. **utils.gs** - 复制 `utils.js` 的内容  
3. **main.gs** - 复制 `main.js` 的内容
4. **triggers.gs** - 复制 `triggers.js` 的内容

### 2.3 配置API信息
在`config.gs`中修改以下配置：

```javascript
// Supabase 配置
const SUPABASE_CONFIG = {
  url: 'https://你的项目ID.supabase.co',           // 替换为你的URL
  anonKey: '你的匿名密钥',                          // 替换为你的密钥
  serviceKey: '你的服务密钥'                        // 可选
};

// Google Sheets 配置
const SHEETS_CONFIG = {
  recordsSheetId: '你的Google-Sheets-ID',          // 替换为你的Sheets ID
  recordsSheetName: '支出记录',
  
  statsSheetId: '你的Google-Sheets-ID',            // 可以和上面相同
  statsSheetName: '用户统计',
  
  branchSheetId: '你的Google-Sheets-ID',           // 可以和上面相同
  branchSheetName: '分支统计'
};
```

## 3. 测试和启动

### 3.1 测试连接
1. 在Apps Script编辑器中，选择`testSync`函数
2. 点击"运行"按钮
3. 首次运行需要授权，按提示完成授权
4. 检查日志确认连接成功

### 3.2 手动测试同步
1. 选择`syncSupabaseToSheets`函数并运行
2. 检查Google Sheets是否有数据写入
3. 查看执行日志确认没有错误

### 3.3 设置定时触发器
1. 选择`setupTriggers`函数并运行
2. 系统会自动设置以下触发器：
   - 主同步：每小时执行一次
   - 日汇总：每天凌晨2点
   - 周报告：每周一早上8点

### 3.4 验证触发器
1. 选择`listAllTriggers`函数并运行
2. 检查日志确认触发器已正确设置

## 4. 维护和监控

### 4.1 查看同步日志
```javascript
// 运行这个函数查看最近的同步记录
function viewSyncLogs() {
  const logs = getSyncLogs();
  console.log('最近同步记录:', logs);
}
```

### 4.2 查看错误日志
```javascript
// 运行这个函数查看错误记录
function viewErrorLogs() {
  const errors = getErrorLogs();
  console.log('错误记录:', errors);
}
```

### 4.3 重置同步状态
如果需要重新开始完整同步：
```javascript
// 清除同步状态，下次会重新同步所有数据
resetSyncState();
```

## 5. 故障排除

### 5.1 常见错误
- **API连接失败**: 检查Supabase URL和密钥是否正确
- **权限错误**: 重新授权Google Sheets访问权限
- **数据格式错误**: 检查Supabase返回的数据结构

### 5.2 调试技巧
1. 使用`console.log()`输出调试信息
2. 在Apps Script编辑器中查看执行日志
3. 分步骤测试各个函数

### 5.3 性能优化
- 如果数据量很大，调整`SYNC_CONFIG.maxRecords`
- 考虑增加同步间隔时间
- 使用增量同步减少数据传输量

## 6. 安全注意事项

- ✅ 此文件夹已添加到`.gitignore`，不会推送到Git
- ✅ API密钥只存储在Google Apps Script中
- ✅ 使用Supabase的行级安全策略保护数据
- ⚠️ 定期检查和更新API密钥

## 7. 扩展功能

你可以根据需要添加更多同步功能：
- 实时数据监控
- 自定义报告生成
- 邮件通知
- 数据可视化图表