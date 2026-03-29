/**
 * 设置面板组件
 * 支持用户自定义全局快捷键和管理预设标签
 */
import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import type { ShortcutConfig, CosConfig, StorageMode, AiModelConfig, PageVisibility } from '../types'
import { getTagColor, registerTags } from '../utils/tagColor'

/** 将 Electron accelerator 格式转换为可读的按键显示 */
function formatShortcutDisplay(accelerator: string): string {
  if (!accelerator) return '未设置'
  return accelerator
    .replace(/CommandOrControl/g, '⌘')
    .replace(/CmdOrCtrl/g, '⌘')
    .replace(/Command/g, '⌘')
    .replace(/Control/g, '⌃')
    .replace(/Shift/g, '⇧')
    .replace(/Alt/g, '⌥')
    .replace(/Option/g, '⌥')
    .replace(/\+/g, ' ')
}

/** 将键盘事件转换为 Electron accelerator 格式 */
function keyEventToAccelerator(e: KeyboardEvent): string | null {
  // 必须有修饰键
  if (!e.metaKey && !e.ctrlKey && !e.altKey) return null

  const parts: string[] = []

  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  // 过滤掉单独的修饰键
  const ignoredKeys = ['Meta', 'Control', 'Shift', 'Alt', 'CapsLock', 'Tab']
  if (ignoredKeys.includes(e.key)) return null

  // 获取实际按键
  let key = e.key.toUpperCase()

  // 特殊键映射
  const specialKeys: Record<string, string> = {
    ' ': 'Space',
    'ARROWUP': 'Up',
    'ARROWDOWN': 'Down',
    'ARROWLEFT': 'Left',
    'ARROWRIGHT': 'Right',
    'BACKSPACE': 'Backspace',
    'DELETE': 'Delete',
    'ENTER': 'Return',
    'ESCAPE': 'Escape',
  }
  if (specialKeys[key]) {
    key = specialKeys[key]
  }

  parts.push(key)
  return parts.join('+')
}

