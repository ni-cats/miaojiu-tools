/** 全局类型声明 */

export interface SnippetData {
  id: string
  title: string
  content: string
  tags: string[]
  type: 'code' | 'text' | 'url'
  language?: string
  createdAt: string
  updatedAt: string
  copyCount: number
  isFavorite: boolean
}

export interface ClipboardData {
  content: string
  type: 'code' | 'text' | 'url'
  language?: string
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
}

declare global {
  interface Window {
    clipToolAPI: ClipToolAPI
  }
}
