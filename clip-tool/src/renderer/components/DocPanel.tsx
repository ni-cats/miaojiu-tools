/**
 * 文档面板组件
 * 支持粘贴临时文本，自动识别文档结构（JSON/Go/SQL/JS 等），语法高亮显示
 * 支持格式化（JSON format/minify 等）、行号显示、保存为片段
 * 支持 ⌘Z 撤回格式化操作、AI 生成标题
 * 统一编辑+预览模式：直接在高亮预览上编辑
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { nanoid } from 'nanoid'
import type { SnippetData, ContentType } from '../types'

/** 支持的语言列表 */
const SUPPORTED_LANGUAGES = [
  { id: 'plaintext', label: '纯文本' },
  { id: 'json', label: 'JSON' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'go', label: 'Go' },
  { id: 'sql', label: 'SQL' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'shell', label: 'Shell' },
  { id: 'yaml', label: 'YAML' },
  { id: 'xml', label: 'XML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'rust', label: 'Rust' },
  { id: 'cpp', label: 'C++' },
  { id: 'c', label: 'C' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'lua', label: 'Lua' },
]

/** 格式化选项定义 */
interface FormatOption {
  id: string
  label: string
  /** 适用的语言列表，空数组表示适用所有语言 */
  languages: string[]
  action: (text: string) => string
}

/** 格式化选项列表 */
const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'json-format',
    label: '格式化 (2空格)',
    languages: ['json'],
    action: (text: string) => {
      try {
        return JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        return text
      }
    },
  },
  {
    id: 'json-format-4',
    label: '格式化 (4空格)',
    languages: ['json'],
    action: (text: string) => {
      try {
        return JSON.stringify(JSON.parse(text), null, 4)
      } catch {
        return text
      }
    },
  },
  {
    id: 'json-minify',
    label: '压缩 (Minify)',
    languages: ['json'],
    action: (text: string) => {
      try {
        return JSON.stringify(JSON.parse(text))
      } catch {
        return text
      }
    },
  },
  {
    id: 'json-sort-keys',
    label: '按 Key 排序',
    languages: ['json'],
    action: (text: string) => {
      try {
        const obj = JSON.parse(text)
        const sorted = sortObjectKeys(obj)
        return JSON.stringify(sorted, null, 2)
      } catch {
        return text
      }
    },
  },
  {
    id: 'trim-lines',
    label: '去除行尾空格',
    languages: [],
    action: (text: string) => text.split('\n').map((l) => l.trimEnd()).join('\n'),
  },
  {
    id: 'remove-empty-lines',
    label: '去除空行',
    languages: [],
    action: (text: string) => text.split('\n').filter((l) => l.trim() !== '').join('\n'),
  },
  {
    id: 'sort-lines',
    label: '行排序',
    languages: [],
    action: (text: string) => text.split('\n').sort().join('\n'),
  },
  {
    id: 'dedupe-lines',
    label: '行去重',
    languages: [],
    action: (text: string) => [...new Set(text.split('\n'))].join('\n'),
  },
]

/** 递归排序 JSON 对象的 key */
function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, key: string) => {
        acc[key] = sortObjectKeys(obj[key])
        return acc
      }, {})
  }
  return obj
}

