/**
 * electron-store 数据管理模块
 * 负责代码片段的 CRUD 操作，支持 COS 云端同步
 */
import Store from 'electron-store'
import {
  uploadSnippet,
  deleteSnippetFromCloud,
  uploadAllSnippets,
  downloadSnippets,
  uploadCustomTags,
  downloadCustomTags,
  uploadProfile,
  downloadProfile,
  resetCosClient,
  uploadSetting,
  uploadAllSettings,
  downloadAllSettings,
  uploadLauncherConfig,
  uploadAllLauncherConfigs,
  downloadAllLauncherConfigs,
  uploadFavorite,
  deleteFavoriteFromCloud,
  downloadFavorites,
} from './cos'
import { getCosYamlConfig } from './config'

/** 内容类型 */
export type ContentType = 'code' | 'text' | 'url' | 'image' | 'document' | 'other'

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
  openSave: string      // 唤起保存模式，默认 CommandOrControl+Shift+K
  openSearch: string    // 唤起搜索模式，默认 CommandOrControl+Shift+S
  openEditor: string    // 唤起编辑模式
  openAi: string        // 唤起 AI 模式
  openFavorite: string  // 唤起收藏模式
  openSettings: string  // 唤起设置模式
  openProfile: string   // 唤起个人中心
  openLauncher: string  // 唤起导航栏
}

/** COS 云端存储配置 */
export interface CosConfig {
  secretId: string
  secretKey: string
  enabled: boolean     // 是否启用云端同步
}

/** 存储模式 */
export type StorageMode = 'local' | 'cos'

/** 剪贴板历史条目 */
export interface ClipboardHistoryItem {
  id: string
  content: string
  type: 'code' | 'text' | 'url' | 'image' | 'document' | 'other'
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
  cosConfig: CosConfig  // COS 云端存储配置
  storageMode: StorageMode  // 存储模式
  profile: ProfileData  // 个人中心信息
  clipboardHistory: ClipboardHistoryItem[]  // 剪贴板历史
  clipboardHistoryLimit: number  // 剪贴板历史最大保存条数
  quickLinks: QuickLink[]  // 快速链接列表
  launcherCategories: string[]  // 导航分类列表
  aiModels: AiModelConfig[]  // AI 模型配置列表
  aiTitleEnabled: boolean  // 是否启用 AI 生成标题
  theme: string  // 主题名称
  pageVisibility: PageVisibility  // 页面可见性配置
  appFontSize: number  // 全局字体大小
  docEditorTheme: string  // 速记编辑器默认主题
}

/** AI 模型配置 */
export interface AiModelConfig {
  provider: 'hunyuan' | 'deepseek'  // 模型提供商
  secretId: string                   // API 密钥 ID（混元）或 API Key（DeepSeek）
  secretKey: string                  // API 密钥（混元）
  model: string                      // 模型名称
  enabled: boolean                   // 是否启用
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

/** 快速链接参数定义 */
export interface QuickLinkParam {
  name: string         // 参数名（占位符名称）
  label: string        // 显示标签
  defaultValue: string // 默认值
}

/** 快速链接条目 */
export interface QuickLink {
  id: string
  name: string        // 显示名称
  url: string         // 链接地址，支持 {参数名} 占位符
  icon: string        // Emoji 图标
  favicon?: string    // 自动解析的 favicon URL
  category: string    // 分类标签
  order: number       // 排序序号
  params?: QuickLinkParam[]  // URL 参数定义
}

/** 默认快捷键配置 */
export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  openSave: 'CommandOrControl+Shift+K',
  openSearch: 'CommandOrControl+Shift+S',
  openEditor: '',
  openAi: '',
  openFavorite: '',
  openSettings: '',
  openProfile: '',
  openLauncher: '',
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
    cosConfig: (() => {
      const yamlCfg = getCosYamlConfig()
      return {
        secretId: yamlCfg.secretId,
        secretKey: yamlCfg.secretKey,
        enabled: yamlCfg.enabled,
      }
    })(),
    storageMode: 'local' as StorageMode,
    clipboardHistory: [] as ClipboardHistoryItem[],
    clipboardHistoryLimit: 20,
    quickLinks: [] as QuickLink[],
    launcherCategories: ['常用', '工作', '文档', '工具', '社交', '其他'] as string[],
    aiModels: [] as AiModelConfig[],
    aiTitleEnabled: false,
    theme: 'system',
    pageVisibility: {
      save: true,
      editor: true,
      search: true,
      launcher: true,
      doc: true,
      ai: true,
      favorite: true,
      settings: true,
      profile: true,
    },
    appFontSize: 13,
    docEditorTheme: 'github-dark',
    profile: {
      nickname: '',
      avatar: '',
      bio: '',
      email: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
})

