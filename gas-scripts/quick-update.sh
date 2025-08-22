#!/bin/bash

echo "⚡ 快速更新脚本到Google Apps Script..."

# 进入gas-scripts目录
cd "$(dirname "$0")"

# 推送更新
clasp push

if [ $? -eq 0 ]; then
    echo "✅ 更新成功！"
    echo "💡 提示：记得在GAS编辑器中刷新查看更新"
else
    echo "❌ 更新失败"
    exit 1
fi