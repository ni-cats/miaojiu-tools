/**
 * 历史面板组件
 * 顶部：搜索框
 * 下方：剪贴板历史记录列表（点击直接复制）
 */
import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useMemo } from 'react'
import type { ClipboardHistoryItem } from '../types'

interface EditorPanelProps {
  onSave: (snippet: import('../types').SnippetData) => void
}

export interface EditorPanelRef {
  selectUp: () => void
  selectDown: () => void
  /** 获取当前选中项的内容（用于 Enter 复制） */
  getSelectedContent: () => string | null
}

const EditorPanel = forwardRef<EditorPanelRef, EditorPanelProps>(({ onSave: _onSave }, ref) => {
  const [history, setHistory] = useState<ClipboardHistoryItem[]>([])
  const [historyLimit, setHistoryLimit] = useState(20)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number>(-1)
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const historyListRef = useRef<HTMLDivElement>(null)
  const historySearchInputRef = useRef<HTMLInputElement>(null)

  // 模糊匹配过滤后的历史列表
  const filteredHistory = useMemo(() => {
    if (!historySearchQuery.trim()) return history
    const q = historySearchQuery.toLowerCase()
    return history.filter((item) => {
      if (item.isImage || item.content.startsWith('data:image/')) return false
      return item.content.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)
    })
  }, [history, historySearchQuery])

  // 暴露上下键选择方法给父组件（全局快捷键调用）
  useImperativeHandle(ref, () => ({
    selectUp: () => {
      if (filteredHistory.length === 0) return
      setSelectedHistoryIndex((prev) => {
        const next = Math.max(prev - 1, -1)
        setTimeout(() => {
          const list = historyListRef.current
          if (next >= 0) {
            const el = list?.children[next] as HTMLElement
            if (el) el.scrollIntoView({ block: 'nearest' })
          }
        }, 0)
        return next
      })
    },
    selectDown: () => {
      if (filteredHistory.length === 0) return
      setSelectedHistoryIndex((prev) => {
        const next = Math.min(prev + 1, filteredHistory.length - 1)
        setTimeout(() => {
          const list = historyListRef.current
          const el = list?.children[next] as HTMLElement
          if (el) el.scrollIntoView({ block: 'nearest' })
        }, 0)
        return next
      })
    },
    getSelectedContent: () => {
      if (filteredHistory.length === 0) return null
      // 如果没有选中项，默认取第一个
      const targetIndex = selectedHistoryIndex >= 0 ? selectedHistoryIndex : 0
      return filteredHistory[targetIndex]?.content ?? null
    },
  }), [filteredHistory, selectedHistoryIndex])

  // 加载剪贴板历史和限制
  useEffect(() => {
    window.clipToolAPI.getClipboardHistory().then(setHistory)
    window.clipToolAPI.getClipboardHistoryLimit().then((limit) => {
      setHistoryLimit(limit)
    })
  }, [])

  // 监听主进程后台剪贴板变化事件（替代前端轮询）
  useEffect(() => {
    const unsubscribe = window.clipToolAPI.onClipboardChanged(({ history: updatedHistory }) => {
      setHistory(updatedHistory)
    })
    return () => unsubscribe()
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  // 点击历史项直接复制到剪贴板
  const handleHistoryClick = useCallback((item: ClipboardHistoryItem) => {
    if (item.isImage || item.type === 'image') {
      navigator.clipboard.writeText(item.content)
      showToast('✓ 图片地址已复制')
      return
    }
    navigator.clipboard.writeText(item.content)
    showToast('✓ 已复制到剪贴板')
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
      {/* 搜索框 - 与搜索页面风格一致 */}
      <div className="search-box">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM14 14l-3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <input
          ref={historySearchInputRef}
          className="search-input"
          type="text"
          value={historySearchQuery}
          onChange={(e) => {
            setHistorySearchQuery(e.target.value)
            setSelectedHistoryIndex(-1)
          }}
          placeholder="搜索剪贴板历史..."
          autoFocus
        />
        {historySearchQuery && (
          <button
            className="action-btn"
            onClick={() => {
              setHistorySearchQuery('')
              setSelectedHistoryIndex(-1)
              historySearchInputRef.current?.focus()
            }}
            style={{ width: 20, height: 20, fontSize: 12 }}
          >
            ✕
          </button>
        )}
        <span className="editor-limit-tag" title="在设置-编辑页面修改" style={{ marginLeft: 4, flexShrink: 0 }}>
          {filteredHistory.length}/{historyLimit}
        </span>
        {history.length > 0 && (
          <button className="editor-clear-btn" onClick={handleClearHistory} style={{ flexShrink: 0 }}>
            清空
          </button>
        )}
      </div>

      {/* 剪贴板历史列表 */}
      <div className="editor-history-list" ref={historyListRef}>
        {filteredHistory.length === 0 ? (
          <div className="editor-history-empty">
            <span className="editor-history-empty-icon">📋</span>
            <span className="editor-history-empty-text">{historySearchQuery.trim() ? '未找到匹配的历史记录' : '暂无剪贴板历史'}</span>
            <span className="editor-history-empty-hint">{historySearchQuery.trim() ? '试试其他关键词' : '复制内容后会自动记录在这里'}</span>
          </div>
        ) : (
          filteredHistory.map((item, index) => (
            <div
              key={item.id}
              className={`editor-history-item${selectedHistoryIndex === index ? ' selected' : ''}`}
              onClick={() => {
                handleHistoryClick(item)
                setSelectedHistoryIndex(-1)
              }}
              title={item.isImage ? '点击复制图片地址' : '点击复制内容'}
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

      {/* Toast */}
      {toast && (
        <div className="editor-toast">{toast}</div>
      )}
    </div>
  )
})

export default EditorPanel