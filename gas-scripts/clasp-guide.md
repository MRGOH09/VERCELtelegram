# Clasp 自动化部署指南

## 🎉 设置完成！

已为你配置好clasp自动化部署系统，从此告别手动复制粘贴！

## 📁 项目结构
```
gas-scripts/
├── .clasp.json          # clasp项目配置
├── appsscript.json      # GAS项目配置
├── config.gs            # 配置文件(已转换为.gs)
├── main.gs              # 主脚本
├── utils.gs             # 工具函数  
├── triggers.gs          # 触发器管理
├── deploy.sh            # 首次部署脚本
├── quick-update.sh      # 快速更新脚本
└── *.md                 # 文档文件
```

## 🚀 使用方法

### 首次部署：
```bash
cd gas-scripts
./deploy.sh
```

这个脚本会：
1. ✅ 检查登录状态
2. ✅ 创建新的GAS项目
3. ✅ 上传所有代码文件
4. ✅ 自动打开GAS编辑器

### 日常更新：
```bash
cd gas-scripts
./quick-update.sh
```

只需要5秒钟就能更新所有代码！

## 🔧 工作流程

### 1. 修改代码
直接编辑本地的`.gs`文件：
- `config.gs` - 修改配置
- `main.gs` - 修改主逻辑
- `utils.gs` - 添加工具函数
- `triggers.gs` - 管理定时任务

### 2. 快速部署
```bash
./quick-update.sh
```

### 3. 在GAS中测试
代码会自动同步到Google Apps Script编辑器

## ⚡ 常用命令

```bash
# 查看项目信息
clasp list

# 打开GAS编辑器
clasp open

# 查看部署版本
clasp deployments

# 拉取远程代码(如果在GAS中修改了)
clasp pull

# 实时监控(自动推送变更)
clasp push --watch
```

## 🎯 优势

- 🚫 **不再复制粘贴**：一键部署所有更新
- ⚡ **超快速度**：5秒完成部署
- 🔄 **版本同步**：本地和云端保持一致
- 🛠️ **本地开发**：使用熟悉的编辑器
- 📝 **版本控制**：可以使用Git管理代码历史

## 🔥 高级用法

### 自动监控模式：
```bash
# 文件变更时自动推送
clasp push --watch
```

### 部署特定版本：
```bash
# 创建正式版本
clasp deploy --description "v1.0 - 初始版本"
```

## 🆘 故障排除

### 登录问题：
```bash
clasp login
```

### 权限问题：
确保Google账户有Apps Script权限

### 文件同步问题：
```bash
# 强制推送
clasp push --force
```

## 🎊 下一步

现在你可以：
1. 运行 `./deploy.sh` 开始首次部署
2. 在GAS编辑器中配置API密钥
3. 享受自动化的开发体验！

不再需要手动复制粘贴，开发效率提升100倍！🚀