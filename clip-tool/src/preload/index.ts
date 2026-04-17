/**
 * 预加载脚本
 * 通过 contextBridge 安全暴露 API 给渲染进程
 */
import { contextBridge, ipcRenderer } from 'electron'

export interface ClipboardData {
  content: string
  type: 'code' | 'text' | 'url' | 'image' | 'document' | 'other'
  language?: string
  isImage?: boolean  // 是否为图片（content 为 base64）
}

export interface SnippetData {
  id: string
  title: string
  content: string
  tags: string[]
  type: 'code' | 'text' | 'url' | 'image' | 'document' | 'other'
  language?: string
  createdAt: string
  updatedAt: string
  copyCount: number
  isFavorite: boolean
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

export interface CosConfig {
  secretId: string
  secretKey: string
  enabled: boolean
}

export type StorageMode = 'local' | 'cos'

export interface ClipboardHistoryItem {
  id: string
  content: string
  type: 'code' | 'text' | 'url' | 'image' | 'document' | 'other'
  language?: string
  isImage?: boolean
  timestamp: string
}

export interface ProfileData {
  nickname: string
  avatar: string
  bio: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface QuickLink {
  id: string
  name: string
  url: string
  icon: string
  category: string
  order: number
}

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

export interface LocalApp {
  name: string       // 应用名称
  path: string       // 应用完整路径
  icon: string       // Emoji 图标
}

const api = {
  /** 同步获取所有设置初始值（仅在 preload 加载时执行一次 sendSync，零延迟） */
  initialSettings: (() => {
    const t0 = Date.now()
    const result = ipcRenderer.sendSync('settings:getInitialSync') as Record<string, unknown>
    console.log(`[preload] settings:getInitialSync 耗时 ${Date.now() - t0}ms`)
    return result
  })(),

  /** 异步获取所有同步设置（用于刷新缓存） */
  getAllSyncSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('settings:getAllSync'),

  /** 获取所有片段 */
  getAllSnippets: (): Promise<SnippetData[]> => ipcRenderer.invoke('snippets:getAll'),

  /** 读取剪贴板内容 */
  readClipboard: (): Promise<ClipboardData> => ipcRenderer.invoke('clipboard:read'),

  /** 保存片段 */
  addSnippet: (snippet: SnippetData): Promise<SnippetData[]> => ipcRenderer.invoke('snippets:add', snippet),

  /** 删除片段 */
  deleteSnippet: (id: string): Promise<SnippetData[]> => ipcRenderer.invoke('snippets:delete', id),

  /** 切换收藏 */
  toggleFavorite: (id: string): Promise<SnippetData[]> => ipcRenderer.invoke('snippets:toggleFavorite', id),

  /** 复制到剪贴板（支持图片和文本） */
  copyToClipboard: (id: string, content: string, contentType?: string): Promise<SnippetData[]> =>
    ipcRenderer.invoke('snippets:copyToClipboard', id, content, contentType),

  /** 更新片段（标题、标签、内容） */
  updateSnippet: (id: string, data: Partial<Pick<SnippetData, 'title' | 'tags' | 'content'>>): Promise<SnippetData[]> =>
    ipcRenderer.invoke('snippets:update', id, data),

  /** 隐藏窗口 */
  hideWindow: (): void => ipcRenderer.send('window:hide'),

  /** 最小化窗口 */
  minimizeWindow: (): void => ipcRenderer.send('window:minimize'),

  /** 最大化/还原窗口 */
  toggleMaximizeWindow: (): void => ipcRenderer.send('window:toggleMaximize'),

  /** 打开独立的剪贴板历史窗口 */
  openHistoryWindow: (): void => ipcRenderer.send('historyWindow:open'),

  /** 关闭剪贴板历史窗口 */
  closeHistoryWindow: (): void => ipcRenderer.send('historyWindow:close'),

  /** 监听窗口模式切换（主进程通过全局快捷键触发） */
  onSwitchMode: (callback: (mode: 'save' | 'search' | 'editor' | 'doc' | 'ai' | 'favorite' | 'settings' | 'profile' | 'launcher') => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, mode: 'save' | 'search' | 'editor' | 'doc' | 'ai' | 'favorite' | 'settings' | 'profile' | 'launcher') => callback(mode)
    ipcRenderer.on('window:switchMode', handler)
    return () => {
      ipcRenderer.removeListener('window:switchMode', handler)
    }
  },

