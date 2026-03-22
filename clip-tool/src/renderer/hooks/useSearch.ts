/**
 * 搜索 Hook
 * 基于 fuse.js 实现模糊搜索
 */
import { useState, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'
import type { SnippetData } from '../types'

const fuseOptions: Fuse.IFuseOptions<SnippetData> = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'content', weight: 0.3 },
    { name: 'tags', weight: 0.3 },
  ],
  threshold: 0.4,
  includeScore: true,
}

export function useSearch(snippets: SnippetData[]) {
  const [query, setQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const fuse = useMemo(() => new Fuse(snippets, fuseOptions), [snippets])

  // 获取所有标签
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    snippets.forEach((s) => s.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [snippets])

  // 搜索结果
  const results = useMemo(() => {
    let filtered = snippets

    // 先按标签筛选
    if (selectedTag) {
      filtered = filtered.filter((s) => s.tags.includes(selectedTag))
    }

    // 再按关键词搜索
    if (query.trim()) {
      const fuseForFiltered = new Fuse(filtered, fuseOptions)
      return fuseForFiltered.search(query).map((r) => r.item)
    }

    // 没有搜索词时，按复制次数和时间排序
    return [...filtered].sort((a, b) => {
      if (b.copyCount !== a.copyCount) return b.copyCount - a.copyCount
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [snippets, query, selectedTag, fuse])

  const clearSearch = useCallback(() => {
    setQuery('')
    setSelectedTag(null)
  }, [])

  return {
    query,
    setQuery,
    selectedTag,
    setSelectedTag,
    allTags,
    results,
    clearSearch,
  }
}
