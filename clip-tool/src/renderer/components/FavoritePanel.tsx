/**
 * 收藏面板组件
 */
import React from 'react'
import type { SnippetData } from '../types'
import SnippetCard from './SnippetCard'
import EmptyState from './EmptyState'

interface FavoritePanelProps {
  snippets: SnippetData[]
  onCopy: (snippet: SnippetData) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  onUpdateTags?: (id: string, tags: string[]) => void
}

const FavoritePanel: React.FC<FavoritePanelProps> = ({ snippets, onCopy, onDelete, onToggleFavorite, onUpdateTags }) => {
  const favorites = snippets.filter((s) => s.isFavorite)

  if (favorites.length === 0) {
    return (
      <EmptyState
        icon="⭐"
        title="暂无收藏的片段"
        description="点击片段上的 ☆ 按钮来收藏常用片段"
      />
    )
  }

  return (
    <div className="panel-content" style={{ padding: 0 }}>
      {favorites.map((snippet) => (
        <SnippetCard
          key={snippet.id}
          snippet={snippet}
          onCopy={onCopy}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onUpdateTags={onUpdateTags}
        />
      ))}
    </div>
  )
}

export default FavoritePanel