  /** 获取快捷键配置 */
  getShortcuts: (): Promise<ShortcutConfig> => ipcRenderer.invoke('shortcuts:get'),

  /** 保存快捷键配置 */
  saveShortcuts: (config: ShortcutConfig): Promise<ShortcutConfig> => ipcRenderer.invoke('shortcuts:save', config),

  /** 获取自定义标签列表 */
  getCustomTags: (): Promise<string[]> => ipcRenderer.invoke('customTags:get'),

  /** 保存自定义标签列表 */
  saveCustomTags: (tags: string[]): Promise<string[]> => ipcRenderer.invoke('customTags:save', tags),

  // ====== COS 云端存储 API ======

  /** 获取 COS 配置 */
  getCosConfig: (): Promise<CosConfig> => ipcRenderer.invoke('cos:getConfig'),

  /** 保存 COS 配置 */
  saveCosConfig: (config: CosConfig): Promise<CosConfig> => ipcRenderer.invoke('cos:saveConfig', config),

  /** 测试 COS 连接 */
  testCosConnection: (): Promise<{ success: boolean; message: string }> => ipcRenderer.invoke('cos:testConnection'),

  /** 获取设备 ID */
  getDeviceId: (): Promise<string> => ipcRenderer.invoke('cos:getDeviceId'),

  /** 从云端拉取片段数据 */
  pullSnippets: (): Promise<SnippetData[] | null> => ipcRenderer.invoke('cos:pullSnippets'),

  /** 从云端拉取收藏数据（favorites 目录） */
  pullFavorites: (): Promise<SnippetData[] | null> => ipcRenderer.invoke('cos:pullFavorites'),

  /** 将本地片段推送到云端 */
  pushSnippets: (): Promise<boolean> => ipcRenderer.invoke('cos:pushSnippets'),

  /** 从云端拉取标签数据 */
  pullTags: (): Promise<string[] | null> => ipcRenderer.invoke('cos:pullTags'),

  /** 将本地标签推送到云端 */
  pushTags: (): Promise<boolean> => ipcRenderer.invoke('cos:pushTags'),

  // ====== 存储模式 API ======

  /** 获取存储模式 */
  getStorageMode: (): Promise<StorageMode> => ipcRenderer.invoke('storage:getMode'),

  /** 设置存储模式 */
  setStorageMode: (mode: StorageMode): Promise<StorageMode> => ipcRenderer.invoke('storage:setMode', mode),

  // ====== 个人中心 API ======

  /** 获取个人信息 */
  getProfile: (): Promise<ProfileData> => ipcRenderer.invoke('profile:get'),

  /** 保存个人信息 */
  saveProfile: (profile: ProfileData): Promise<ProfileData> => ipcRenderer.invoke('profile:save', profile),

  /** 推送个人信息到云端 */
  pushProfile: (): Promise<boolean> => ipcRenderer.invoke('profile:push'),

  /** 从云端拉取个人信息 */
  pullProfile: (): Promise<ProfileData | null> => ipcRenderer.invoke('profile:pull'),

  // ====== 剪贴板历史 API ======

  /** 获取剪贴板历史 */
  getClipboardHistory: (): Promise<ClipboardHistoryItem[]> => ipcRenderer.invoke('clipboardHistory:get'),

  /** 添加剪贴板历史 */
  addClipboardHistory: (item: ClipboardHistoryItem): Promise<ClipboardHistoryItem[]> =>
    ipcRenderer.invoke('clipboardHistory:add', item),

  /** 清空剪贴板历史 */
  clearClipboardHistory: (): Promise<ClipboardHistoryItem[]> => ipcRenderer.invoke('clipboardHistory:clear'),

  /** 删除单条剪贴板历史 */
  deleteClipboardHistoryItem: (id: string): Promise<ClipboardHistoryItem[]> =>
    ipcRenderer.invoke('clipboardHistory:delete', id),

