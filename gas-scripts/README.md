# Google Apps Script 文件

**重要：这个文件夹包含API密钥等敏感信息，已在.gitignore中排除，不会同步到Git！**

## 文件结构

- `config.js` - API配置和密钥
- `main.js` - 主同步脚本
- `utils.js` - 工具函数
- `triggers.js` - 定时触发器设置

## 使用方法

1. 在Google Sheets中打开Apps Script编辑器
2. 将这些文件内容复制到对应的.gs文件中
3. 配置好API密钥和Google Sheets ID
4. 运行`setupTriggers()`设置定时任务

## 注意事项

- 请勿将此文件夹推送到Git仓库
- API密钥请从环境变量获取或直接在GAS中配置
- 测试时请先运行`testSync()`检查连接