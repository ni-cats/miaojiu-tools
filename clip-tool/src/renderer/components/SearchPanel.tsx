/**
 * 搜索面板组件
 * 支持键盘上下键选中、⌘C/Enter 复制选中项
 * 支持按标签、内容类型筛选
 */
import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect, useCallback } from 'react'
import { useSearch, CONTENT_TYPE_MAP } from '../hooks/useSearch'
import type { SnippetData, ContentType } from '../types'
import SnippetCard from './SnippetCard'
import TagFilter from './TagFilter'
import EmptyState from './EmptyState'

interface SearchPanelProps {
  snippets: SnippetData[]
  onCopy: (snippet: SnippetData) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  onUpdateTags?: (id: string, tags: string[]) => void
}

export interface SearchPanelRef {
  focusSearch: () => void
  getResults: () => SnippetData[]
  getSelectedIndex: () => number
  selectUp: () => void
  selectDown: () => void
  copySelected: () => void
}

const SearchPanel = forwardRef<SearchPanelRef, SearchPanelProps>(
  ({ snippets, onCopy, onDelete, onToggleFavorite, onUpdateTags }, ref) => {
    const searchInputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const {
      query, setQuery,
      selectedTag, setSelectedTag,
      selectedType, setSelectedType,
      allTags, allTypes,
      results,
    } = useSearch(snippets)
    const [selectedIndex, setSelectedIndex] = useState(0)

    // 搜索结果变化时重置选中
    useEffect(() => {
      setSelectedIndex(0)
    }, [results.length, query, selectedTag, selectedType])

    // 滚动选中项到可视区域
    const scrollToSelected = useCallback((index: number) => {
      const listEl = listRef.current
      if (!listEl) return
      const cards = listEl.querySelectorAll('.snippet-card')
      if (cards[index]) {
        cards[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }, [])

    const selectUp = useCallback(() => {
      setSelectedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : results.length - 1
        scrollToSelected(next)
        return next
      })
    }, [results.length, scrollToSelected])

    const selectDown = useCallback(() => {
      setSelectedIndex((prev) => {
        const next = prev < results.length - 1 ? prev + 1 : 0
        scrollToSelected(next)
        return next
      })
    }, [results.length, scrollToSelected])

    const copySelected = useCallback(() => {
      if (results.length > 0 && selectedIndex >= 0 && selectedIndex < results.length) {
        onCopy(results[selectedIndex])
      }
    }, [results, selectedIndex, onCopy])

    useImperativeHandle(ref, () => ({
      focusSearch: () => {
        searchInputRef.current?.focus()
      },
      getResults: () => results,
      getSelectedIndex: () => selectedIndex,
      selectUp,
      selectDown,
      copySelected,
    }))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 搜索框 */}
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题、内容、标签..."
          />
          {query && (
            <button
              className="action-btn"
              onClick={() => setQuery('')}
              style={{ width: 20, height: 20, fontSize: 12 }}
            >
              ✕
            </button>
          )}
        </div>

        {/* 内容类型筛选 */}
        {allTypes.length > 1 && (
          <div className="type-filter">
            <button
              className={`type-filter-item ${selectedType === null ? 'active' : ''}`}
              onClick={() => setSelectedType(null)}
            >
              全部
            </button>
            {allTypes.map((type) => (
              <button
                key={type}
                className={`type-filter-item ${selectedType === type ? 'active' : ''}`}
                onClick={() => setSelectedType(selectedType === type ? null : type)}
              >
                {CONTENT_TYPE_MAP[type]?.icon} {CONTENT_TYPE_MAP[type]?.label || type}
              </button>
            ))}
          </div>
        )}

        {/* 标签筛选 */}
        <TagFilter tags={allTags} selectedTag={selectedTag} onSelectTag={setSelectedTag} />

        {/* 搜索结果列表 */}
        <div className="panel-content" ref={listRef} style={{ flex: 1, padding: '0' }}>
          {results.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={query || selectedTag || selectedType ? '没有找到匹配的片段' : '暂无保存的片段'}
              description={query || selectedTag || selectedType ? '试试更换筛选条件' : '使用 ⌘⇧K 保存剪贴板内容'}
            />
          ) : (
            results.map((snippet, index) => (
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
            ))
          )}
        </div>

        {/* 搜索模式快捷键提示 */}
        <div className="shortcut-hint" style={{ borderTop: 'none', paddingTop: 4 }}>
          <kbd>↑↓</kbd> 选择 &nbsp;
          <kbd>Enter</kbd> / <kbd>⌘C</kbd> 复制 &nbsp;
          <kbd>⌘1-9</kbd> 快速复制 &nbsp;
          <kbd>Esc</kbd> 关闭
        </div>
      </div>
    )
  }
)

SearchPanel.displayName = 'SearchPanel'

export default SearchPanel
