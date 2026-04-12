/**
 * IPC 事件处理模块
 * 负责主进程与渲染进程之间的通信
 */
import { ipcMain, BrowserWindow, shell } from 'electron'
import { log, timer, getLogFilePath } from './logger'
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
  pullFavoritesFromCloud,
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
  getAiTagEnabled,
  setAiTagEnabled,
  getTheme,
  setTheme,
  pushSettingsToCloud,
  pullSettingsFromCloud,
  getAllSyncSettings,
  getPageVisibility,
  savePageVisibility,
  getAppFontSize,
  setAppFontSize,
  getDocEditorTheme,
  setDocEditorTheme,
  getLauncherUsageCount,
  incrementLauncherUsage,
  type Snippet,
  type ShortcutConfig,
  type CosConfig,
  type StorageMode,
  type ProfileData,
  type ClipboardHistoryItem,
  type QuickLink,
  type AiModelConfig,
  type PageVisibility,
} from './store'
import { reRegisterShortcuts } from './shortcuts'
import { readClipboard, writeToClipboard } from './clipboard'
import { testCosConnection, getDeviceId } from './cos'
import { chatWithHunyuan, isHunyuanAvailable, generateTitle, matchTags, type ChatMessage } from './hunyuan'
import { getInstalledApps, openApp, getAppIcon, getMacShortcuts, runMacShortcut } from './apps'

/** 注册所有 IPC 事件处理器 */
export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
  getHistoryWindow: () => BrowserWindow | null,
  createHistoryWindow: () => void
) {
  // 同步获取所有设置初始值（避免渲染进程异步加载导致UI跳变）
  ipcMain.on('settings:getInitialSync', (event) => {
    const stopTimer = timer('ipc', 'settings:getInitialSync (同步IPC)')
    const settings = getAllSyncSettings()
    const cosConfig = getCosConfig()
    const deviceId = getDeviceId()
    const storageMode = getStorageMode()
    const themeVal = getTheme()
    stopTimer()
    event.returnValue = {
      ...settings,
      cosConfig,
      deviceId,
      storageMode,
      theme: themeVal,
    }
  })

  // 异步获取所有同步设置（用于刷新缓存，不阻塞渲染进程）
  ipcMain.handle('settings:getAllSync', () => {
    return {
      ...getAllSyncSettings(),
      cosConfig: getCosConfig(),
      deviceId: getDeviceId(),
      storageMode: getStorageMode(),
      theme: getTheme(),
    }
  })

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

  // 更新片段（标题、标签、内容）
  ipcMain.handle('snippets:update', (_event, id: string, data: Partial<Pick<Snippet, 'title' | 'tags' | 'content'>>) => {
    return updateSnippet(id, data)
  })

  // 隐藏窗口
  ipcMain.on('window:hide', () => {
    const win = getMainWindow()
    if (win) win.hide()
  })

  // 最小化窗口
  ipcMain.on('window:minimize', () => {
    const win = getMainWindow()
    if (win) win.minimize()
  })

  // 最大化/还原窗口
  ipcMain.on('window:toggleMaximize', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    }
  })

  // 打开独立的剪贴板历史窗口
  ipcMain.on('historyWindow:open', () => {
    createHistoryWindow()
  })

  // 关闭剪贴板历史窗口
  ipcMain.on('historyWindow:close', () => {
    const win = getHistoryWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }
  })

  // 获取快捷键配置
  ipcMain.handle('shortcuts:get', () => {
    return getShortcuts()
  })

  // 保存快捷键配置并重新注册
  ipcMain.handle('shortcuts:save', (_event, config: ShortcutConfig) => {
    saveShortcuts(config)
    try {
      reRegisterShortcuts(getMainWindow)
    } catch (e) {
      console.error('重新注册快捷键异常（不影响保存）:', e)
    }
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

  // 从云端拉取收藏数据（favorites 目录）
  ipcMain.handle('cos:pullFavorites', async () => {
    return pullFavoritesFromCloud()
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

  // 使用 AI 匹配标签
  ipcMain.handle('aiTags:match', async (_event, content: string, contentType: string, availableTags: string[]) => {
    return matchTags(content, contentType, availableTags)
  })

  // ====== AI 标签匹配配置 ======

  // 获取是否启用 AI 自动匹配标签
  ipcMain.handle('aiTag:getEnabled', () => {
    return getAiTagEnabled()
  })

  // 设置是否启用 AI 自动匹配标签
  ipcMain.handle('aiTag:setEnabled', (_event, enabled: boolean) => {
    return setAiTagEnabled(enabled)
  })

  // ====== 主题 ======

  // 获取当前主题
  ipcMain.handle('theme:get', () => {
    return getTheme()
  })

  // 设置主题
  ipcMain.handle('theme:set', (_event, theme: string) => {
    return setTheme(theme)
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

  // ====== 页面可见性 ======

  // 获取页面可见性配置
  ipcMain.handle('pageVisibility:get', () => {
    return getPageVisibility()
  })

  // 保存页面可见性配置
  ipcMain.handle('pageVisibility:save', (_event, config: PageVisibility) => {
    return savePageVisibility(config)
  })

  // ====== 全局字体大小 ======

  // 获取全局字体大小
  ipcMain.handle('appFontSize:get', () => {
    return getAppFontSize()
  })

  // 设置全局字体大小
  ipcMain.handle('appFontSize:set', (_event, size: number) => {
    return setAppFontSize(size)
  })

  // ====== 速记编辑器主题 ======

  // 获取速记编辑器默认主题
  ipcMain.handle('docEditorTheme:get', () => {
    return getDocEditorTheme()
  })

  // 设置速记编辑器默认主题
  ipcMain.handle('docEditorTheme:set', (_event, theme: string) => {
    return setDocEditorTheme(theme)
  })

  // ====== 导航页使用频率 ======

  // 获取导航页操作使用频率计数
  ipcMain.handle('launcherUsage:get', () => {
    return getLauncherUsageCount()
  })

  // 增加某个操作的使用频率计数
  ipcMain.handle('launcherUsage:increment', (_event, itemKey: string) => {
    return incrementLauncherUsage(itemKey)
  })

  // ====== 本地应用 ======

  // 获取已安装的本地应用列表（异步，不阻塞主进程）
  ipcMain.handle('apps:getInstalled', async () => {
    return await getInstalledApps()
  })

  // 获取单个应用的图标（按需加载，避免一次性加载所有图标导致卡顿）
  ipcMain.handle('apps:getIcon', async (_event, appPath: string) => {
    return await getAppIcon(appPath)
  })

  // 打开本地应用
  ipcMain.handle('apps:open', (_event, appPath: string) => {
    return openApp(appPath)
  })

  // ====== macOS 快捷指令 ======

  // 获取 macOS 快捷指令列表
  ipcMain.handle('shortcuts:getMacShortcuts', async () => {
    return await getMacShortcuts()
  })

  // 运行 macOS 快捷指令
  ipcMain.handle('shortcuts:runMacShortcut', (_event, name: string) => {
    return runMacShortcut(name)
  })

  // ====== 日志 ======

  // 获取启动日志文件路径
  ipcMain.handle('logger:getLogFilePath', () => {
    return getLogFilePath()
  })

}