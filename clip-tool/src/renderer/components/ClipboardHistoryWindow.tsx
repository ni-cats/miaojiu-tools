/**
 * 独立的剪贴板历史窗口组件
 * 完整展示编辑框 + 剪贴板历史列表（与 EditorPanel 一致的布局）
 * 在其它页面（如速记）使用时，可以唤起此独立窗口来选择剪贴板历史
 * 支持 ↑↓ 选择、Enter 复制并关闭、Escape 关闭、点击填充
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { nanoid } from 'nanoid'
import type { ClipboardHistoryItem } from '../types'

const ClipboardHistoryWindow: React.FC = () => {
  const [editorContent, setEditorContent] = useState('')
  const [history, setHistory] = useState<ClipboardHistoryItem[]>([])
  const [historyLimit, setHistoryLimit] = useState(20)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number>(-1)
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorSectionRef = useRef<HTMLDivElement>(null)
  const historyListRef = useRef<HTMLDivElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastClipboardRef = useRef<string>('')

  // 加载主题和字体大小
  useEffect(() => {
    window.clipToolAPI.getTheme().then((t) => {
      document.documentElement.setAttribute('data-theme', t || 'dark')
    })
    window.clipToolAPI.getAppFontSize().then((size) => {
      const scale = (size || 13) / 13
      document.documentElement.style.setProperty('--app-zoom', String(scale))
      const appContainer = document.querySelector('.app-container') as HTMLElement
      if (appContainer) appContainer.style.zoom = String(scale)
    })
  }, [])

  // 加载剪贴板历史和限制，并读取当前剪贴板内容填充编辑框
  useEffect(() => {
    window.clipToolAPI.getClipboardHistory().then(setHistory)
    window.clipToolAPI.getClipboardHistoryLimit().then((limit) => {
      setHistoryLimit(limit)
    })
    // 读取当前剪贴板内容，实时填充到编辑框
    window.clipToolAPI.readClipboard().then((data) => {
      if (data && data.content && data.content.trim()) {
        if (data.isImage) {
          setSelectedImageSrc(data.content)
        } else {
          setEditorContent(data.content)
        }
        lastClipboardRef.current = data.content
      }
    }).catch(() => {})
  }, [])

  // 定时轮询剪贴板变化，自动记录到历史
  useEffect(() => {
    const pollClipboard = async () => {
      try {
        const data = await window.clipToolAPI.readClipboard()
        if (data.content && data.content.trim() && data.content !== lastClipboardRef.current) {
          lastClipboardRef.current = data.content
          const item: ClipboardHistoryItem = {
            id: nanoid(),
            content: data.content,
            type: data.type,
            language: data.language,
            isImage: data.isImage,
            timestamp: new Date().toISOString(),
          }
          const updated = await window.clipToolAPI.addClipboardHistory(item)
          setHistory(updated)
        }
      } catch {
        // 静默忽略
      }
    }
    pollClipboard()
    pollTimerRef.current = setInterval(pollClipboard, 2000)
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  // 监听 textarea 大小变化
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const observer = new ResizeObserver(() => {
      if (editorSectionRef.current) {
        editorSectionRef.current.style.flexShrink = '0'
        editorSectionRef.current.style.flexBasis = 'auto'
      }
    })
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  // 复制编辑框内容并关闭窗口
  const handleCopyAndClose = useCallback(async () => {
    const content = editorContent.trim()
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      showToast('✓ 已复制')
      setTimeout(() => {
        window.clipToolAPI.closeHistoryWindow()
      }, 300)
    } catch {
      showToast('✕ 复制失败')
    }
  }, [editorContent, showToast])

  // 点击历史项填充到编辑框
  const handleHistoryClick = useCallback((item: ClipboardHistoryItem) => {
    if (item.isImage || item.type === 'image') {
      navigator.clipboard.writeText(item.content)
      showToast('✓ 图片地址已复制')
      return
    }
    setEditorContent(item.content)
    setSelectedImageSrc(null)
    setSelectedHistoryIndex(-1)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [showToast])

  // 删除单条历史
  const handleDeleteHistory = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = await window.clipToolAPI.deleteClipboardHistoryItem(id)
    setHistory(updated)
  }, [])

  // 清空全部历史
  const handleClearHistory = useCallback(async () => {
    const updated = await window.clipToolAPI.clearClipboardHistory()
    setHistory(updated)
    showToast('已清空')
  }, [showToast])

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTextareaFocused = target === textareaRef.current

      if (e.key === 'Escape') {
        e.preventDefault()
        window.clipToolAPI.closeHistoryWindow()
        return
      }

      // Enter：如果编辑框有内容，复制并关闭
      if (e.key === 'Enter' && !e.shiftKey && !isTextareaFocused) {
        e.preventDefault()
        if (selectedHistoryIndex >= 0 && history[selectedHistoryIndex]) {
          const item = history[selectedHistoryIndex]
          if (item.isImage || item.type === 'image') {
            navigator.clipboard.writeText(item.content)
          } else {
            navigator.clipboard.writeText(item.content)
          }
          showToast('✓ 已复制')
          setTimeout(() => {
            window.clipToolAPI.closeHistoryWindow()
          }, 300)
        } else if (editorContent.trim()) {
          handleCopyAndClose()
        }
        return
      }

      // ↑↓ 在非编辑框聚焦时切换历史
      if (!isTextareaFocused) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          if (history.length === 0) return
          setSelectedHistoryIndex((prev) => {
            const next = Math.min(prev + 1, history.length - 1)
            const item = history[next]
            if (item) {
              if (item.isImage || item.type === 'image') {
                setSelectedImageSrc(item.content)
                setEditorContent('')
              } else {
                setSelectedImageSrc(null)
                setEditorContent(item.content)
              }
            }
            setTimeout(() => {
              const list = historyListRef.current
              const el = list?.children[next] as HTMLElement
              if (el) el.scrollIntoView({ block: 'nearest' })
            }, 0)
            return next
          })
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          if (history.length === 0) return
          setSelectedHistoryIndex((prev) => {
            const next = Math.max(prev - 1, -1)
            if (next >= 0) {
              const item = history[next]
              if (item) {
                if (item.isImage || item.type === 'image') {
                  setSelectedImageSrc(item.content)
                  setEditorContent('')
                } else {
                  setSelectedImageSrc(null)
                  setEditorContent(item.content)
                }
              }
              setTimeout(() => {
                const list = historyListRef.current
                const el = list?.children[next] as HTMLElement
                if (el) el.scrollIntoView({ block: 'nearest' })
              }, 0)
            } else {
              setEditorContent('')
              setSelectedImageSrc(null)
            }
            return next
          })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [history, selectedHistoryIndex, editorContent, handleCopyAndClose, showToast])

  // 格式化时间
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 60 * 1000) return '刚刚'
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // 内容预览（截断）
  const previewContent = (content: string, isImage?: boolean) => {
    if (isImage || content.startsWith('data:image/')) return '🖼️ [图片]'
    const text = content.replace(/\n/g, ' ').trim()
    return text.length > 60 ? text.substring(0, 60) + '...' : text
  }

  return (
    <div className="app-container">
      {/* 可拖拽区域 */}
      <div className="drag-region" />

      {/* 与 EditorPanel 一致的完整布局 */}
      <div className="editor-panel">
        {/* 标题栏 */}
        <div className="editor-title-row">
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>✏️ 历史</span>
        </div>

        {/* 上方：编辑区域 */}
        <div className="editor-section" ref={editorSectionRef}>
          {selectedImageSrc ? (
            <div className="editor-image-preview">
              <img src={selectedImageSrc} alt="图片预览" />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              style={{
                background: '#ffffff',
                color: '#1a1a1a',
                border: '1px solid #d0d0d0',
                caretColor: '#333',
              }}
              value={editorContent}
              onChange={(e) => {
                setEditorContent(e.target.value)
                if (e.target.value.trim()) {
                  setSelectedHistoryIndex(-1)
                }
              }}
              placeholder="在这里编辑内容...&#10;可以直接输入，也可以点击下方历史记录填充&#10;↑↓ 切换剪贴板历史，选中内容自动展示"
              spellCheck={false}
            />
          )}
        </div>

        {/* 分隔线 */}
        <div className="editor-divider">
          <span className="editor-divider-label">📋 剪贴板历史</span>
          <div className="editor-divider-actions">
            <span className="editor-limit-tag" title="在设置-编辑页面修改">
              最多 {historyLimit} 条
            </span>
            {history.length > 0 && (
              <button className="editor-clear-btn" onClick={handleClearHistory}>
                清空
              </button>
            )}
          </div>
        </div>

        {/* 下方：剪贴板历史列表 */}
        <div className="editor-history-list" ref={historyListRef}>
          {history.length === 0 ? (
            <div className="editor-history-empty">
              <span className="editor-history-empty-icon">📋</span>
              <span className="editor-history-empty-text">暂无剪贴板历史</span>
              <span className="editor-history-empty-hint">复制内容后会自动记录在这里</span>
            </div>
          ) : (
            history.map((item, index) => (
              <div
                key={item.id}
                className={`editor-history-item${selectedHistoryIndex === index ? ' selected' : ''}`}
                onClick={() => {
                  handleHistoryClick(item)
                }}
                title={item.isImage ? '点击复制图片地址' : '点击填充到编辑框'}
              >
                <div className="editor-history-item-content">
                  <span className={`editor-history-type ${item.type}`}>
                    {item.type}
                  </span>
                  {(item.isImage || item.content.startsWith('data:image/')) ? (
                    <span className="editor-history-preview editor-history-image-preview">
                      <img src={item.content} alt="图片" />
                    </span>
                  ) : (
                    <span className="editor-history-preview">
                      {previewContent(item.content, item.isImage)}
                    </span>
                  )}
                </div>
                <div className="editor-history-item-meta">
                  <span className="editor-history-time">{formatTime(item.timestamp)}</span>
                  <button
                    className="editor-history-delete"
                    onClick={(e) => handleDeleteHistory(item.id, e)}
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 底部快捷键提示 */}
      <div className="shortcut-hint" style={{ borderTop: 'none', paddingTop: 4, display: 'flex', justifyContent: 'center' }}>
        <kbd>↑↓</kbd> 选择 &nbsp;
        <kbd>Enter</kbd> 复制并关闭 &nbsp;
        <kbd>Esc</kbd> 关闭
      </div>

      {/* Toast */}
      {toast && <div className="editor-toast">{toast}</div>}

      {/* 窗口拉伸手柄 */}
      <div className="resize-handle" />
    </div>
  )
}

export default ClipboardHistoryWindow
