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
  openSave: string    // 唤起保存模式，默认 CommandOrControl+Shift+K
  openSearch: string  // 唤起搜索模式，默认 CommandOrControl+Shift+S
}

/** COS 云端存储配置 */
export interface CosConfig {
  secretId: string
  secretKey: string
  enabled: boolean     // 是否启用云端同步
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
    cosConfig: (() => {
      const yamlCfg = getCosYamlConfig()
      return {
        secretId: yamlCfg.secretId,
        secretKey: yamlCfg.secretKey,
        enabled: yamlCfg.enabled,
      }
    })(),
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

  // 优先使用 YAML 配置文件中的密钥（如果存在）
  // 这样即使 electron-store 中的密钥为空（首次运行遗留的默认值），也能正确工作
  return {
    secretId: storedConfig.secretId || yamlCfg.secretId,
    secretKey: storedConfig.secretKey || yamlCfg.secretKey,
    enabled: storedConfig.secretId ? storedConfig.enabled : yamlCfg.enabled,
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