interface ShortcutItemProps {
  label: string
  description: string
  value: string
  isRecording: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onClear: () => void
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({
  label,
  description,
  value,
  isRecording,
  onStartRecording,
  onStopRecording,
  onClear,
}) => {
  return (
    <div className="settings-shortcut-item">
      <div className="settings-shortcut-info">
        <div className="settings-shortcut-label">{label}</div>
        <div className="settings-shortcut-desc">{description}</div>
      </div>
      <div className="settings-shortcut-actions">
        <button
          className={`settings-shortcut-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? onStopRecording : onStartRecording}
        >
          {isRecording ? (
            <span className="recording-text">按下快捷键...</span>
          ) : (
            <span className="shortcut-display">{formatShortcutDisplay(value)}</span>
          )}
        </button>
        {value && !isRecording && (
          <button className="settings-clear-btn" onClick={onClear} title="清除快捷键">
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

/** 设置面板子页面类型 */
type SettingsSection = 'save' | 'editor' | 'search' | 'launcher' | 'ai' | 'favorite' | 'profile' | 'shortcuts' | 'plugins' | 'appearance' | 'display'

/** 主题配置 */
const THEMES: { id: string; name: string; emoji: string; desc: string; dark: boolean }[] = [
  { id: 'system', name: '跟随系统', emoji: '🖥️', desc: '自动切换亮色/暗色', dark: false },
  { id: 'light', name: '纯净白', emoji: '☀️', desc: '简洁明亮，护眼舒适', dark: false },
  { id: 'dark', name: '深邃黑', emoji: '🌙', desc: '深色背景，减少眼疲劳', dark: true },
  { id: 'ocean', name: '海洋蓝', emoji: '🌊', desc: '深海色调，沉浸专注', dark: true },
  { id: 'rose', name: '玫瑰粉', emoji: '🌸', desc: '温柔粉调，优雅精致', dark: false },
  { id: 'forest', name: '森林绿', emoji: '🌿', desc: '自然绿意，清新宁静', dark: true },
  { id: 'sunset', name: '日落橙', emoji: '🌅', desc: '暖橙色调，活力充沛', dark: false },
  { id: 'purple', name: '紫罗兰', emoji: '💜', desc: '神秘紫调，创意无限', dark: true },
]

/** 设置导航按钮配置 */
const SETTINGS_NAV: { key: SettingsSection; icon: string; label: string }[] = [
  { key: 'save', icon: '📋', label: '保存' },
  { key: 'editor', icon: '✏️', label: '编辑' },
  { key: 'search', icon: '🔍', label: '搜索' },
  { key: 'launcher', icon: '🚀', label: '导航' },
  { key: 'ai', icon: '🤖', label: 'AI' },
  { key: 'favorite', icon: '⭐', label: '收藏' },
  { key: 'profile', icon: '💾', label: '存储' },
  { key: 'shortcuts', icon: '⌨️', label: '快捷键' },
  { key: 'plugins', icon: '🧩', label: '插件' },
  { key: 'appearance', icon: '🎨', label: '主题' },
  { key: 'display', icon: '👁', label: '页面' },
]

/** 预留插件列表 */
interface PluginItem {
  id: string
  icon: string
  name: string
  description: string
  status: 'coming' | 'beta' | 'active'
}

const PLUGIN_LIST: PluginItem[] = [
  {
    id: 'format-json',
    icon: '📐',
    name: 'JSON 格式化',
    description: '自动检测并格式化剪贴板中的 JSON 内容，支持压缩和美化',
    status: 'coming',
  },
  {
    id: 'translate',
    icon: '🌐',
    name: '即时翻译',
    description: '自动翻译剪贴板内容，支持中英日韩等多语言互译',
    status: 'coming',
  },
  {
    id: 'markdown-preview',
    icon: '📖',
    name: 'Markdown 预览',
    description: '实时预览剪贴板中的 Markdown 内容，支持代码高亮',
    status: 'coming',
  },
  {
    id: 'sensitive-mask',
    icon: '🔒',
    name: '敏感信息脱敏',
    description: '自动识别并遮盖密码、密钥、手机号等敏感信息',
    status: 'coming',
  },
  {
    id: 'ocr',
    icon: '👁',
    name: 'OCR 文字识别',
    description: '从剪贴板图片中提取文字内容，支持多语言识别',
    status: 'coming',
  },
  {
    id: 'workflow',
    icon: '⚡',
    name: '自动化工作流',
    description: '根据剪贴板内容自动触发预设动作，如格式转换、存储等',
    status: 'coming',
  },
]

const pluginStatusLabels: Record<PluginItem['status'], { text: string; className: string }> = {
  coming: { text: '即将推出', className: 'plugin-status-coming' },
  beta: { text: '测试中', className: 'plugin-status-beta' },
  active: { text: '已启用', className: 'plugin-status-active' },
}

/** SettingsPanel 暴露给外部的方法 */
export interface SettingsPanelRef {
  /** 左右切换设置子标签页 */
  switchNav: (direction: 'left' | 'right') => void
  /** 聚焦到设置子标签页导航栏 */
  focusNav: () => void
  /** 取消导航栏聚焦 */
  blurNav: () => void
}

const SettingsPanel = forwardRef<SettingsPanelRef, { onShortcutsChanged?: () => void; onDataChanged?: () => void; onPageVisibilityChanged?: () => void }>(({ onShortcutsChanged, onDataChanged, onPageVisibilityChanged }, ref) => {
  // 当前激活的子页面
  const [activeSection, setActiveSection] = useState<SettingsSection>('save')
  // 导航栏是否处于键盘聚焦状态
  const [navFocused, setNavFocused] = useState(false)

  // 暴露给外部的方法
  useImperativeHandle(ref, () => ({
    switchNav: (direction: 'left' | 'right') => {
      setActiveSection((prev) => {
        const currentIndex = SETTINGS_NAV.findIndex((n) => n.key === prev)
        let nextIndex: number
        if (direction === 'left') {
          nextIndex = currentIndex <= 0 ? SETTINGS_NAV.length - 1 : currentIndex - 1
        } else {
          nextIndex = currentIndex >= SETTINGS_NAV.length - 1 ? 0 : currentIndex + 1
        }
        return SETTINGS_NAV[nextIndex].key
      })
    },
    focusNav: () => {
      setNavFocused(true)
    },
    blurNav: () => {
      setNavFocused(false)
    },
  }))

  const [shortcuts, setShortcuts] = useState<ShortcutConfig>({
    openSave: '',
    openSearch: '',
    openEditor: '',
    openAi: '',
    openFavorite: '',
    openSettings: '',
    openProfile: '',
    openLauncher: '',
  })
  const [recording, setRecording] = useState<keyof ShortcutConfig | null>(null)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const originalRef = useRef<ShortcutConfig | null>(null)

  // 标签管理状态
  const [customTags, setCustomTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [tagSaveStatus, setTagSaveStatus] = useState<string | null>(null)

  // AI 生成标题配置
  const [aiTitleEnabled, setAiTitleEnabled] = useState<boolean | null>(null)

  // 编辑 — 剪贴板历史条数
  const [editorHistoryLimit, setEditorHistoryLimit] = useState(20)
  const [editingEditorLimit, setEditingEditorLimit] = useState(false)
  const [editorLimitInput, setEditorLimitInput] = useState('')
  const [editorLimitStatus, setEditorLimitStatus] = useState<string | null>(null)

  // 主题状态
  const [currentTheme, setCurrentTheme] = useState<string>('system')

  // COS 云端存储状态
  const [cosConfig, setCosConfig] = useState<CosConfig>({
    secretId: '',
    secretKey: '',
    enabled: false,
  })
  const [deviceId, setDeviceId] = useState<string>('')
  const [cosStatus, setCosStatus] = useState<string | null>(null)
  const [cosTesting, setCosTesting] = useState(false)
  const [cosSyncing, setCosSyncing] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [storageMode, setStorageModeState] = useState<StorageMode>('local')

  // AI 模型配置状态
  const [aiModels, setAiModels] = useState<AiModelConfig[]>([])
  const [aiStatus, setAiStatus] = useState<string | null>(null)
  const [showAiSecretKeys, setShowAiSecretKeys] = useState<Record<number, boolean>>({})


  // 导航分类管理状态
  const [launcherCategories, setLauncherCategories] = useState<string[]>([])
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [categorySaveStatus, setCategorySaveStatus] = useState<string | null>(null)
  // 导航分类拖拽排序状态（必须在组件顶层声明）
  const [catDragIndex, setCatDragIndex] = useState<number | null>(null)
  const [catDragOverIndex, setCatDragOverIndex] = useState<number | null>(null)

  // 页面可见性配置状态
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

  // 加载当前快捷键配置
  useEffect(() => {
    window.clipToolAPI.getShortcuts().then((config) => {
      setShortcuts(config)
      originalRef.current = { ...config }
    })
    // 加载自定义标签
    window.clipToolAPI.getCustomTags().then((tags) => {
      setCustomTags(tags)
      registerTags(tags)
    })
    // 加载剪贴板历史条数限制
    window.clipToolAPI.getClipboardHistoryLimit().then((limit) => {
      setEditorHistoryLimit(limit)
      setEditorLimitInput(String(limit))
    })
    // 加载 COS 配置和设备 ID
    window.clipToolAPI.getCosConfig().then(setCosConfig)
    window.clipToolAPI.getDeviceId().then(setDeviceId)
    // 加载存储模式
    window.clipToolAPI.getStorageMode().then(setStorageModeState)
    // 加载 AI 模型配置
    window.clipToolAPI.getAiModels().then(setAiModels)
    // 加载导航分类
    window.clipToolAPI.getLauncherCategories().then(setLauncherCategories)
    // 加载 AI 标题配置
    window.clipToolAPI.getAiTitleEnabled().then(setAiTitleEnabled)

    // 加载主题
    window.clipToolAPI.getTheme().then(setCurrentTheme)
    // 加载页面可见性配置
    window.clipToolAPI.getPageVisibility().then(setPageVisibility)
  }, [])

  // 录制快捷键
  useEffect(() => {
    if (!recording) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // 按 Escape 取消录制
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }

      const accelerator = keyEventToAccelerator(e)
      if (accelerator) {
        setShortcuts((prev) => {
          const next = { ...prev, [recording]: accelerator }
          setHasChanges(
            JSON.stringify(next) !== JSON.stringify(originalRef.current)
          )
          return next
        })
        setRecording(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recording])

  // 清除某个快捷键
  const handleClear = useCallback((key: keyof ShortcutConfig) => {
    setShortcuts((prev) => {
      const next = { ...prev, [key]: '' }
      setHasChanges(
        JSON.stringify(next) !== JSON.stringify(originalRef.current)
      )
      return next
    })
  }, [])

  // 保存配置
  const handleSave = useCallback(async () => {
    try {
      const saved = await window.clipToolAPI.saveShortcuts(shortcuts)
      setShortcuts(saved)
      originalRef.current = { ...saved }
      setHasChanges(false)
      setSaveStatus('✓ 快捷键已保存')
      // 通知父组件快捷键已更新
      onShortcutsChanged?.()
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error('保存快捷键配置失败:', error)
      setSaveStatus('✕ 保存失败')
      setTimeout(() => setSaveStatus(null), 2000)
    }
  }, [shortcuts])

  // 重置为默认
  const handleReset = useCallback(async () => {
    const defaults: ShortcutConfig = {
      openSave: 'CommandOrControl+Shift+K',
      openSearch: 'CommandOrControl+Shift+S',
      openEditor: '',
      openAi: '',
      openFavorite: '',
      openSettings: '',
      openProfile: '',
      openLauncher: '',
    }
    setShortcuts(defaults)
    setHasChanges(
      JSON.stringify(defaults) !== JSON.stringify(originalRef.current)
    )
  }, [])

  // ===== 标签管理 =====
  const handleAddTag = useCallback(async () => {
    const tag = newTagInput.trim()
    if (!tag) return
    if (customTags.includes(tag)) {
      setTagSaveStatus('⚠ 标签已存在')
      setTimeout(() => setTagSaveStatus(null), 2000)
      return
    }
    const updated = [...customTags, tag]
    const saved = await window.clipToolAPI.saveCustomTags(updated)
    setCustomTags(saved)
    registerTags(saved)
    setNewTagInput('')
    setTagSaveStatus('✓ 已添加')
    setTimeout(() => setTagSaveStatus(null), 2000)
  }, [newTagInput, customTags])

  const handleRemoveTag = useCallback(async (tag: string) => {
    const updated = customTags.filter((t) => t !== tag)
    const saved = await window.clipToolAPI.saveCustomTags(updated)
    setCustomTags(saved)
    registerTags(saved)
  }, [customTags])

  // ===== 拖拽排序 =====
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(async (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const updated = [...customTags]
    const [removed] = updated.splice(dragIndex, 1)
    updated.splice(index, 0, removed)
    const saved = await window.clipToolAPI.saveCustomTags(updated)
    setCustomTags(saved)
    registerTags(saved)
    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex, customTags])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  // ===== 存储模式切换 =====
  const handleStorageModeChange = useCallback(async (mode: StorageMode) => {
    try {
      const saved = await window.clipToolAPI.setStorageMode(mode)
      setStorageModeState(saved)
      // 同步更新 COS enabled 状态
      setCosConfig((prev) => ({ ...prev, enabled: mode === 'cos' }))
      setCosStatus(mode === 'cos' ? '☁️ 已切换为云端存储模式' : '💾 已切换为本地存储模式')
      setTimeout(() => setCosStatus(null), 2000)
    } catch (error) {
      setCosStatus('✕ 切换存储模式失败')
      setTimeout(() => setCosStatus(null), 2000)
    }
  }, [])

  // ===== COS 云端存储 =====
  const handleSaveCosConfig = useCallback(async () => {
    try {
      const saved = await window.clipToolAPI.saveCosConfig(cosConfig)
      setCosConfig(saved)
      setCosStatus('✓ COS 配置已保存')
      setTimeout(() => setCosStatus(null), 2000)
    } catch (error) {
      console.error('保存 COS 配置失败:', error)
      setCosStatus('✕ 保存失败')
      setTimeout(() => setCosStatus(null), 2000)
    }
  }, [cosConfig])

  const handleTestConnection = useCallback(async () => {
    setCosTesting(true)
    setCosStatus(null)
    try {
      // 先保存配置
      await window.clipToolAPI.saveCosConfig(cosConfig)
      const result = await window.clipToolAPI.testCosConnection()
      setCosStatus(result.success ? '✓ 连接成功' : `✕ ${result.message}`)
      setTimeout(() => setCosStatus(null), 3000)
    } catch (error) {
      setCosStatus('✕ 连接测试失败')
      setTimeout(() => setCosStatus(null), 3000)
    } finally {
      setCosTesting(false)
    }
  }, [cosConfig])

  const handlePushToCloud = useCallback(async () => {
    setCosSyncing(true)
    setCosStatus(null)
    try {
      const [snippetOk, tagOk, settingsOk] = await Promise.all([
        window.clipToolAPI.pushSnippets(),
        window.clipToolAPI.pushTags(),
        window.clipToolAPI.pushSettings(),
      ])
      if (snippetOk && tagOk && settingsOk) {
        setCosStatus('✓ 数据和设置已推送到云端')
      } else {
        setCosStatus('⚠ 部分数据推送失败')
      }
      setTimeout(() => setCosStatus(null), 3000)
    } catch (error) {
      setCosStatus('✕ 推送失败')
      setTimeout(() => setCosStatus(null), 3000)
    } finally {
      setCosSyncing(false)
    }
  }, [])

  const handlePullFromCloud = useCallback(async () => {
    setCosSyncing(true)
    setCosStatus(null)
    try {
      const [snippets, tags, settings] = await Promise.all([
        window.clipToolAPI.pullSnippets(),
        window.clipToolAPI.pullTags(),
        window.clipToolAPI.pullSettings(),
      ])
      const results: string[] = []
      if (snippets !== null) {
        results.push(`${snippets.length} 条片段`)
      }
      if (tags !== null) {
        setCustomTags(tags)
        results.push(`${tags.length} 个标签`)
      }
      if (settings !== null) {
        const settingCount = Object.keys(settings).length
        results.push(`${settingCount} 项设置`)
        // 刷新当前页面的设置状态
        if (settings.shortcuts) setShortcuts(settings.shortcuts as ShortcutConfig)
        if (settings.customTags) {
          setCustomTags(settings.customTags as string[])
          registerTags(settings.customTags as string[])
        }
        if (settings.clipboardHistoryLimit !== undefined) {
          setEditorHistoryLimit(settings.clipboardHistoryLimit as number)
          setEditorLimitInput(String(settings.clipboardHistoryLimit))
        }
        if (settings.aiModels) setAiModels(settings.aiModels as AiModelConfig[])
        if (settings.aiTitleEnabled !== undefined) setAiTitleEnabled(settings.aiTitleEnabled as boolean)
        if (settings.launcherCategories) setLauncherCategories(settings.launcherCategories as string[])
      }
      if (results.length > 0) {
        setCosStatus(`✓ 已从云端拉取 ${results.join('、')}`)
        onDataChanged?.()
        onShortcutsChanged?.()
      } else {
        setCosStatus('⚠ 部分数据拉取失败')
      }
      setTimeout(() => setCosStatus(null), 3000)
    } catch (error) {
      setCosStatus('✕ 拉取失败')
      setTimeout(() => setCosStatus(null), 3000)
    } finally {
      setCosSyncing(false)
    }
  }, [])

  const shortcutItems: {
    key: keyof ShortcutConfig
    label: string
    description: string
  }[] = [
    {
      key: 'openSave',
      label: '📋 唤起保存',
      description: '打开窗口并进入保存模式，自动读取剪贴板',
    },
    {
      key: 'openSearch',
      label: '🔍 唤起搜索',
      description: '打开窗口并进入搜索模式，自动聚焦搜索框',
    },
    {
      key: 'openEditor',
      label: '✏️ 唤起编辑',
      description: '打开窗口并进入编辑页面',
    },
    {
      key: 'openAi',
      label: '🤖 唤起 AI',
      description: '打开窗口并进入 AI 页面',
    },
    {
      key: 'openFavorite',
      label: '⭐ 唤起收藏',
      description: '打开窗口并进入收藏页面',
    },
    {
      key: 'openSettings',
      label: '⚙ 唤起设置',
      description: '打开窗口并进入设置页面',
    },
    {
      key: 'openProfile',
      label: '👤 唤起我的',
      description: '打开窗口并进入个人中心页面',
    },
    {
      key: 'openLauncher',
      label: '🚀 唤起导航',
      description: '打开窗口并进入快速导航页面',
    },
  ]

  // ===== 渲染各子页面 =====

  /** 快捷键设置子页面（合并全局快捷键 + 窗口内快捷键） */
  const renderShortcutsPage = () => (
    <>
      <div className="settings-section">
        <div className="settings-section-title">⌨️ 全局快捷键</div>
        <div className="settings-section-hint">
          点击按键区域后按下新的快捷键组合，按 Esc 取消录制
        </div>

        <div className="settings-shortcut-list">
          {shortcutItems.map((item) => (
            <ShortcutItem
              key={item.key}
              label={item.label}
              description={item.description}
              value={shortcuts[item.key]}
              isRecording={recording === item.key}
              onStartRecording={() => setRecording(item.key)}
              onStopRecording={() => setRecording(null)}
              onClear={() => handleClear(item.key)}
            />
          ))}
        </div>
      </div>

      {/* 操作区域 */}
      <div className="settings-footer">
        {saveStatus && (
          <span className={`settings-status ${saveStatus.startsWith('✓') ? 'success' : 'error'}`}>
            {saveStatus}
          </span>
        )}
        <div className="settings-footer-actions">
          <button className="settings-reset-btn" onClick={handleReset}>
            恢复默认
          </button>
          <button
            className="settings-save-btn"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            保存设置
          </button>
        </div>
      </div>

      {/* 窗口内快捷键说明 */}
      <div className="settings-section" style={{ marginTop: 8 }}>
        <div className="settings-section-title">💡 窗口内快捷键</div>
        <div className="settings-section-hint">
          以下快捷键在窗口激活时生效，不可自定义
        </div>
        <div className="settings-builtin-list">
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">Enter</span>
            <span className="settings-builtin-desc">保存模式下保存并关闭</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">⌘C / Enter</span>
            <span className="settings-builtin-desc">搜索模式下复制选中项</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">← / →</span>
            <span className="settings-builtin-desc">切换 Tab 页面</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">↑ / ↓</span>
            <span className="settings-builtin-desc">搜索结果导航 / 编辑页选择剪贴板历史</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">空格 × 2</span>
            <span className="settings-builtin-desc">快速关闭窗口</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">Esc</span>
            <span className="settings-builtin-desc">关闭窗口</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">⌘ 1~9</span>
            <span className="settings-builtin-desc">快速复制第 N 项</span>
          </div>
        </div>
      </div>
    </>
  )

  /** 保存设置子页面（预设标签管理） */
  const renderSavePage = () => (
    <div className="settings-section">
      <div className="settings-section-title">📋 保存 — 智能标题</div>
      <div className="settings-section-hint">
        启用后，保存片段时将自动调用 AI 大模型为剪贴板内容生成简短标题（需先在 AI 页面配置模型密钥）
      </div>

      <div className="settings-config-item" style={{ marginBottom: 16 }}>
        <div className="settings-config-info">
          <div className="settings-config-label">🤖 AI 自动生成标题</div>
          <div className="settings-config-desc">保存时自动使用大模型分析内容并生成标题，替代默认的前30字截取</div>
        </div>
        <div className="settings-config-action">
          {aiTitleEnabled === null ? (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>加载中...</span>
          ) : (
            <label className="settings-cos-switch" title={aiTitleEnabled ? '已启用' : '未启用'}>
              <input
                type="checkbox"
                checked={aiTitleEnabled}
                onChange={async (e) => {
                  const enabled = e.target.checked
                  const saved = await window.clipToolAPI.setAiTitleEnabled(enabled)
                  setAiTitleEnabled(saved)
                }}
              />
              <span className="settings-cos-slider"></span>
            </label>
          )}
        </div>
      </div>

      <div className="settings-section-title">📋 保存 — 预设标签管理</div>
      <div className="settings-section-hint">
        管理保存片段时可快速选择的预设标签
      </div>

      {/* 添加标签 */}
      <div className="settings-tag-add-row">
        <input
          className="text-input"
          type="text"
          value={newTagInput}
          onChange={(e) => setNewTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newTagInput.trim()) {
              e.preventDefault()
              handleAddTag()
            }
          }}
          placeholder="输入新标签名称，回车添加"
          style={{ flex: 1 }}
        />
        <button
          className="settings-tag-add-btn"
          onClick={handleAddTag}
          disabled={!newTagInput.trim()}
        >
          添加
        </button>
      </div>

      {tagSaveStatus && (
        <span className={`settings-status ${tagSaveStatus.startsWith('✓') ? 'success' : 'warning'}`}
              style={{ fontSize: 12, marginTop: 4 }}>
          {tagSaveStatus}
        </span>
      )}

      {/* 标签列表（拖拽排序） */}
      <div className="settings-tag-list">
        {customTags.length === 0 ? (
          <div className="settings-tag-empty">暂无预设标签，请添加</div>
        ) : (
          customTags.map((tag, index) => (
            <div
              key={tag}
              className={`settings-tag-item${
                dragIndex === index ? ' dragging' : ''
              }${dragOverIndex === index && dragIndex !== index ? ' drag-over' : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
            >
              <span className="settings-tag-drag-handle" title="拖拽排序">⠿</span>
              <span className="settings-tag-index">{index + 1}</span>
              <span
                className="settings-launcher-category-preview"
                style={{ background: getTagColor(tag).bg, color: getTagColor(tag).text }}
              >
                {tag}
              </span>
              <button
                className="settings-tag-remove-btn"
                onClick={() => handleRemoveTag(tag)}
                title="删除标签"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )

  /** 编辑设置子页面（剪贴板历史条数配置） */
  const renderEditorPage = () => {
    const handleSaveEditorLimit = async () => {
      const num = parseInt(editorLimitInput, 10)
      if (isNaN(num) || num < 1 || num > 500) {
        setEditorLimitStatus('⚠ 请输入 1~500 之间的数字')
        setTimeout(() => setEditorLimitStatus(null), 2000)
        return
      }
      const saved = await window.clipToolAPI.setClipboardHistoryLimit(num)
      setEditorHistoryLimit(saved)
      setEditingEditorLimit(false)
      setEditorLimitStatus(`✓ 已设置最多保存 ${saved} 条`)
      setTimeout(() => setEditorLimitStatus(null), 2000)
    }

    return (
      <div className="settings-section">
        <div className="settings-section-title">✏️ 编辑设置</div>
        <div className="settings-section-hint">
          配置编辑页面的行为参数
        </div>

        <div className="settings-editor-config">
          <div className="settings-config-item">
            <div className="settings-config-info">
              <div className="settings-config-label">📋 剪贴板历史最大条数</div>
              <div className="settings-config-desc">控制编辑页面下方剪贴板历史列表保存的最大条数（1~500），超出后自动移除旧记录</div>
            </div>
            <div className="settings-config-action">
              {editingEditorLimit ? (
                <div className="editor-limit-edit">
                  <input
                    className="text-input editor-limit-input"
                    type="number"
                    min={1}
                    max={500}
                    value={editorLimitInput}
                    onChange={(e) => setEditorLimitInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEditorLimit()
                      if (e.key === 'Escape') setEditingEditorLimit(false)
                    }}
                    autoFocus
                  />
                  <button className="editor-limit-btn" onClick={handleSaveEditorLimit}>✓</button>
                  <button className="editor-limit-btn cancel" onClick={() => setEditingEditorLimit(false)}>✕</button>
                </div>
              ) : (
                <button
                  className="editor-limit-tag"
                  onClick={() => {
                    setEditorLimitInput(String(editorHistoryLimit))
                    setEditingEditorLimit(true)
                  }}
                  title="点击修改"
                >
                  {editorHistoryLimit} 条
                </button>
              )}
            </div>
          </div>
        </div>

        {editorLimitStatus && (
          <span className={`settings-status ${editorLimitStatus.startsWith('✓') ? 'success' : 'warning'}`}
                style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            {editorLimitStatus}
          </span>
        )}
      </div>
    )
  }

  /** 存储设置子页面 */
  const renderStoragePage = () => (
    <>
      {/* 存储模式选择 */}
      <div className="settings-section">
        <div className="settings-section-title">💾 存储配置 — 存储模式</div>
        <div className="settings-section-hint">
          选择数据存储方式：本地存储仅保存在当前设备，云端存储支持多设备同步
        </div>
        <div className="settings-storage-mode">
          <div
            className={`settings-storage-option ${storageMode === 'local' ? 'active' : ''}`}
            onClick={() => handleStorageModeChange('local')}
          >
            <span className="settings-storage-icon">💾</span>
            <div className="settings-storage-info">
              <div className="settings-storage-name">本地存储</div>
              <div className="settings-storage-desc">数据保存在本地，快速且无网络依赖</div>
            </div>
            {storageMode === 'local' && <span className="settings-storage-check">✓</span>}
          </div>
          <div
            className={`settings-storage-option ${storageMode === 'cos' ? 'active' : ''}`}
            onClick={() => handleStorageModeChange('cos')}
          >
            <span className="settings-storage-icon">☁️</span>
            <div className="settings-storage-info">
              <div className="settings-storage-name">COS 云端存储</div>
              <div className="settings-storage-desc">数据同步到腾讯云 COS，支持多设备共享</div>
            </div>
            {storageMode === 'cos' && <span className="settings-storage-check">✓</span>}
          </div>
        </div>
      </div>

      {/* COS 云端存储配置 */}
      <div className="settings-section" style={{ opacity: storageMode === 'cos' ? 1 : 0.5, pointerEvents: storageMode === 'cos' ? 'auto' : 'none' }}>
        <div className="settings-section-title">☁️ 云端存储配置（腾讯云 COS）</div>
        <div className="settings-section-hint">
          配置腾讯云 COS 密钥，片段数据和所有设置将自动同步到云端。设备 ID：<code style={{ fontSize: 11, color: '#8b949e', userSelect: 'all' }}>{deviceId || '获取中...'}</code>
        </div>

        {/* SecretId 输入 */}
        <div className="settings-cos-field">
          <label className="settings-cos-label">SecretId</label>
          <input
            className="text-input"
            type="text"
            value={cosConfig.secretId}
            onChange={(e) => setCosConfig((prev) => ({ ...prev, secretId: e.target.value }))}
            placeholder="输入腾讯云 SecretId"
            spellCheck={false}
          />
        </div>

        {/* SecretKey 输入 */}
        <div className="settings-cos-field">
          <label className="settings-cos-label">SecretKey</label>
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            <input
              className="text-input"
              type={showSecretKey ? 'text' : 'password'}
              value={cosConfig.secretKey}
              onChange={(e) => setCosConfig((prev) => ({ ...prev, secretKey: e.target.value }))}
              placeholder="输入腾讯云 SecretKey"
              style={{ flex: 1 }}
              spellCheck={false}
            />
            <button
              className="settings-cos-toggle-btn"
              onClick={() => setShowSecretKey(!showSecretKey)}
              title={showSecretKey ? '隐藏' : '显示'}
            >
              {showSecretKey ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {/* 同步状态（由存储模式自动控制） */}
        <div className="settings-cos-field">
          <label className="settings-cos-label">同步状态</label>
          <span style={{ fontSize: 12, color: storageMode === 'cos' ? '#34c759' : '#8b949e' }}>
            {storageMode === 'cos' ? '✓ 已启用 - 数据变更自动同步' : '未启用（请切换为云端存储模式）'}
          </span>
        </div>

        {/* 状态提示 */}
        {cosStatus && (
          <div className={`settings-status ${cosStatus.startsWith('✓') ? 'success' : cosStatus.startsWith('⚠') ? 'warning' : 'error'}`}
               style={{ fontSize: 12, marginTop: 4, marginBottom: 4 }}>
            {cosStatus}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="settings-cos-actions">
          <button
            className="settings-cos-btn"
            onClick={handleSaveCosConfig}
            disabled={!cosConfig.secretId || !cosConfig.secretKey}
          >
            💾 保存配置
          </button>
          <button
            className="settings-cos-btn"
            onClick={handleTestConnection}
            disabled={!cosConfig.secretId || !cosConfig.secretKey || cosTesting}
          >
            {cosTesting ? '⏳ 测试中...' : '🔗 测试连接'}
          </button>
          <button
            className="settings-cos-btn primary"
            onClick={handlePushToCloud}
            disabled={!cosConfig.secretId || !cosConfig.secretKey || cosSyncing}
          >
            {cosSyncing ? '⏳ 同步中...' : '⬆️ 推送到云端'}
          </button>
          <button
            className="settings-cos-btn"
            onClick={handlePullFromCloud}
            disabled={!cosConfig.secretId || !cosConfig.secretKey || cosSyncing}
          >
            {cosSyncing ? '⏳ 同步中...' : '⬇️ 从云端拉取'}
          </button>
        </div>

        {/* 同步说明 */}
        <div className="settings-section-hint" style={{ marginTop: 8 }}>
          💡 推送/拉取会同步：片段数据、标签、快捷键、AI 模型配置、导航分类、快速链接等所有设置
        </div>
      </div>
    </>
  )

  /** 插件子页面（预留功能） */
  const renderPluginsPage = () => (
    <div className="settings-section">
      <div className="settings-section-title">🧩 插件市场</div>
      <div className="settings-section-hint">
        通过插件扩展 ClipTool 的能力，以下插件正在开发中
      </div>
      <div className="plugin-grid">
        {PLUGIN_LIST.map((plugin) => {
          const status = pluginStatusLabels[plugin.status]
          return (
            <div key={plugin.id} className="plugin-card">
              <div className="plugin-card-header">
                <span className="plugin-card-icon">{plugin.icon}</span>
                <span className={`plugin-card-status ${status.className}`}>{status.text}</span>
              </div>
              <div className="plugin-card-name">{plugin.name}</div>
              <div className="plugin-card-desc">{plugin.description}</div>
            </div>
          )
        })}
      </div>

      {/* 底部提示 */}
      <div className="plugin-footer">
        <span className="plugin-footer-text">🔧 更多插件持续开发中，敬请期待...</span>
      </div>
    </div>
  )

  /** 导航设置子页面（分类标签管理） */
  const renderLauncherPage = () => {
    const handleAddCategory = async () => {
      const cat = newCategoryInput.trim()
      if (!cat) return
      if (launcherCategories.includes(cat)) {
        setCategorySaveStatus('⚠ 分类已存在')
        setTimeout(() => setCategorySaveStatus(null), 2000)
        return
      }
      const updated = [...launcherCategories, cat]
      const saved = await window.clipToolAPI.saveLauncherCategories(updated)
      setLauncherCategories(saved)
      setNewCategoryInput('')
      setCategorySaveStatus('✓ 已添加')
      setTimeout(() => setCategorySaveStatus(null), 2000)
    }

    const handleRemoveCategory = async (cat: string) => {
      const updated = launcherCategories.filter((c) => c !== cat)
      const saved = await window.clipToolAPI.saveLauncherCategories(updated)
      setLauncherCategories(saved)
    }

    const handleCatDrop = async (index: number) => {
      if (catDragIndex === null || catDragIndex === index) {
        setCatDragIndex(null)
        setCatDragOverIndex(null)
        return
      }
      const updated = [...launcherCategories]
      const [removed] = updated.splice(catDragIndex, 1)
      updated.splice(index, 0, removed)
      const saved = await window.clipToolAPI.saveLauncherCategories(updated)
      setLauncherCategories(saved)
      setCatDragIndex(null)
      setCatDragOverIndex(null)
    }

    return (
      <div className="settings-section">
        <div className="settings-section-title">🚀 导航 — 分类标签管理</div>
        <div className="settings-section-hint">
          管理导航页面的分类标签，每个分类会自动分配颜色并显示在链接标题旁
        </div>

        {/* 添加分类 */}
        <div className="settings-tag-add-row">
          <input
            className="text-input"
            type="text"
            value={newCategoryInput}
            onChange={(e) => setNewCategoryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCategoryInput.trim()) {
                e.preventDefault()
                handleAddCategory()
              }
            }}
            placeholder="输入新分类名称，回车添加"
            style={{ flex: 1 }}
          />
          <button
            className="settings-tag-add-btn"
            onClick={handleAddCategory}
            disabled={!newCategoryInput.trim()}
          >
            添加
          </button>
        </div>

        {categorySaveStatus && (
          <span className={`settings-status ${categorySaveStatus.startsWith('✓') ? 'success' : 'warning'}`}
                style={{ fontSize: 12, marginTop: 4 }}>
            {categorySaveStatus}
          </span>
        )}

        {/* 分类列表（拖拽排序） */}
        <div className="settings-tag-list">
          {launcherCategories.length === 0 ? (
            <div className="settings-tag-empty">暂无分类标签，请添加</div>
          ) : (
            launcherCategories.map((cat, index) => {
              const color = getTagColor(cat)
              return (
                <div
                  key={cat}
                  className={`settings-tag-item${
                    catDragIndex === index ? ' dragging' : ''
                  }${catDragOverIndex === index && catDragIndex !== index ? ' drag-over' : ''}`}
                  draggable
                  onDragStart={() => setCatDragIndex(index)}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setCatDragOverIndex(index) }}
                  onDrop={() => handleCatDrop(index)}
                  onDragEnd={() => { setCatDragIndex(null); setCatDragOverIndex(null) }}
                >
                  <span className="settings-tag-drag-handle" title="拖拽排序">⠿</span>
                  <span className="settings-tag-index">{index + 1}</span>
                  <span
                    className="settings-launcher-category-preview"
                    style={{ background: color.bg, color: color.text }}
                  >
                    {cat}
                  </span>
                  <button
                    className="settings-tag-remove-btn"
                    onClick={() => handleRemoveCategory(cat)}
                    title="删除分类"
                  >
                    ✕
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  /** AI 模型配置子页面 */
  const renderAiConfigPage = () => {
    /** 模型提供商列表 */
    const AI_PROVIDERS: { key: AiModelConfig['provider']; name: string; icon: string; models: string[]; needSecretId: boolean }[] = [
      {
        key: 'hunyuan',
        name: '腾讯混元',
        icon: '🤖',
        models: ['hunyuan-lite', 'hunyuan-standard', 'hunyuan-pro'],
        needSecretId: true,  // 混元需要 SecretId + SecretKey
      },
      {
        key: 'deepseek',
        name: 'DeepSeek',
        icon: '🧠',
        models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
        needSecretId: false, // DeepSeek 只需要 API Key
      },
    ]

    const handleAddModel = (provider: AiModelConfig['provider']) => {
      const providerInfo = AI_PROVIDERS.find((p) => p.key === provider)
      if (!providerInfo) return
      // 检查是否已添加该提供商
      if (aiModels.some((m) => m.provider === provider)) {
        setAiStatus(`⚠ ${providerInfo.name} 已添加`)
        setTimeout(() => setAiStatus(null), 2000)
        return
      }
      const newModel: AiModelConfig = {
        provider,
        secretId: '',
        secretKey: '',
        model: providerInfo.models[0],
        enabled: false,
      }
      const updated = [...aiModels, newModel]
      setAiModels(updated)
    }

    const handleRemoveModel = async (index: number) => {
      const updated = aiModels.filter((_, i) => i !== index)
      const saved = await window.clipToolAPI.saveAiModels(updated)
      setAiModels(saved)
      setAiStatus('✓ 已删除')
      setTimeout(() => setAiStatus(null), 2000)
    }

    const handleUpdateModel = (index: number, data: Partial<AiModelConfig>) => {
      const updated = [...aiModels]
      updated[index] = { ...updated[index], ...data }
      // 启用一个模型时，禁用其他模型
      if (data.enabled) {
        updated.forEach((m, i) => {
          if (i !== index) m.enabled = false
        })
      }
      setAiModels(updated)
    }

    const handleSaveAiModels = async () => {
      const saved = await window.clipToolAPI.saveAiModels(aiModels)
      setAiModels(saved)
      setAiStatus('✓ AI 配置已保存')
      setTimeout(() => setAiStatus(null), 2000)
    }

    const toggleShowAiKey = (index: number) => {
      setShowAiSecretKeys((prev) => ({ ...prev, [index]: !prev[index] }))
    }

    return (
      <>
      <div className="settings-section">
        <div className="settings-section-title">🤖 AI 模型配置</div>
        <div className="settings-section-hint">
          配置 AI 大模型的密钥信息，启用后可在 AI 页面中使用对话功能。同一时间只能启用一个模型。
        </div>

        {/* 添加模型按钮 */}
        <div className="ai-provider-add-row">
          {AI_PROVIDERS.map((provider) => {
            const alreadyAdded = aiModels.some((m) => m.provider === provider.key)
            return (
              <button
                key={provider.key}
                className={`ai-provider-add-btn ${alreadyAdded ? 'added' : ''}`}
                onClick={() => handleAddModel(provider.key)}
                disabled={alreadyAdded}
              >
                <span>{provider.icon}</span>
                <span>{alreadyAdded ? `${provider.name} ✓` : `+ ${provider.name}`}</span>
              </button>
            )
          })}
        </div>

        {/* 已配置的模型列表 */}
        {aiModels.map((model, index) => {
          const providerInfo = AI_PROVIDERS.find((p) => p.key === model.provider)
          if (!providerInfo) return null
          return (
            <div key={index} className="ai-model-card">
              <div className="ai-model-card-header">
                <div className="ai-model-card-title">
                  <span>{providerInfo.icon}</span>
                  <span>{providerInfo.name}</span>
                </div>
                <div className="ai-model-card-actions">
                  {/* 启用开关 */}
                  <label className="settings-cos-switch" title={model.enabled ? '已启用' : '未启用'}>
                    <input
                      type="checkbox"
                      checked={model.enabled}
                      onChange={(e) => handleUpdateModel(index, { enabled: e.target.checked })}
                    />
                    <span className="settings-cos-slider"></span>
                  </label>
                  <button
                    className="settings-tag-remove-btn"
                    onClick={() => handleRemoveModel(index)}
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* SecretId（仅混元需要） */}
              {providerInfo.needSecretId && (
                <div className="settings-cos-field">
                  <label className="settings-cos-label">SecretId</label>
                  <input
                    className="text-input"
                    type="text"
                    value={model.secretId}
                    onChange={(e) => handleUpdateModel(index, { secretId: e.target.value })}
                    placeholder="输入 SecretId"
                    spellCheck={false}
                  />
                </div>
              )}

              {/* SecretKey / API Key */}
              <div className="settings-cos-field">
                <label className="settings-cos-label">{providerInfo.needSecretId ? 'SecretKey' : 'API Key'}</label>
                <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                  <input
                    className="text-input"
                    type={showAiSecretKeys[index] ? 'text' : 'password'}
                    value={model.secretKey}
                    onChange={(e) => handleUpdateModel(index, { secretKey: e.target.value })}
                    placeholder={`输入 ${providerInfo.needSecretId ? 'SecretKey' : 'API Key'}`}
                    style={{ flex: 1 }}
                    spellCheck={false}
                  />
                  <button
                    className="settings-cos-toggle-btn"
                    onClick={() => toggleShowAiKey(index)}
                    title={showAiSecretKeys[index] ? '隐藏' : '显示'}
                  >
                    {showAiSecretKeys[index] ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {aiModels.length === 0 && (
          <div className="settings-placeholder" style={{ padding: '20px 0' }}>
            <span className="settings-placeholder-icon">🤖</span>
            <span className="settings-placeholder-text">点击上方按钮添加 AI 模型</span>
          </div>
        )}

        {/* 状态提示和保存按钮 */}
        {aiModels.length > 0 && (
          <div className="settings-cos-actions" style={{ marginTop: 8 }}>
            <button
              className="settings-cos-btn primary"
              onClick={handleSaveAiModels}
            >
              💾 保存配置
            </button>
            {aiStatus && (
              <span className={`settings-status ${aiStatus.startsWith('✓') ? 'success' : 'warning'}`}
                    style={{ fontSize: 12 }}>
                {aiStatus}
              </span>
            )}
          </div>
        )}
      </div>
      </>
    )
  }

  /** 根据当前激活的子页面渲染内容 */
  /** 页面展示配置子页面 */
  const PAGE_DISPLAY_ITEMS: { key: keyof PageVisibility; icon: string; label: string; desc: string; required?: boolean }[] = [
    { key: 'save', icon: '📋', label: '速存', desc: '快速保存剪贴板内容' },
    { key: 'editor', icon: '✏️', label: '历史', desc: '查看和编辑剪贴板历史' },
    { key: 'search', icon: '🔍', label: '搜索', desc: '搜索已保存的片段' },
    { key: 'launcher', icon: '🚀', label: '导航', desc: '快速链接导航面板' },
    { key: 'doc', icon: '📄', label: '速记', desc: '快速记录笔记' },
    { key: 'ai', icon: '🤖', label: 'AI', desc: 'AI 智能助手' },
    { key: 'favorite', icon: '⭐', label: '收藏', desc: '收藏的片段管理' },
    { key: 'settings', icon: '⚙', label: '设置', desc: '应用设置（建议保持开启）', required: true },
    { key: 'profile', icon: '👤', label: '我的', desc: '个人中心' },
  ]

  const renderDisplayPage = () => (
    <div className="settings-section">
      <div className="settings-section-title">👁 页面展示配置</div>
      <div className="settings-section-hint">
        控制顶部 Tab 栏中各页面是否显示，关闭后对应页面将被隐藏
      </div>

      <div className="settings-display-list">
        {PAGE_DISPLAY_ITEMS.map((item) => (
          <div key={item.key} className="settings-config-item">
            <div className="settings-config-info">
              <div className="settings-config-label">{item.icon} {item.label}</div>
              <div className="settings-config-desc">{item.desc}</div>
            </div>
            <div className="settings-config-action">
              <label className="settings-cos-switch" title={pageVisibility[item.key] ? '已显示' : '已隐藏'}>
                <input
                  type="checkbox"
                  checked={pageVisibility[item.key]}
                  disabled={item.required}
                  onChange={async (e) => {
                    const newConfig = { ...pageVisibility, [item.key]: e.target.checked }
                    setPageVisibility(newConfig)
                    await window.clipToolAPI.savePageVisibility(newConfig)
                    onPageVisibilityChanged?.()
                  }}
                />
                <span className="settings-cos-slider"></span>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  /** 外观主题子页面 */
  const renderAppearancePage = () => (
    <div className="settings-section">
      <div className="settings-section-title">🎨 主题选择</div>
      <div className="settings-section-hint">
        选择你喜欢的界面主题风格，切换后立即生效
      </div>
      <div className="settings-theme-grid">
        {THEMES.map((theme) => (
          <div
            key={theme.id}
            className={`settings-theme-card ${currentTheme === theme.id ? 'active' : ''} theme-preview-${theme.id}`}
            onClick={async () => {
              setCurrentTheme(theme.id)
              document.documentElement.setAttribute('data-theme', theme.id)
              await window.clipToolAPI.setTheme(theme.id)
            }}
          >
            <div className="settings-theme-emoji">{theme.emoji}</div>
            <div className="settings-theme-name">{theme.name}</div>
            <div className="settings-theme-desc">{theme.desc}</div>
            {currentTheme === theme.id && (
              <div className="settings-theme-check">✓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'appearance': return renderAppearancePage()
      case 'save': return renderSavePage()
      case 'editor': return renderEditorPage()
      case 'search': return renderPlaceholderPage('🔍', '搜索', '搜索功能目前无额外配置项')
      case 'launcher': return renderLauncherPage()
      case 'ai': return renderAiConfigPage()
      case 'favorite': return renderPlaceholderPage('⭐', '收藏', '收藏功能目前无额外配置项')
      case 'profile': return renderStoragePage()
      case 'shortcuts': return renderShortcutsPage()
      case 'plugins': return renderPluginsPage()
      case 'display': return renderDisplayPage()
      default: return null
    }
  }

  /** 占位页（暂无配置项的页面） */
  const renderPlaceholderPage = (icon: string, title: string, desc: string) => (
    <div className="settings-section">
      <div className="settings-section-title">{icon} {title} 设置</div>
      <div className="settings-placeholder">
        <span className="settings-placeholder-icon">{icon}</span>
        <span className="settings-placeholder-text">{desc}</span>
      </div>
    </div>
  )

  return (
    <div className="settings-panel">
      {/* 横向导航按钮栏 */}
      <div className={`settings-nav-bar ${navFocused ? 'nav-focused' : ''}`}>
        {SETTINGS_NAV.map((nav) => (
          <button
            key={nav.key}
            className={`settings-nav-btn ${activeSection === nav.key ? 'active' : ''}`}
            onClick={() => {
              setActiveSection(nav.key)
              setNavFocused(false)
            }}
          >
            <span className="settings-nav-icon">{nav.icon}</span>
            <span className="settings-nav-label">{nav.label}</span>
          </button>
        ))}
      </div>

      {/* 子页面内容区域 */}
      <div className="settings-page-content">
        {renderContent()}
      </div>
    </div>
  )
})

export default SettingsPanel
