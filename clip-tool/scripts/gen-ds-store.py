#!/usr/bin/env python3
"""
生成 DMG 的 .DS_Store 文件
用于控制 Finder 窗口布局、背景图、图标位置
比 AppleScript 更可靠
"""

import sys
import os

try:
    from ds_store import DSStore
    from mac_alias import Alias
except ImportError:
    print("❌ 需要安装 ds-store 库: pip3 install ds-store")
    sys.exit(1)


def create_ds_store(staging_dir, volume_name, bg_filename="background.png",
                    win_w=660, win_h=400,
                    app_name="ClipTool", app_x=180, app_y=200,
                    apps_x=480, apps_y=200, icon_size=80):
    """
    在 staging_dir 中生成 .DS_Store 文件
    """
    ds_store_path = os.path.join(staging_dir, ".DS_Store")

    with DSStore.open(ds_store_path, "w+") as d:
        # 窗口背景设置 - 使用 .background/background.png
        # Finder 使用 Alias 记录来引用背景图
        bg_path = os.path.join(staging_dir, ".background", bg_filename)
        if os.path.exists(bg_path):
            # 创建背景图的 Alias
            bg_alias = Alias.for_file(bg_path)
            d["."]["BKGD"] = bg_alias

        # 窗口位置和大小 (Finder Window Location)
        # fwi0 格式: top, left, bottom, right, view_mode, ???
        top = 100
        left = 100
        bottom = top + win_h
        right = left + win_w

        # 设置图标视图选项
        d["."]["icvp"] = {
            "backgroundColorBlue": 1.0,
            "backgroundColorGreen": 1.0,
            "backgroundColorRed": 1.0,
            "backgroundType": 2,  # 2 = 图片背景
            "bottomBarVisible": False,
            "gridOffsetX": 0.0,
            "gridOffsetY": 0.0,
            "gridSpacing": 100.0,
            "iconSize": float(icon_size),
            "labelOnBottom": True,
            "showIconPreview": True,
            "showItemInfo": False,
            "sidebarWidth": 0,
            "textSize": 12.0,
            "viewOptionsVersion": 1,
        }

        # 设置图标位置
        d[f"{app_name}.app"]["Iloc"] = (app_x, app_y)
        d["Applications"]["Iloc"] = (apps_x, apps_y)

        # 隐藏 .background 目录
        d[".background"]["Iloc"] = (999, 999)

    print(f"   ✅ .DS_Store 已生成: {ds_store_path}")
    return ds_store_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python3 gen-ds-store.py <staging_dir> [volume_name]")
        sys.exit(1)

    staging_dir = sys.argv[1]
    volume_name = sys.argv[2] if len(sys.argv) > 2 else "ClipTool"

    create_ds_store(staging_dir, volume_name)
