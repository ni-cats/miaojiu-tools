/**
 * 片段卡片组件
 * 支持选中状态高亮
 */
import React from 'react'
import type { SnippetData, ContentType } from '../types'
import { formatTime } from '../utils/formatTime'
import { getTagStyle } from '../utils/tagColor'

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
  onMouseEnter,
}) => {
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
      {snippet.tags.length > 0 && (
        <div className="snippet-tags">
          {snippet.tags.map((tag) => (
            <span key={tag} className="tag" style={getTagStyle(tag)}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default SnippetCard