/** 自动检测文本语言类型 */
function detectLanguage(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return 'plaintext'

  // JSON 检测
  if (/^\s*[\[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // 可能是不完整的 JSON 或其他语言
    }
  }

  // SQL 检测
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN|SHOW|DESCRIBE|USE|SET)\b/i.test(trimmed)) {
    return 'sql'
  }

  // Go 检测
  if (/^package\s+\w+/m.test(trimmed) || /^func\s+/m.test(trimmed) || /^import\s+\(/m.test(trimmed) || /\bfmt\.\w+/m.test(trimmed)) {
    return 'go'
  }

  // Python 检测
  if (/^(def |class |import |from |if __name__|print\(|#!.*python)/m.test(trimmed)) {
    return 'python'
  }

  // Java 检测
  if (/^(public |private |protected |class |interface |package |import java\.)/m.test(trimmed)) {
    return 'java'
  }

  // Rust 检测
  if (/^(fn |use |mod |pub |impl |struct |enum |trait |let mut )/m.test(trimmed)) {
    return 'rust'
  }

  // Shell 检测
  if (/^#!\/bin\/(bash|sh|zsh)/m.test(trimmed) || /^\s*(echo |export |alias |source |chmod |mkdir |cd |ls )/m.test(trimmed)) {
    return 'shell'
  }

  // HTML 检测
  if (/^\s*<!DOCTYPE|^\s*<html|^\s*<div|^\s*<span|^\s*<p\b/i.test(trimmed)) {
    return 'html'
  }

  // XML 检测
  if (/^\s*<\?xml/i.test(trimmed) || (/^\s*<[a-zA-Z]/.test(trimmed) && /<\/[a-zA-Z]/.test(trimmed))) {
    return 'xml'
  }

  // YAML 检测
  if (/^---\s*$/m.test(trimmed) || /^\w+:\s+/m.test(trimmed) && /^\s+-\s+/m.test(trimmed)) {
    return 'yaml'
  }

  // Markdown 检测
  if (/^#{1,6}\s+/m.test(trimmed) || /^\s*[-*+]\s+/m.test(trimmed) && /\[.*\]\(.*\)/m.test(trimmed)) {
    return 'markdown'
  }

  // CSS 检测
  if (/^\s*[.#@]\w+.*\{/m.test(trimmed) || /^\s*\w+\s*:\s*[^;]+;/m.test(trimmed)) {
    return 'css'
  }

  // TypeScript 检测（在 JS 之前，因为 TS 是 JS 的超集）
  if (/\b(interface |type |enum |namespace |as |readonly )\b/m.test(trimmed) || /:\s*(string|number|boolean|any|void)\b/m.test(trimmed)) {
    return 'typescript'
  }

  // JavaScript 检测
  if (/\b(const |let |var |function |=>|require\(|module\.exports|import .* from)/m.test(trimmed)) {
    return 'javascript'
  }

  // PHP 检测
  if (/^<\?php/m.test(trimmed) || /^\$\w+\s*=/m.test(trimmed)) {
    return 'php'
  }

  // C/C++ 检测
  if (/^#include\s*[<"]/m.test(trimmed) || /^(int|void|char|float|double)\s+main\s*\(/m.test(trimmed)) {
    return /\b(class |namespace |template |std::)/m.test(trimmed) ? 'cpp' : 'c'
  }

  return 'plaintext'
}

/** 生成行号 */
function generateLineNumbers(lineCount: number): string {
  return Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')
}

interface DocPanelProps {
  onSave: (snippet: SnippetData) => void
  activeTab?: string
}

/** 撤回历史栈最大深度 */
const MAX_UNDO_STACK = 50

const DocPanel: React.FC<DocPanelProps> = ({ onSave, activeTab }) => {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('plaintext')
  const [highlightedHtml, setHighlightedHtml] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [shikiHighlighter, setShikiHighlighter] = useState<any>(null)
  const [showFormatMenu, setShowFormatMenu] = useState(false)
  const [aiTitleLoading, setAiTitleLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumberRef = useRef<HTMLDivElement>(null)
  const formatMenuRef = useRef<HTMLDivElement>(null)
  /** 撤回历史栈（存储格式化前的内容） */
  const undoStackRef = useRef<string[]>([])
  /** 标记是否已经自动读取过剪贴板（防止重复读取） */
  const hasAutoReadRef = useRef(false)

  // 初始化 shiki 高亮器
  useEffect(() => {
    let cancelled = false
    import('shiki').then(async (shiki) => {
      if (cancelled) return
      const highlighter = await shiki.createHighlighter({
        themes: ['github-dark'],
        langs: SUPPORTED_LANGUAGES.map((l) => l.id).filter((id) => id !== 'plaintext'),
      })
      if (!cancelled) {
        setShikiHighlighter(highlighter)
      }
    }).catch((err) => {
      console.error('初始化 shiki 失败:', err)
    })
    return () => { cancelled = true }
  }, [])

  // 切换到文档页面时自动读取剪贴板
  useEffect(() => {
    if (activeTab === 'doc' && !hasAutoReadRef.current && !content.trim()) {
      hasAutoReadRef.current = true
      // 通过 Electron API 读取剪贴板
      window.clipToolAPI.readClipboard().then((clipData) => {
        if (clipData && clipData.content && !clipData.isImage) {
          const text = clipData.content
          const detected = detectLanguage(text)
          // JSON 自动格式化
          let processedText = text
          if (detected === 'json') {
            try {
              processedText = JSON.stringify(JSON.parse(text), null, 2)
            } catch {
              processedText = text
            }
          }
          setContent(processedText)
          setLanguage(detected)
          showToast(`✓ 已读取剪贴板${detected !== 'plaintext' ? ` · 识别为 ${detected.toUpperCase()}` : ''}`)
        }
      }).catch(() => {
        // 静默失败
      })
    }
    // 当切离文档页面时，重置标记，下次切回来可以再次读取
    if (activeTab !== 'doc') {
      hasAutoReadRef.current = false
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // 内容变化时自动检测语言
  useEffect(() => {
    if (content.trim()) {
      const detected = detectLanguage(content)
      setLanguage(detected)
    }
  }, [content])

  // 语言或内容变化时更新高亮
  useEffect(() => {
    if (!content.trim()) {
      setHighlightedHtml('')
      return
    }

    if (shikiHighlighter && language !== 'plaintext') {
      try {
        const html = shikiHighlighter.codeToHtml(content, {
          lang: language,
          theme: 'github-dark',
        })
        setHighlightedHtml(html)
      } catch {
        setHighlightedHtml('')
      }
    } else {
      setHighlightedHtml('')
    }
  }, [content, language, shikiHighlighter])

  // 点击外部关闭格式化菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formatMenuRef.current && !formatMenuRef.current.contains(e.target as Node)) {
        setShowFormatMenu(false)
      }
    }
    if (showFormatMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFormatMenu])

  // 同步编辑区域和行号的滚动
  const handleTextareaScroll = useCallback(() => {
    if (textareaRef.current && lineNumberRef.current) {
      lineNumberRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  // 将当前内容压入撤回栈
  const pushUndo = useCallback((currentContent: string) => {
    const stack = undoStackRef.current
    // 避免重复压入相同内容
    if (stack.length > 0 && stack[stack.length - 1] === currentContent) return
    stack.push(currentContent)
    if (stack.length > MAX_UNDO_STACK) {
      stack.shift()
    }
  }, [])

  // 获取当前语言可用的格式化选项
  const getAvailableFormats = useCallback((): FormatOption[] => {
    return FORMAT_OPTIONS.filter(
      (opt) => opt.languages.length === 0 || opt.languages.includes(language)
    )
  }, [language])

  // 执行格式化（带撤回支持）
  const handleFormat = useCallback((formatId: string) => {
    const option = FORMAT_OPTIONS.find((o) => o.id === formatId)
    if (!option || !content.trim()) return
    const formatted = option.action(content)
    if (formatted !== content) {
      pushUndo(content) // 格式化前压入撤回栈
      setContent(formatted)
      showToast(`✓ 已${option.label}`)
    } else {
      showToast('内容未变化')
    }
    setShowFormatMenu(false)
  }, [content, showToast, pushUndo])

  // 撤回操作
  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current
    if (stack.length === 0) {
      showToast('没有可撤回的操作')
      return
    }
    const prev = stack.pop()!
    setContent(prev)
    showToast('✓ 已撤回')
  }, [showToast])

  // 快捷键：⌘⇧F 格式化 / ⌘Z 撤回
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘⇧F / Ctrl+Shift+F：自动格式化
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        if (!content.trim()) return
        if (language === 'json') {
          handleFormat('json-format')
        } else {
          handleFormat('trim-lines')
        }
        return
      }
      // ⌘Z / Ctrl+Z：撤回（仅在 textarea 未聚焦时拦截，聚焦时由 textarea 自身处理普通编辑撤回）
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        // 如果 textarea 聚焦且撤回栈为空，让浏览器处理原生撤回
        if (document.activeElement === textareaRef.current && undoStackRef.current.length === 0) {
          return
        }
        // 如果撤回栈有内容，优先使用我们的撤回
        if (undoStackRef.current.length > 0) {
          e.preventDefault()
          handleUndo()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [content, language, handleFormat, handleUndo])

  // AI 生成标题
  const handleAiTitle = useCallback(async () => {
    if (!content.trim()) return
    setAiTitleLoading(true)
    try {
      const contentType = language === 'plaintext' ? 'text' : 'code'
      const generated = await window.clipToolAPI.generateAiTitle(content, contentType)
      if (generated) {
        setTitle(generated)
        showToast('✓ AI 标题已生成')
      } else {
        showToast('✕ AI 生成标题失败，请检查 AI 模型配置')
      }
    } catch {
      showToast('✕ AI 生成标题失败')
    } finally {
      setAiTitleLoading(false)
    }
  }, [content, language, showToast])

  // 保存为片段
  const handleSave = useCallback(() => {
    const trimmedContent = content.trim()
    if (!trimmedContent) return

    const contentType: ContentType = language === 'plaintext' ? 'text' : 'code'
    const snippet: SnippetData = {
      id: nanoid(),
      title: title.trim() || trimmedContent.substring(0, 30).replace(/\n/g, ' '),
      content: trimmedContent,
      tags: ['文档'],
      type: contentType,
      language: language,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      copyCount: 0,
      isFavorite: false,
    }

    onSave(snippet)
    showToast('✓ 已保存为片段')
  }, [content, title, language, onSave, showToast])

  // 复制内容
  const handleCopy = useCallback(() => {
    if (!content.trim()) return
    navigator.clipboard.writeText(content)
    showToast('✓ 已复制到剪贴板')
  }, [content, showToast])

  // 清空内容
  const handleClear = useCallback(() => {
    if (content.trim()) {
      pushUndo(content) // 清空前压入撤回栈
    }
    setContent('')
    setTitle('')
    setLanguage('plaintext')
    setHighlightedHtml('')
    showToast('✓ 已清空')
  }, [content, showToast, pushUndo])

  // 从剪贴板粘贴
  const handlePaste = useCallback(async () => {
    try {
      const clipData = await window.clipToolAPI.readClipboard()
      if (clipData && clipData.content && !clipData.isImage) {
        const text = clipData.content
        const detected = detectLanguage(text)
        let processedText = text
        if (detected === 'json') {
          try {
            processedText = JSON.stringify(JSON.parse(text), null, 2)
          } catch {
            processedText = text
          }
        }
        if (content.trim()) {
          pushUndo(content) // 粘贴覆盖前压入撤回栈
        }
        setContent(processedText)
        setLanguage(detected)
        showToast(`✓ 已粘贴${detected !== 'plaintext' ? ` · 识别为 ${detected.toUpperCase()}` : ''}`)
      }
    } catch {
      showToast('✕ 读取剪贴板失败')
    }
  }, [content, showToast, pushUndo])

  // 获取语言显示标签
  const getLangLabel = (langId: string) => {
    return SUPPORTED_LANGUAGES.find((l) => l.id === langId)?.label || langId
  }

  const lineCount = content ? content.split('\n').length : 0
  const availableFormats = getAvailableFormats()

  return (
    <div className="doc-panel">
      {/* 工具栏 */}
      <div className="doc-toolbar">
        <div className="doc-toolbar-left">
          <input
            className="text-input doc-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文档标题（可选）"
          />
          {/* AI 生成标题按钮 */}
          <button
            className="doc-ai-title-btn"
            onClick={handleAiTitle}
            disabled={!content.trim() || aiTitleLoading}
            title="使用 AI 生成标题"
          >
            {aiTitleLoading ? '✨ 生成中...' : '🤖 AI标题'}
          </button>
        </div>
        <div className="doc-toolbar-right">
          {/* 格式化按钮 */}
          <div className="doc-format-wrapper" ref={formatMenuRef}>
            <button
              className="doc-action-btn"
              onClick={() => setShowFormatMenu(!showFormatMenu)}
              disabled={!content.trim()}
              title="格式化 (⌘⇧F)"
            >
              🔧 格式化
            </button>
            {showFormatMenu && (
              <div className="doc-format-menu">
                {availableFormats.map((opt) => (
                  <div
                    key={opt.id}
                    className="doc-format-item"
                    onClick={() => handleFormat(opt.id)}
                  >
                    {opt.label}
                    {opt.languages.length > 0 && (
                      <span className="doc-format-lang">{opt.languages.join(', ')}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 撤回按钮 */}
          <button
            className="doc-action-btn"
            onClick={handleUndo}
            disabled={undoStackRef.current.length === 0}
            title="撤回 (⌘Z)"
          >
            ↩ 撤回
          </button>

          {/* 语言选择 */}
          <select
            className="doc-lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 内容区域：统一编辑+预览 */}
      <div className="doc-content-area">
        {content.trim() ? (
          <div className="doc-editor-wrapper">
            <div className="doc-line-numbers" ref={lineNumberRef}>
              <pre>{generateLineNumbers(Math.max(lineCount, 1))}</pre>
            </div>
            <div className="doc-editable-area">
              {/* 高亮层（底层） */}
              <div className="doc-highlight-layer">
                {highlightedHtml ? (
                  <div
                    className="doc-highlighted"
                    dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                  />
                ) : (
                  <pre className="doc-plain-preview">
                    <code>{content}</code>
                  </pre>
                )}
              </div>
              {/* 编辑层（顶层，透明 textarea） */}
              <textarea
                ref={textareaRef}
                className="doc-textarea doc-textarea-overlay"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onScroll={handleTextareaScroll}
                spellCheck={false}
              />
            </div>
          </div>
        ) : (
          <div className="doc-empty-preview">
            <div className="doc-empty-icon">📄</div>
            <div className="doc-empty-title">粘贴文档内容</div>
            <div className="doc-empty-desc">
              切换到此页面时会自动读取剪贴板
            </div>
            <div className="doc-empty-desc">
              也可以按 <kbd>⌘V</kbd> 粘贴，或点击下方「📋 粘贴」按钮
            </div>
            <div className="doc-empty-desc">
              支持自动识别 JSON、Go、SQL、JavaScript、Python 等语言
            </div>
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="doc-statusbar">
        <div className="doc-statusbar-left">
          <span className="doc-status-item">
            📝 {lineCount} 行
          </span>
          <span className="doc-status-item">
            📊 {content.length} 字符
          </span>
          {language !== 'plaintext' && (
            <span className="doc-status-lang">
              🔤 {getLangLabel(language)}
            </span>
          )}
        </div>
        <div className="doc-statusbar-right">
          <button className="doc-action-btn" onClick={handlePaste} title="从剪贴板粘贴">
            📋 粘贴
          </button>
          <button className="doc-action-btn" onClick={handleCopy} disabled={!content.trim()} title="复制内容">
            📄 复制
          </button>
          <button className="doc-action-btn" onClick={handleClear} disabled={!content.trim()} title="清空内容">
            🗑 清空
          </button>
          <button className="doc-action-btn primary" onClick={handleSave} disabled={!content.trim()} title="保存为片段">
            💾 保存
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="doc-toast">{toast}</div>}
    </div>
  )
}

export default DocPanel
