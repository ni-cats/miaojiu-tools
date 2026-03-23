/**
 * Electron 主进程入口
 * 负责窗口创建、生命周期管理
 */
import { app, BrowserWindow } from 'electron'
import path from 'path'
import { registerShortcuts, unregisterAllShortcuts } from './shortcuts'
import { createTray } from './tray'
import { registerIpcHandlers } from './ipc'
import { getWindowBounds, saveWindowBounds } from './store'

let mainWindow: BrowserWindow | null = null

function getMainWindow() {
  return mainWindow
}

function createMainWindow() {
  // 读取记忆的窗口大小和位置
  const savedBounds = getWindowBounds()

  mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    ...(savedBounds.x !== undefined && savedBounds.y !== undefined
      ? { x: savedBounds.x, y: savedBounds.y }
      : {}),
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    minWidth: 400,
    minHeight: 400,
    skipTaskbar: true,
    alwaysOnTop: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -999, y: -999 }, // 隐藏红绿灯按钮
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // 如果没有保存过位置，窗口居中
  if (savedBounds.x === undefined || savedBounds.y === undefined) {
    mainWindow.center()
  }

  // 监听窗口大小和位置变化，防抖保存
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const debounceSaveBounds = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds()
        saveWindowBounds({
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
        })
      }
    }, 500)
  }

  mainWindow.on('resize', debounceSaveBounds)
  mainWindow.on('move', debounceSaveBounds)

  // 加载页面
  // 设置 VITE_DEV_SERVER=1 时连接 Vite dev server，否则加载本地文件
  if (process.env.VITE_DEV_SERVER === '1') {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow?.loadFile(path.join(__dirname, '../renderer/index.html'))
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 窗口失焦时自动隐藏
  mainWindow.on('blur', () => {
    // 延迟隐藏，避免点击托盘图标/Dock图标时窗口立即隐藏
    setTimeout(() => {
      if (mainWindow && !mainWindow.isFocused()) {
        lastVisibleTime = Date.now()
        mainWindow.hide()
      }
    }, 200)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 保留 Dock 图标，方便用户点击 Dock 唤起窗口

app.whenReady().then(() => {
  createMainWindow()
  createTray(getMainWindow)
  registerShortcuts(getMainWindow)
  registerIpcHandlers(getMainWindow)
})

app.on('will-quit', () => {
  unregisterAllShortcuts()
})

app.on('window-all-closed', () => {
  // macOS 上不退出应用
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 记录窗口上次可见的时间，用于判断 Dock 点击时的切换行为
let lastVisibleTime = 0

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow()
  }
  // 点击 Dock 图标时切换窗口显示/隐藏
  if (mainWindow) {
    const now = Date.now()
    // 如果窗口刚刚因为 blur 隐藏（200ms 内），说明用户点击 Dock 前窗口是可见的，不再显示
    if (now - lastVisibleTime < 300) {
      // 窗口刚刚是可见状态，用户点击 Dock 意图是关闭，不做操作（blur 已经隐藏了）
      return
    }
    mainWindow.show()
    mainWindow.focus()
  }
})