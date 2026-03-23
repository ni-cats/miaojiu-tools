/**
 * 编辑面板组件
 * 上方：文本编辑框 + 保存按钮
 * 下方：剪贴板历史记录列表
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { nanoid } from 'nanoid'
import type { SnippetData, ClipboardHistoryItem } from '../types'

interface EditorPanelProps {
  onSave: (snippet: SnippetData) => void
}

const EditorPanel: React.FC<EditorPanelProps> = ({ onSave }) => {
  const [editorContent, setEditorContent] = useState('')
  const [title, setTitle] = useState('')
  const [history, setHistory] = useState<ClipboardHistoryItem[]>([])
  const [historyLimit, setHistoryLimit] = useState(20)
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitInput, setLimitInput] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorSectionRef = useRef<HTMLDivElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastClipboardRef = useRef<string>('')

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
      setLimitInput(String(limit))
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

  // 修改保存条数限制
  const handleSaveLimit = useCallback(async () => {
    const num = parseInt(limitInput, 10)
    if (isNaN(num) || num < 1 || num > 100) {
      showToast('⚠ 请输入 1~100 之间的数字')
      return
    }
    const saved = await window.clipToolAPI.setClipboardHistoryLimit(num)
    setHistoryLimit(saved)
    setEditingLimit(false)
    // 重新加载历史（可能被裁剪了）
    const updated = await window.clipToolAPI.getClipboardHistory()
    setHistory(updated)
    showToast(`✓ 已设置最多保存 ${saved} 条`)
  }, [limitInput, showToast])

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
          onChange={(e) => setEditorContent(e.target.value)}
          placeholder="在这里编辑内容...&#10;可以直接输入，也可以点击下方历史记录填充"
          spellCheck={false}
        />
      </div>

      {/* 分隔线 */}
      <div className="editor-divider">
        <span className="editor-divider-label">📋 剪贴板历史</span>
        <div className="editor-divider-actions">
          {editingLimit ? (
            <div className="editor-limit-edit">
              <input
                className="text-input editor-limit-input"
                type="number"
                min={1}
                max={100}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveLimit()
                  if (e.key === 'Escape') setEditingLimit(false)
                }}
              />
              <button className="editor-limit-btn" onClick={handleSaveLimit}>✓</button>
              <button className="editor-limit-btn cancel" onClick={() => setEditingLimit(false)}>✕</button>
            </div>
          ) : (
            <button
              className="editor-limit-tag"
              onClick={() => {
                setLimitInput(String(historyLimit))
                setEditingLimit(true)
              }}
              title="点击修改保存条数"
            >
              最多 {historyLimit} 条
            </button>
          )}
          {history.length > 0 && (
            <button className="editor-clear-btn" onClick={handleClearHistory}>
              清空
            </button>
          )}
        </div>
      </div>

      {/* 下方：剪贴板历史列表 */}
      <div className="editor-history-list">
        {history.length === 0 ? (
          <div className="editor-history-empty">
            <span className="editor-history-empty-icon">📋</span>
            <span className="editor-history-empty-text">暂无剪贴板历史</span>
            <span className="editor-history-empty-hint">复制内容后会自动记录在这里</span>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className="editor-history-item"
              onClick={() => handleHistoryClick(item)}
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
}

export default EditorPanel
