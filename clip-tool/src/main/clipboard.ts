/**
 * 剪贴板操作封装
 * 支持文本和图片的读写
 */
import { clipboard, nativeImage } from 'electron'

/** 内容类型 */
type ContentType = 'code' | 'text' | 'url' | 'image' | 'video' | 'document' | 'other'

/** 剪贴板读取结果 */
export interface ClipboardResult {
  content: string
  type: ContentType
  language?: string
  isImage?: boolean  // 标记是否为图片（content 为 base64）
}

/** 内容类型检测 */
export function detectContentType(content: string): { type: ContentType; language?: string } {
  // 检测 URL
  const urlPattern = /^(https?:\/\/|ftp:\/\/|file:\/\/)/i
  if (urlPattern.test(content.trim())) {
    // 检测视频链接
    const videoExtPatterns = /\.(mp4|avi|mkv|mov|wmv|flv|webm|m3u8)(\?|$)/i
    const videoHostPatterns = /(youtube\.com|youtu\.be|bilibili\.com|vimeo\.com|v\.qq\.com|douyin\.com|tiktok\.com)/i
    if (videoExtPatterns.test(content.trim()) || videoHostPatterns.test(content.trim())) {
      return { type: 'video' }
    }

    // 检测图片链接
    const imageExtPatterns = /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico|tiff)(\?|$)/i
    if (imageExtPatterns.test(content.trim())) {
      return { type: 'image' }
    }

    // 检测文档链接
    const docExtPatterns = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|csv)(\?|$)/i
    if (docExtPatterns.test(content.trim())) {
      return { type: 'document' }
    }

    return { type: 'url' }
  }

  // 检测 base64 图片数据
  if (content.startsWith('data:image/')) {
    return { type: 'image' }
  }

  // 检测代码 - 基于常见语法特征
  const codePatterns: { pattern: RegExp; language: string }[] = [
    { pattern: /^(import\s+.+from\s+|export\s+(default\s+)?(function|class|const|interface|type))/m, language: 'typescript' },
    { pattern: /^(const|let|var)\s+\w+\s*[:=]/m, language: 'javascript' },
    { pattern: /^(function|class)\s+\w+/m, language: 'javascript' },
    { pattern: /^(def|class)\s+\w+.*:/m, language: 'python' },
    { pattern: /^(package|import)\s+[\w.]+;?\s*$/m, language: 'java' },
    { pattern: /^(func|package|import)\s+/m, language: 'go' },
    { pattern: /^(use|fn|let\s+mut|impl|struct|enum)\s+/m, language: 'rust' },
    { pattern: /^(#include|using namespace|int\s+main)/m, language: 'cpp' },
    { pattern: /^\s*<[\w-]+(\s+[\w-]+=("[^"]*"|'[^']*'))*\s*\/?>$/m, language: 'html' },
    { pattern: /^\s*[\w-]+\s*:\s*[^;]+;\s*$/m, language: 'css' },
    { pattern: /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+/im, language: 'sql' },
    { pattern: /^#!\//m, language: 'bash' },
    { pattern: /^\s*\{[\s\S]*"[\w]+":\s*/m, language: 'json' },
    { pattern: /^(apiVersion|kind):\s+/m, language: 'yaml' },
  ]

  for (const { pattern, language } of codePatterns) {
    if (pattern.test(content)) {
      return { type: 'code', language }
    }
  }

  // 多行且含有大括号、分号等特征，可能是代码
  const lines = content.split('\n')
  if (lines.length > 3) {
    const codeIndicators = ['{', '}', ';', '=>', '->', '()', '[]'].filter((c) => content.includes(c))
    if (codeIndicators.length >= 3) {
      return { type: 'code', language: 'plaintext' }
    }
  }

  return { type: 'text' }
}

/** 读取剪贴板（优先检测图片，再检测文本） */
export function readClipboard(): ClipboardResult {
  // 优先检测图片
  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    const pngBuffer = image.toPNG()
    const base64 = `data:image/png;base64,${pngBuffer.toString('base64')}`
    // 同时检查是否也有文本（有些复制操作同时包含图片和文本）
    const text = clipboard.readText()
    return {
      content: base64,
      type: 'image',
      isImage: true,
    }
  }

  // 读取文本
  const text = readClipboardText()
  const detected = detectContentType(text)
  return {
    content: text,
    ...detected,
    isImage: false,
  }
}

/** 读取剪贴板文本内容 */
export function readClipboardText(): string {
  return clipboard.readText()
}

/** 写入文本到剪贴板 */
export function writeClipboardText(text: string): void {
  clipboard.writeText(text)
}

/** 写入图片到剪贴板（base64 数据） */
export function writeClipboardImage(base64Data: string): void {
  // 去掉 data:image/xxx;base64, 前缀
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Clean, 'base64')
  const image = nativeImage.createFromBuffer(buffer)
  clipboard.writeImage(image)
}

/** 根据内容类型智能写入剪贴板 */
export function writeToClipboard(content: string, type: string): void {
  if (type === 'image' && content.startsWith('data:image/')) {
    writeClipboardImage(content)
  } else {
    // video / url / code / text / document / other 都是文本形式
    writeClipboardText(content)
  }
}