// ====== COS 配置管理 ======

/** 获取 COS 配置 */
export function getCosConfig(): CosConfig {
  const yamlCfg = getCosYamlConfig()
  const storedConfig = store.get('cosConfig', {
    secretId: '',
    secretKey: '',
    enabled: false,
  })

  // 密钥优先级：store 持久化数据（设置页配置）> YAML 配置文件
  // 用户在设置页手动配置的密钥优先级最高
  // YAML 仅在 store 未配置时作为备选（首次启动或用户未手动配置时）
  const finalSecretId = storedConfig.secretId || yamlCfg.secretId
  const finalSecretKey = storedConfig.secretKey || yamlCfg.secretKey

  // enabled 逻辑：
  // 1. 如果 store 有密钥，以 store 的 enabled 为准（用户手动配置优先）
  // 2. 如果 store 无密钥但 YAML 有，使用 YAML 的 enabled
  const finalEnabled = storedConfig.secretId ? storedConfig.enabled : yamlCfg.enabled

  console.log('getCosConfig - finalSecretId:', finalSecretId ? finalSecretId.substring(0, 8) + '...' : '(空)',
    'enabled:', finalEnabled, '(store:', storedConfig.enabled, 'yaml:', yamlCfg.enabled, ')',
    'source:', storedConfig.secretId ? 'store' : 'YAML')

  return {
    secretId: finalSecretId,
    secretKey: finalSecretKey,
    enabled: finalEnabled,
  }
}

/** 保存 COS 配置 */
export function saveCosConfig(config: CosConfig): CosConfig {
  store.set('cosConfig', config)
  // 密钥变更时重置客户端实例
  resetCosClient()
  return config
}

// ====== 云端同步辅助函数 ======

/** 防抖上传定时器（按片段 id 分别防抖） */
const syncSnippetTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
let syncTagsTimer: ReturnType<typeof setTimeout> | null = null

/** 防抖同步单条片段到云端（写操作后自动调用） */
function debounceSyncSnippet(snippet: Snippet): void {
  const config = getCosConfig()
  if (!config.enabled) return

  const existing = syncSnippetTimers.get(snippet.id)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(async () => {
    syncSnippetTimers.delete(snippet.id)
    await uploadSnippet(snippet)
  }, 1000) // 1秒防抖，避免连续操作频繁上传
  syncSnippetTimers.set(snippet.id, timer)
}

/** 防抖同步删除云端片段 */
function debounceSyncDeleteSnippet(snippetId: string): void {
  const config = getCosConfig()
  if (!config.enabled) return

  // 取消该片段的上传定时器（如果有）
  const existing = syncSnippetTimers.get(snippetId)
  if (existing) {
    clearTimeout(existing)
    syncSnippetTimers.delete(snippetId)
  }

  // 直接删除，无需防抖
  deleteSnippetFromCloud(snippetId)
}

/** 防抖同步标签到云端 */
function debounceSyncTags(): void {
  const config = getCosConfig()
  if (!config.enabled) return

  if (syncTagsTimer) clearTimeout(syncTagsTimer)
  syncTagsTimer = setTimeout(async () => {
    const tags = store.get('customTags', [])
    await uploadCustomTags(tags)
    // 同时同步到 settings 目录
    await uploadSetting('customTags', tags)
  }, 1000)
}

/** 防抖同步收藏到云端 favorites 目录（按片段 id 分别防抖） */
const syncFavoriteTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

