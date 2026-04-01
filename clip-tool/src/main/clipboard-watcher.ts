/**
 * 主进程后台剪贴板监听模块
 * 在后台持续轮询剪贴板变化，不依赖任何窗口的打开状态
 * 检测到新内容后自动写入历史记录，并通知所有渲染进程窗口
 *
 * 重要：不使用 readClipboard()（它优先返回图片），
 * 而是直接使用 Electron clipboard API 分别检测文本和图片变化。
 * macOS 上很多应用复制文本时剪贴板会同时包含文本和图片格式（富文本渲染），
 * 如果优先检测图片会导致文本变化被忽略。
 */
import { clipboard, BrowserWindow } from 'electron'
import { detectContentType } from './clipboard'
import { addClipboardHistory, type ClipboardHistoryItem } from './store'

// 使用 require 导入 crypto，避免 Rollup 将其视为浏览器外部模块
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeCrypto = require('crypto')

/**
 * 生成 UUID v4（兼容低版本 Node.js，不依赖 crypto.randomUUID）
 */
function generateUUID(): string {
  const bytes = nodeCrypto.randomBytes(16) as Buffer
  // 设置 version 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  // 设置 variant
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** 上一次剪贴板文本内容（用于去重） */
let lastClipboardText = ''

/** 上一次剪贴板图片的哈希（用于去重，避免比较巨大的 base64 字符串） */
let lastImageHash = ''

/** 轮询定时器 */
let pollTimer: ReturnType<typeof setInterval> | null = null

/** 轮询间隔（毫秒） */
const POLL_INTERVAL = 500

/**
 * 简单的图片内容哈希（取 PNG buffer 的长度 + 前 64 字节的 hex 作为指纹）
 * 不需要加密级别的哈希，只需要快速判断图片是否变化
 */
function quickImageHash(image: Electron.NativeImage): string {
  const buf = image.toPNG()
  const prefix = buf.subarray(0, 64).toString('hex')
  return `${buf.length}:${prefix}`
}

/**
 * 广播剪贴板变化事件到所有渲染进程窗口
 */
function broadcastClipboardChange(item: ClipboardHistoryItem, updatedHistory: ClipboardHistoryItem[]): void {
  const allWindows = BrowserWindow.getAllWindows()
  for (const win of allWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send('clipboard:changed', {
        newItem: item,
        history: updatedHistory,
      })
    }
  }
}

/**
 * 启动后台剪贴板监听
 * 每 500ms 轮询一次剪贴板，分别检测文本和图片变化：
 * - 优先检测文本变化（绝大多数使用场景）
 * - 仅在没有文本变化时检测纯图片变化（截图等场景）
 * 检测到新内容后：
 * 1. 写入 store 历史记录
 * 2. 通过 IPC 通知所有渲染进程窗口
 */
export function startClipboardWatcher(): void {
  if (pollTimer) return // 防止重复启动

  // 初始化：读取当前剪贴板内容作为基准，避免启动时重复记录
  try {
    const text = clipboard.readText()
    if (text && text.trim()) {
      lastClipboardText = text
    }
    const image = clipboard.readImage()
    if (!image.isEmpty()) {
      lastImageHash = quickImageHash(image)
    }
  } catch {
    // 静默忽略
  }

  pollTimer = setInterval(() => {
    try {
      // 1. 优先检测文本变化
      const currentText = clipboard.readText()
      if (currentText && currentText.trim() && currentText !== lastClipboardText) {
        lastClipboardText = currentText
        // 文本变化时也更新图片哈希基准（因为新的复制操作可能同时改变了图片格式）
        try {
          const img = clipboard.readImage()
          if (!img.isEmpty()) {
            lastImageHash = quickImageHash(img)
          }
        } catch { /* 忽略 */ }

        const detected = detectContentType(currentText)
        const item: ClipboardHistoryItem = {
          id: generateUUID(),
          content: currentText,
          type: detected.type as ClipboardHistoryItem['type'],
          language: detected.language,
          isImage: false,
          timestamp: new Date().toISOString(),
        }

        const updatedHistory = addClipboardHistory(item)
        broadcastClipboardChange(item, updatedHistory)
        return // 文本变化已处理，跳过图片检测
      }

      // 2. 文本没变化时，检测纯图片变化（截图、复制图片等场景）
      const currentImage = clipboard.readImage()
      if (!currentImage.isEmpty()) {
        const currentHash = quickImageHash(currentImage)
        if (currentHash !== lastImageHash) {
          lastImageHash = currentHash
          // 同时更新文本基准（复制图片时文本可能也变了）
          lastClipboardText = currentText || ''

          const base64 = `data:image/png;base64,${currentImage.toPNG().toString('base64')}`
          const item: ClipboardHistoryItem = {
          id: generateUUID(),
          content: base64,
            type: 'image',
            isImage: true,
            timestamp: new Date().toISOString(),
          }

          const updatedHistory = addClipboardHistory(item)
          broadcastClipboardChange(item, updatedHistory)
        }
      }
    } catch {
      // 静默忽略单次轮询异常，不影响后续轮询
    }
  }, POLL_INTERVAL)

  console.log('[ClipboardWatcher] 后台剪贴板监听已启动')
}

/**
 * 停止后台剪贴板监听
 */
export function stopClipboardWatcher(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
    console.log('[ClipboardWatcher] 后台剪贴板监听已停止')
  }
}
