#!/bin/bash
# 生成 macOS 应用图标 (.icns)
# 为图标添加合适的 padding，使其符合 macOS 图标规范
set -e

SRC="/tmp/clip-icon-square.png"
ICONSET="/tmp/clip-icon-final.iconset"
OUT="/tmp/clip-iconset-padded"
DEST="$(cd "$(dirname "$0")" && pwd)/../resources/icon.icns"

rm -rf "$ICONSET" "$OUT"
mkdir -p "$ICONSET" "$OUT"

# 使用 Python 给图标添加 padding（macOS 规范：图标内容不应填满整个画布）
# 约 10% 的 padding
python3 << 'PYEOF'
import subprocess, os, sys

src = "/tmp/clip-icon-square.png"
out_dir = "/tmp/clip-iconset-padded"

# macOS icon sizes: 16, 32, 64, 128, 256, 512, 1024
sizes = [16, 32, 64, 128, 256, 512, 1024]

for size in sizes:
    # 图标内容占画布的约 80%（留 10% padding 每边）
    content_size = int(size * 0.82)
    if content_size < 1:
        content_size = size

    padding = (size - content_size) // 2
    out_path = os.path.join(out_dir, f"icon_{size}.png")

    # 先缩放到 content_size
    tmp_path = f"/tmp/clip_tmp_{size}.png"
    subprocess.run(["sips", "-z", str(content_size), str(content_size), src, "--out", tmp_path],
                   capture_output=True, check=True)

    # 然后 padToHeightWidth 到 size
    subprocess.run(["sips", "-p", str(size), str(size), tmp_path, "--out", out_path],
                   capture_output=True, check=True)

    os.remove(tmp_path)
    print(f"  ✓ {size}x{size}")

print("所有尺寸生成完成")
PYEOF

# 复制到 iconset 目录
cp "$OUT/icon_16.png"   "$ICONSET/icon_16x16.png"
cp "$OUT/icon_32.png"   "$ICONSET/icon_16x16@2x.png"
cp "$OUT/icon_32.png"   "$ICONSET/icon_32x32.png"
cp "$OUT/icon_64.png"   "$ICONSET/icon_32x32@2x.png"
cp "$OUT/icon_128.png"  "$ICONSET/icon_128x128.png"
cp "$OUT/icon_256.png"  "$ICONSET/icon_128x128@2x.png"
cp "$OUT/icon_256.png"  "$ICONSET/icon_256x256.png"
cp "$OUT/icon_512.png"  "$ICONSET/icon_256x256@2x.png"
cp "$OUT/icon_512.png"  "$ICONSET/icon_512x512.png"
cp "$OUT/icon_1024.png" "$ICONSET/icon_512x512@2x.png"

# 生成 icns
iconutil -c icns "$ICONSET" -o "$DEST"
rm -rf "$ICONSET" "$OUT"

echo "✅ icon.icns -> $DEST"
ls -lh "$DEST"
