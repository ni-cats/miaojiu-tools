/**
 * 全局快捷键注册模块
 * 支持根据用户自定义配置动态注册快捷键
 */
import { globalShortcut, BrowserWindow } from 'electron'
import { getShortcuts, type ShortcutConfig } from './store'

/** 所有支持通过全局快捷键唤起的模式 */
type WindowMode = 'save' | 'search' | 'editor' | 'doc' | 'ai' | 'favorite' | 'settings' | 'profile' | 'launcher'

/** 显示窗口并发送模式切换指令 */
function showWindowWithMode(win: BrowserWindow, mode: WindowMode) {
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

/** 快捷键配置字段到模式的映射 */
const SHORTCUT_MODE_MAP: { key: keyof ShortcutConfig; mode: WindowMode }[] = [
  { key: 'openSave', mode: 'save' },
  { key: 'openSearch', mode: 'search' },
  { key: 'openEditor', mode: 'editor' },
  { key: 'openDoc', mode: 'doc' },
  { key: 'openAi', mode: 'ai' },
  { key: 'openFavorite', mode: 'favorite' },
  { key: 'openSettings', mode: 'settings' },
  { key: 'openProfile', mode: 'profile' },
  { key: 'openLauncher', mode: 'launcher' },
]

/** 注册全局快捷键（根据用户配置） */
export function registerShortcuts(getMainWindow: () => BrowserWindow | null) {
  const shortcuts = getShortcuts()

  for (const { key, mode } of SHORTCUT_MODE_MAP) {
    const accelerator = shortcuts[key]
    if (accelerator) {
      try {
        globalShortcut.register(accelerator, () => {
          const win = getMainWindow()
          if (!win) return
          showWindowWithMode(win, mode)
        })
      } catch (e) {
        console.error(`注册快捷键 ${accelerator}（${key}）失败:`, e)
      }
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