function debounceSyncFavorite(snippet: Snippet): void {
  const config = getCosConfig()
  if (!config.enabled) return

  const existing = syncFavoriteTimers.get(snippet.id)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(async () => {
    syncFavoriteTimers.delete(snippet.id)
    if (snippet.isFavorite) {
      // 收藏：上传到 favorites 目录
      await uploadFavorite(snippet)
    } else {
      // 取消收藏：从 favorites 目录删除
      await deleteFavoriteFromCloud(snippet)
    }
  }, 1000) // 1秒防抖
  syncFavoriteTimers.set(snippet.id, timer)
}

// ====== 设置同步辅助函数 ======

/** 所有需要同步的设置项名称（settings 目录） */
const SYNC_SETTING_NAMES = [
  'shortcuts',
  'customTags',
  'clipboardHistoryLimit',
  'aiModels',
  'aiTitleEnabled',
  'launcherCategories',
  'pageVisibility',
  'appFontSize',
  'docEditorTheme',
] as const

/** 所有需要同步的导航配置项名称（launcher 目录） */
const SYNC_LAUNCHER_NAMES = [
  'quickLinks',
] as const

/** 防抖同步设置到云端的定时器（按设置名分别防抖） */
const syncSettingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

/** 防抖同步单个设置项到云端 */
function debounceSyncSetting(settingName: string, data: unknown): void {
  const config = getCosConfig()
  if (!config.enabled) return

  const existing = syncSettingTimers.get(settingName)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(async () => {
    syncSettingTimers.delete(settingName)
    await uploadSetting(settingName, data)
  }, 1000) // 1秒防抖
  syncSettingTimers.set(settingName, timer)
}

/** 防抖同步导航配置到云端的定时器（按配置名分别防抖） */
const syncLauncherTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

/** 防抖同步单个导航配置到云端（launcher 目录） */
function debounceSyncLauncher(configName: string, data: unknown): void {
  const config = getCosConfig()
  if (!config.enabled) return

  const existing = syncLauncherTimers.get(configName)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(async () => {
    syncLauncherTimers.delete(configName)
    await uploadLauncherConfig(configName, data)
  }, 1000) // 1秒防抖
  syncLauncherTimers.set(configName, timer)
}

// ====== 片段 CRUD ======

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
    // 被裁剪掉的片段需要从云端删除
    const removedIds = new Set(nonFavorites.slice(maxSnippets - favorites.length).map((s) => s.id))
    removedIds.forEach((id) => debounceSyncDeleteSnippet(id))
    const result = [...favorites, ...trimmed].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    store.set('snippets', result)
    debounceSyncSnippet(snippet) // 上传新增的片段
    return result
  }
  store.set('snippets', snippets)
  debounceSyncSnippet(snippet) // 上传新增的片段
  return snippets
}

/** 删除片段 */
export function deleteSnippet(id: string): Snippet[] {
  const snippets = getAllSnippets().filter((s) => s.id !== id)
  store.set('snippets', snippets)
  debounceSyncDeleteSnippet(id) // 从云端删除该片段文件
  return snippets
}

/** 切换收藏状态 */
export function toggleFavorite(id: string): Snippet[] {
  const snippets = getAllSnippets()
  const target = snippets.find((s) => s.id === id)
  if (target) {
    target.isFavorite = !target.isFavorite
    target.updatedAt = new Date().toISOString()
    debounceSyncSnippet(target) // 仅上传变更的片段
    // 收藏状态变更时，同步到 COS favorites 目录
    debounceSyncFavorite(target)
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
    debounceSyncSnippet(target) // 仅上传变更的片段
  }
  store.set('snippets', snippets)
  return snippets
}

/** 更新片段（标题、标签、内容） */
export function updateSnippet(id: string, data: Partial<Pick<Snippet, 'title' | 'tags' | 'content'>>): Snippet[] {
  const snippets = getAllSnippets()
  const target = snippets.find((s) => s.id === id)
  if (target) {
    if (data.title !== undefined) target.title = data.title
    if (data.tags !== undefined) target.tags = data.tags
    if (data.content !== undefined) target.content = data.content
    target.updatedAt = new Date().toISOString()
    debounceSyncSnippet(target) // 仅上传变更的片段
    // 如果是收藏片段，同步到 favorites 目录
    if (target.isFavorite) {
      debounceSyncFavorite(target)
    }
  }
  store.set('snippets', snippets)
  return snippets
}

