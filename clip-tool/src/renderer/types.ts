/** 全局类型声明 */

/** 内容类型 */
export type ContentType = 'code' | 'text' | 'url' | 'image' | 'document' | 'other'

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
  isImage?: boolean  // 是否为图片（content 为 base64）
}

export interface ShortcutConfig {
  openSave: string
  openSearch: string
}

/** COS 云端存储配置 */
export interface CosConfig {
  secretId: string
  secretKey: string
  enabled: boolean
}

/** 存储模式 */
export type StorageMode = 'local' | 'cos'

/** 剪贴板历史条目 */
export interface ClipboardHistoryItem {
  id: string
  content: string
  type: ContentType
  language?: string
  isImage?: boolean
  timestamp: string
}

/** 个人中心信息 */
export interface ProfileData {
  nickname: string
  avatar: string        // base64 或空
  bio: string           // 个人签名/简介
  email: string
  createdAt: string
  updatedAt: string
}

export interface ClipToolAPI {
  getAllSnippets: () => Promise<SnippetData[]>
  readClipboard: () => Promise<ClipboardData>
  addSnippet: (snippet: SnippetData) => Promise<SnippetData[]>
  deleteSnippet: (id: string) => Promise<SnippetData[]>
  toggleFavorite: (id: string) => Promise<SnippetData[]>
  copyToClipboard: (id: string, content: string, contentType?: string) => Promise<SnippetData[]>
  updateSnippet: (id: string, data: Partial<Pick<SnippetData, 'title' | 'tags'>>) => Promise<SnippetData[]>
  hideWindow: () => void
  onSwitchMode: (callback: (mode: 'save' | 'search') => void) => (() => void)
  getShortcuts: () => Promise<ShortcutConfig>
  saveShortcuts: (config: ShortcutConfig) => Promise<ShortcutConfig>
  getCustomTags: () => Promise<string[]>
  saveCustomTags: (tags: string[]) => Promise<string[]>
  // COS 云端存储 API
  getCosConfig: () => Promise<CosConfig>
  saveCosConfig: (config: CosConfig) => Promise<CosConfig>
  testCosConnection: () => Promise<{ success: boolean; message: string }>
  getDeviceId: () => Promise<string>
  pullSnippets: () => Promise<SnippetData[] | null>
  pushSnippets: () => Promise<boolean>
  pullTags: () => Promise<string[] | null>
  pushTags: () => Promise<boolean>
  // 存储模式
  getStorageMode: () => Promise<StorageMode>
  setStorageMode: (mode: StorageMode) => Promise<StorageMode>
  // 个人中心
  getProfile: () => Promise<ProfileData>
  saveProfile: (profile: ProfileData) => Promise<ProfileData>
  pullProfile: () => Promise<ProfileData | null>
  pushProfile: () => Promise<boolean>
  getCosConfig: () => Promise<CosConfig>
  // 剪贴板历史
  getClipboardHistory: () => Promise<ClipboardHistoryItem[]>
  addClipboardHistory: (item: ClipboardHistoryItem) => Promise<ClipboardHistoryItem[]>
  clearClipboardHistory: () => Promise<ClipboardHistoryItem[]>
  deleteClipboardHistoryItem: (id: string) => Promise<ClipboardHistoryItem[]>
  getClipboardHistoryLimit: () => Promise<number>
  setClipboardHistoryLimit: (limit: number) => Promise<number>
}

declare global {
  interface Window {
    clipToolAPI: ClipToolAPI
  }
}
