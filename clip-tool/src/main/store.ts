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
  aiModels: AiModelConfig[]  // AI 模型配置列表
}

/** AI 模型配置 */
export interface AiModelConfig {
  provider: 'hunyuan' | 'deepseek'  // 模型提供商
  secretId: string                   // API 密钥 ID（混元）或 API Key（DeepSeek）
  secretKey: string                  // API 密钥（混元）
  model: string                      // 模型名称
  enabled: boolean                   // 是否启用
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
    aiModels: [] as AiModelConfig[],
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

  // 密钥优先级：YAML 配置文件 > store 持久化数据
  // YAML 是密钥的 source of truth（方便更新密钥后立即生效）
  // store 中的密钥仅在 YAML 未配置时作为备选（如用户通过设置界面手动配置）
  const finalSecretId = yamlCfg.secretId || storedConfig.secretId
  const finalSecretKey = yamlCfg.secretKey || storedConfig.secretKey

  // enabled 逻辑：
  // 1. 如果 YAML 有密钥，以 YAML 的 enabled 为准
  // 2. 如果 YAML 无密钥但 store 有，使用 store 的 enabled
  const finalEnabled = yamlCfg.secretId ? yamlCfg.enabled : storedConfig.enabled

  console.log('getCosConfig - finalSecretId:', finalSecretId ? finalSecretId.substring(0, 8) + '...' : '(空)',
    'enabled:', finalEnabled, '(store:', storedConfig.enabled, 'yaml:', yamlCfg.enabled, ')',
    'source:', yamlCfg.secretId ? 'YAML' : 'store')

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
  }, 1000)
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

/** 更新片段（标题、标签） */
export function updateSnippet(id: string, data: Partial<Pick<Snippet, 'title' | 'tags'>>): Snippet[] {
  const snippets = getAllSnippets()
  const target = snippets.find((s) => s.id === id)
  if (target) {
    if (data.title !== undefined) target.title = data.title
    if (data.tags !== undefined) target.tags = data.tags
    target.updatedAt = new Date().toISOString()
    debounceSyncSnippet(target) // 仅上传变更的片段
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
 * 从云端拉取标签数据并覆盖本地
 */
export async function pullTagsFromCloud(): Promise<string[] | null> {
  const cloudTags = await downloadCustomTags()
  if (cloudTags === null) return null
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
}

/** 获取自定义标签列表 */
export function getCustomTags(): string[] {
  return store.get('customTags', ['工具函数', '配置', '模板', '笔记', '临时'])
}

/** 保存自定义标签列表 */
export function saveCustomTags(tags: string[]): string[] {
  store.set('customTags', tags)
  debounceSyncTags()
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
  const safeLimit = Math.max(1, Math.min(100, limit))
  store.set('clipboardHistoryLimit', safeLimit)

  // 如果当前历史超过新限制，裁剪
  const history = getClipboardHistory()
  if (history.length > safeLimit) {
    store.set('clipboardHistory', history.slice(0, safeLimit))
  }

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
  return links
}

/** 添加快速链接 */
export function addQuickLink(link: QuickLink): QuickLink[] {
  const links = getQuickLinks()
  links.push(link)
  store.set('quickLinks', links)
  return links
}

/** 删除快速链接 */
export function deleteQuickLink(id: string): QuickLink[] {
  const links = getQuickLinks().filter((l) => l.id !== id)
  store.set('quickLinks', links)
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
  return links
}