  /** 获取剪贴板历史保存条数限制 */
  getClipboardHistoryLimit: (): Promise<number> => ipcRenderer.invoke('clipboardHistory:getLimit'),

  /** 设置剪贴板历史保存条数限制 */
  setClipboardHistoryLimit: (limit: number): Promise<number> =>
    ipcRenderer.invoke('clipboardHistory:setLimit', limit),

  // ====== 快速链接 API ======

  /** 获取快速链接列表 */
  getQuickLinks: (): Promise<QuickLink[]> => ipcRenderer.invoke('quickLinks:get'),

  /** 保存快速链接列表 */
  saveQuickLinks: (links: QuickLink[]): Promise<QuickLink[]> => ipcRenderer.invoke('quickLinks:save', links),

  /** 添加快速链接 */
  addQuickLink: (link: QuickLink): Promise<QuickLink[]> => ipcRenderer.invoke('quickLinks:add', link),

  /** 删除快速链接 */
  deleteQuickLink: (id: string): Promise<QuickLink[]> => ipcRenderer.invoke('quickLinks:delete', id),

  /** 更新快速链接 */
  updateQuickLink: (id: string, data: Partial<Omit<QuickLink, 'id'>>): Promise<QuickLink[]> =>
    ipcRenderer.invoke('quickLinks:update', id, data),

  /** 在默认浏览器中打开 URL */
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),

  // ====== 本地应用 API ======

  // ====== 导航页使用频率 API ======

  /** 获取导航页操作使用频率计数 */
  getLauncherUsageCount: (): Promise<Record<string, number>> => ipcRenderer.invoke('launcherUsage:get'),

  /** 增加某个操作的使用频率计数 */
  incrementLauncherUsage: (itemKey: string): Promise<Record<string, number>> => ipcRenderer.invoke('launcherUsage:increment', itemKey),

  // ====== 本地应用 API（续） ======

  /** 获取已安装的本地应用列表 */
  getInstalledApps: (): Promise<{ name: string; path: string; icon: string }[]> => ipcRenderer.invoke('apps:getInstalled'),

  /** 获取单个应用的图标（按需加载） */
  getAppIcon: (appPath: string): Promise<string> => ipcRenderer.invoke('apps:getIcon', appPath),

  /** 打开本地应用 */
  openApp: (appPath: string): Promise<boolean> => ipcRenderer.invoke('apps:open', appPath),

  // ====== macOS 快捷指令 API ======

  /** 获取 macOS 快捷指令列表 */
  getMacShortcuts: (): Promise<{ name: string }[]> => ipcRenderer.invoke('shortcuts:getMacShortcuts'),

  /** 运行 macOS 快捷指令 */
  runMacShortcut: (name: string): Promise<boolean> => ipcRenderer.invoke('shortcuts:runMacShortcut', name),

  // ====== 混元大模型 API ======

  /** 检查混元是否可用 */
  isHunyuanAvailable: (): Promise<boolean> => ipcRenderer.invoke('hunyuan:isAvailable'),

  /** 发送消息给混元大模型 */
  chatWithHunyuan: (messages: { Role: string; Content: string }[]): Promise<string> =>
    ipcRenderer.invoke('hunyuan:chat', messages),

  /** 监听混元流式响应 */
  onHunyuanStream: (
    callback: (data: { type: 'delta' | 'done' | 'error'; content: string; fullContent?: string }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { type: 'delta' | 'done' | 'error'; content: string; fullContent?: string }
    ) => callback(data)
    ipcRenderer.on('hunyuan:stream', handler)
    return () => {
      ipcRenderer.removeListener('hunyuan:stream', handler)
    }
  },

  // ====== AI 模型配置 API ======

  /** 获取 AI 模型配置列表 */
  getAiModels: (): Promise<{ provider: string; secretId: string; secretKey: string; model: string; enabled: boolean }[]> =>
    ipcRenderer.invoke('aiModels:get'),

