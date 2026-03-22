/**
 * 剪贴板操作封装
 */
import { clipboard } from 'electron'

/** 内容类型 */
type ContentType = 'code' | 'text' | 'url' | 'image' | 'video' | 'document' | 'other'

/** 内容类型检测 */
export function detectContentType(content: string): { type: ContentType; language?: string } {
  // 检测 URL
  const urlPattern = /^(https?:\/\/|ftp:\/\/|file:\/\/)/i
  if (urlPattern.test(content.trim())) {
    return { type: 'url' }
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

/** 读取剪贴板文本内容 */
export function readClipboardText(): string {
  return clipboard.readText()
}

/** 写入文本到剪贴板 */
export function writeClipboardText(text: string): void {
  clipboard.writeText(text)
}
