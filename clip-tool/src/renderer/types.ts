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
  openEditor: string
  openAi: string
  openFavorite: string
  openSettings: string
  openProfile: string
  openLauncher: string
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

/** 快速链接参数定义 */
export interface QuickLinkParam {
  name: string         // 参数名（占位符名称）
  label: string        // 显示标签
  defaultValue: string // 默认值
}

/** 快速链接条目 */
export interface QuickLink {
  id: string
  name: string
  url: string
  icon: string
  favicon?: string    // 自动解析的 favicon URL
  category: string
  order: number
  params?: QuickLinkParam[]  // URL 参数定义
}

/** AI 模型配置 */
export interface AiModelConfig {
  provider: 'hunyuan' | 'deepseek'
  secretId: string
  secretKey: string
  model: string
  enabled: boolean
}

export interface ClipToolAPI {
  getAllSnippets: () => Promise<SnippetData[]>
  readClipboard: () => Promise<ClipboardData>
  addSnippet: (snippet: SnippetData) => Promise<SnippetData[]>
  deleteSnippet: (id: string) => Promise<SnippetData[]>
  toggleFavorite: (id: string) => Promise<SnippetData[]>
  copyToClipboard: (id: string, content: string, contentType?: string) => Promise<SnippetData[]>
  updateSnippet: (id: string, data: Partial<Pick<SnippetData, 'title' | 'tags' | 'content'>>) => Promise<SnippetData[]>
  hideWindow: () => void
  onSwitchMode: (callback: (mode: 'save' | 'search' | 'editor' | 'ai' | 'favorite' | 'settings' | 'profile' | 'launcher') => void) => (() => void)
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
  pullFavorites: () => Promise<SnippetData[] | null>
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
  // 快速链接
  getQuickLinks: () => Promise<QuickLink[]>
  saveQuickLinks: (links: QuickLink[]) => Promise<QuickLink[]>
  addQuickLink: (link: QuickLink) => Promise<QuickLink[]>
  deleteQuickLink: (id: string) => Promise<QuickLink[]>
  updateQuickLink: (id: string, data: Partial<Omit<QuickLink, 'id'>>) => Promise<QuickLink[]>
  openExternal: (url: string) => Promise<void>
  // 混元大模型
  isHunyuanAvailable: () => Promise<boolean>
  chatWithHunyuan: (messages: { Role: string; Content: string }[]) => Promise<string>
  onHunyuanStream: (
    callback: (data: { type: 'delta' | 'done' | 'error'; content: string; fullContent?: string }) => void
  ) => (() => void)
  // AI 模型配置
  getAiModels: () => Promise<AiModelConfig[]>
  saveAiModels: (models: AiModelConfig[]) => Promise<AiModelConfig[]>
  // 导航分类管理
  getLauncherCategories: () => Promise<string[]>
  saveLauncherCategories: (categories: string[]) => Promise<string[]>
  // AI 标题
  getAiTitleEnabled: () => Promise<boolean>
  setAiTitleEnabled: (enabled: boolean) => Promise<boolean>
  generateAiTitle: (content: string, contentType: string) => Promise<string | null>
  // 设置批量推拉
  pushSettings: () => Promise<boolean>
  pullSettings: () => Promise<Record<string, unknown> | null>
}

declare global {
  interface Window {
    clipToolAPI: ClipToolAPI
  }
}
