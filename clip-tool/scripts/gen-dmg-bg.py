#!/usr/bin/env python3
"""
生成 DMG 安装背景图
经典的拖拽安装界面：左侧 App 图标区域 → 箭头 → 右侧 Applications 文件夹区域
"""

from PIL import Image, ImageDraw, ImageFont
import os
import math

# DMG 窗口尺寸
WIDTH = 660
HEIGHT = 400

# 图标位置（与 AppleScript 中设置的图标位置对应）
APP_ICON_X = 180
APP_ICON_Y = 200
APPS_ICON_X = 480
APPS_ICON_Y = 200

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
LOGO_PATH = os.path.join(PROJECT_DIR, "resources", "icon", "miaojiu-clip-logo.png")
OUTPUT_PATH = os.path.join(PROJECT_DIR, "resources", "dmg-background.png")
OUTPUT_PATH_2X = os.path.join(PROJECT_DIR, "resources", "dmg-background@2x.png")


def draw_rounded_rect(draw, xy, radius, fill):
    """绘制圆角矩形"""
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.pieslice([x0, y0, x0 + 2 * radius, y0 + 2 * radius], 180, 270, fill=fill)
    draw.pieslice([x1 - 2 * radius, y0, x1, y0 + 2 * radius], 270, 360, fill=fill)
    draw.pieslice([x0, y1 - 2 * radius, x0 + 2 * radius, y1], 90, 180, fill=fill)
    draw.pieslice([x1 - 2 * radius, y1 - 2 * radius, x1, y1], 0, 90, fill=fill)


def draw_arrow(draw, start_x, start_y, end_x, end_y, color, width=3, head_size=12):
    """绘制带箭头的线"""
    draw.line([(start_x, start_y), (end_x, end_y)], fill=color, width=width)
    # 箭头头部
    angle = math.atan2(end_y - start_y, end_x - start_x)
    x1 = end_x - head_size * math.cos(angle - math.pi / 6)
    y1 = end_y - head_size * math.sin(angle - math.pi / 6)
    x2 = end_x - head_size * math.cos(angle + math.pi / 6)
    y2 = end_y - head_size * math.sin(angle + math.pi / 6)
    draw.polygon([(end_x, end_y), (x1, y1), (x2, y2)], fill=color)


def create_dmg_background(scale=1):
    """创建 DMG 背景图"""
    w = WIDTH * scale
    h = HEIGHT * scale

    img = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(img)

    # 绘制渐变背景（从深灰到浅灰，现代感）
    for y in range(h):
        ratio = y / h
        # 从 #1a1a2e 到 #16213e 的渐变
        r = int(26 + (22 - 26) * ratio)
        g = int(26 + (33 - 26) * ratio)
        b = int(46 + (62 - 46) * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b, 255))

    # 绘制微妙的光晕效果（中心偏上）
    center_x, center_y = w // 2, int(h * 0.35)
    max_radius = int(w * 0.5)
    for radius in range(max_radius, 0, -1):
        alpha = int(15 * (1 - radius / max_radius))
        if alpha > 0:
            draw.ellipse(
                [center_x - radius, center_y - radius,
                 center_x + radius, center_y + radius],
                fill=(100, 120, 200, alpha)
            )

    # 箭头区域（中间的拖拽指引箭头）
    arrow_y = APP_ICON_Y * scale
    arrow_start_x = (APP_ICON_X + 55) * scale
    arrow_end_x = (APPS_ICON_X - 55) * scale
    arrow_color = (255, 255, 255, 140)

    # 绘制虚线箭头
    dash_len = 12 * scale
    gap_len = 8 * scale
    total_len = arrow_end_x - arrow_start_x
    x = arrow_start_x
    while x < arrow_end_x - 20 * scale:
        seg_end = min(x + dash_len, arrow_end_x - 20 * scale)
        draw.line([(x, arrow_y), (seg_end, arrow_y)], fill=arrow_color, width=3 * scale)
        x += dash_len + gap_len

    # 箭头头部
    head_size = 16 * scale
    tip_x = arrow_end_x
    draw.polygon([
        (tip_x, arrow_y),
        (tip_x - head_size, arrow_y - head_size // 2),
        (tip_x - head_size, arrow_y + head_size // 2)
    ], fill=arrow_color)

    # 底部提示文字
    try:
        font_size = 14 * scale
        font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", font_size)
    except Exception:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except Exception:
            font = ImageFont.load_default()

    text = "拖拽 ClipTool 到 Applications 文件夹完成安装"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_x = (w - text_w) // 2
    text_y = int(h * 0.82)
    draw.text((text_x, text_y), text, fill=(255, 255, 255, 180), font=font)

    # 顶部标题
    try:
        title_font_size = 22 * scale
        title_font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", title_font_size)
    except Exception:
        title_font = font

    title = "安装 ClipTool"
    bbox = draw.textbbox((0, 0), title, font=title_font)
    title_w = bbox[2] - bbox[0]
    title_x = (w - title_w) // 2
    title_y = int(h * 0.08)
    draw.text((title_x, title_y), title, fill=(255, 255, 255, 220), font=title_font)

    return img


def main():
    print("🎨 生成 DMG 背景图...")

    # 1x 版本
    img_1x = create_dmg_background(scale=1)
    img_1x.save(OUTPUT_PATH, "PNG")
    print(f"   ✅ 1x: {OUTPUT_PATH} ({img_1x.size[0]}x{img_1x.size[1]})")

    # 2x Retina 版本
    img_2x = create_dmg_background(scale=2)
    img_2x.save(OUTPUT_PATH_2X, "PNG")
    print(f"   ✅ 2x: {OUTPUT_PATH_2X} ({img_2x.size[0]}x{img_2x.size[1]})")

    print("🎉 DMG 背景图生成完成！")


if __name__ == "__main__":
    main()
