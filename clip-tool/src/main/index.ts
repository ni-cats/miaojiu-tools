/**
 * Electron 主进程入口
 * 负责窗口创建、生命周期管理
 */
import { app, BrowserWindow } from 'electron'
import path from 'path'
import { registerShortcuts, unregisterAllShortcuts } from './shortcuts'
import { createTray } from './tray'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

function getMainWindow() {
  return mainWindow
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 620,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
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

  // 窗口居中
  mainWindow.center()

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
    // 延迟隐藏，避免点击托盘图标时窗口立即隐藏
    setTimeout(() => {
      if (mainWindow && !mainWindow.isFocused()) {
        mainWindow.hide()
      }
    }, 100)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 不显示 Dock 图标（menubar 应用）
app.dock?.hide()

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

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow()
  }
})
