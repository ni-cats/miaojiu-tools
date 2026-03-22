/** 全局类型声明 */

/** 内容类型 */
export type ContentType = 'code' | 'text' | 'url' | 'image' | 'video' | 'document' | 'other'

export interface SnippetData {
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

export interface ClipboardData {
  content: string
  type: ContentType
  language?: string
}

export interface ShortcutConfig {
  openSave: string
  openSearch: string
}

export interface ClipToolAPI {
  getAllSnippets: () => Promise<SnippetData[]>
  readClipboard: () => Promise<ClipboardData>
  addSnippet: (snippet: SnippetData) => Promise<SnippetData[]>
  deleteSnippet: (id: string) => Promise<SnippetData[]>
  toggleFavorite: (id: string) => Promise<SnippetData[]>
  copyToClipboard: (id: string, content: string) => Promise<SnippetData[]>
  updateSnippet: (id: string, data: Partial<Pick<SnippetData, 'title' | 'tags'>>) => Promise<SnippetData[]>
  hideWindow: () => void
  onSwitchMode: (callback: (mode: 'save' | 'search') => void) => (() => void)
  getShortcuts: () => Promise<ShortcutConfig>
  saveShortcuts: (config: ShortcutConfig) => Promise<ShortcutConfig>
  getCustomTags: () => Promise<string[]>
  saveCustomTags: (tags: string[]) => Promise<string[]>
}

declare global {
  interface Window {
    clipToolAPI: ClipToolAPI
  }
}
