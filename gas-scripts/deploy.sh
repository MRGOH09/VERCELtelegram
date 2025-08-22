#!/bin/bash

echo "🚀 开始部署Supabase同步脚本到Google Apps Script..."

# 检查是否在正确的目录
if [ ! -f ".clasp.json" ]; then
    echo "❌ 错误：请在gas-scripts目录中运行此脚本"
    exit 1
fi

# 检查是否已登录
if ! clasp login --status; then
    echo "🔑 需要登录Google账户..."
    clasp login
fi

# 检查是否有scriptId
if grep -q '"scriptId": ""' .clasp.json; then
    echo "📝 创建新的Google Apps Script项目..."
    clasp create --type sheets --title "Supabase数据同步脚本"
else
    echo "📤 推送代码到现有项目..."
fi

# 推送代码
echo "⬆️  上传文件到Google Apps Script..."
clasp push

if [ $? -eq 0 ]; then
    echo "✅ 部署成功！"
    echo ""
    echo "📋 下一步："
    echo "1. 在Google Sheets中打开Apps Script编辑器"
    echo "2. 配置config.gs中的API密钥和Sheets ID" 
    echo "3. 运行testSync()函数测试连接"
    echo "4. 运行setupTriggers()设置定时任务"
    echo ""
    echo "🔗 打开Apps Script编辑器："
    clasp open
else
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi