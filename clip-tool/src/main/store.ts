/**
 * electron-store 数据管理模块
 * 负责代码片段的 CRUD 操作
 */
import Store from 'electron-store'

/** 内容类型 */
export type ContentType = 'code' | 'text' | 'url' | 'image' | 'video' | 'document' | 'other'

export interface Snippet {
  id: string
  title: string
  content: string
  tags: string[]
  type: ContentType
  language?: string
  createdAt: string
  updatedAt: string
  copyCount: number
  isFavorite: boolean
}

/** 快捷键配置 */
export interface ShortcutConfig {
  openSave: string    // 唤起保存模式，默认 CommandOrControl+Shift+K
  openSearch: string  // 唤起搜索模式，默认 CommandOrControl+Shift+S
}

interface StoreSchema {
  snippets: Snippet[]
  settings: {
    hideOnBlur: boolean
    maxSnippets: number
  }
  windowBounds: {
    width: number
    height: number
    x?: number
    y?: number
  }
  shortcuts: ShortcutConfig
  customTags: string[]  // 用户自定义的枚举标签列表
}

/** 默认快捷键配置 */
export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  openSave: 'CommandOrControl+Shift+K',
  openSearch: 'CommandOrControl+Shift+S',
}

const store = new Store<StoreSchema>({
  name: 'clip-tool-data',
  defaults: {
    snippets: [],
    settings: {
      hideOnBlur: true,
      maxSnippets: 500,
    },
    windowBounds: {
      width: 520,
      height: 620,
    },
    shortcuts: { ...DEFAULT_SHORTCUTS },
    customTags: ['工具函数', '配置', '模板', '笔记', '临时'],
  },
})

/** 获取所有片段 */
export function getAllSnippets(): Snippet[] {
  return store.get('snippets', [])
}

/** 添加片段 */
export function addSnippet(snippet: Snippet): Snippet[] {
  const snippets = getAllSnippets()
  snippets.unshift(snippet)
  // 超过最大数量时，删除非收藏的最旧条目
  const maxSnippets = store.get('settings.maxSnippets', 500)
  if (snippets.length > maxSnippets) {
    // 保留所有收藏，删除非收藏的最旧条目
    const favorites = snippets.filter((s) => s.isFavorite)
    const nonFavorites = snippets.filter((s) => !s.isFavorite)
    const trimmed = nonFavorites.slice(0, maxSnippets - favorites.length)
    const result = [...favorites, ...trimmed].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    store.set('snippets', result)
    return result
  }
  store.set('snippets', snippets)
  return snippets
}

/** 删除片段 */
export function deleteSnippet(id: string): Snippet[] {
  const snippets = getAllSnippets().filter((s) => s.id !== id)
  store.set('snippets', snippets)
  return snippets
}

/** 切换收藏状态 */
export function toggleFavorite(id: string): Snippet[] {
  const snippets = getAllSnippets()
  const target = snippets.find((s) => s.id === id)
  if (target) {
    target.isFavorite = !target.isFavorite
    target.updatedAt = new Date().toISOString()
  }
  store.set('snippets', snippets)
  return snippets
}

/** 增加复制计数 */
export function incrementCopyCount(id: string): Snippet[] {
  const snippets = getAllSnippets()
  const target = snippets.find((s) => s.id === id)
  if (target) {
    target.copyCount += 1
    target.updatedAt = new Date().toISOString()
  }
  store.set('snippets', snippets)
  return snippets
}

/** 更新片段（标题、标签） */
export function updateSnippet(id: string, data: Partial<Pick<Snippet, 'title' | 'tags'>>): Snippet[] {
  const snippets = getAllSnippets()
  const target = snippets.find((s) => s.id === id)
  if (target) {
    if (data.title !== undefined) target.title = data.title
    if (data.tags !== undefined) target.tags = data.tags
    target.updatedAt = new Date().toISOString()
  }
  store.set('snippets', snippets)
  return snippets
}

/** 获取设置 */
export function getSettings() {
  return store.get('settings')
}

/** 获取记忆的窗口大小和位置 */
export function getWindowBounds() {
  return store.get('windowBounds', { width: 520, height: 620 })
}

/** 保存窗口大小和位置 */
export function saveWindowBounds(bounds: { width: number; height: number; x?: number; y?: number }) {
  store.set('windowBounds', bounds)
}

/** 获取快捷键配置 */
export function getShortcuts(): ShortcutConfig {
  return store.get('shortcuts', { ...DEFAULT_SHORTCUTS })
}

/** 保存快捷键配置 */
export function saveShortcuts(shortcuts: ShortcutConfig): void {
  store.set('shortcuts', shortcuts)
}

/** 获取自定义标签列表 */
export function getCustomTags(): string[] {
  return store.get('customTags', ['工具函数', '配置', '模板', '笔记', '临时'])
}

/** 保存自定义标签列表 */
export function saveCustomTags(tags: string[]): string[] {
  store.set('customTags', tags)
  return tags
}

/** 添加自定义标签 */
export function addCustomTag(tag: string): string[] {
  const tags = getCustomTags()
  if (!tags.includes(tag)) {
    tags.push(tag)
    store.set('customTags', tags)
  }
  return tags
}

/** 删除自定义标签 */
export function removeCustomTag(tag: string): string[] {
  const tags = getCustomTags().filter((t) => t !== tag)
  store.set('customTags', tags)
  return tags
}