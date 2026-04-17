/**
 * IPC 事件处理模块
 * 负责主进程与渲染进程之间的通信
 */
import { ipcMain, BrowserWindow, shell, app } from 'electron'
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
  getEnableHistoryWindow,
  setEnableHistoryWindow,
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
  getYuqueConfig,
  saveYuqueConfig,
  getYuqueSyncMap,
  updateYuqueSyncItem,
  deleteYuqueSyncItem,
  type YuqueConfig,
  type YuqueSyncMap,
} from './store'
import { reRegisterShortcuts } from './shortcuts'
import { readClipboard, writeToClipboard } from './clipboard'
import { testCosConnection, getDeviceId } from './cos'
import { chatWithHunyuan, isHunyuanAvailable, generateTitle, matchTags, type ChatMessage } from './hunyuan'
import { getInstalledApps, openApp, getAppIcon, getMacShortcuts, runMacShortcut } from './apps'
import { recognizeImage, getOcrStatus } from './ocr'
import {
  verifyToken,
  getUserRepos,
  searchDocs,
  getDocDetail,
  createDoc,
  updateDoc,
  getRepoToc,
  appendDocToToc,
  createTocTitleNode,
  YuqueApiError,
  type SearchOptions,
} from './yuque'

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

  // 隐藏窗口（隐藏后让焦点回到之前的应用）
  ipcMain.on('window:hide', () => {
    const win = getMainWindow()
    if (win) {
      win.hide()
      // macOS 上隐藏窗口后，需要 app.hide() 让焦点回到之前的应用
      if (process.platform === 'darwin') {
        const historyWin = getHistoryWindow()
        // 只有当历史窗口也不可见时才隐藏整个应用
        if (!historyWin || historyWin.isDestroyed() || !historyWin.isVisible()) {
          app.hide()
        }
      }
    }
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

  // 关闭剪贴板历史窗口（关闭后让焦点回到之前的应用）
  ipcMain.on('historyWindow:close', () => {
    const win = getHistoryWindow()
    if (win && !win.isDestroyed()) {
      win.close()
      // macOS 上关闭历史窗口后，需要让焦点回到之前的应用
      if (process.platform === 'darwin') {
        const mainWin = getMainWindow()
        // 只有当主窗口也不可见时才隐藏整个应用
        if (!mainWin || mainWin.isDestroyed() || !mainWin.isVisible()) {
          app.hide()
        }
      }
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

  // 获取是否启用独立历史小窗
  ipcMain.handle('historyWindow:getEnabled', () => {
    return getEnableHistoryWindow()
  })

  // 设置是否启用独立历史小窗
  ipcMain.handle('historyWindow:setEnabled', (_event, enabled: boolean) => {
    return setEnableHistoryWindow(enabled)
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

  // ====== 语雀集成 ======

  // 获取语雀配置
  ipcMain.handle('yuque:getConfig', () => {
    return getYuqueConfig()
  })

  // 保存语雀配置
  ipcMain.handle('yuque:saveConfig', (_event, config: YuqueConfig) => {
    return saveYuqueConfig(config)
  })

  // 验证语雀 Token
  ipcMain.handle('yuque:verifyToken', async (_event, token: string) => {
    log('ipc', `[yuque:verifyToken] 开始验证, token长度=${token?.length || 0}`)
    try {
      const user = await verifyToken(token)
      log('ipc', `[yuque:verifyToken] 验证成功: ${user.name} (${user.login})`)
      return { success: true, user }
    } catch (error) {
      const msg = error instanceof YuqueApiError ? error.message : '验证失败'
      log('ipc', `[yuque:verifyToken] 验证失败: ${msg}, error=${error}`)
      return { success: false, error: msg }
    }
  })

  // 获取用户知识库列表
  ipcMain.handle('yuque:getRepos', async (_event, token: string, login: string) => {
    try {
      const repos = await getUserRepos(token, login)
      return { success: true, repos }
    } catch (error) {
      const msg = error instanceof YuqueApiError ? error.message : '获取知识库失败'
      return { success: false, error: msg }
    }
  })

  // 搜索语雀文档
  ipcMain.handle('yuque:search', async (_event, query: string, options?: SearchOptions) => {
    log('ipc', `[yuque:search] 搜索关键词="${query}", options=${JSON.stringify(options)}`)
    try {
      const config = getYuqueConfig()
      if (!config.token) {
        log('ipc', `[yuque:search] 失败: Token 未配置`)
        return { success: false, error: '语雀 Token 未配置，请先在设置中配置语雀 Token' }
      }
      log('ipc', `[yuque:search] Token长度=${config.token.length}, 开始搜索...`)
      const result = await searchDocs(config.token, query, options)
      log('ipc', `[yuque:search] 搜索成功, 返回 ${result.data?.length || 0} 条结果`)
      return { success: true, ...result }
    } catch (error) {
      const msg = error instanceof YuqueApiError ? error.message : '搜索失败'
      log('ipc', `[yuque:search] 搜索异常: ${msg}, error=${error}`)
      return { success: false, error: msg }
    }
  })

  // 获取文档详情
  ipcMain.handle('yuque:getDocDetail', async (_event, bookId: number, docId: number) => {
    try {
      const config = getYuqueConfig()
      if (!config.token) {
        return { success: false, error: '语雀 Token 未配置' }
      }
      const doc = await getDocDetail(config.token, bookId, docId)
      return { success: true, doc }
    } catch (error) {
      const msg = error instanceof YuqueApiError ? error.message : '获取文档失败'
      return { success: false, error: msg }
    }
  })

  /**
   * 确保文档挂载到知识库目录的 clip-tool 分组下
   * 如果 clip-tool 分组不存在则自动创建
   */
  async function ensureDocInToc(token: string, namespace: string, docId: number): Promise<void> {
    try {
      const toc = await getRepoToc(token, namespace)
      // 统一用 replace 去掉连字符后匹配，兼容 'ClipTool' / 'clip-tool' / 'Clip-Tool' 等写法
      let clipToolNode = toc.find(item => item.type === 'TITLE' && item.title.toLowerCase().replace(/-/g, '').includes('cliptool'))

      if (!clipToolNode) {
        // 自动创建 clip-tool 分组节点
        log('ipc', `[yuque:ensureDocInToc] 未找到 clip-tool 目录节点，自动创建...`)
        const newToc = await createTocTitleNode(token, namespace, 'clip-tool')
        clipToolNode = newToc.find(item => item.type === 'TITLE' && item.title.toLowerCase().replace(/-/g, '').includes('cliptool'))
        if (!clipToolNode) {
          log('ipc', `[yuque:ensureDocInToc] 创建 clip-tool 分组节点后仍未找到，跳过目录插入`)
          return
        }
        log('ipc', `[yuque:ensureDocInToc] 已创建 clip-tool 分组节点: uuid=${clipToolNode.uuid}`)
      }

      // 检查文档是否已经在 clip-tool 目录下，避免重复插入
      const alreadyInToc = toc.some(item => item.type === 'DOC' && item.doc_id === docId && item.parent_uuid === clipToolNode!.uuid)
      if (alreadyInToc) {
        log('ipc', `[yuque:ensureDocInToc] 文档已在目录中，跳过: docId=${docId}`)
        return
      }

      await appendDocToToc(token, namespace, clipToolNode.uuid, docId)
      log('ipc', `[yuque:ensureDocInToc] 已插入目录: parentUuid=${clipToolNode.uuid}, docId=${docId}`)
    } catch (tocError) {
      // 插入目录失败不影响主流程
      log('ipc', `[yuque:ensureDocInToc] 插入目录失败: ${tocError instanceof Error ? tocError.message : '未知错误'}`)
    }
  }

  // 同步单个片段到语雀（创建或更新）
  ipcMain.handle('yuque:syncSnippet', async (_event, snippetId: string, title: string, content: string) => {
    log('ipc', `[yuque:syncSnippet] 开始同步: snippetId=${snippetId}, title="${title}", contentLen=${content?.length || 0}`)
    try {
      const config = getYuqueConfig()
      if (!config.token) {
        log('ipc', `[yuque:syncSnippet] 失败: Token 未配置`)
        return { success: false, error: '语雀 Token 未配置，请先在设置中配置' }
      }
      if (!config.targetRepoNamespace) {
        log('ipc', `[yuque:syncSnippet] 失败: 未选择目标知识库, config=${JSON.stringify({ ...config, token: config.token ? '***' : '' })}`)
        return { success: false, error: '未选择目标知识库，请先在设置中选择要导出到的语雀知识库' }
      }
      log('ipc', `[yuque:syncSnippet] 配置: namespace=${config.targetRepoNamespace}, repoName=${config.targetRepoName}`)

      const syncMap = getYuqueSyncMap()
      const existingSync = syncMap[snippetId]

      if (existingSync?.yuqueDocId) {
        // 已同步过，尝试更新
        try {
          const doc = await updateDoc(config.token, config.targetRepoNamespace, existingSync.yuqueDocId, {
            title,
            body: content,
            format: 'markdown',
          })
          updateYuqueSyncItem(snippetId, {
            yuqueDocId: doc.id,
            yuqueSyncedAt: new Date().toISOString(),
          })

          // 确保文档挂载到 clip-tool 目录下
          await ensureDocInToc(config.token, config.targetRepoNamespace, doc.id)

          return { success: true, docId: doc.id, action: 'updated' }
        } catch (updateError) {
          // 如果 404，说明语雀端文档已删除，清除映射并重新创建
          if (updateError instanceof YuqueApiError && updateError.status === 404) {
            deleteYuqueSyncItem(snippetId)
            // 继续执行下面的创建逻辑
          } else {
            throw updateError
          }
        }
      }

      // 创建新文档
      const doc = await createDoc(config.token, config.targetRepoNamespace, {
        title,
        body: content,
        format: 'markdown',
      })
      updateYuqueSyncItem(snippetId, {
        yuqueDocId: doc.id,
        yuqueSyncedAt: new Date().toISOString(),
      })

      // 将新创建的文档插入到 clip-tool 目录下
      await ensureDocInToc(config.token, config.targetRepoNamespace, doc.id)

      return { success: true, docId: doc.id, action: 'created' }
    } catch (error) {
      const msg = error instanceof YuqueApiError ? error.message : '同步失败'
      return { success: false, error: msg }
    }
  })

  // 批量导出所有收藏为一篇语雀文档
  ipcMain.handle('yuque:exportAll', async (_event, title: string, body: string) => {
    log('ipc', `[yuque:exportAll] 开始导出: title="${title}", bodyLen=${body?.length || 0}`)
    try {
      const config = getYuqueConfig()
      if (!config.token) {
        return { success: false, error: '语雀 Token 未配置，请先在设置中配置' }
      }
      if (!config.targetRepoNamespace) {
        return { success: false, error: '未选择目标知识库，请先在设置中选择要导出到的语雀知识库' }
      }

      // 检查是否已有导出记录（用固定 key "clip-tool-export-all" 存储）
      const syncMap = getYuqueSyncMap()
      const existingSync = syncMap['clip-tool-export-all']

      if (existingSync?.yuqueDocId) {
        // 已导出过，尝试更新
        try {
          const doc = await updateDoc(config.token, config.targetRepoNamespace, existingSync.yuqueDocId, {
            title,
            body,
            format: 'markdown',
          })
          updateYuqueSyncItem('clip-tool-export-all', {
            yuqueDocId: doc.id,
            yuqueSyncedAt: new Date().toISOString(),
          })
          log('ipc', `[yuque:exportAll] 更新成功: docId=${doc.id}`)

          // 确保文档挂载到 clip-tool 目录下（可能之前创建时未成功挂载）
          await ensureDocInToc(config.token, config.targetRepoNamespace, doc.id)

          return { success: true, docId: doc.id, action: 'updated' }
        } catch (updateError) {
          if (updateError instanceof YuqueApiError && updateError.status === 404) {
            deleteYuqueSyncItem('clip-tool-export-all')
            // 文档已被删除，继续创建新文档
          } else {
            throw updateError
          }
        }
      }

      // 创建新文档
      const doc = await createDoc(config.token, config.targetRepoNamespace, {
        title,
        body,
        format: 'markdown',
      })
      updateYuqueSyncItem('clip-tool-export-all', {
        yuqueDocId: doc.id,
        yuqueSyncedAt: new Date().toISOString(),
      })
      log('ipc', `[yuque:exportAll] 创建成功: docId=${doc.id}`)

      // 将文档插入到知识库目录中（查找或创建 clip-tool 分组节点）
      await ensureDocInToc(config.token, config.targetRepoNamespace, doc.id)

      return { success: true, docId: doc.id, action: 'created' }
    } catch (error) {
      const msg = error instanceof YuqueApiError ? error.message : '导出失败'
      log('ipc', `[yuque:exportAll] 失败: ${msg}`)
      return { success: false, error: msg }
    }
  })

  // 获取语雀同步映射表
  ipcMain.handle('yuque:getSyncMap', () => {
    return getYuqueSyncMap()
  })

  // ====== OCR 文字识别 ======

  // OCR 识别图片文字
  ipcMain.handle('ocr:recognize', async (_event, base64Image: string) => {
    return recognizeImage(base64Image)
  })

  // 获取 OCR 引擎状态
  ipcMain.handle('ocr:getStatus', () => {
    return getOcrStatus()
  })

  // OCR 识别 + 翻译（先识别再调用混元翻译）
  ipcMain.handle('ocr:translate', async (_event, base64Image: string, targetLang: string) => {
    // 第一步：OCR 识别
    const ocrResult = await recognizeImage(base64Image)
    if (!ocrResult.text.trim()) {
      return { original: '', translated: '', error: '未识别到文字内容' }
    }

    // 第二步：调用混元翻译
    if (!isHunyuanAvailable()) {
      return {
        original: ocrResult.text,
        translated: '',
        error: '翻译服务未配置，请在设置中配置混元大模型密钥',
      }
    }

    try {
      const messages: ChatMessage[] = [
        {
          Role: 'system',
          Content: `你是一个翻译助手。请将以下文本翻译为${targetLang || '中文'}，只输出翻译结果，不要添加任何解释、前缀或标注。`,
        },
        {
          Role: 'user',
          Content: ocrResult.text,
        },
      ]
      const win = getMainWindow()
      const translated = await chatWithHunyuan(messages, win)
      return {
        original: ocrResult.text,
        translated: translated.trim(),
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      return {
        original: ocrResult.text,
        translated: '',
        error: `翻译失败：${errMsg}`,
      }
    }
  })

  // 仅翻译文本（不含 OCR 识别，用于切换语言时重新翻译已识别的原文）
  ipcMain.handle('ocr:translateText', async (_event, text: string, targetLang: string) => {
    if (!text.trim()) {
      return { translated: '', error: '没有可翻译的文本' }
    }

    if (!isHunyuanAvailable()) {
      return {
        translated: '',
        error: '翻译服务未配置，请在设置中配置混元大模型密钥',
      }
    }

    try {
      const messages: ChatMessage[] = [
        {
          Role: 'system',
          Content: `你是一个翻译助手。请将以下文本翻译为${targetLang || '中文'}，只输出翻译结果，不要添加任何解释、前缀或标注。`,
        },
        {
          Role: 'user',
          Content: text,
        },
      ]
      const win = getMainWindow()
      const translated = await chatWithHunyuan(messages, win)
      return {
        translated: translated.trim(),
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      return {
        translated: '',
        error: `翻译失败：${errMsg}`,
      }
    }
  })

}