#!/bin/bash

# 自定义 DMG 构建脚本
# 将 ClipTool.app + 安装.command + Applications 链接打包进 DMG

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RELEASE_DIR="$PROJECT_DIR/release"
APP_NAME="ClipTool"
DMG_NAME="${APP_NAME}-1.0.0-arm64.dmg"
VOLUME_NAME="$APP_NAME"
STAGING_DIR="$RELEASE_DIR/dmg-staging"

echo "========================================="
echo "  ClipTool 自定义 DMG 构建"
echo "========================================="

# 1. 先构建前端和主进程
echo ""
echo "⏳ 步骤 1/4: 构建项目..."
cd "$PROJECT_DIR"
npm run build

# 2. 确保安装脚本有执行权限
chmod +x "$PROJECT_DIR/resources/安装.command"

# 3. 用 electron-builder 打包 app（仅生成 .app，不生成 DMG）
echo ""
echo "⏳ 步骤 2/4: 打包 Electron 应用..."
npx electron-builder --mac --dir

# 找到生成的 .app
APP_PATH=$(find "$RELEASE_DIR" -name "${APP_NAME}.app" -maxdepth 2 -type d | head -1)
if [ -z "$APP_PATH" ]; then
    echo "❌ 未找到 ${APP_NAME}.app"
    exit 1
fi
echo "   找到应用: $APP_PATH"

# 4. 创建 DMG 临时目录
echo ""
echo "⏳ 步骤 3/4: 准备 DMG 内容..."
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# 拷贝 .app
cp -R "$APP_PATH" "$STAGING_DIR/"

# 创建 Applications 链接
ln -s /Applications "$STAGING_DIR/Applications"

# 拷贝安装脚本
cp "$PROJECT_DIR/resources/安装.command" "$STAGING_DIR/安装.command"
chmod +x "$STAGING_DIR/安装.command"

echo "   DMG 内容:"
ls -la "$STAGING_DIR/"

# 5. 创建 DMG
echo ""
echo "⏳ 步骤 4/4: 生成 DMG..."
DMG_PATH="$RELEASE_DIR/$DMG_NAME"
rm -f "$DMG_PATH"

# 使用 hdiutil 创建 DMG
hdiutil create \
    -volname "$VOLUME_NAME" \
    -srcfolder "$STAGING_DIR" \
    -ov \
    -format UDZO \
    "$DMG_PATH"

# 清理临时目录
rm -rf "$STAGING_DIR"

echo ""
echo "========================================="
echo "✅ DMG 构建完成！"
echo "   输出: $DMG_PATH"
echo "   大小: $(du -h "$DMG_PATH" | cut -f1)"
echo "========================================="
