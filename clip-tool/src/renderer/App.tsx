/**
 * 主应用组件
 * 极简交互流程：
 *   ⌘⇧K → 保存模式（自动读取剪贴板 → Enter 保存并关闭）
 *   ⌘⇧S → 搜索模式（↑↓ 选中 → ⌘C/Enter 复制并关闭）
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import SavePanel, { type SavePanelRef } from './components/SavePanel'
import SearchPanel, { type SearchPanelRef } from './components/SearchPanel'
import EditorPanel, { type EditorPanelRef } from './components/EditorPanel'
import AiPanel, { type AiPanelRef } from './components/AiPanel'
import FavoritePanel from './components/FavoritePanel'
import DocPanel from './components/DocPanel'
import SettingsPanel, { type SettingsPanelRef } from './components/SettingsPanel'
import ProfilePanel from './components/ProfilePanel'
import LauncherPanel, { type LauncherPanelRef } from './components/LauncherPanel'
import { useShortcuts } from './hooks/useShortcuts'
import { registerTags } from './utils/tagColor'
import type { SnippetData, PageVisibility } from './types'

/** 渲染进程启动计时 */
const rendererStartTime = Date.now()
function rlog(msg: string) {
  console.log(`[+${Date.now() - rendererStartTime}ms] [renderer] ${msg}`)
}

type TabType = 'save' | 'editor' | 'search' | 'ai' | 'favorite' | 'doc' | 'profile' | 'settings' | 'launcher'

