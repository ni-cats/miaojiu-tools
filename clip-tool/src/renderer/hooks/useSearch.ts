/**
 * 搜索 Hook
 * 基于 fuse.js 实现模糊搜索，支持标签筛选和内容类型筛选
 */
import React from 'react'
import { useState, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'
import type { SnippetData, ContentType } from '../types'
import { IconCode, IconText, IconImage, IconDocument, IconRocket } from '../components/TabIcons'
import { Link, Package } from 'lucide-react'

const fuseOptions: Fuse.IFuseOptions<SnippetData> = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'content', weight: 0.3 },
    { name: 'tags', weight: 0.3 },
  ],
  threshold: 0.4,
  includeScore: true,
}

/** 内容类型的显示名称和图标 */
export const CONTENT_TYPE_MAP: Record<ContentType, { label: string; icon: React.ReactNode }> = {
  code: { label: '代码', icon: React.createElement(IconCode, { size: 12 }) },
  text: { label: '文本', icon: React.createElement(IconText, { size: 12 }) },
  url: { label: '链接', icon: React.createElement(Link, { size: 12 }) },
  image: { label: '图片', icon: React.createElement(IconImage, { size: 12 }) },
  document: { label: '文档', icon: React.createElement(IconDocument, { size: 12 }) },
  other: { label: '其他', icon: React.createElement(Package, { size: 12 }) },
}

export function useSearch(snippets: SnippetData[]) {
  const [query, setQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<ContentType | null>(null)

  const fuse = useMemo(() => new Fuse(snippets, fuseOptions), [snippets])

  // 获取所有标签
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    snippets.forEach((s) => s.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [snippets])

  // 获取所有已有的内容类型
  const allTypes = useMemo(() => {
    const typeSet = new Set<ContentType>()
    snippets.forEach((s) => typeSet.add(s.type))
    return Array.from(typeSet).sort()
  }, [snippets])

  // 搜索结果
  const results = useMemo(() => {
    let filtered = snippets

    // 按内容类型筛选
    if (selectedType) {
      filtered = filtered.filter((s) => s.type === selectedType)
    }

    // 按标签筛选
    if (selectedTag) {
      filtered = filtered.filter((s) => s.tags.includes(selectedTag))
    }

    // 按关键词搜索
    if (query.trim()) {
      const fuseForFiltered = new Fuse(filtered, fuseOptions)
      return fuseForFiltered.search(query).map((r) => r.item)
    }

    // 没有搜索词时，按复制次数和时间排序
    return [...filtered].sort((a, b) => {
      if (b.copyCount !== a.copyCount) return b.copyCount - a.copyCount
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [snippets, query, selectedTag, selectedType, fuse])

  const clearSearch = useCallback(() => {
    setQuery('')
    setSelectedTag(null)
    setSelectedType(null)
  }, [])

  return {
    query,
    setQuery,
    selectedTag,
    setSelectedTag,
    selectedType,
    setSelectedType,
    allTags,
    allTypes,
    results,
    clearSearch,
  }
}
