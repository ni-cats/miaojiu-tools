/**
 * OCR 引擎服务模块
 * 基于 Tesseract.js 实现端侧离线 OCR 文字识别
 * 支持中英文识别，语言包内置到应用资源中
 */
import { app } from 'electron'
import path from 'path'

// 使用 require 引入 tesseract.js（避免 ESM 兼容问题）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Tesseract = require('tesseract.js')

/** OCR 识别结果 */
export interface OcrResult {
  text: string
  confidence: number
}

/** OCR 引擎状态 */
export interface OcrStatus {
  ready: boolean
  loading: boolean
}

/** Tesseract Worker 实例 */
let ocrWorker: ReturnType<typeof Tesseract.createWorker> | null = null

/** 引擎状态 */
let engineReady = false
let engineLoading = false

/** 并发锁：同一时间只允许一个 OCR 任务 */
let recognizing = false

/**
 * 获取语言包目录路径
 * 开发模式：项目根目录/resources/tessdata/
 * 打包模式：app.asar 内的 /resources/tessdata/
 */
function getTessdataPath(): string {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'resources', 'tessdata')
  }
  return path.resolve(__dirname, '../../resources/tessdata')
}

/**
 * 获取 Tesseract.js worker 核心文件路径
 * Tesseract.js 需要加载 tesseract-core WASM 文件
 */
function getWorkerPath(): string {
  // 在 node_modules 中查找 tesseract.js 的 worker 文件
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'node_modules', 'tesseract.js')
  }
  return path.resolve(__dirname, '../../node_modules/tesseract.js')
}

/**
 * 初始化 OCR 引擎（预加载）
 * 应在应用启动时调用，异步执行不阻塞主流程
 */
export async function initOcrEngine(): Promise<void> {
  if (engineReady || engineLoading) return

  engineLoading = true
  const langPath = getTessdataPath()

  try {
    console.log('[OCR] 开始初始化 OCR 引擎...')
    console.log('[OCR] 语言包路径:', langPath)

    // 创建 Worker，指定本地语言包路径
    ocrWorker = await Tesseract.createWorker('eng+chi_sim', Tesseract.OEM.DEFAULT, {
      langPath,
      // 禁止从 CDN 下载，强制使用本地语言包
      gzip: false,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          // 识别进度日志（可选）
        }
      },
    })

    engineReady = true
    engineLoading = false
    console.log('[OCR] OCR 引擎初始化完成 ✓')
  } catch (error) {
    engineReady = false
    engineLoading = false
    console.error('[OCR] OCR 引擎初始化失败:', error)
    throw error
  }
}

/**
 * 获取 OCR 引擎状态
 */
export function getOcrStatus(): OcrStatus {
  return {
    ready: engineReady,
    loading: engineLoading,
  }
}

/**
 * 对 base64 图片进行 OCR 文字识别
 * @param base64Image base64 编码的图片数据（支持带 data:image/... 前缀）
 * @returns 识别结果（文字和置信度）
 */
export async function recognizeImage(base64Image: string): Promise<OcrResult> {
  // 检查引擎是否就绪
  if (!engineReady || !ocrWorker) {
    // 尝试自动初始化
    if (!engineLoading) {
      await initOcrEngine()
    } else {
      // 等待初始化完成（最多 30 秒）
      let waited = 0
      while (engineLoading && waited < 30000) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        waited += 500
      }
    }
    if (!engineReady || !ocrWorker) {
      throw new Error('OCR 引擎未就绪，请稍后重试')
    }
  }

  // 并发控制
  if (recognizing) {
    throw new Error('已有 OCR 任务正在执行，请稍后重试')
  }

  recognizing = true

  try {
    // 处理 base64 数据：确保有正确的前缀
    let imageData = base64Image
    if (!imageData.startsWith('data:image/')) {
      imageData = `data:image/png;base64,${imageData}`
    }

    // 检查图片大小（base64 字符串长度粗略估算）
    // base64 编码后大小约为原始数据的 4/3
    const estimatedSizeBytes = (imageData.length * 3) / 4
    const MAX_SIZE = 4 * 1024 * 1024 // 4MB
    if (estimatedSizeBytes > MAX_SIZE) {
      console.warn(`[OCR] 图片较大 (${(estimatedSizeBytes / 1024 / 1024).toFixed(1)}MB)，可能影响识别速度`)
    }

    console.log('[OCR] 开始识别图片...')
    const startTime = Date.now()

    const result = await ocrWorker.recognize(imageData)

    const elapsed = Date.now() - startTime
    const text = result.data.text?.trim() || ''
    const confidence = result.data.confidence || 0

    console.log(`[OCR] 识别完成，耗时 ${elapsed}ms，置信度 ${confidence}%，文字长度 ${text.length}`)

    return { text, confidence }
  } catch (error) {
    console.error('[OCR] 识别失败:', error)
    throw error
  } finally {
    recognizing = false
  }
}

/**
 * 销毁 OCR 引擎（应用退出时调用）
 */
export async function destroyOcrEngine(): Promise<void> {
  if (ocrWorker) {
    try {
      await ocrWorker.terminate()
    } catch {
      // 静默忽略
    }
    ocrWorker = null
    engineReady = false
    engineLoading = false
    console.log('[OCR] OCR 引擎已销毁')
  }
}