// ====== 云端同步操作 ======

/**
 * 从云端拉取片段数据并覆盖本地
 * 返回拉取后的片段列表
 */
export async function pullSnippetsFromCloud(): Promise<Snippet[] | null> {
  const cloudSnippets = await downloadSnippets()
  if (cloudSnippets === null) return null
  store.set('snippets', cloudSnippets as Snippet[])
  return cloudSnippets as Snippet[]
}

/**
 * 将本地片段数据推送到云端
 * 逐条上传所有本地片段
 */
export async function pushSnippetsToCloud(): Promise<boolean> {
  const snippets = getAllSnippets()
  return uploadAllSnippets(snippets)
}

/**
 * 从云端拉取收藏数据（favorites 目录）
 * 返回收藏列表，不覆盖本地 snippets，由调用方决定合并策略
 */
export async function pullFavoritesFromCloud(): Promise<Snippet[] | null> {
  const cloudFavorites = await downloadFavorites()
  if (cloudFavorites === null) return null
  return cloudFavorites as Snippet[]
}

/**
 * 从云端拉取标签数据并覆盖本地
 * 如果云端标签为空但本地有标签，保留本地标签（防止误清空）
 */
export async function pullTagsFromCloud(): Promise<string[] | null> {
  const cloudTags = await downloadCustomTags()
  if (cloudTags === null) return null
  // 防护：如果云端标签为空但本地有标签，保留本地标签
  if (cloudTags.length === 0) {
    const localTags = store.get('customTags', [])
    if (localTags.length > 0) {
      console.warn('[pullTagsFromCloud] 云端标签为空但本地有标签，保留本地标签:', localTags)
      return localTags
    }
  }
  store.set('customTags', cloudTags)
  return cloudTags
}

/**
 * 将本地标签数据推送到云端
 */
export async function pushTagsToCloud(): Promise<boolean> {
  const tags = getCustomTags()
  return uploadCustomTags(tags)
}

// ====== 设置相关 ======

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
  debounceSyncSetting('shortcuts', shortcuts)
}

/** 获取自定义标签列表 */
export function getCustomTags(): string[] {
  return store.get('customTags', ['工具函数', '配置', '模板', '笔记', '临时'])
}

/** 保存自定义标签列表 */
export function saveCustomTags(tags: string[]): string[] {
  // 防护：如果传入空数组但当前已有标签数据，打印警告（不阻止保存，因为用户可能有意清空）
  if (tags.length === 0) {
    const current = store.get('customTags', [])
    if (current.length > 0) {
      console.warn('[saveCustomTags] 警告：将覆盖现有标签为空数组！当前标签:', current)
    }
  }
  store.set('customTags', tags)
  debounceSyncTags() // 同步到旧路径（兼容）+ settings 目录
  return tags
}

/** 添加自定义标签 */
export function addCustomTag(tag: string): string[] {
  const tags = getCustomTags()
  if (!tags.includes(tag)) {
    tags.push(tag)
    store.set('customTags', tags)
    debounceSyncTags()
  }
  return tags
}

/** 删除自定义标签 */
export function removeCustomTag(tag: string): string[] {
  const tags = getCustomTags().filter((t) => t !== tag)
  store.set('customTags', tags)
  debounceSyncTags()
  return tags
}

// ====== 存储模式管理 ======

/** 获取当前存储模式 */
export function getStorageMode(): StorageMode {
  return store.get('storageMode', 'local')
}

/** 设置存储模式 */
export function setStorageMode(mode: StorageMode): StorageMode {
  store.set('storageMode', mode)
  // 切换到 COS 模式时，同步启用 COS
  if (mode === 'cos') {
    const cosConfig = getCosConfig()
    if (!cosConfig.enabled) {
      saveCosConfig({ ...cosConfig, enabled: true })
    }
  } else {
    // 切换到本地模式时，关闭自动同步
    const cosConfig = getCosConfig()
    if (cosConfig.enabled) {
      saveCosConfig({ ...cosConfig, enabled: false })
    }
  }
  return mode
}

