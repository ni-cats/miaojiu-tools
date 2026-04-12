/**
 * 独立的剪贴板历史窗口组件
 * 搜索框 + 剪贴板历史列表
 * 在其它页面（如速记）使用时，可以唤起此独立窗口来选择剪贴板历史
 * 支持模糊搜索、↑↓ 选择、Enter 复制并关闭、Escape 关闭、点击复制
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { ClipboardHistoryItem } from '../types'
import { IconClipboard } from './TabIcons'

const ClipboardHistoryWindow: React.FC = () => {
  const [history, setHistory] = useState<ClipboardHistoryItem[]>([])
  const [historyLimit, setHistoryLimit] = useState(20)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number>(-1)
  const [searchQuery, setSearchQuery] = useState('')
  const historyListRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 模糊匹配过滤后的历史列表
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history
    const q = searchQuery.toLowerCase()
    return history.filter((item) => {
      if (item.isImage || item.content.startsWith('data:image/')) return false
      return item.content.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)
    })
  }, [history, searchQuery])

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

  // 加载剪贴板历史和限制
  useEffect(() => {
    window.clipToolAPI.getClipboardHistory().then(setHistory)
    window.clipToolAPI.getClipboardHistoryLimit().then((limit) => {
      setHistoryLimit(limit)
    })
    // 打开窗口时自动聚焦搜索框
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }, [])

  // 监听主进程后台剪贴板变化事件
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

  // 复制内容并关闭窗口
  const handleCopyAndClose = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      showToast('✓ 已复制')
      setTimeout(() => {
        window.clipToolAPI.closeHistoryWindow()
      }, 300)
    } catch {
      showToast('✕ 复制失败')
    }
  }, [showToast])

  // 点击历史项直接复制并关闭
  const handleHistoryClick = useCallback((item: ClipboardHistoryItem) => {
    handleCopyAndClose(item.content)
  }, [handleCopyAndClose])

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
      if (e.key === 'Escape') {
        e.preventDefault()
        // 如果搜索框有内容，先清空搜索
        if (searchQuery.trim()) {
          setSearchQuery('')
          setSelectedHistoryIndex(-1)
          return
        }
        window.clipToolAPI.closeHistoryWindow()
        return
      }

      // Enter：复制选中项并关闭
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        // 如果没有选中项但有过滤结果，默认选中第一个
        const targetIndex = selectedHistoryIndex >= 0 ? selectedHistoryIndex : 0
        if (filteredHistory[targetIndex]) {
          handleCopyAndClose(filteredHistory[targetIndex].content)
        }
        return
      }

      // ↑↓ 切换历史
      if (e.key === 'ArrowDown') {
        e.preventDefault()
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
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (filteredHistory.length === 0) return
        setSelectedHistoryIndex((prev) => {
          const next = Math.max(prev - 1, -1)
          if (next >= 0) {
            setTimeout(() => {
              const list = historyListRef.current
              const el = list?.children[next] as HTMLElement
              if (el) el.scrollIntoView({ block: 'nearest' })
            }, 0)
          }
          return next
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredHistory, selectedHistoryIndex, handleCopyAndClose, searchQuery])

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
    if (isImage || content.startsWith('data:image/')) return '[图片]'
    const text = content.replace(/\n/g, ' ').trim()
    return text.length > 60 ? text.substring(0, 60) + '...' : text
  }

  return (
    <div className="app-container">
      {/* 可拖拽区域 */}
      <div className="drag-region">
        <div className="traffic-lights">
          <button className="traffic-light traffic-light-close" onClick={() => window.clipToolAPI.closeHistoryWindow()} title="关闭">
            <svg width="6" height="6" viewBox="0 0 6 6"><path d="M0 0L6 6M6 0L0 6" stroke="currentColor" strokeWidth="1.2" /></svg>
          </button>
          <button className="traffic-light traffic-light-minimize" onClick={() => window.clipToolAPI.minimizeWindow()} title="最小化">
            <svg width="8" height="2" viewBox="0 0 8 2"><path d="M0 1h8" stroke="currentColor" strokeWidth="1.2" /></svg>
          </button>
          <button className="traffic-light traffic-light-maximize" onClick={() => window.clipToolAPI.toggleMaximizeWindow()} title="最大化">
            <svg width="6" height="6" viewBox="0 0 6 6"><path d="M0 1.5C0 .67.67 0 1.5 0h3C5.33 0 6 .67 6 1.5v3c0 .83-.67 1.5-1.5 1.5h-3C.67 6 0 5.33 0 4.5z" fill="currentColor" /></svg>
          </button>
        </div>
      </div>

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
            ref={searchInputRef}
            className="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSelectedHistoryIndex(-1)
            }}
            placeholder="搜索剪贴板历史..."
            autoFocus
          />
          {searchQuery && (
            <button
              className="action-btn"
              onClick={() => {
                setSearchQuery('')
                setSelectedHistoryIndex(-1)
                searchInputRef.current?.focus()
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
              <span className="editor-history-empty-icon"><IconClipboard size={28} /></span>
              <span className="editor-history-empty-text">{searchQuery.trim() ? '未找到匹配的历史记录' : '暂无剪贴板历史'}</span>
              <span className="editor-history-empty-hint">{searchQuery.trim() ? '试试其他关键词' : '复制内容后会自动记录在这里'}</span>
            </div>
          ) : (
            filteredHistory.map((item, index) => (
              <div
                key={item.id}
                className={`editor-history-item${selectedHistoryIndex === index ? ' selected' : ''}`}
                onClick={() => {
                  handleHistoryClick(item)
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
