/**
 * 全局快捷键注册模块
 * 支持根据用户自定义配置动态注册快捷键
 */
import { globalShortcut, BrowserWindow, Notification } from 'electron'
import { getShortcuts, type ShortcutConfig } from './store'

/** 所有支持通过全局快捷键唤起的模式 */
type WindowMode = 'save' | 'search' | 'editor' | 'doc' | 'ai' | 'favorite' | 'settings' | 'profile' | 'launcher'

/** 显示窗口并发送模式切换指令（支持在全屏应用上方显示） */
function showWindowWithMode(win: BrowserWindow, mode: WindowMode) {
  // 确保窗口在所有工作空间可见（包括全屏空间）
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // 临时置顶，确保在全屏应用上方显示
  win.setAlwaysOnTop(true, 'floating')

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

  // 短暂延迟后取消置顶和全工作空间可见，避免窗口一直悬浮在最上层
  setTimeout(() => {
    win.setAlwaysOnTop(false)
    win.setVisibleOnAllWorkspaces(false)
  }, 300)
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

  const failedShortcuts: { key: string; accelerator: string }[] = []

  for (const { key, mode } of SHORTCUT_MODE_MAP) {
    const accelerator = shortcuts[key]
    if (accelerator) {
      try {
        const success = globalShortcut.register(accelerator, () => {
          const win = getMainWindow()
          if (!win) return
          showWindowWithMode(win, mode)
        })
        if (!success) {
          console.warn(`快捷键 ${accelerator}（${key}）注册失败，可能被其他应用占用`)
          failedShortcuts.push({ key, accelerator })
        }
      } catch (e) {
        console.error(`注册快捷键 ${accelerator}（${key}）异常:`, e)
        failedShortcuts.push({ key, accelerator })
      }
    }
  }

  // 如果有注册失败的快捷键，通过系统通知提醒用户
  if (failedShortcuts.length > 0) {
    const details = failedShortcuts.map((f) => `${f.accelerator}`).join('、')
    try {
      const notification = new Notification({
        title: 'ClipTool 快捷键冲突',
        body: `以下快捷键注册失败（可能被其他应用占用）：${details}\n请在设置中修改快捷键`,
      })
      notification.show()
    } catch (e) {
      console.warn('发送快捷键冲突通知失败:', e)
    }

    // 同时通知渲染进程（如果窗口已就绪）
    try {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('shortcuts:conflict', failedShortcuts)
      }
    } catch (e) {
      console.warn('通知渲染进程快捷键冲突失败:', e)
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