  /** 保存 AI 模型配置列表 */
  saveAiModels: (models: { provider: string; secretId: string; secretKey: string; model: string; enabled: boolean }[]): Promise<{ provider: string; secretId: string; secretKey: string; model: string; enabled: boolean }[]> =>
    ipcRenderer.invoke('aiModels:save', models),

  // ====== 导航分类 API ======

  /** 获取导航分类列表 */
  getLauncherCategories: (): Promise<string[]> => ipcRenderer.invoke('launcherCategories:get'),

  /** 保存导航分类列表 */
  saveLauncherCategories: (categories: string[]): Promise<string[]> => ipcRenderer.invoke('launcherCategories:save', categories),

  // ====== AI 标题 API ======

  /** 获取是否启用 AI 生成标题 */
  getAiTitleEnabled: (): Promise<boolean> => ipcRenderer.invoke('aiTitle:getEnabled'),

  /** 设置是否启用 AI 生成标题 */
  setAiTitleEnabled: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('aiTitle:setEnabled', enabled),

  /** 获取是否启用独立历史小窗 */
  getEnableHistoryWindow: (): Promise<boolean> => ipcRenderer.invoke('historyWindow:getEnabled'),

  /** 设置是否启用独立历史小窗 */
  setEnableHistoryWindow: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('historyWindow:setEnabled', enabled),

  /** 使用 AI 生成标题 */
  generateAiTitle: (content: string, contentType: string): Promise<string | null> =>
    ipcRenderer.invoke('aiTitle:generate', content, contentType),

  /** 使用 AI 匹配标签 */
  matchAiTags: (content: string, contentType: string, availableTags: string[]): Promise<string[]> =>
    ipcRenderer.invoke('aiTags:match', content, contentType, availableTags),

  // ====== AI 标签匹配 API ======

  /** 获取是否启用 AI 自动匹配标签 */
  getAiTagEnabled: (): Promise<boolean> => ipcRenderer.invoke('aiTag:getEnabled'),

  /** 设置是否启用 AI 自动匹配标签 */
  setAiTagEnabled: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('aiTag:setEnabled', enabled),

  // ====== 设置批量推拉 API ======

  /** 将所有设置推送到云端 */
  pushSettings: (): Promise<boolean> => ipcRenderer.invoke('settings:push'),

  /** 从云端拉取所有设置 */
  pullSettings: (): Promise<Record<string, unknown> | null> => ipcRenderer.invoke('settings:pull'),

  // ====== 主题 API ======

  /** 获取当前主题 */
  getTheme: (): Promise<string> => ipcRenderer.invoke('theme:get'),

  /** 设置主题 */
  setTheme: (theme: string): Promise<string> => ipcRenderer.invoke('theme:set', theme),

  // ====== 页面可见性 API ======

  /** 获取页面可见性配置 */
  getPageVisibility: (): Promise<PageVisibility> => ipcRenderer.invoke('pageVisibility:get'),

  /** 保存页面可见性配置 */
  savePageVisibility: (config: PageVisibility): Promise<PageVisibility> => ipcRenderer.invoke('pageVisibility:save', config),

  // ====== 全局字体大小 API ======

  /** 获取全局字体大小 */
  getAppFontSize: (): Promise<number> => ipcRenderer.invoke('appFontSize:get'),

  /** 设置全局字体大小 */
  setAppFontSize: (size: number): Promise<number> => ipcRenderer.invoke('appFontSize:set', size),

  // ====== 速记编辑器主题 API ======

  /** 获取速记编辑器默认主题 */
  getDocEditorTheme: (): Promise<string> => ipcRenderer.invoke('docEditorTheme:get'),

  /** 设置速记编辑器默认主题 */
  setDocEditorTheme: (theme: string): Promise<string> => ipcRenderer.invoke('docEditorTheme:set', theme),

  /** 监听主进程后台剪贴板变化事件 */
  onClipboardChanged: (
    callback: (data: { newItem: ClipboardHistoryItem; history: ClipboardHistoryItem[] }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { newItem: ClipboardHistoryItem; history: ClipboardHistoryItem[] }
    ) => callback(data)
    ipcRenderer.on('clipboard:changed', handler)
    return () => {
      ipcRenderer.removeListener('clipboard:changed', handler)
    }
  },

