#!/bin/bash

# 自定义 DMG 构建脚本
# 生成简洁的拖拽安装 DMG（左边 Applications，右边 App）

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RELEASE_DIR="$PROJECT_DIR/release"
APP_NAME="ClipTool"
DMG_NAME="${APP_NAME}-1.0.0-arm64.dmg"
VOLUME_NAME="$APP_NAME"
STAGING_DIR="$RELEASE_DIR/dmg-staging"
DMG_TEMP="$RELEASE_DIR/${APP_NAME}-temp.dmg"
DMG_PATH="$RELEASE_DIR/$DMG_NAME"

# DMG 窗口尺寸（简洁紧凑）
WIN_W=540
WIN_H=380

# 图标位置（左边 Applications，右边 App）
APPS_X=160
APPS_Y=190
APP_X=380
APP_Y=190

echo "========================================="
echo "  ClipTool 拖拽安装 DMG 构建"
echo "========================================="

# 1. 先构建前端和主进程
echo ""
echo "⏳ 步骤 1/4: 构建项目..."
cd "$PROJECT_DIR"
npm run build

# 2. 用 electron-builder 打包 app（仅生成 .app，不生成 DMG）
echo ""
echo "⏳ 步骤 2/4: 打包 Electron 应用..."
# 先清理残留的 staging 目录，避免 find 找到错误路径
rm -rf "$STAGING_DIR"
npx electron-builder --mac --dir

# 找到生成的 .app（排除 dmg-staging 目录）
APP_PATH=$(find "$RELEASE_DIR" -name "${APP_NAME}.app" -maxdepth 2 -type d -not -path "*/dmg-staging/*" | head -1)
if [ -z "$APP_PATH" ]; then
    echo "❌ 未找到 ${APP_NAME}.app"
    exit 1
fi
echo "   找到应用: $APP_PATH"

# 3. 创建 DMG 临时目录
echo ""
echo "⏳ 步骤 3/4: 准备 DMG 内容..."
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# 拷贝 .app
cp -R "$APP_PATH" "$STAGING_DIR/"

# 创建 Applications 链接（便于拖拽安装）
ln -s /Applications "$STAGING_DIR/Applications"

echo "   DMG 内容:"
ls -la "$STAGING_DIR/"

# 4. 创建可读写 HFS+ DMG，拷贝内容并设置窗口布局
echo ""
echo "⏳ 步骤 4/4: 创建 DMG 并设置窗口布局..."

# 先卸载所有同名的 ClipTool 卷（防止之前的残留）
echo "   清理残留挂载..."
for vol in /Volumes/ClipTool*; do
    if [ -d "$vol" ]; then
        hdiutil detach "$vol" -force 2>/dev/null || true
    fi
done

rm -f "$DMG_TEMP" "$DMG_PATH"

# 计算所需大小（app 大小 + 50MB 余量）
APP_SIZE=$(du -sm "$STAGING_DIR" | cut -f1)
DMG_SIZE=$((APP_SIZE + 50))

# 创建空的可读写 HFS+ sparse image
DMG_SPARSE="${DMG_TEMP}.sparseimage"
rm -f "$DMG_SPARSE"
hdiutil create \
    -volname "$VOLUME_NAME" \
    -fs "HFS+" \
    -size "${DMG_SIZE}m" \
    -type SPARSE \
    -ov \
    "$DMG_TEMP"

# 挂载 sparse image
MOUNT_OUTPUT=$(hdiutil attach "$DMG_SPARSE" -readwrite -noverify -noautoopen)
# 从挂载输出中获取实际挂载点
DEVICE=$(echo "$MOUNT_OUTPUT" | grep "Apple_HFS" | awk '{print $1}')
MOUNT_POINT=$(echo "$MOUNT_OUTPUT" | grep "Apple_HFS" | sed 's/.*Apple_HFS[[:space:]]*//')
if [ -z "$DEVICE" ]; then
    DEVICE=$(echo "$MOUNT_OUTPUT" | grep "/dev/" | tail -1 | awk '{print $1}')
    MOUNT_POINT="/Volumes/$VOLUME_NAME"
fi

echo "   已挂载: $MOUNT_POINT (设备: $DEVICE)"

# 手动拷贝所有内容到 DMG 卷中
echo "   拷贝文件到 DMG..."
cp -R "$APP_PATH" "$MOUNT_POINT/"
ln -s /Applications "$MOUNT_POINT/Applications"

echo "   验证 DMG 内容:"
ls -la "$MOUNT_POINT/"

# 等待 Finder 索引完成
sleep 3

# 使用 AppleScript 设置简洁的窗口布局（无背景图）
echo "   设置窗口布局..."

osascript <<EOF || true
tell application "Finder"
    tell disk "$VOLUME_NAME"
        open
        delay 2
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {100, 100, $((100 + WIN_W)), $((100 + WIN_H))}
        set viewOptions to the icon view options of container window
        set arrangement of viewOptions to not arranged
        set icon size of viewOptions to 80
        set text size of viewOptions to 12
        set position of item "${APP_NAME}.app" of container window to {${APP_X}, ${APP_Y}}
        set position of item "Applications" of container window to {${APPS_X}, ${APPS_Y}}
        update without registering applications
        delay 2
        close
    end tell
end tell
EOF

# 同步并等待
sync
sleep 3

# 卸载 DMG
hdiutil detach "$DEVICE" -quiet || hdiutil detach "$DEVICE" -force

# 5. 转换为压缩的只读 DMG
echo ""
echo "⏳ 压缩生成最终 DMG..."
hdiutil convert "$DMG_SPARSE" \
    -format UDZO \
    -imagekey zlib-level=9 \
    -o "$DMG_PATH"

# 清理临时文件
rm -f "$DMG_TEMP" "$DMG_SPARSE"
rm -rf "$STAGING_DIR"

echo ""
echo "========================================="
echo "✅ DMG 构建完成！"
echo "   输出: $DMG_PATH"
echo "   大小: $(du -h "$DMG_PATH" | cut -f1)"
echo "========================================="