// ====== 个人信息管理 ======

/** 防抖同步个人信息到云端的定时器 */
let syncProfileTimer: ReturnType<typeof setTimeout> | null = null

/** 防抖同步个人信息到云端（不受存储模式切换影响，只要有密钥就同步） */
function debounceSyncProfile(): void {
  const config = getCosConfig()
  // 个人信息永远同步到 COS，只要有密钥即可，不受 enabled 开关影响
  if (!config.secretId || !config.secretKey) return

  if (syncProfileTimer) clearTimeout(syncProfileTimer)
  syncProfileTimer = setTimeout(async () => {
    const profile = store.get('profile')
    if (profile) {
      await uploadProfile(profile)
    }
  }, 1000) // 1秒防抖
}

/** 获取个人信息 */
export function getProfile(): ProfileData {
  return store.get('profile', {
    nickname: '',
    avatar: '',
    bio: '',
    email: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

/** 保存个人信息（保存到本地并自动同步到 COS） */
export function saveProfile(profile: ProfileData): ProfileData {
  store.set('profile', profile)
  debounceSyncProfile() // 自动同步到云端
  return profile
}

/** 将个人信息推送到云端（不受存储模式影响） */
export async function pushProfileToCloud(): Promise<boolean> {
  const profile = getProfile()
  return uploadProfile(profile)
}

/** 从云端拉取个人信息（不受存储模式影响） */
export async function pullProfileFromCloud(): Promise<ProfileData | null> {
  const cloudProfile = await downloadProfile()
  if (cloudProfile === null) return null
  store.set('profile', cloudProfile as ProfileData)
  return cloudProfile as ProfileData
}

// ====== 剪贴板历史管理 ======

/** 获取剪贴板历史 */
export function getClipboardHistory(): ClipboardHistoryItem[] {
  return store.get('clipboardHistory', [])
}

/** 添加剪贴板历史条目 */
export function addClipboardHistory(item: ClipboardHistoryItem): ClipboardHistoryItem[] {
  const history = getClipboardHistory()
  const limit = getClipboardHistoryLimit()

  // 去重：如果内容相同则不重复添加，只更新时间戳
  const existingIndex = history.findIndex((h) => h.content === item.content)
  if (existingIndex >= 0) {
    history.splice(existingIndex, 1)
  }

  // 添加到最前面
  history.unshift(item)

  // 超过限制则裁剪
  if (history.length > limit) {
    history.splice(limit)
  }

  store.set('clipboardHistory', history)
  return history
}

/** 清空剪贴板历史 */
export function clearClipboardHistory(): ClipboardHistoryItem[] {
  store.set('clipboardHistory', [])
  return []
}

/** 删除单条剪贴板历史 */
export function deleteClipboardHistoryItem(id: string): ClipboardHistoryItem[] {
  const history = getClipboardHistory().filter((h) => h.id !== id)
  store.set('clipboardHistory', history)
  return history
}

/** 获取剪贴板历史最大保存条数 */
export function getClipboardHistoryLimit(): number {
  return store.get('clipboardHistoryLimit', 20)
}

/** 设置剪贴板历史最大保存条数 */
export function setClipboardHistoryLimit(limit: number): number {
  const safeLimit = Math.max(1, Math.min(500, limit))
  store.set('clipboardHistoryLimit', safeLimit)

  // 如果当前历史超过新限制，裁剪
  const history = getClipboardHistory()
  if (history.length > safeLimit) {
    store.set('clipboardHistory', history.slice(0, safeLimit))
  }

  debounceSyncSetting('clipboardHistoryLimit', safeLimit)
  return safeLimit
}

// ====== 快速链接管理 ======

/** 获取所有快速链接 */
export function getQuickLinks(): QuickLink[] {
  return store.get('quickLinks', [])
}

/** 保存所有快速链接 */
export function saveQuickLinks(links: QuickLink[]): QuickLink[] {
  store.set('quickLinks', links)
  debounceSyncLauncher('quickLinks', links)
  return links
}

/** 添加快速链接 */
export function addQuickLink(link: QuickLink): QuickLink[] {
  const links = getQuickLinks()
  links.push(link)
  store.set('quickLinks', links)
  debounceSyncLauncher('quickLinks', links)
  return links
}

/** 删除快速链接 */
export function deleteQuickLink(id: string): QuickLink[] {
  const links = getQuickLinks().filter((l) => l.id !== id)
  store.set('quickLinks', links)
  debounceSyncLauncher('quickLinks', links)
  return links
}

// ====== AI 模型配置管理 ======

/** 获取 AI 模型配置列表 */
export function getAiModels(): AiModelConfig[] {
  return store.get('aiModels', [])
}

/** 保存 AI 模型配置列表 */
export function saveAiModels(models: AiModelConfig[]): AiModelConfig[] {
  store.set('aiModels', models)
  debounceSyncSetting('aiModels', models)
  return models
}

/** 获取当前启用的 AI 模型配置 */
export function getActiveAiModel(): AiModelConfig | null {
  const models = getAiModels()
  return models.find((m) => m.enabled) || null
}

/** 更新快速链接 */
export function updateQuickLink(id: string, data: Partial<Omit<QuickLink, 'id'>>): QuickLink[] {
  const links = getQuickLinks()
  const target = links.find((l) => l.id === id)
  if (target) {
    Object.assign(target, data)
  }
  store.set('quickLinks', links)
  debounceSyncLauncher('quickLinks', links)
  return links
}

// ====== 导航分类管理 ======

/** 获取导航分类列表 */
export function getLauncherCategories(): string[] {
  return store.get('launcherCategories', ['常用', '工作', '文档', '工具', '社交', '其他'])
}

/** 保存导航分类列表 */
export function saveLauncherCategories(categories: string[]): string[] {
  store.set('launcherCategories', categories)
  debounceSyncSetting('launcherCategories', categories)
  return categories
}

// ====== AI 标题配置管理 ======

/** 获取是否启用 AI 生成标题 */
export function getAiTitleEnabled(): boolean {
  return store.get('aiTitleEnabled', false)
}

/** 设置是否启用 AI 生成标题 */
export function setAiTitleEnabled(enabled: boolean): boolean {
  store.set('aiTitleEnabled', enabled)
  debounceSyncSetting('aiTitleEnabled', enabled)
  return enabled
}

// ====== 主题 ======

/** 获取当前主题 */
export function getTheme(): string {
  return store.get('theme', 'system')
}

/** 设置主题 */
export function setTheme(theme: string): string {
  store.set('theme', theme)
  return theme
}

// ====== 页面可见性配置管理 ======

/** 获取页面可见性配置 */
export function getPageVisibility(): PageVisibility {
  return store.get('pageVisibility', {
    save: true,
    editor: true,
    search: true,
    launcher: true,
    doc: true,
    ai: true,
    favorite: true,
    settings: true,
    profile: true,
  })
}

/** 保存页面可见性配置 */
export function savePageVisibility(config: PageVisibility): PageVisibility {
  store.set('pageVisibility', config)
  debounceSyncSetting('pageVisibility', config)
  return config
}

// ====== 全局字体大小配置 ======

/** 获取全局字体大小 */
export function getAppFontSize(): number {
  return store.get('appFontSize', 13)
}

/** 设置全局字体大小 */
export function setAppFontSize(size: number): number {
  const clamped = Math.max(10, Math.min(20, size))
  store.set('appFontSize', clamped)
  debounceSyncSetting('appFontSize', clamped)
  return clamped
}

// ====== 速记编辑器主题 ======

/** 获取速记编辑器默认主题 */
export function getDocEditorTheme(): string {
  return store.get('docEditorTheme', 'github-dark')
}

/** 设置速记编辑器默认主题 */
export function setDocEditorTheme(theme: string): string {
  store.set('docEditorTheme', theme)
  debounceSyncSetting('docEditorTheme', theme)
  return theme
}

// ====== 设置批量推拉 ======

/**
 * 获取所有需要同步的设置数据（用于推送到云端 settings 目录）
 */
export function getAllSyncSettings(): Record<string, unknown> {
  return {
    shortcuts: getShortcuts(),
    customTags: getCustomTags(),
    clipboardHistoryLimit: getClipboardHistoryLimit(),
    aiModels: getAiModels(),
    aiTitleEnabled: getAiTitleEnabled(),
    launcherCategories: getLauncherCategories(),
    pageVisibility: getPageVisibility(),
    appFontSize: getAppFontSize(),
    docEditorTheme: getDocEditorTheme(),
  }
}

/**
 * 获取所有需要同步的导航配置数据（用于推送到云端 launcher 目录）
 */
export function getAllSyncLauncherConfigs(): Record<string, unknown> {
  return {
    quickLinks: getQuickLinks(),
  }
}

/**
 * 将所有设置和导航配置推送到云端
 */
export async function pushSettingsToCloud(): Promise<boolean> {
  const settings = getAllSyncSettings()
  const launcherConfigs = getAllSyncLauncherConfigs()
  const [settingsOk, launcherOk] = await Promise.all([
    uploadAllSettings(settings),
    uploadAllLauncherConfigs(launcherConfigs),
  ])
  return settingsOk && launcherOk
}

/**
 * 从云端拉取所有设置和导航配置并覆盖本地
 * 同时拉取 settings 目录和 launcher 目录
 */
export async function pullSettingsFromCloud(): Promise<Record<string, unknown> | null> {
  const settingNames = [...SYNC_SETTING_NAMES]
  const launcherNames = [...SYNC_LAUNCHER_NAMES]

  // 并行拉取 settings 和 launcher 目录
  const [cloudSettings, cloudLauncherConfigs] = await Promise.all([
    downloadAllSettings(settingNames),
    downloadAllLauncherConfigs(launcherNames),
  ])

  const totalCount = Object.keys(cloudSettings).length + Object.keys(cloudLauncherConfigs).length
  if (totalCount === 0) {
    console.log('[pullSettingsFromCloud] 云端暂无设置和导航数据')
    return null
  }

  // 逐项覆盖本地设置数据
  if (cloudSettings.shortcuts) {
    store.set('shortcuts', cloudSettings.shortcuts as ShortcutConfig)
  }
  if (cloudSettings.customTags) {
    const tags = cloudSettings.customTags as string[]
    // 防护：如果云端标签为空但本地有标签，保留本地标签
    if (tags.length > 0 || getCustomTags().length === 0) {
      store.set('customTags', tags)
    } else {
      console.warn('[pullSettingsFromCloud] 云端标签为空但本地有标签，保留本地标签')
    }
  }
  if (cloudSettings.clipboardHistoryLimit !== undefined) {
    store.set('clipboardHistoryLimit', cloudSettings.clipboardHistoryLimit as number)
  }
  if (cloudSettings.aiModels) {
    store.set('aiModels', cloudSettings.aiModels as AiModelConfig[])
  }
  if (cloudSettings.aiTitleEnabled !== undefined) {
    store.set('aiTitleEnabled', cloudSettings.aiTitleEnabled as boolean)
  }
  // settings 目录中的 launcherCategories
  if (cloudSettings.launcherCategories) {
    store.set('launcherCategories', cloudSettings.launcherCategories as string[])
  }
  if (cloudSettings.pageVisibility) {
    store.set('pageVisibility', cloudSettings.pageVisibility as PageVisibility)
  }
  if (cloudSettings.appFontSize !== undefined) {
    store.set('appFontSize', cloudSettings.appFontSize as number)
  }
  if (cloudSettings.docEditorTheme) {
    store.set('docEditorTheme', cloudSettings.docEditorTheme as string)
  }

  // 逐项覆盖本地导航配置（launcher 目录）
  if (cloudLauncherConfigs.quickLinks) {
    store.set('quickLinks', cloudLauncherConfigs.quickLinks as QuickLink[])
  }

  // 合并结果返回
  const merged = { ...cloudSettings, ...cloudLauncherConfigs }
  console.log(`[pullSettingsFromCloud] 从云端拉取了 ${Object.keys(cloudSettings).length} 项设置 + ${Object.keys(cloudLauncherConfigs).length} 项导航配置`)
  return merged
}