/** 将 Electron accelerator 格式转换为短标签显示 */
function formatHint(accelerator: string): string {
  if (!accelerator) return ''
  return accelerator
    .replace(/CommandOrControl/g, '⌘')
    .replace(/CmdOrCtrl/g, '⌘')
    .replace(/Command/g, '⌘')
    .replace(/Control/g, '⌃')
    .replace(/Shift/g, '⇧')
    .replace(/Alt/g, '⌥')
    .replace(/Option/g, '⌥')
    .replace(/\+/g, '')
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('save')
  const [snippets, setSnippets] = useState<SnippetData[]>([])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
  const [triggerRead, setTriggerRead] = useState(0)
  const [shortcutHints, setShortcutHints] = useState<Record<string, string>>({
    save: '⌘⇧K',
    search: '⌘⇧S',
    editor: '⌘⇧E',
    doc: '⌘⇧D',
    ai: '',
    favorite: '',
    settings: '',
    profile: '',
    launcher: '',
  })
  const [pageVisibility, setPageVisibility] = useState<PageVisibility>({
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
  const searchPanelRef = useRef<SearchPanelRef>(null)
  const savePanelRef = useRef<SavePanelRef>(null)
  const settingsPanelRef = useRef<SettingsPanelRef>(null)
  const aiPanelRef = useRef<AiPanelRef>(null)
  const launcherPanelRef = useRef<LauncherPanelRef>(null)
  const editorPanelRef = useRef<EditorPanelRef>(null)
  const [settingsNavFocused, setSettingsNavFocused] = useState(false)
  const [aiCardFocused, setAiCardFocused] = useState(false)

  // 加载所有片段（如果 COS 启用，先从云端拉取再展示）
  const loadSnippets = useCallback(async () => {
    try {
      // 先展示本地数据，避免等待云端请求导致空白
      const localData = await window.clipToolAPI.getAllSnippets()
      setSnippets(localData)

      // 异步拉取云端数据（如果启用了 COS）
      const cosConfig = await window.clipToolAPI.getCosConfig()
      if (cosConfig.enabled) {
        // 并行拉取 snippets 和 favorites
        const [cloudData, cloudFavorites] = await Promise.all([
          window.clipToolAPI.pullSnippets(),
          window.clipToolAPI.pullFavorites(),
        ])

        let merged = [...localData]

        // 合并云端 snippets：以云端数据为主，本地独有的片段也保留
        if (cloudData !== null && cloudData.length > 0) {
          const cloudIds = new Set(cloudData.map((s) => s.id))
          const localOnly = localData.filter((s) => !cloudIds.has(s.id))
          merged = [...cloudData, ...localOnly]
        }

        // 合并云端 favorites：将 favorites 目录中的收藏数据合并进来
        // favorites 中的数据一定是 isFavorite=true 的，以 id 去重
        if (cloudFavorites !== null && cloudFavorites.length > 0) {
          const existingIds = new Set(merged.map((s) => s.id))
          for (const fav of cloudFavorites) {
            if (existingIds.has(fav.id)) {
              // 已存在的片段：确保收藏状态为 true
              const existing = merged.find((s) => s.id === fav.id)
              if (existing) {
                existing.isFavorite = true
              }
            } else {
              // 不存在的片段：从 favorites 目录补充进来
              fav.isFavorite = true
              merged.push(fav)
            }
          }
        }

        // 按创建时间排序
        merged.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setSnippets(merged)
      }
    } catch (error) {
      console.error('加载片段失败:', error)
    }
  }, [])

  // 加载快捷键提示
  const loadShortcutHints = useCallback(async () => {
    try {
      const config = await window.clipToolAPI.getShortcuts()
      setShortcutHints({
        save: formatHint(config.openSave),
        search: formatHint(config.openSearch),
        editor: formatHint(config.openEditor),
        doc: formatHint(config.openDoc),
        ai: formatHint(config.openAi),
        favorite: formatHint(config.openFavorite),
        settings: formatHint(config.openSettings),
        profile: formatHint(config.openProfile),
        launcher: formatHint(config.openLauncher),
      })
    } catch (error) {
      console.error('加载快捷键配置失败:', error)
    }
  }, [])

  // 加载页面可见性配置（初始化时从 store 读取）
  const loadPageVisibility = useCallback(async () => {
    try {
      const config = await window.clipToolAPI.getPageVisibility()
      applyPageVisibility(config)
    } catch (error) {
      console.error('加载页面可见性配置失败:', error)
    }
  }, [])

  // 直接应用页面可见性配置（实时生效，无需再走 IPC 读取）
  const applyPageVisibility = useCallback((config: PageVisibility) => {
    setPageVisibility(config)
    // 如果当前 activeTab 对应的页面被隐藏了，自动切换到第一个可见的 Tab
    const tabKeys: TabType[] = ['save', 'editor', 'search', 'launcher', 'doc', 'ai', 'favorite', 'settings', 'profile']
    setActiveTab((prev) => {
      if (config[prev as keyof PageVisibility] === false) {
        const firstVisible = tabKeys.find((key) => config[key as keyof PageVisibility] !== false)
        return firstVisible || 'save'
      }
      return prev
    })
  }, [])

  useEffect(() => {
    rlog('⚙️ useEffect 初始化开始')
    const t0 = Date.now()
    loadSnippets().then(() => rlog(`✅ loadSnippets 完成 (耗时 ${Date.now() - t0}ms)`))
    loadShortcutHints()
    loadPageVisibility()
    // 初始化标签颜色映射
    window.clipToolAPI.getCustomTags().then(registerTags)
    // 初始化主题
    window.clipToolAPI.getTheme().then((theme) => {
      document.documentElement.setAttribute('data-theme', theme)
    })
    // 初始化全局字体大小
    window.clipToolAPI.getAppFontSize().then((size) => {
      const scale = size / 13
      document.documentElement.style.setProperty('--app-zoom', String(scale))
      const appContainer = document.querySelector('.app-container') as HTMLElement
      if (appContainer) appContainer.style.zoom = String(scale)
      rlog(`✅ 渲染进程初始化完成 (总耗时 ${Date.now() - t0}ms)`)
    })
  }, [loadSnippets, loadShortcutHints])

  // 监听主进程发来的模式切换（全局快捷键触发）
  useEffect(() => {
    const unsubscribe = window.clipToolAPI.onSwitchMode((mode) => {
      if (mode === 'save') {
        setActiveTab('save')
        setTriggerRead((prev) => prev + 1)
      } else if (mode === 'search') {
        setActiveTab('search')
        setTimeout(() => {
          searchPanelRef.current?.focusSearch()
        }, 100)
      } else if (mode === 'launcher') {
        setActiveTab('launcher')
        // 切换到 launcher 后清空搜索框并聚焦
        // 使用 setTimeout 确保 React 状态更新和组件渲染完成后再调用
        setTimeout(() => {
          launcherPanelRef.current?.focusSearch()
        }, 50)
      } else if (mode === 'editor') {
        // 如果当前已在 editor tab，正常切换；否则打开独立历史小窗
        setActiveTab((prev) => {
          if (prev === 'editor') {
            return 'editor'
          } else {
            // 不在历史页面时，打开独立小窗
            window.clipToolAPI.openHistoryWindow()
            return prev // 保持当前 tab 不变
          }
        })
      } else {
        // ai / favorite / settings / profile
        setActiveTab(mode as TabType)
      }
      // 每次唤起都重新加载数据
      loadSnippets()
    })
    return unsubscribe
  }, [loadSnippets])

  // Toast 提示（支持类型：success / error / warning / info）
  const showToast = useCallback((message: string, type?: 'success' | 'error' | 'warning' | 'info') => {
    // 自动推断类型
    let toastType = type
    if (!toastType) {
      if (message.startsWith('✓') || message.startsWith('✅')) toastType = 'success'
      else if (message.startsWith('✕') || message.startsWith('❌')) toastType = 'error'
      else if (message.startsWith('⚠')) toastType = 'warning'
      else toastType = 'info'
    }
    setToast({ message, type: toastType })
    setTimeout(() => setToast(null), 2200)
  }, [])

  // 保存片段
  const handleSave = useCallback(async (snippet: SnippetData) => {
    try {
      const updated = await window.clipToolAPI.addSnippet(snippet)
      setSnippets(updated)
      showToast('✓ 片段已保存')
    } catch (error) {
      console.error('保存失败:', error)
      showToast('✕ 保存失败')
    }
  }, [showToast])

  // 保存并关闭窗口
  const handleSaveAndClose = useCallback(async (snippet: SnippetData) => {
    try {
      const updated = await window.clipToolAPI.addSnippet(snippet)
      setSnippets(updated)
      showToast('✓ 片段已保存')
      // 短暂延迟后关闭窗口，让用户看到保存成功提示
      setTimeout(() => {
        window.clipToolAPI.hideWindow()
      }, 400)
    } catch (error) {
      console.error('保存失败:', error)
      showToast('✕ 保存失败')
    }
  }, [showToast])

  // 复制片段到剪贴板
  const handleCopy = useCallback(async (snippet: SnippetData) => {
    try {
      const updated = await window.clipToolAPI.copyToClipboard(snippet.id, snippet.content, snippet.type)
      setSnippets(updated)
      showToast('✓ 已复制到剪贴板')
    } catch (error) {
      console.error('复制失败:', error)
    }
  }, [showToast])

  // 复制并关闭窗口
  const handleCopyAndClose = useCallback(async (snippet: SnippetData) => {
    try {
      const updated = await window.clipToolAPI.copyToClipboard(snippet.id, snippet.content, snippet.type)
      setSnippets(updated)
      showToast('✓ 已复制到剪贴板')
      setTimeout(() => {
        window.clipToolAPI.hideWindow()
      }, 300)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }, [showToast])

  // 删除片段
  const handleDelete = useCallback(async (id: string) => {
    try {
      const updated = await window.clipToolAPI.deleteSnippet(id)
      setSnippets(updated)
      showToast('已删除')
    } catch (error) {
      console.error('删除失败:', error)
    }
  }, [showToast])

  // 切换收藏
  const handleToggleFavorite = useCallback(async (id: string) => {
    try {
      const updated = await window.clipToolAPI.toggleFavorite(id)
      setSnippets(updated)
    } catch (error) {
      console.error('操作失败:', error)
    }
  }, [])

  // 更新标签
  const handleUpdateTags = useCallback(async (id: string, tags: string[]) => {
    try {
      const updated = await window.clipToolAPI.updateSnippet(id, { tags })
      setSnippets(updated)
      showToast('✓ 标签已更新')
    } catch (error) {
      console.error('更新标签失败:', error)
      showToast('✕ 更新标签失败')
    }
  }, [showToast])

  // 更新标题
  const handleUpdateTitle = useCallback(async (id: string, title: string) => {
    try {
      const updated = await window.clipToolAPI.updateSnippet(id, { title })
      setSnippets(updated)
      showToast('✓ 标题已更新')
    } catch (error) {
      console.error('更新标题失败:', error)
      showToast('✕ 更新标题失败')
    }
  }, [showToast])

  // 注册窗口内快捷键
  useShortcuts({
    activeTab,
    // Enter：保存模式下保存并关闭
    onEnterSave: () => {
      savePanelRef.current?.doSave()
    },
    // ⌘C / Enter（搜索模式）：复制选中项并关闭窗口
    onCopySelected: () => {
      const results = searchPanelRef.current?.getResults()
      const idx = searchPanelRef.current?.getSelectedIndex() ?? 0
      if (results && results[idx]) {
        handleCopyAndClose(results[idx])
      }
    },
    onArrowUp: () => {
      searchPanelRef.current?.selectUp()
    },
    onArrowDown: () => {
      searchPanelRef.current?.selectDown()
    },
    onEditorUp: () => {
      editorPanelRef.current?.selectUp()
    },
    onEditorDown: () => {
      editorPanelRef.current?.selectDown()
    },
    onEscape: () => {
      // launcher tab: 先让 LauncherPanel 层层退出子状态
      if (activeTab === 'launcher') {
        const consumed = launcherPanelRef.current?.handleEscape()
        if (consumed) return true
      }
      window.clipToolAPI.hideWindow()
    },
    onQuickCopy: (index: number) => {
      const results = searchPanelRef.current?.getResults()
      if (results && results[index]) {
        handleCopyAndClose(results[index])
      }
    },
    // ← / → 切换 Tab（使用函数式更新避免闭包陷阱）
    onSwitchTab: (direction: 'left' | 'right') => {
      // 切换顶部 Tab 时重置子导航聚焦
      setSettingsNavFocused(false)
      settingsPanelRef.current?.blurNav()
      setAiCardFocused(false)
      aiPanelRef.current?.blurCards()
      const tabKeys: TabType[] = ['save', 'editor', 'search', 'launcher', 'doc', 'ai', 'favorite', 'settings', 'profile']
      setActiveTab((prev) => {
        // 过滤出可见的 Tab
        const visibleTabs = tabKeys.filter((key) => pageVisibility[key as keyof PageVisibility] !== false)
        const currentIndex = visibleTabs.indexOf(prev)
        let nextIndex: number
        if (direction === 'left') {
          nextIndex = currentIndex <= 0 ? visibleTabs.length - 1 : currentIndex - 1
        } else {
          nextIndex = currentIndex >= visibleTabs.length - 1 ? 0 : currentIndex + 1
        }
        const nextTab = visibleTabs[nextIndex]
        // 切换到搜索模式时自动聚焦搜索框
        if (nextTab === 'search') {
          setTimeout(() => {
            searchPanelRef.current?.focusSearch()
          }, 100)
        }
        // 切换到导航栏时自动聚焦搜索框
        if (nextTab === 'launcher') {
          setTimeout(() => {
            launcherPanelRef.current?.focusSearch()
          }, 100)
        }
        return nextTab
      })
    },
    // 双击空格关闭窗口
    onClose: () => {
      window.clipToolAPI.hideWindow()
    },
    // 设置页面：↓ 进入子导航
    onSettingsNavFocus: () => {
      setSettingsNavFocused(true)
      settingsPanelRef.current?.focusNav()
    },
    // 设置页面：↑ 退出子导航
    onSettingsNavBlur: () => {
      setSettingsNavFocused(false)
      settingsPanelRef.current?.blurNav()
    },
    // 设置页面：←→ 切换子标签页
    onSettingsNavSwitch: (direction: 'left' | 'right') => {
      settingsPanelRef.current?.switchNav(direction)
    },
    settingsNavFocused,
    // AI 页面：↓ 进入卡片聚焦
    onAiCardFocus: () => {
      setAiCardFocused(true)
      aiPanelRef.current?.focusCards()
    },
    // AI 页面：↑ 退出卡片聚焦
    onAiCardBlur: () => {
      setAiCardFocused(false)
      aiPanelRef.current?.blurCards()
    },
    // AI 页面：方向键导航卡片
    onAiCardNavigate: (direction: 'up' | 'down' | 'left' | 'right') => {
      const stillFocused = aiPanelRef.current?.navigateCard(direction)
      if (!stillFocused) {
        setAiCardFocused(false)
      }
    },
    aiCardFocused,
  })

  const allTabs: { key: TabType; label: string; hint: string }[] = [
    { key: 'save', label: '📋 速存', hint: shortcutHints.save },
    { key: 'editor', label: '✏️ 历史', hint: shortcutHints.editor },
    { key: 'search', label: '🔍 搜索', hint: shortcutHints.search },
    { key: 'launcher', label: '🚀 导航', hint: shortcutHints.launcher },
    { key: 'doc', label: '📄 速记', hint: shortcutHints.doc },
    { key: 'ai', label: '🤖 AI', hint: shortcutHints.ai },
    { key: 'favorite', label: '⭐ 收藏', hint: shortcutHints.favorite },
    { key: 'settings', label: '⚙ 设置', hint: shortcutHints.settings },
    { key: 'profile', label: '👤 我的', hint: shortcutHints.profile },
  ]

  // 根据页面可见性过滤 Tab
  const tabs = allTabs.filter((tab) => pageVisibility[tab.key as keyof PageVisibility] !== false)

  return (
    <div className="app-container">
      {/* 可拖拽区域（窗口标题栏） */}
      <div className="drag-region">
        <div className="traffic-lights">
          <button className="traffic-light traffic-light-close" onClick={() => window.clipToolAPI.hideWindow()} title="关闭">
            <svg width="6" height="6" viewBox="0 0 6 6"><path d="M0 0L6 6M6 0L0 6" stroke="currentColor" strokeWidth="1.2" /></svg>
          </button>
          <button className="traffic-light traffic-light-minimize" onClick={() => window.clipToolAPI.minimizeWindow()} title="最小化">
            <svg width="8" height="2" viewBox="0 0 8 2"><path d="M0 1h8" stroke="currentColor" strokeWidth="1.2" /></svg>
          </button>
          <button className="traffic-light traffic-light-maximize" onClick={() => window.clipToolAPI.toggleMaximizeWindow()} title="最大化">
            <svg width="6" height="6" viewBox="0 0 6 6"><path d="M0 1.5C0 .67.67 0 1.5 0h3C5.33 0 6 .67 6 1.5v3c0 .83-.67 1.5-1.5 1.5h-3C.67 6 0 5.33 0 4.5z" fill="currentColor" /></svg>
          </button>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="tab-bar">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.hint && <span className="tab-hint">{tab.hint}</span>}
          </div>
        ))}
      </div>

      {/* 面板内容 */}
      <div className="panel-content">
        {activeTab === 'save' && (
          <SavePanel ref={savePanelRef} onSave={handleSaveAndClose} triggerRead={triggerRead} />
        )}
        {activeTab === 'editor' && (
          <EditorPanel ref={editorPanelRef} onSave={handleSave} />
        )}
        {activeTab === 'search' && (
          <SearchPanel
            ref={searchPanelRef}
            snippets={snippets}
            onCopy={handleCopyAndClose}
            onDelete={handleDelete}
            onToggleFavorite={handleToggleFavorite}
            onUpdateTags={handleUpdateTags}
          />
        )}
        {activeTab === 'ai' && <AiPanel ref={aiPanelRef} />}
        {activeTab === 'favorite' && (
          <FavoritePanel
            snippets={snippets}
            onCopy={handleCopy}
            onDelete={handleDelete}
            onToggleFavorite={handleToggleFavorite}
            onUpdateTags={handleUpdateTags}
            onUpdateTitle={handleUpdateTitle}
          />
        )}
        {activeTab === 'doc' && <DocPanel onSave={handleSave} activeTab={activeTab} />}
        {activeTab === 'profile' && <ProfilePanel />}
{activeTab === 'settings' && <SettingsPanel ref={settingsPanelRef} onShortcutsChanged={loadShortcutHints} onDataChanged={loadSnippets} onPageVisibilityChanged={applyPageVisibility} />}
        {activeTab === 'launcher' && <LauncherPanel ref={launcherPanelRef} onSwitchToAi={(query) => {
          setActiveTab('ai')
          // 将搜索词存入剪贴板以便在 AI 中使用
          if (query) {
            navigator.clipboard.writeText(query)
          }
        }} />}
      </div>

      {/* Toast 提示 */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* 窗口拉伸手柄 */}
      <div className="resize-handle" />
    </div>
  )
}

export default App
