/**
 * Electron 主进程入口
 * 负责窗口创建、生命周期管理
 */
import { app, BrowserWindow, screen } from 'electron'
import path from 'path'
import { registerShortcuts, unregisterAllShortcuts } from './shortcuts'
import { createTray } from './tray'
import { registerIpcHandlers } from './ipc'
import { getWindowBounds, saveWindowBounds, pushSettingsToCloud, pullSettingsFromCloud, getCosConfig } from './store'
import { startClipboardWatcher, stopClipboardWatcher } from './clipboard-watcher'

let mainWindow: BrowserWindow | null = null
let historyWindow: BrowserWindow | null = null

function getMainWindow() {
  return mainWindow
}

function getHistoryWindow() {
  return historyWindow
}

/** 创建独立的剪贴板历史子窗口 */
function createHistoryWindow() {
  // 如果已存在，直接聚焦
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.show()
    historyWindow.focus()
    return
  }

  // 获取主窗口所在屏幕（修复副屏 Bug：不再使用 primaryDisplay）
  const mainBounds = mainWindow?.getBounds()

  const winWidth = 500
  const winHeight = 560

  let x: number | undefined
  let y: number | undefined
  if (mainBounds) {
    // 获取主窗口中心点所在的屏幕
    const centerX = mainBounds.x + Math.round(mainBounds.width / 2)
    const centerY = mainBounds.y + Math.round(mainBounds.height / 2)
    const display = screen.getDisplayNearestPoint({ x: centerX, y: centerY })
    const { x: workX, y: workY, width: workWidth, height: workHeight } = display.workArea

    // 水平居中对齐主窗口
    x = mainBounds.x + Math.round((mainBounds.width - winWidth) / 2)
    // 放在主窗口上方
    y = mainBounds.y - winHeight - 10

    // 如果上方空间不够，放在主窗口下方
    if (y < workY) {
      y = mainBounds.y + mainBounds.height + 10
    }
    // 如果下方也不够，居中显示在屏幕上
    if (y + winHeight > workY + workHeight) {
      y = workY + Math.round((workHeight - winHeight) / 2)
    }
    // 确保 x 不超出屏幕边界
    if (x < workX) x = workX
    if (x + winWidth > workX + workWidth) x = workX + workWidth - winWidth
  }

  historyWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    ...(x !== undefined && y !== undefined ? { x, y } : {}),
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    minWidth: 320,
    minHeight: 300,
    skipTaskbar: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -999, y: -999 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // 加载页面（带 hash 标识为历史窗口）
  if (process.env.VITE_DEV_SERVER === '1') {
    historyWindow.loadURL('http://localhost:5173#clipboard-history').catch(() => {
      historyWindow?.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'clipboard-history' })
    })
  } else {
    historyWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'clipboard-history' })
  }

  historyWindow.once('ready-to-show', () => {
    historyWindow?.show()
    historyWindow?.focus()
  })

  historyWindow.on('closed', () => {
    historyWindow = null
  })
}

function createMainWindow() {
  // 读取记忆的窗口大小和位置
  const savedBounds = getWindowBounds()

  // 首次打开时根据屏幕大小自动适配窗口尺寸
  const isFirstOpen = savedBounds.x === undefined && savedBounds.y === undefined
  let windowWidth = savedBounds.width
  let windowHeight = savedBounds.height
  if (isFirstOpen) {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
    // 窗口宽度取屏幕宽度的 45%，高度取屏幕高度的 75%，确保所有 Tab 标题在一行内显示
    windowWidth = Math.max(580, Math.min(Math.round(screenWidth * 0.45), 960))
    windowHeight = Math.max(500, Math.min(Math.round(screenHeight * 0.75), 1080))
  }

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    ...(savedBounds.x !== undefined && savedBounds.y !== undefined
      ? { x: savedBounds.x, y: savedBounds.y }
      : {}),
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    minWidth: 520,
    minHeight: 400,
    skipTaskbar: true,
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

  // 不再在失焦时自动隐藏窗口，仅通过用户主动操作（Escape、双击空格等）关闭

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 保留 Dock 图标，方便用户点击 Dock 唤起窗口

app.whenReady().then(() => {
  createMainWindow()
  createTray(getMainWindow)
  registerShortcuts(getMainWindow)
  registerIpcHandlers(getMainWindow, getHistoryWindow, createHistoryWindow)

  // 启动后台剪贴板监听（不依赖任何窗口）
  startClipboardWatcher()

  // 首次启动自动显示窗口，让用户知道应用已运行
  if (mainWindow) {
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show()
      mainWindow?.focus()
    })
  }

  // 启动时自动同步设置：先从云端拉取（确保本地是最新的），再推送本地到云端
  const cosConfig = getCosConfig()
  if (cosConfig.enabled) {
    pullSettingsFromCloud().then((result) => {
      console.log(`[启动同步] 从云端拉取设置: ${result ? '成功' : '云端暂无数据'}`)
      // 拉取完成后再推送本地数据到云端（确保本地新增的设置项也同步上去）
      return pushSettingsToCloud()
    }).then((ok) => {
      console.log(`[启动同步] 本地数据推送到云端: ${ok ? '成功' : '失败'}`)
    }).catch((err) => {
      console.error('[启动同步] 同步失败:', err)
    })
  }
})

app.on('will-quit', () => {
  stopClipboardWatcher()
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
  // 从 Launchpad 或 Dock 点击时，显示窗口并默认进入保存模式
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('switch-mode', 'save')
  }
})