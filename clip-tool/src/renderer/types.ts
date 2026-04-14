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
  openDoc: string
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

/** 页面可见性配置 */
export interface PageVisibility {
  save: boolean
  editor: boolean
  search: boolean
  launcher: boolean
  doc: boolean
  ai: boolean
  favorite: boolean
  settings: boolean
  profile: boolean
}

/** 本地应用 */
export interface LocalApp {
  name: string       // 应用名称
  path: string       // 应用完整路径
  icon: string       // Emoji 图标
}

/** macOS 快捷指令 */
export interface MacShortcut {
  name: string  // 快捷指令名称
}

/** AI 模型配置 */
export interface AiModelConfig {
  provider: 'hunyuan' | 'deepseek'
  secretId: string
  secretKey: string
  model: string
  enabled: boolean
}

/** 语雀配置 */
export interface YuqueConfig {
  token: string
  login: string
  userName: string
  targetRepoId: number
  targetRepoName: string
  targetRepoNamespace: string
}

/** 语雀同步映射项 */
export interface YuqueSyncItem {
  yuqueDocId: number
  yuqueSyncedAt: string
}

/** 语雀同步映射表 */
export type YuqueSyncMap = Record<string, YuqueSyncItem>

/** 语雀搜索结果项 */
export interface YuqueSearchResult {
  id: number
  type: string
  title: string
  summary: string
  url: string
  target: {
    id: number
    slug: string
    title: string
    book_id: number
    description: string
    created_at: string
    updated_at: string
    content_updated_at: string
    book?: {
      id: number
      slug: string
      name: string
      namespace: string
    }
  }
}

/** 语雀文档详情 */
export interface YuqueDoc {
  id: number
  slug: string
  title: string
  body: string
  body_html: string
  book_id: number
  description: string
  created_at: string
  updated_at: string
  content_updated_at: string
  word_count: number
}

/** 语雀知识库 */
export interface YuqueRepo {
  id: number
  slug: string
  name: string
  namespace: string
  description: string
}

export interface ClipToolAPI {
  // 同步设置缓存（APP启动时获取，零延迟）
  initialSettings: Record<string, unknown>
  // 异步获取最新设置（用于刷新缓存）
  getAllSyncSettings: () => Promise<Record<string, unknown>>
  getAllSnippets: () => Promise<SnippetData[]>
  readClipboard: () => Promise<ClipboardData>
  addSnippet: (snippet: SnippetData) => Promise<SnippetData[]>
  deleteSnippet: (id: string) => Promise<SnippetData[]>
  toggleFavorite: (id: string) => Promise<SnippetData[]>
  copyToClipboard: (id: string, content: string, contentType?: string) => Promise<SnippetData[]>
  updateSnippet: (id: string, data: Partial<Pick<SnippetData, 'title' | 'tags' | 'content'>>) => Promise<SnippetData[]>
  hideWindow: () => void
  minimizeWindow: () => void
  toggleMaximizeWindow: () => void
  openHistoryWindow: () => void
  closeHistoryWindow: () => void
  isHistoryWindow: () => boolean
onSwitchMode: (callback: (mode: 'save' | 'search' | 'editor' | 'doc' | 'ai' | 'favorite' | 'settings' | 'profile' | 'launcher') => void) => (() => void)
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
  // 监听主进程后台剪贴板变化
  onClipboardChanged: (
    callback: (data: { newItem: ClipboardHistoryItem; history: ClipboardHistoryItem[] }) => void
  ) => (() => void)
  // 快速链接
  getQuickLinks: () => Promise<QuickLink[]>
  saveQuickLinks: (links: QuickLink[]) => Promise<QuickLink[]>
  addQuickLink: (link: QuickLink) => Promise<QuickLink[]>
  deleteQuickLink: (id: string) => Promise<QuickLink[]>
  updateQuickLink: (id: string, data: Partial<Omit<QuickLink, 'id'>>) => Promise<QuickLink[]>
  openExternal: (url: string) => Promise<void>
  // 本地应用
  getInstalledApps: () => Promise<LocalApp[]>
  getAppIcon: (appPath: string) => Promise<string>
  openApp: (appPath: string) => Promise<boolean>
  // 导航页使用频率
  getLauncherUsageCount: () => Promise<Record<string, number>>
  incrementLauncherUsage: (itemKey: string) => Promise<Record<string, number>>
  // macOS 快捷指令
  getMacShortcuts: () => Promise<MacShortcut[]>
  runMacShortcut: (name: string) => Promise<boolean>
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
  matchAiTags: (content: string, contentType: string, availableTags: string[]) => Promise<string[]>
  // AI 标签匹配
  getAiTagEnabled: () => Promise<boolean>
  setAiTagEnabled: (enabled: boolean) => Promise<boolean>
  // 历史小窗配置
  getEnableHistoryWindow: () => Promise<boolean>
  setEnableHistoryWindow: (enabled: boolean) => Promise<boolean>
  // 设置批量推拉
  pushSettings: () => Promise<boolean>
  pullSettings: () => Promise<Record<string, unknown> | null>
  // 主题
  getTheme: () => Promise<string>
  setTheme: (theme: string) => Promise<string>
  // 页面可见性
  getPageVisibility: () => Promise<PageVisibility>
  savePageVisibility: (config: PageVisibility) => Promise<PageVisibility>
  // 全局字体大小
  getAppFontSize: () => Promise<number>
  setAppFontSize: (size: number) => Promise<number>
  // 语雀集成
  getYuqueConfig: () => Promise<YuqueConfig>
  saveYuqueConfig: (config: YuqueConfig) => Promise<YuqueConfig>
  verifyYuqueToken: (token: string) => Promise<{ success: boolean; user?: { id: number; login: string; name: string; avatar_url: string }; error?: string }>
  getYuqueRepos: (token: string, login: string) => Promise<{ success: boolean; repos?: YuqueRepo[]; error?: string }>
  searchYuqueDocs: (query: string, options?: { type?: string; page?: number; limit?: number }) => Promise<{ success: boolean; data?: YuqueSearchResult[]; total?: number; error?: string }>
  getYuqueDocDetail: (bookId: number, docId: number) => Promise<{ success: boolean; doc?: YuqueDoc; error?: string }>
  syncSnippetToYuque: (snippetId: string, title: string, content: string) => Promise<{ success: boolean; docId?: number; action?: 'created' | 'updated'; error?: string }>
  getYuqueSyncMap: () => Promise<YuqueSyncMap>
}

declare global {
  interface Window {
    clipToolAPI: ClipToolAPI
  }
}
