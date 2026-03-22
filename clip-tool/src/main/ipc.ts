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
  type Snippet,
  type ShortcutConfig,
} from './store'
import { reRegisterShortcuts } from './shortcuts'
import { readClipboardText, writeClipboardText, detectContentType } from './clipboard'

/** 注册所有 IPC 事件处理器 */
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  // 获取所有片段
  ipcMain.handle('snippets:getAll', () => {
    return getAllSnippets()
  })

  // 读取剪贴板内容
  ipcMain.handle('clipboard:read', () => {
    const content = readClipboardText()
    const detected = detectContentType(content)
    return { content, ...detected }
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

  // 复制到剪贴板并增加计数
  ipcMain.handle('snippets:copyToClipboard', (_event, id: string, content: string) => {
    writeClipboardText(content)
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
}
