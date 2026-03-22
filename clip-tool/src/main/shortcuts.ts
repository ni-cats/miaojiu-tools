/**
 * 全局快捷键注册模块
 * 支持根据用户自定义配置动态注册快捷键
 */
import { globalShortcut, BrowserWindow } from 'electron'
import { getShortcuts, type ShortcutConfig } from './store'

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

/** 注册全局快捷键（根据用户配置） */
export function registerShortcuts(getMainWindow: () => BrowserWindow | null) {
  const shortcuts = getShortcuts()

  // 注册"唤起保存模式"快捷键
  if (shortcuts.openSave) {
    try {
      globalShortcut.register(shortcuts.openSave, () => {
        const win = getMainWindow()
        if (!win) return
        showWindowWithMode(win, 'save')
      })
    } catch (e) {
      console.error(`注册快捷键 ${shortcuts.openSave} 失败:`, e)
    }
  }

  // 注册"唤起搜索模式"快捷键
  if (shortcuts.openSearch) {
    try {
      globalShortcut.register(shortcuts.openSearch, () => {
        const win = getMainWindow()
        if (!win) return
        showWindowWithMode(win, 'search')
      })
    } catch (e) {
      console.error(`注册快捷键 ${shortcuts.openSearch} 失败:`, e)
    }
  }
}

/** 重新注册所有全局快捷键（用户修改配置后调用） */
export function reRegisterShortcuts(getMainWindow: () => BrowserWindow | null) {
  globalShortcut.unregisterAll()
  registerShortcuts(getMainWindow)
}

/** 注销所有全局快捷键 */
export function unregisterAllShortcuts() {
  globalShortcut.unregisterAll()
}
