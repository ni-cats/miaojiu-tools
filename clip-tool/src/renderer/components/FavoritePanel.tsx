/**
 * 收藏面板组件
 * 支持键盘 ↑↓ 选中、Enter 复制
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // 收藏列表变化时重置选中
  useEffect(() => {
    setSelectedIndex(0)
  }, [favorites.length])

  // 滚动选中项到可视区域
  const scrollToSelected = useCallback((index: number) => {
    const listEl = listRef.current
    if (!listEl) return
    const cards = listEl.querySelectorAll('.snippet-card')
    if (cards[index]) {
      cards[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [])

  // 全局键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      if (isInputFocused) return
      if (favorites.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev < favorites.length - 1 ? prev + 1 : 0
          scrollToSelected(next)
          return next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : favorites.length - 1
          scrollToSelected(next)
          return next
        })
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (favorites[selectedIndex]) {
          onCopy(favorites[selectedIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [favorites, selectedIndex, onCopy, scrollToSelected])

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-content" ref={listRef} style={{ padding: 0, flex: 1 }}>
        {favorites.map((snippet, index) => (
          <SnippetCard
            key={snippet.id}
            snippet={snippet}
            index={index}
            showIndex={index < 9}
            isSelected={index === selectedIndex}
            onCopy={onCopy}
            onDelete={onDelete}
            onToggleFavorite={onToggleFavorite}
            onUpdateTags={onUpdateTags}
            onMouseEnter={() => setSelectedIndex(index)}
          />
        ))}
      </div>

      {/* 快捷键提示 */}
      <div className="shortcut-hint" style={{ borderTop: 'none', paddingTop: 4 }}>
        <kbd>↑↓</kbd> 选择 &nbsp;
        <kbd>Enter</kbd> 复制 &nbsp;
        <kbd>Esc</kbd> 关闭
      </div>
    </div>
  )
}

export default FavoritePanel
