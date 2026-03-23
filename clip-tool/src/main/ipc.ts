/**
 * IPC 事件处理模块
 * 负责主进程与渲染进程之间的通信
 */
import { ipcMain, BrowserWindow } from 'electron'
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
  type Snippet,
  type ShortcutConfig,
  type CosConfig,
  type StorageMode,
  type ProfileData,
  type ClipboardHistoryItem,
} from './store'
import { reRegisterShortcuts } from './shortcuts'
import { readClipboard, writeToClipboard } from './clipboard'
import { testCosConnection, getDeviceId } from './cos'

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
}
