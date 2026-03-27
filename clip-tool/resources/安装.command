#!/bin/bash

# ClipTool 安装脚本
# 双击此文件即可完成安装

echo "========================================="
echo "  ClipTool 安装程序"
echo "========================================="
echo ""

# 获取脚本所在目录（即 DMG 挂载目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="ClipTool.app"
APP_SOURCE="$SCRIPT_DIR/$APP_NAME"
APP_TARGET="/Applications/$APP_NAME"

# 检查应用是否存在
if [ ! -d "$APP_SOURCE" ]; then
    echo "❌ 错误：未找到 $APP_NAME"
    echo "   请确保从 DMG 中运行此脚本"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi

# 如果已安装，先关闭正在运行的实例
if pgrep -x "ClipTool" > /dev/null 2>&1; then
    echo "⏳ 正在关闭运行中的 ClipTool..."
    killall "ClipTool" 2>/dev/null
    sleep 1
fi

# 如果已存在旧版本，先删除
if [ -d "$APP_TARGET" ]; then
    echo "⏳ 检测到旧版本，正在替换..."
    rm -rf "$APP_TARGET"
fi

# 拷贝应用到 /Applications
echo "⏳ 正在安装 ClipTool 到 /Applications..."
cp -R "$APP_SOURCE" "$APP_TARGET"

if [ $? -ne 0 ]; then
    echo "❌ 安装失败，请尝试手动拖拽安装"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi

# 移除隔离属性（解决"已损坏"提示）
echo "⏳ 正在移除安全隔离属性..."
xattr -cr "$APP_TARGET"

echo ""
echo "✅ 安装完成！"
echo ""

# 询问是否立即打开
read -p "是否立即打开 ClipTool？(Y/n) " answer
answer=${answer:-Y}
if [[ "$answer" =~ ^[Yy]$ ]]; then
    echo "🚀 正在启动 ClipTool..."
    open "$APP_TARGET"
fi

echo ""
echo "你现在可以关闭此窗口了。"
exit 0
