#!/usr/bin/env python3
"""
裁剪图标：只保留椭圆形部分，去掉外边框背景
然后生成 macOS 应用图标 (.icns) 和托盘图标
"""
from PIL import Image, ImageDraw
import numpy as np
import subprocess
import os
import sys

SRC = '/Users/miaojiu/IdeaProjects/miaojiu-tools/clip-tool/resources/icon/cliptool.png'
RESOURCES = '/Users/miaojiu/IdeaProjects/miaojiu-tools/clip-tool/resources'

def find_ellipse_bounds(img_array):
    """找到图片中椭圆形内容的边界（深色边框的外缘）"""
    h, w = img_array.shape[:2]
    
    # 找深色像素的边界（椭圆边框 RGB sum < 250）
    min_x, max_x, min_y, max_y = w, 0, h, 0
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = img_array[y, x]
            if a > 10 and (int(r) + int(g) + int(b)) < 250:
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
    
    return min_x, min_y, max_x, max_y

def crop_ellipse(src_path, output_path):
    """裁剪图片为椭圆形，去掉外部背景"""
    img = Image.open(src_path).convert('RGBA')
    arr = np.array(img)
    h, w = arr.shape[:2]
    
    # 椭圆区域边界（从之前的分析得知）
    # 深色像素 X: 223-1550, Y: 315-1670
    # 添加少量padding
    pad = 5
    x1, y1, x2, y2 = 223 - pad, 315 - pad, 1550 + pad, 1670 + pad
    
    # 裁剪到椭圆区域
    cropped = img.crop((x1, y1, x2, y2))
    cw, ch = cropped.size
    
    # 创建椭圆形遮罩
    mask = Image.new('L', (cw, ch), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([0, 0, cw - 1, ch - 1], fill=255)
    
    # 应用遮罩
    result = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    result.paste(cropped, (0, 0), mask)
    
    # 保存为正方形（取最大边）
    size = max(cw, ch)
    final = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    offset_x = (size - cw) // 2
    offset_y = (size - ch) // 2
    final.paste(result, (offset_x, offset_y), result)
    
    final.save(output_path)
    print(f'  ✓ 裁剪完成: {final.size[0]}x{final.size[1]} -> {output_path}')
    return final

def generate_icons(cropped_path):
    """从裁剪后的图片生成各种尺寸的图标"""
    img = Image.open(cropped_path).convert('RGBA')
    
    # 生成 iconset 各尺寸
    iconset_dir = '/tmp/clip-icon-final.iconset'
    os.makedirs(iconset_dir, exist_ok=True)
    
    icon_sizes = {
        'icon_16x16.png': 16,
        'icon_16x16@2x.png': 32,
        'icon_32x32.png': 32,
        'icon_32x32@2x.png': 64,
        'icon_128x128.png': 128,
        'icon_128x128@2x.png': 256,
        'icon_256x256.png': 256,
        'icon_256x256@2x.png': 512,
        'icon_512x512.png': 512,
        'icon_512x512@2x.png': 1024,
    }
    
    for name, size in icon_sizes.items():
        # 图标内容占 82%（macOS 规范留 padding）
        content_size = int(size * 0.82)
        padding = (size - content_size) // 2
        
        resized = img.resize((content_size, content_size), Image.LANCZOS)
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        canvas.paste(resized, (padding, padding), resized)
        canvas.save(os.path.join(iconset_dir, name))
        print(f'  ✓ {name} ({size}x{size})')
    
    # 生成 .icns
    icns_path = os.path.join(RESOURCES, 'icon.icns')
    subprocess.run(
        ['iconutil', '-c', 'icns', iconset_dir, '-o', icns_path],
        check=True
    )
    print(f'  ✓ icon.icns -> {icns_path}')
    
    # 生成托盘图标（不需要 padding，直接缩放）
    tray_dir = os.path.join(RESOURCES, 'icon')
    tray_16 = img.resize((16, 16), Image.LANCZOS)
    tray_32 = img.resize((32, 32), Image.LANCZOS)
    tray_16.save(os.path.join(tray_dir, 'tray-icon.png'))
    tray_32.save(os.path.join(tray_dir, 'tray-icon@2x.png'))
    print(f'  ✓ tray-icon.png (16x16)')
    print(f'  ✓ tray-icon@2x.png (32x32)')
    
    # 清理临时文件
    import shutil
    shutil.rmtree(iconset_dir, ignore_errors=True)

def prepare_square(src_path, output_path):
    """将图片调整为正方形（居中放置）"""
    img = Image.open(src_path).convert('RGBA')
    w, h = img.size
    size = max(w, h)
    final = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    offset_x = (size - w) // 2
    offset_y = (size - h) // 2
    final.paste(img, (offset_x, offset_y), img)
    final.save(output_path)
    print(f'  ✓ 正方形化完成: {final.size[0]}x{final.size[1]} -> {output_path}')
    return final

if __name__ == '__main__':
    print('🔧 Step 1: 将图标调整为正方形...')
    prepared_path = '/tmp/clip-icon-prepared.png'
    prepare_square(SRC, prepared_path)
    
    print('🔧 Step 2: 生成各尺寸图标...')
    generate_icons(prepared_path)
    
    print('✅ 所有图标生成完成!')
