/**
 * 全局快捷键注册模块
 */
import { globalShortcut, BrowserWindow } from 'electron'

/** 显示窗口并发送模式切换指令 */
function showWindowWithMode(win: BrowserWindow, mode: 'save' | 'search') {
  if (win.isVisible()) {
    // 窗口已显示，直接切换模式
    win.webContents.send('window:switchMode', mode)
    win.focus()
  } else {
    win.show()
    win.focus()
    // 等窗口显示后再发送模式切换
    setTimeout(() => {
      win.webContents.send('window:switchMode', mode)
    }, 50)
  }
}

/** 注册全局快捷键 */
export function registerShortcuts(getMainWindow: () => BrowserWindow | null) {
  // Command+Shift+K：显示窗口 → 保存模式（自动读取剪贴板）
  globalShortcut.register('CommandOrControl+Shift+K', () => {
    const win = getMainWindow()
    if (!win) return
    showWindowWithMode(win, 'save')
  })

  // Command+Shift+S：显示窗口 → 搜索模式（自动聚焦搜索框）
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    const win = getMainWindow()
    if (!win) return
    showWindowWithMode(win, 'search')
  })
}

/** 注销所有全局快捷键 */
export function unregisterAllShortcuts() {
  globalShortcut.unregisterAll()
}