  /** 判断当前是否为剪贴板历史窗口 */
  isHistoryWindow: (): boolean => {
    return window.location.hash === '#clipboard-history'
  },

  // ====== 语雀集成 API ======

  /** 获取语雀配置 */
  getYuqueConfig: (): Promise<{
    token: string
    login: string
    userName: string
    targetRepoId: number
    targetRepoName: string
    targetRepoNamespace: string
  }> => ipcRenderer.invoke('yuque:getConfig'),

  /** 保存语雀配置 */
  saveYuqueConfig: (config: {
    token: string
    login: string
    userName: string
    targetRepoId: number
    targetRepoName: string
    targetRepoNamespace: string
  }): Promise<{
    token: string
    login: string
    userName: string
    targetRepoId: number
    targetRepoName: string
    targetRepoNamespace: string
  }> => ipcRenderer.invoke('yuque:saveConfig', config),

  /** 验证语雀 Token */
  verifyYuqueToken: (token: string): Promise<{
    success: boolean
    user?: { id: number; login: string; name: string; avatar_url: string }
    error?: string
  }> => ipcRenderer.invoke('yuque:verifyToken', token),

  /** 获取用户知识库列表 */
  getYuqueRepos: (token: string, login: string): Promise<{
    success: boolean
    repos?: { id: number; slug: string; name: string; namespace: string; description: string }[]
    error?: string
  }> => ipcRenderer.invoke('yuque:getRepos', token, login),

  /** 搜索语雀文档 */
  searchYuqueDocs: (query: string, options?: { type?: string; page?: number; limit?: number }): Promise<{
    success: boolean
    data?: unknown[]
    total?: number
    error?: string
  }> => ipcRenderer.invoke('yuque:search', query, options),

  /** 获取语雀文档详情 */
  getYuqueDocDetail: (bookId: number, docId: number): Promise<{
    success: boolean
    doc?: { id: number; slug: string; title: string; body: string; book_id: number; updated_at: string }
    error?: string
  }> => ipcRenderer.invoke('yuque:getDocDetail', bookId, docId),

  /** 批量导出所有收藏为一篇语雀文档 */
  exportAllToYuque: (title: string, body: string): Promise<{
    success: boolean
    docId?: number
    action?: 'created' | 'updated'
    error?: string
  }> => ipcRenderer.invoke('yuque:exportAll', title, body),

  /** 同步片段到语雀 */
  syncSnippetToYuque: (snippetId: string, title: string, content: string): Promise<{
    success: boolean
    docId?: number
    action?: 'created' | 'updated'
    error?: string
  }> => ipcRenderer.invoke('yuque:syncSnippet', snippetId, title, content),

  /** 获取语雀同步映射表 */
  getYuqueSyncMap: (): Promise<Record<string, { yuqueDocId: number; yuqueSyncedAt: string }>> =>
    ipcRenderer.invoke('yuque:getSyncMap'),

  // ====== OCR 文字识别 API ======

  /** OCR 识别图片文字（本地离线） */
  ocrRecognize: (base64Image: string): Promise<{ text: string; confidence: number }> =>
    ipcRenderer.invoke('ocr:recognize', base64Image),

  /** 获取 OCR 引擎状态 */
  ocrGetStatus: (): Promise<{ ready: boolean; loading: boolean }> =>
    ipcRenderer.invoke('ocr:getStatus'),

  /** OCR 识别 + 翻译（识别离线，翻译需要混元大模型） */
  ocrTranslate: (base64Image: string, targetLang: string): Promise<{ original: string; translated: string; error?: string }> =>
    ipcRenderer.invoke('ocr:translate', base64Image, targetLang),

  /** 仅翻译文本（用于切换语言时重新翻译已识别的原文） */
  ocrTranslateText: (text: string, targetLang: string): Promise<{ translated: string; error?: string }> =>
    ipcRenderer.invoke('ocr:translateText', text, targetLang),
}

contextBridge.exposeInMainWorld('clipToolAPI', api)

// TypeScript 类型声明
export type ClipToolAPI = typeof api
