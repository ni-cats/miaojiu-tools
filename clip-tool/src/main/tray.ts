/**
 * 系统托盘模块
 */
import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import path from 'path'

let tray: Tray | null = null

/** 创建系统托盘 */
export function createTray(getMainWindow: () => BrowserWindow | null) {
  // 使用喵九剪贴板彩色图标（不使用 Template 模式，保留原始颜色）
  const iconPath = path.join(__dirname, '../../resources/icon/tray-icon@2x.png')

  let icon: nativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    // 将图标缩放到 16x16（macOS 菜单栏标准尺寸），@2x 实际渲染为高清
    icon = icon.resize({ width: 16, height: 16 })
  } catch {
    // 如果图标文件不存在，创建一个空图标
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('ClipTool - 剪贴板片段管理')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      accelerator: 'CommandOrControl+Shift+K',
      click: () => {
        const win = getMainWindow()
        if (win) {
          win.show()
          win.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      accelerator: 'CommandOrControl+Q',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // 点击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })

  return tray
}
