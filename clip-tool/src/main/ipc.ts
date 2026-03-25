/**
 * IPC 事件处理模块
 * 负责主进程与渲染进程之间的通信
 */
import { ipcMain, BrowserWindow, shell } from 'electron'
import {
  getAllSnippets,
  addSnippet,
  deleteSnippet,
  toggleFavorite,
  incrementCopyCount,
  updateSnippet,
  getShortcuts,
  saveShortcuts,
  getCustomTags,
  saveCustomTags,
  getCosConfig,
  saveCosConfig,
  pullSnippetsFromCloud,
  pushSnippetsToCloud,
  pullTagsFromCloud,
  pushTagsToCloud,
  getStorageMode,
  setStorageMode,
  getProfile,
  saveProfile,
  pushProfileToCloud,
  pullProfileFromCloud,
  getClipboardHistory,
  addClipboardHistory,
  clearClipboardHistory,
  deleteClipboardHistoryItem,
  getClipboardHistoryLimit,
  setClipboardHistoryLimit,
  getQuickLinks,
  saveQuickLinks,
  addQuickLink,
  deleteQuickLink,
  updateQuickLink,
  getAiModels,
  saveAiModels,
  getLauncherCategories,
  saveLauncherCategories,
  getAiTitleEnabled,
  setAiTitleEnabled,
  pushSettingsToCloud,
  pullSettingsFromCloud,
  type Snippet,
  type ShortcutConfig,
  type CosConfig,
  type StorageMode,
  type ProfileData,
  type ClipboardHistoryItem,
  type QuickLink,
  type AiModelConfig,
} from './store'
import { reRegisterShortcuts } from './shortcuts'
import { readClipboard, writeToClipboard } from './clipboard'
import { testCosConnection, getDeviceId } from './cos'
import { chatWithHunyuan, isHunyuanAvailable, generateTitle, type ChatMessage } from './hunyuan'

