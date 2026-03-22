/**
 * 预加载脚本
 * 通过 contextBridge 安全暴露 API 给渲染进程
 */
import { contextBridge, ipcRenderer } from 'electron'

export interface ClipboardData {
  content: string
  type: 'code' | 'text' | 'url'
  language?: string
}

export interface SnippetData {
  id: string
  title: string
  content: string
  tags: string[]
  type: 'code' | 'text' | 'url'
  language?: string
  createdAt: string
  updatedAt: string
  copyCount: number
  isFavorite: boolean
}

export interface ShortcutConfig {
  openSave: string
  openSearch: string
}

const api = {
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

  /** 复制到剪贴板 */
  copyToClipboard: (id: string, content: string): Promise<SnippetData[]> =>
    ipcRenderer.invoke('snippets:copyToClipboard', id, content),

  /** 更新片段 */
  updateSnippet: (id: string, data: Partial<Pick<SnippetData, 'title' | 'tags'>>): Promise<SnippetData[]> =>
    ipcRenderer.invoke('snippets:update', id, data),

  /** 隐藏窗口 */
  hideWindow: (): void => ipcRenderer.send('window:hide'),

  /** 监听窗口模式切换（主进程通过全局快捷键触发） */
  onSwitchMode: (callback: (mode: 'save' | 'search') => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, mode: 'save' | 'search') => callback(mode)
    ipcRenderer.on('window:switchMode', handler)
    return () => {
      ipcRenderer.removeListener('window:switchMode', handler)
    }
  },

  /** 获取快捷键配置 */
  getShortcuts: (): Promise<ShortcutConfig> => ipcRenderer.invoke('shortcuts:get'),

  /** 保存快捷键配置 */
  saveShortcuts: (config: ShortcutConfig): Promise<ShortcutConfig> => ipcRenderer.invoke('shortcuts:save', config),
}

contextBridge.exposeInMainWorld('clipToolAPI', api)

// TypeScript 类型声明
export type ClipToolAPI = typeof api
