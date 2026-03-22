/**
 * 主应用组件
 * 极简交互流程：
 *   ⌘⇧K → 保存模式（自动读取剪贴板 → Enter 保存并关闭）
 *   ⌘⇧S → 搜索模式（↑↓ 选中 → ⌘C/Enter 复制并关闭）
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import SavePanel, { type SavePanelRef } from './components/SavePanel'
import SearchPanel, { type SearchPanelRef } from './components/SearchPanel'
import FavoritePanel from './components/FavoritePanel'
import SettingsPanel from './components/SettingsPanel'
import { useShortcuts } from './hooks/useShortcuts'
import type { SnippetData } from './types'

type TabType = 'save' | 'search' | 'favorite' | 'settings'

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
  const [toast, setToast] = useState<string | null>(null)
  const [triggerRead, setTriggerRead] = useState(0)
  const [shortcutHints, setShortcutHints] = useState<{ save: string; search: string }>({
    save: '⌘⇧K',
    search: '⌘⇧S',
  })
  const searchPanelRef = useRef<SearchPanelRef>(null)
  const savePanelRef = useRef<SavePanelRef>(null)

  // 加载所有片段
  const loadSnippets = useCallback(async () => {
    try {
      const data = await window.clipToolAPI.getAllSnippets()
      setSnippets(data)
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
      })
    } catch (error) {
      console.error('加载快捷键配置失败:', error)
    }
  }, [])

  useEffect(() => {
    loadSnippets()
    loadShortcutHints()
  }, [loadSnippets, loadShortcutHints])

  // 监听主进程发来的模式切换（全局快捷键触发）
  useEffect(() => {
    const unsubscribe = window.clipToolAPI.onSwitchMode((mode) => {
      if (mode === 'save') {
        setActiveTab('save')
        setTriggerRead((prev) => prev + 1)
      } else if (mode === 'search') {
        setActiveTab('search')
        // 延迟聚焦搜索框，等待 Tab 切换渲染完成
        setTimeout(() => {
          searchPanelRef.current?.focusSearch()
        }, 100)
      }
      // 每次唤起都重新加载数据
      loadSnippets()
    })
    return unsubscribe
  }, [loadSnippets])

  // Toast 提示
  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2000)
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
      const updated = await window.clipToolAPI.copyToClipboard(snippet.id, snippet.content)
      setSnippets(updated)
      showToast('✓ 已复制到剪贴板')
    } catch (error) {
      console.error('复制失败:', error)
    }
  }, [showToast])

  // 复制并关闭窗口
  const handleCopyAndClose = useCallback(async (snippet: SnippetData) => {
    try {
      const updated = await window.clipToolAPI.copyToClipboard(snippet.id, snippet.content)
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

  // 注册窗口内快捷键
  useShortcuts({
    activeTab,
    // Enter：保存模式下保存并关闭
    onEnterSave: () => {
      savePanelRef.current?.doSave()
    },
    // ⌘C / Enter（搜索模式）：复制选中项并关闭
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
    onEscape: () => {
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
      const tabKeys: TabType[] = ['save', 'search', 'favorite', 'settings']
      setActiveTab((prev) => {
        const currentIndex = tabKeys.indexOf(prev)
        let nextIndex: number
        if (direction === 'left') {
          nextIndex = currentIndex <= 0 ? tabKeys.length - 1 : currentIndex - 1
        } else {
          nextIndex = currentIndex >= tabKeys.length - 1 ? 0 : currentIndex + 1
        }
        const nextTab = tabKeys[nextIndex]
        // 切换到搜索模式时自动聚焦搜索框
        if (nextTab === 'search') {
          setTimeout(() => {
            searchPanelRef.current?.focusSearch()
          }, 100)
        }
        return nextTab
      })
    },
    // 双击空格关闭窗口
    onClose: () => {
      window.clipToolAPI.hideWindow()
    },
  })

  const tabs: { key: TabType; label: string; hint: string }[] = [
    { key: 'save', label: '📋 保存', hint: shortcutHints.save },
    { key: 'search', label: '🔍 搜索', hint: shortcutHints.search },
    { key: 'favorite', label: '⭐ 收藏', hint: '' },
    { key: 'settings', label: '⚙ 设置', hint: '' },
  ]

  return (
    <div className="app-container">
      {/* 可拖拽区域（窗口标题栏） */}
      <div className="drag-region" />

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
        {activeTab === 'search' && (
          <SearchPanel
            ref={searchPanelRef}
            snippets={snippets}
            onCopy={handleCopyAndClose}
            onDelete={handleDelete}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        {activeTab === 'favorite' && (
          <FavoritePanel
            snippets={snippets}
            onCopy={handleCopy}
            onDelete={handleDelete}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        {activeTab === 'settings' && <SettingsPanel onShortcutsChanged={loadShortcutHints} />}
      </div>

      {/* Toast 提示 */}
      {toast && <div className="toast">{toast}</div>}

      {/* 窗口拉伸手柄 */}
      <div className="resize-handle" />
    </div>
  )
}

export default App