/** 注册所有 IPC 事件处理器 */
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  // 获取所有片段
  ipcMain.handle('snippets:getAll', () => {
    return getAllSnippets()
  })

  // 读取剪贴板内容（支持图片和文本）
  ipcMain.handle('clipboard:read', () => {
    return readClipboard()
  })

  // 保存片段
  ipcMain.handle('snippets:add', (_event, snippet: Snippet) => {
    return addSnippet(snippet)
  })

  // 删除片段
  ipcMain.handle('snippets:delete', (_event, id: string) => {
    return deleteSnippet(id)
  })

  // 切换收藏
  ipcMain.handle('snippets:toggleFavorite', (_event, id: string) => {
    return toggleFavorite(id)
  })

  // 复制到剪贴板并增加计数（支持图片和文本）
  ipcMain.handle('snippets:copyToClipboard', (_event, id: string, content: string, contentType?: string) => {
    writeToClipboard(content, contentType || 'text')
    return incrementCopyCount(id)
  })

  // 更新片段
  ipcMain.handle('snippets:update', (_event, id: string, data: Partial<Pick<Snippet, 'title' | 'tags'>>) => {
    return updateSnippet(id, data)
  })

  // 隐藏窗口
  ipcMain.on('window:hide', () => {
    const win = getMainWindow()
    if (win) win.hide()
  })

  // 获取快捷键配置
  ipcMain.handle('shortcuts:get', () => {
    return getShortcuts()
  })

  // 保存快捷键配置并重新注册
  ipcMain.handle('shortcuts:save', (_event, config: ShortcutConfig) => {
    saveShortcuts(config)
    reRegisterShortcuts(getMainWindow)
    return getShortcuts()
  })

  // 获取自定义标签列表
  ipcMain.handle('customTags:get', () => {
    return getCustomTags()
  })

  // 保存自定义标签列表
  ipcMain.handle('customTags:save', (_event, tags: string[]) => {
    return saveCustomTags(tags)
  })

  // ====== COS 云端存储相关 ======

  // 获取 COS 配置
  ipcMain.handle('cos:getConfig', () => {
    return getCosConfig()
  })

  // 保存 COS 配置
  ipcMain.handle('cos:saveConfig', (_event, config: CosConfig) => {
    return saveCosConfig(config)
  })

  // 测试 COS 连接
  ipcMain.handle('cos:testConnection', async () => {
    return testCosConnection()
  })

  // 获取设备 ID
  ipcMain.handle('cos:getDeviceId', () => {
    return getDeviceId()
  })

  // 从云端拉取片段数据（覆盖本地）
  ipcMain.handle('cos:pullSnippets', async () => {
    return pullSnippetsFromCloud()
  })

  // 将本地片段推送到云端
  ipcMain.handle('cos:pushSnippets', async () => {
    return pushSnippetsToCloud()
  })

  // 从云端拉取标签数据（覆盖本地）
  ipcMain.handle('cos:pullTags', async () => {
    return pullTagsFromCloud()
  })

  // 将本地标签推送到云端
  ipcMain.handle('cos:pushTags', async () => {
    return pushTagsToCloud()
  })

  // ====== 存储模式 ======

  // 获取存储模式
  ipcMain.handle('storage:getMode', () => {
    return getStorageMode()
  })

  // 设置存储模式
  ipcMain.handle('storage:setMode', (_event, mode: StorageMode) => {
    return setStorageMode(mode)
  })

  // ====== 个人中心 ======

  // 获取个人信息
  ipcMain.handle('profile:get', () => {
    return getProfile()
  })

  // 保存个人信息
  ipcMain.handle('profile:save', (_event, profile: ProfileData) => {
    return saveProfile(profile)
  })

  // 推送个人信息到云端
  ipcMain.handle('profile:push', async () => {
    return pushProfileToCloud()
  })

  // 从云端拉取个人信息
  ipcMain.handle('profile:pull', async () => {
    return pullProfileFromCloud()
  })

  // ====== 剪贴板历史 ======

  // 获取剪贴板历史
  ipcMain.handle('clipboardHistory:get', () => {
    return getClipboardHistory()
  })

  // 添加剪贴板历史
  ipcMain.handle('clipboardHistory:add', (_event, item: ClipboardHistoryItem) => {
    return addClipboardHistory(item)
  })

  // 清空剪贴板历史
  ipcMain.handle('clipboardHistory:clear', () => {
    return clearClipboardHistory()
  })

  // 删除单条剪贴板历史
  ipcMain.handle('clipboardHistory:delete', (_event, id: string) => {
    return deleteClipboardHistoryItem(id)
  })

  // 获取剪贴板历史保存条数限制
  ipcMain.handle('clipboardHistory:getLimit', () => {
    return getClipboardHistoryLimit()
  })

  // 设置剪贴板历史保存条数限制
  ipcMain.handle('clipboardHistory:setLimit', (_event, limit: number) => {
    return setClipboardHistoryLimit(limit)
  })

  // ====== 快速链接 ======

  // 获取快速链接列表
  ipcMain.handle('quickLinks:get', () => {
    return getQuickLinks()
  })

  // 保存快速链接列表
  ipcMain.handle('quickLinks:save', (_event, links: QuickLink[]) => {
    return saveQuickLinks(links)
  })

  // 添加快速链接
  ipcMain.handle('quickLinks:add', (_event, link: QuickLink) => {
    return addQuickLink(link)
  })

  // 删除快速链接
  ipcMain.handle('quickLinks:delete', (_event, id: string) => {
    return deleteQuickLink(id)
  })

  // 更新快速链接
  ipcMain.handle('quickLinks:update', (_event, id: string, data: Partial<Omit<QuickLink, 'id'>>) => {
    return updateQuickLink(id, data)
  })

  // 在默认浏览器中打开 URL
  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    return shell.openExternal(url)
  })

  // ====== 混元大模型 ======

  // 检查混元是否可用
  ipcMain.handle('hunyuan:isAvailable', () => {
    return isHunyuanAvailable()
  })

  // 发送消息给混元大模型（流式）
  ipcMain.handle('hunyuan:chat', async (_event, messages: ChatMessage[]) => {
    const win = getMainWindow()
    return chatWithHunyuan(messages, win)
  })

  // ====== AI 模型配置 ======

  // 获取 AI 模型配置列表
  ipcMain.handle('aiModels:get', () => {
    return getAiModels()
  })

  // 保存 AI 模型配置列表
  ipcMain.handle('aiModels:save', (_event, models: AiModelConfig[]) => {
    return saveAiModels(models)
  })

  // ====== 导航分类管理 ======

  // 获取导航分类列表
  ipcMain.handle('launcherCategories:get', () => {
    return getLauncherCategories()
  })

  // 保存导航分类列表
  ipcMain.handle('launcherCategories:save', (_event, categories: string[]) => {
    return saveLauncherCategories(categories)
  })

  // ====== AI 标题配置 ======

  // 获取是否启用 AI 生成标题
  ipcMain.handle('aiTitle:getEnabled', () => {
    return getAiTitleEnabled()
  })

  // 设置是否启用 AI 生成标题
  ipcMain.handle('aiTitle:setEnabled', (_event, enabled: boolean) => {
    return setAiTitleEnabled(enabled)
  })

  // 使用 AI 生成标题
  ipcMain.handle('aiTitle:generate', async (_event, content: string, contentType: string) => {
    return generateTitle(content, contentType)
  })

  // ====== 设置批量推拉 ======

  // 将所有设置推送到云端
  ipcMain.handle('settings:push', async () => {
    return pushSettingsToCloud()
  })

  // 从云端拉取所有设置
  ipcMain.handle('settings:pull', async () => {
    return pullSettingsFromCloud()
  })
}
