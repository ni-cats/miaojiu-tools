/**
 * 片段卡片组件
 * 支持选中状态高亮，支持标签编辑
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { SnippetData, ContentType } from '../types'
import { formatTime } from '../utils/formatTime'
import { getTagStyle, getTagColor } from '../utils/tagColor'

/** 内容类型样式映射 */
const TYPE_LABELS: Record<ContentType, string> = {
  code: 'code',
  text: 'text',
  url: 'url',
  image: 'image',
  document: 'doc',
  other: 'other',
}

interface SnippetCardProps {
  snippet: SnippetData
  index?: number
  showIndex?: boolean
  isSelected?: boolean
  onCopy: (snippet: SnippetData) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  onUpdateTags?: (id: string, tags: string[]) => void
  onMouseEnter?: () => void
}

const SnippetCard: React.FC<SnippetCardProps> = ({
  snippet,
  index,
  showIndex = false,
  isSelected = false,
  onCopy,
  onDelete,
  onToggleFavorite,
  onUpdateTags,
  onMouseEnter,
}) => {
  const [isEditingTags, setIsEditingTags] = useState(false)
  const [editTags, setEditTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [presetTags, setPresetTags] = useState<string[]>([])
  const tagEditorRef = useRef<HTMLDivElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  // 打开标签编辑
  const openTagEditor = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEditTags([...snippet.tags])
    setCustomTagInput('')
    setIsEditingTags(true)
    // 加载预设标签
    window.clipToolAPI.getCustomTags().then(setPresetTags)
    setTimeout(() => tagInputRef.current?.focus(), 50)
  }, [snippet.tags])

  // 关闭标签编辑并保存
  const closeTagEditor = useCallback(() => {
    if (isEditingTags && onUpdateTags) {
      // 比较标签是否有变化
      const tagsChanged =
        editTags.length !== snippet.tags.length ||
        editTags.some((t, i) => t !== snippet.tags[i])
      if (tagsChanged) {
        onUpdateTags(snippet.id, editTags)
      }
    }
    setIsEditingTags(false)
  }, [isEditingTags, editTags, snippet.id, snippet.tags, onUpdateTags])

  // 点击外部关闭编辑
  useEffect(() => {
    if (!isEditingTags) return
    const handleClickOutside = (e: MouseEvent) => {
      if (tagEditorRef.current && !tagEditorRef.current.contains(e.target as Node)) {
        closeTagEditor()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isEditingTags, closeTagEditor])

  // 切换标签选中
  const toggleTag = (tag: string) => {
    setEditTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  // 添加自定义标签
  const addCustomTag = () => {
    const tag = customTagInput.trim()
    if (tag && !editTags.includes(tag)) {
      setEditTags((prev) => [...prev, tag])
    }
    setCustomTagInput('')
  }

  const getPreview = (content: string, type: ContentType) => {
    // 图片类型不显示文本预览
    if (type === 'image' && content.startsWith('data:image/')) {
      return null
    }
    const lines = content.split('\n').filter((l) => l.trim())
    return lines.slice(0, 2).join('\n')
  }

  const isImageSnippet = snippet.type === 'image' && snippet.content.startsWith('data:image/')

  return (
    <div
      className={`snippet-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onCopy(snippet)}
      onMouseEnter={onMouseEnter}
    >
      {/* 操作按钮 */}
      <div className="snippet-actions">
        <button
          className={`action-btn ${snippet.isFavorite ? 'favorite' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(snippet.id)
          }}
          title={snippet.isFavorite ? '取消收藏' : '收藏'}
        >
          {snippet.isFavorite ? '★' : '☆'}
        </button>
        <button
          className="action-btn danger"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(snippet.id)
          }}
          title="删除"
        >
          ✕
        </button>
      </div>

      {/* 标题行 */}
      <div className="snippet-card-header">
        {showIndex && index !== undefined && (
          <span className="snippet-index">⌘{index + 1}</span>
        )}
        <span className="snippet-title">{snippet.title}</span>
        <span className={`snippet-type ${snippet.type}`}>
          {TYPE_LABELS[snippet.type] || snippet.type}
          {snippet.language && snippet.language !== 'plaintext' ? ` · ${snippet.language}` : ''}
        </span>
      </div>

      {/* 内容预览 */}
      {isImageSnippet ? (
        <div className="snippet-image-preview">
          <img src={snippet.content} alt="图片" />
        </div>
      ) : (
        <div className="snippet-preview">{getPreview(snippet.content, snippet.type)}</div>
      )}

      {/* 底部信息 */}
      <div className="snippet-meta">
        <span>{formatTime(snippet.createdAt)}</span>
        {snippet.copyCount > 0 && <span>已复制 {snippet.copyCount} 次</span>}
      </div>

      {/* 标签 */}
      <div className="snippet-tags-row">
        {snippet.tags.length > 0 && (
          <div className="snippet-tags">
            {snippet.tags.map((tag) => (
              <span key={tag} className="tag" style={getTagStyle(tag)}>{tag}</span>
            ))}
          </div>
        )}
        {onUpdateTags && (
          <button
            className="tag-edit-btn"
            onClick={openTagEditor}
            title="编辑标签"
          >
            🏷️
          </button>
        )}
      </div>

      {/* 标签编辑弹出层 */}
      {isEditingTags && (
        <div className="tag-editor-overlay" ref={tagEditorRef} onClick={(e) => e.stopPropagation()}>
          <div className="tag-editor-header">
            <span className="tag-editor-title">编辑标签</span>
            <button className="tag-editor-done" onClick={(e) => { e.stopPropagation(); closeTagEditor() }}>完成</button>
          </div>

          {/* 已选标签 */}
          {editTags.length > 0 && (
            <div className="tag-editor-selected">
              {editTags.map((tag) => (
                <span key={tag} className="tag-editor-tag" style={{
                  background: getTagColor(tag).bg,
                  color: getTagColor(tag).text,
                }}>
                  {tag}
                  <button
                    className="tag-editor-tag-remove"
                    onClick={() => toggleTag(tag)}
                    style={{ color: getTagColor(tag).text }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 预设标签快速选择 */}
          {presetTags.length > 0 && (
            <div className="tag-editor-presets">
              {presetTags.map((tag) => (
                <button
                  key={tag}
                  className={`tag-editor-preset-item ${editTags.includes(tag) ? 'active' : ''}`}
                  onClick={() => toggleTag(tag)}
                  style={editTags.includes(tag) ? {
                    background: getTagColor(tag).bg,
                    color: getTagColor(tag).text,
                    borderColor: getTagColor(tag).text,
                  } : {
                    color: getTagColor(tag).text,
                    borderColor: getTagColor(tag).bg,
                  }}
                >
                  {editTags.includes(tag) ? '✓ ' : ''}{tag}
                </button>
              ))}
            </div>
          )}

          {/* 自定义输入 */}
          <div className="tag-editor-input-row">
            <input
              ref={tagInputRef}
              className="tag-editor-input"
              type="text"
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customTagInput.trim()) {
                  e.preventDefault()
                  e.stopPropagation()
                  addCustomTag()
                } else if (e.key === 'Escape') {
                  e.stopPropagation()
                  closeTagEditor()
                }
              }}
              placeholder="输入自定义标签，回车添加"
            />
            {customTagInput.trim() && (
              <button className="tag-editor-add-btn" onClick={addCustomTag}>+</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SnippetCard
