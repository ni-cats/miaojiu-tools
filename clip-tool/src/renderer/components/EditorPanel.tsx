/**
 * 编辑面板组件
 * 上方：文本编辑框 + 保存按钮
 * 下方：剪贴板历史记录列表
 */
import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { nanoid } from 'nanoid'
import type { SnippetData, ClipboardHistoryItem } from '../types'

interface EditorPanelProps {
  onSave: (snippet: SnippetData) => void
}

export interface EditorPanelRef {
  selectUp: () => void
  selectDown: () => void
}

const EditorPanel = forwardRef<EditorPanelRef, EditorPanelProps>(({ onSave }, ref) => {
  const [editorContent, setEditorContent] = useState('')
  const [title, setTitle] = useState('')
  const [history, setHistory] = useState<ClipboardHistoryItem[]>([])
  const [historyLimit, setHistoryLimit] = useState(20)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number>(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorSectionRef = useRef<HTMLDivElement>(null)
  const historyListRef = useRef<HTMLDivElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastClipboardRef = useRef<string>('')

  // 暴露上下键选择方法给父组件（全局快捷键调用）
  useImperativeHandle(ref, () => ({
    selectUp: () => {
      if (history.length === 0) return
      setSelectedHistoryIndex((prev) => {
        const next = Math.max(prev - 1, -1)
        if (next >= 0) {
          const item = history[next]
          if (item && !item.isImage && item.type !== 'image') {
            setEditorContent(item.content)
          }
          setTimeout(() => {
            const list = historyListRef.current
            const el = list?.children[next] as HTMLElement
            if (el) el.scrollIntoView({ block: 'nearest' })
          }, 0)
        } else {
          // 回到 -1 时清空编辑框
          setEditorContent('')
        }
        return next
      })
    },
    selectDown: () => {
      if (history.length === 0) return
      setSelectedHistoryIndex((prev) => {
        const next = Math.min(prev + 1, history.length - 1)
        // 将选中项内容展示到编辑框
        const item = history[next]
        if (item && !item.isImage && item.type !== 'image') {
          setEditorContent(item.content)
        }
        // 滚动到可见区域
        setTimeout(() => {
          const list = historyListRef.current
          const el = list?.children[next] as HTMLElement
          if (el) el.scrollIntoView({ block: 'nearest' })
        }, 0)
        return next
      })
    },
  }), [history])

  // 监听 textarea 大小变化（用户拖拽 resize 手柄时）
  // 动态更新编辑区域高度，使其挤压下方历史列表空间
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const observer = new ResizeObserver(() => {
      // textarea 被拖拽时，强制父容器重新布局
      if (editorSectionRef.current) {
        editorSectionRef.current.style.flexShrink = '0'
        editorSectionRef.current.style.flexBasis = 'auto'
      }
    })
    observer.observe(textarea)

    return () => observer.disconnect()
  }, [])

  // 加载剪贴板历史和限制
  useEffect(() => {
    window.clipToolAPI.getClipboardHistory().then(setHistory)
    window.clipToolAPI.getClipboardHistoryLimit().then((limit) => {
      setHistoryLimit(limit)
    })
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
      } catch (err) {
        // 静默忽略
      }
    }

    // 初始读取一次
    pollClipboard()

    // 每 2 秒轮询一次
    pollTimerRef.current = setInterval(pollClipboard, 2000)
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  // 保存编辑器内容为片段
  const handleSave = useCallback(() => {
    const content = editorContent.trim()
    if (!content) return

    const snippet: SnippetData = {
      id: nanoid(),
      title: title.trim() || content.substring(0, 30).replace(/\n/g, ' '),
      content,
      tags: ['编辑'],
      type: 'text',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      copyCount: 0,
      isFavorite: false,
    }

    onSave(snippet)
    setEditorContent('')
    setTitle('')
    showToast('✓ 已保存')
  }, [editorContent, title, onSave, showToast])

  // 点击历史项填充到编辑框
  const handleHistoryClick = useCallback((item: ClipboardHistoryItem) => {
    if (item.isImage || item.type === 'image') {
      // 图片直接复制到剪贴板
      navigator.clipboard.writeText(item.content)
      showToast('✓ 图片地址已复制')
      return
    }
    setEditorContent(item.content)
    // 自动聚焦编辑框
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
    <div className="editor-panel">
      {/* 上方：编辑区域 */}
      <div className="editor-section" ref={editorSectionRef}>
        <div className="editor-title-row">
          <input
            className="text-input editor-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题（可选）"
          />
          <button
            className="editor-save-btn"
            onClick={handleSave}
            disabled={!editorContent.trim()}
          >
            💾 保存
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={editorContent}
          onChange={(e) => {
            setEditorContent(e.target.value)
            // 输入内容后取消历史选中
            if (e.target.value.trim()) {
              setSelectedHistoryIndex(-1)
            }
          }}

          placeholder="在这里编辑内容...&#10;可以直接输入，也可以点击下方历史记录填充&#10;↑↓ 切换剪贴板历史，选中内容自动展示"
          spellCheck={false}
        />
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
                setSelectedHistoryIndex(-1)
              }}
              title={item.isImage ? '点击复制图片地址' : '点击填充到编辑框'}
            >
              <div className="editor-history-item-content">
                <span className={`editor-history-type ${item.type}`}>
                  {item.type}
                </span>
                <span className="editor-history-preview">
                  {previewContent(item.content, item.isImage)}
                </span>
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

      {/* Toast */}
      {toast && (
        <div className="editor-toast">{toast}</div>
      )}
    </div>
  )
})

export default EditorPanel

