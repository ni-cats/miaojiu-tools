/**
 * 设置面板组件
 * 支持用户自定义全局快捷键和管理预设标签
 */
import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useMemo } from 'react'
import type { ShortcutConfig, CosConfig, StorageMode, AiModelConfig, PageVisibility, YuqueConfig, YuqueRepo } from '../types'
import { getTagColor, registerTags } from '../utils/tagColor'
import { TabSaveIcon, TabEditorIcon, TabSearchIcon, TabLauncherIcon, TabDocIcon, TabAiIcon, TabFavoriteIcon, TabSettingsIcon, TabProfileIcon, IconBot, IconClipboard, IconPlugin, IconSettings, NavConfigIcon, NavShortcutIcon, NavThemeIcon, NavPageIcon, NavPluginIcon, IconFont, IconTag, IconPreview, IconTranslate, IconToJSON, IconOCR, IconSensitive, IconWorkflow } from './TabIcons'
import { Brain, Keyboard, Lightbulb, Eye, Palette, Wrench } from 'lucide-react'

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

  // 特殊键映射（基于 e.key）
  const specialKeyMap: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'Enter': 'Return',
    'Escape': 'Escape',
  }
  if (specialKeyMap[e.key]) {
    parts.push(specialKeyMap[e.key])
    return parts.join('+')
  }

  // F1-F12 功能键
  if (/^F([1-9]|1[0-2])$/.test(e.key)) {
    parts.push(e.key)
    return parts.join('+')
  }

  // 使用 e.code 从物理按键推断实际键名
  // 这样可以正确处理 Shift+数字键（macOS 上 e.key 会返回符号如 !@# 而非数字）
  const code = e.code
  if (code.startsWith('Key')) {
    // 字母键：KeyA → A
    parts.push(code.slice(3).toUpperCase())
    return parts.join('+')
  }
  if (code.startsWith('Digit')) {
    // 数字键：Digit1 → 1
    parts.push(code.slice(5))
    return parts.join('+')
  }

  // 其他键：使用 e.key 的大写形式
  const key = e.key.toUpperCase()
  // 过滤掉不可识别的键（如 Dead、Unidentified 等）
  if (key === 'DEAD' || key === 'UNIDENTIFIED' || key.length > 10) return null

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
type SettingsSection = 'general' | 'config' | 'shortcuts' | 'plugins' | 'appearance' | 'display'

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
const SETTINGS_NAV: { key: SettingsSection; icon: React.ReactNode; label: string }[] = [
  { key: 'general', icon: <IconSettings size={14} />, label: '通用' },
  { key: 'config', icon: <NavConfigIcon size={14} />, label: '配置' },
  { key: 'shortcuts', icon: <NavShortcutIcon size={14} />, label: '快捷键' },
  { key: 'display', icon: <NavPageIcon size={14} />, label: '页面' },
  { key: 'appearance', icon: <NavThemeIcon size={14} />, label: '主题' },
  { key: 'plugins', icon: <NavPluginIcon size={14} />, label: '插件' },
]

/** 预留插件列表 */
interface PluginItem {
  id: string
  icon: React.ReactNode
  name: string
  description: string
  status: 'coming' | 'beta' | 'active'
}

const PLUGIN_LIST: PluginItem[] = [
  {
    id: 'format-json',
    icon: <IconToJSON size={18} />,
    name: 'JSON 格式化',
    description: '自动检测并格式化剪贴板中的 JSON 内容，支持压缩和美化',
    status: 'coming',
  },
  {
    id: 'translate',
    icon: <IconTranslate size={18} />,
    name: '即时翻译',
    description: '自动翻译剪贴板内容，支持中英日韩等多语言互译',
    status: 'coming',
  },
  {
    id: 'markdown-preview',
    icon: <IconPreview size={18} />,
    name: 'Markdown 预览',
    description: '实时预览剪贴板中的 Markdown 内容，支持代码高亮',
    status: 'coming',
  },
  {
    id: 'sensitive-mask',
    icon: <IconSensitive size={18} />,
    name: '敏感信息脱敏',
    description: '自动识别并遮盖密码、密钥、手机号等敏感信息',
    status: 'coming',
  },
  {
    id: 'ocr',
    icon: <IconOCR size={18} />,
    name: 'OCR 文字识别',
    description: '从剪贴板图片中提取文字内容，支持多语言识别',
    status: 'coming',
  },
  {
    id: 'workflow',
    icon: <IconWorkflow size={18} />,
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

const SettingsPanel = forwardRef<SettingsPanelRef, { onShortcutsChanged?: () => void; onDataChanged?: () => void; onPageVisibilityChanged?: (config: PageVisibility) => void }>(({ onShortcutsChanged, onDataChanged, onPageVisibilityChanged }, ref) => {
  // 当前激活的子页面
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
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

  // 从 preload 缓存的设置初始值（APP启动时同步获取，零延迟）
  // 注意：contextBridge 暴露的对象属性是只读的，必须深拷贝到本地才能修改
  const _init = useMemo(() => {
    try {
      return JSON.parse(JSON.stringify(window.clipToolAPI.initialSettings))
    } catch {
      return { ...window.clipToolAPI.initialSettings }
    }
  }, [])

  /** 更新本地设置缓存，确保下次打开设置页面时初始值是最新的 */
  const updateCache = useCallback((updates: Record<string, unknown>) => {
    Object.assign(_init, updates)
  }, [_init])

  const [shortcuts, setShortcuts] = useState<ShortcutConfig>(
    (_init.shortcuts as ShortcutConfig) || {
      openSave: '',
      openSearch: '',
      openEditor: '',
      openDoc: '',
      openAi: '',
      openFavorite: '',
      openSettings: '',
      openProfile: '',
      openLauncher: '',
    }
  )
  const [recording, setRecording] = useState<keyof ShortcutConfig | null>(null)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const originalRef = useRef<ShortcutConfig | null>(null)

  // 标签管理状态
  const [customTags, setCustomTags] = useState<string[]>((_init.customTags as string[]) || [])
  const [newTagInput, setNewTagInput] = useState('')

  // 通用设置状态
  const [appFontSize, setAppFontSize] = useState((_init.appFontSize as number) || 13)
  // 速记页面默认编辑器主题
  const [docEditorTheme, setDocEditorTheme] = useState((_init.docEditorTheme as string) || 'github-dark')

  /** 应用字体大小缩放 */
  const applyFontZoom = (size: number) => {
    const scale = size / 13
    document.documentElement.style.setProperty('--app-zoom', String(scale))
    const appContainer = document.querySelector('.app-container') as HTMLElement
    if (appContainer) appContainer.style.zoom = String(scale)
  }
  const [tagSaveStatus, setTagSaveStatus] = useState<string | null>(null)

  // AI 生成标题配置
  const [aiTitleEnabled, setAiTitleEnabled] = useState<boolean>((_init.aiTitleEnabled as boolean) ?? false)
  // AI 自动匹配标签配置
  const [aiTagEnabled, setAiTagEnabled] = useState<boolean>((_init.aiTagEnabled as boolean) ?? true)

  // 编辑 — 剪贴板历史条数
  const [editorHistoryLimit, setEditorHistoryLimit] = useState((_init.clipboardHistoryLimit as number) || 20)
  const [editingEditorLimit, setEditingEditorLimit] = useState(false)
  const [editorLimitInput, setEditorLimitInput] = useState(String((_init.clipboardHistoryLimit as number) || 20))
  const [editorLimitStatus, setEditorLimitStatus] = useState<string | null>(null)

  // 主题状态
  const [currentTheme, setCurrentTheme] = useState<string>((_init.theme as string) || 'system')

  // COS 云端存储状态
  const [cosConfig, setCosConfig] = useState<CosConfig>(
    (_init.cosConfig as CosConfig) || {
      secretId: '',
      secretKey: '',
      enabled: false,
    }
  )
  const [deviceId, setDeviceId] = useState<string>((_init.deviceId as string) || '')
  const [cosStatus, setCosStatus] = useState<string | null>(null)
  const [cosTesting, setCosTesting] = useState(false)
  const [cosSyncing, setCosSyncing] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [storageMode, setStorageModeState] = useState<StorageMode>((_init.storageMode as StorageMode) || 'local')

  // AI 模型配置状态
  const [aiModels, setAiModels] = useState<AiModelConfig[]>((_init.aiModels as AiModelConfig[]) || [])
  const [aiStatus, setAiStatus] = useState<string | null>(null)
  const [showAiSecretKeys, setShowAiSecretKeys] = useState<Record<number, boolean>>({})

  // 语雀配置状态
  const [yuqueConfig, setYuqueConfig] = useState<YuqueConfig>({
    token: '',
    login: '',
    userName: '',
    targetRepoId: 0,
    targetRepoName: '',
    targetRepoNamespace: '',
  })
  const [yuqueStatus, setYuqueStatus] = useState<string | null>(null)
  const [yuqueVerifying, setYuqueVerifying] = useState(false)
  const [yuqueRepos, setYuqueRepos] = useState<YuqueRepo[]>([])
  const [showYuqueToken, setShowYuqueToken] = useState(false)
  const [yuqueReposLoading, setYuqueReposLoading] = useState(false)


  // 导航分类管理状态
  const [launcherCategories, setLauncherCategories] = useState<string[]>((_init.launcherCategories as string[]) || [])
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [categorySaveStatus, setCategorySaveStatus] = useState<string | null>(null)
  // 导航分类拖拽排序状态（必须在组件顶层声明）
  const [catDragIndex, setCatDragIndex] = useState<number | null>(null)
  const [catDragOverIndex, setCatDragOverIndex] = useState<number | null>(null)

  // 页面可见性配置状态
  const [pageVisibility, setPageVisibility] = useState<PageVisibility>(
    (_init.pageVisibility as PageVisibility) || {
      save: true,
      editor: true,
      search: true,
      launcher: true,
      doc: true,
      ai: true,
      favorite: true,
      settings: true,
      profile: true,
    }
  )

  // 初始化副作用（注册标签、设置 originalRef、异步刷新最新设置）
  useEffect(() => {
    originalRef.current = { ...shortcuts }
    registerTags(customTags)

    // 异步获取最新设置值（云端拉取后可能已更新），只有值不同时才更新 state
    window.clipToolAPI.getAllSyncSettings().then((latest: Record<string, unknown>) => {
      // 用最新值覆盖缓存，确保下次打开设置页面时初始值是最新的
      Object.assign(window.clipToolAPI.initialSettings, latest)
      if (latest.aiTitleEnabled !== undefined && latest.aiTitleEnabled !== _init.aiTitleEnabled) {
        setAiTitleEnabled(latest.aiTitleEnabled as boolean)
      }
      if (latest.aiTagEnabled !== undefined && latest.aiTagEnabled !== _init.aiTagEnabled) {
        setAiTagEnabled(latest.aiTagEnabled as boolean)
      }
      if (latest.docEditorTheme && latest.docEditorTheme !== _init.docEditorTheme) {
        setDocEditorTheme(latest.docEditorTheme as string)
      }
      if (latest.shortcuts && JSON.stringify(latest.shortcuts) !== JSON.stringify(_init.shortcuts)) {
        setShortcuts(latest.shortcuts as ShortcutConfig)
        originalRef.current = { ...(latest.shortcuts as ShortcutConfig) }
      }
      if (latest.customTags && JSON.stringify(latest.customTags) !== JSON.stringify(_init.customTags)) {
        setCustomTags(latest.customTags as string[])
        registerTags(latest.customTags as string[])
      }
      if (latest.clipboardHistoryLimit !== undefined && latest.clipboardHistoryLimit !== _init.clipboardHistoryLimit) {
        setEditorHistoryLimit(latest.clipboardHistoryLimit as number)
        setEditorLimitInput(String(latest.clipboardHistoryLimit))
      }
      if (latest.aiModels && JSON.stringify(latest.aiModels) !== JSON.stringify(_init.aiModels)) {
        setAiModels(latest.aiModels as AiModelConfig[])
      }
      if (latest.launcherCategories && JSON.stringify(latest.launcherCategories) !== JSON.stringify(_init.launcherCategories)) {
        setLauncherCategories(latest.launcherCategories as string[])
      }
      if (latest.pageVisibility && JSON.stringify(latest.pageVisibility) !== JSON.stringify(_init.pageVisibility)) {
        setPageVisibility(latest.pageVisibility as PageVisibility)
      }
      if (latest.appFontSize !== undefined && latest.appFontSize !== _init.appFontSize) {
        setAppFontSize(latest.appFontSize as number)
        applyFontZoom(latest.appFontSize as number)
      }
      if (latest.theme && latest.theme !== _init.theme) {
        setCurrentTheme(latest.theme as string)
      }
      if (latest.cosConfig && JSON.stringify(latest.cosConfig) !== JSON.stringify(_init.cosConfig)) {
        setCosConfig(latest.cosConfig as CosConfig)
      }
      if (latest.storageMode && latest.storageMode !== _init.storageMode) {
        setStorageModeState(latest.storageMode as StorageMode)
      }
    })
  }, [])

  // 加载语雀配置
  useEffect(() => {
    window.clipToolAPI.getYuqueConfig().then((config) => {
      if (config && config.token) {
        setYuqueConfig(config)
        // 如果已有 token 和 login，自动加载知识库列表
        if (config.login) {
          window.clipToolAPI.getYuqueRepos(config.token, config.login).then((result) => {
            if (result.success && result.repos) {
              setYuqueRepos(result.repos as YuqueRepo[])
            }
          })
        }
      }
    })
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
      updateCache({ shortcuts: saved })
      // 通知父组件快捷键已更新
      onShortcutsChanged?.()
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error('保存快捷键配置失败:', error)
      const msg = error instanceof Error ? error.message : String(error)
      setSaveStatus(`✕ 保存失败: ${msg}`)
      setTimeout(() => setSaveStatus(null), 4000)
    }
  }, [shortcuts])

  // 重置为默认
  const handleReset = useCallback(async () => {
    const defaults: ShortcutConfig = {
      openSave: 'CommandOrControl+Shift+K',
      openSearch: 'CommandOrControl+Shift+S',
      openEditor: 'CommandOrControl+Shift+E',
      openDoc: 'CommandOrControl+Shift+D',
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
    updateCache({ customTags: saved })
    setTimeout(() => setTagSaveStatus(null), 2000)
  }, [newTagInput, customTags])

  const handleRemoveTag = useCallback(async (tag: string) => {
    const updated = customTags.filter((t) => t !== tag)
    const saved = await window.clipToolAPI.saveCustomTags(updated)
    setCustomTags(saved)
    registerTags(saved)
    updateCache({ customTags: saved })
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
    updateCache({ customTags: saved })
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
      updateCache({ storageMode: saved })
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
      updateCache({ cosConfig: saved })
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
        if (settings.aiTagEnabled !== undefined) setAiTagEnabled(settings.aiTagEnabled as boolean)
        if (settings.launcherCategories) setLauncherCategories(settings.launcherCategories as string[])
        if (settings.docEditorTheme) setDocEditorTheme(settings.docEditorTheme as string)
        if (settings.pageVisibility) setPageVisibility(settings.pageVisibility as PageVisibility)
        if (settings.appFontSize !== undefined) {
          setAppFontSize(settings.appFontSize as number)
          applyFontZoom(settings.appFontSize as number)
        }
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
      label: '唤起保存',
      description: '打开窗口并进入保存模式，自动读取剪贴板',
    },
    {
      key: 'openSearch',
      label: '唤起搜索',
      description: '打开窗口并进入搜索模式，自动聚焦搜索框',
    },
    {
      key: 'openEditor',
      label: '唤起历史',
      description: '打开窗口并进入历史页面',
    },
    {
      key: 'openDoc',
      label: '唤起速记',
      description: '打开窗口并进入速记页面',
    },
    {
      key: 'openAi',
      label: '唤起 AI',
      description: '打开窗口并进入 AI 页面',
    },
    {
      key: 'openFavorite',
      label: '唤起收藏',
      description: '打开窗口并进入收藏页面',
    },
    {
      key: 'openSettings',
      label: '唤起设置',
      description: '打开窗口并进入设置页面',
    },
    {
      key: 'openProfile',
      label: '唤起我的',
      description: '打开窗口并进入个人中心页面',
    },
    {
      key: 'openLauncher',
      label: '唤起导航',
      description: '打开窗口并进入快速导航页面',
    },
  ]

  // ===== 渲染各子页面 =====

  /** 快捷键设置子页面（合并全局快捷键 + 窗口内快捷键） */
  const renderShortcutsPage = () => (
    <>
      <div className="settings-section">
        <div className="settings-section-title"><Keyboard size={14} style={{ verticalAlign: -2, marginRight: 4 }} />全局快捷键</div>
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
        <div className="settings-section-title"><Lightbulb size={14} style={{ verticalAlign: -2, marginRight: 4 }} />窗口内快捷键</div>
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

  /** 配置页面（合并了 AI 模型配置 + 存储配置） */
  const renderConfigPage = () => {
    /** 模型提供商列表 */
    const AI_PROVIDERS: { key: AiModelConfig['provider']; name: string; icon: React.ReactNode; models: string[]; needSecretId: boolean }[] = [
      {
        key: 'hunyuan',
        name: '腾讯混元',
        icon: <IconBot size={14} />,
        models: ['hunyuan-lite', 'hunyuan-standard', 'hunyuan-pro'],
        needSecretId: true,
      },
      {
        key: 'deepseek',
        name: 'DeepSeek',
        icon: <Brain size={14} />,
        models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
        needSecretId: false,
      },
    ]

    const handleAddModel = (provider: AiModelConfig['provider']) => {
      const providerInfo = AI_PROVIDERS.find((p) => p.key === provider)
      if (!providerInfo) return
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
      updateCache({ aiModels: saved })
      setAiStatus('✓ 已删除')
      setTimeout(() => setAiStatus(null), 2000)
    }

    const handleUpdateModel = (index: number, data: Partial<AiModelConfig>) => {
      const updated = [...aiModels]
      updated[index] = { ...updated[index], ...data }
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
      updateCache({ aiModels: saved })
      setAiStatus('✓ AI 配置已保存')
      setTimeout(() => setAiStatus(null), 2000)
    }

    const toggleShowAiKey = (index: number) => {
      setShowAiSecretKeys((prev) => ({ ...prev, [index]: !prev[index] }))
    }

    return (
      <>
        {/* ===== AI 模型配置 ===== */}
        <div className="settings-section">
          <div className="settings-section-title"><IconBot size={14} style={{ verticalAlign: -2, marginRight: 4 }} />AI 模型配置</div>
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
              <span className="settings-placeholder-icon"><IconBot size={24} /></span>
              <span className="settings-placeholder-text">点击上方按钮添加 AI 模型</span>
            </div>
          )}

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

        {/* ===== 存储配置 ===== */}
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

          <div className="settings-cos-field">
            <label className="settings-cos-label">同步状态</label>
            <span style={{ fontSize: 12, color: storageMode === 'cos' ? '#34c759' : '#8b949e' }}>
              {storageMode === 'cos' ? '✓ 已启用 - 数据变更自动同步' : '未启用（请切换为云端存储模式）'}
            </span>
          </div>

          {cosStatus && (
            <div className={`settings-status ${cosStatus.startsWith('✓') ? 'success' : cosStatus.startsWith('⚠') ? 'warning' : 'error'}`}
                 style={{ fontSize: 12, marginTop: 4, marginBottom: 4 }}>
              {cosStatus}
            </div>
          )}

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

          <div className="settings-section-hint" style={{ marginTop: 8 }}>
            💡 推送/拉取会同步：片段数据、标签、快捷键、AI 模型配置、导航分类、快速链接等所有设置
          </div>
        </div>

        {/* ===== 语雀集成配置 ===== */}
        <div className="settings-section">
          <div className="settings-section-title">📗 语雀集成</div>
          <div className="settings-section-hint">
            配置语雀 API Token，启用后可在导航栏搜索语雀文档，并将收藏片段同步到语雀知识库
          </div>

          <div className="settings-cos-field">
            <label className="settings-cos-label">API Token</label>
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              <input
                className="text-input"
                type={showYuqueToken ? 'text' : 'password'}
                value={yuqueConfig.token}
                onChange={(e) => setYuqueConfig((prev) => ({ ...prev, token: e.target.value }))}
                placeholder="输入语雀 API Token"
                style={{ flex: 1 }}
                spellCheck={false}
              />
              <button
                className="settings-cos-toggle-btn"
                onClick={() => setShowYuqueToken(!showYuqueToken)}
                title={showYuqueToken ? '隐藏' : '显示'}
              >
                {showYuqueToken ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {yuqueConfig.userName && (
            <div className="settings-cos-field">
              <label className="settings-cos-label">已连接用户</label>
              <span style={{ fontSize: 12, color: '#34c759' }}>✓ {yuqueConfig.userName} ({yuqueConfig.login})</span>
            </div>
          )}

          {yuqueRepos.length > 0 && (
            <div className="settings-cos-field">
              <label className="settings-cos-label">目标知识库</label>
              <select
                className="text-input"
                value={yuqueConfig.targetRepoId || ''}
                onChange={(e) => {
                  const repoId = Number(e.target.value)
                  const repo = yuqueRepos.find((r) => r.id === repoId)
                  if (repo) {
                    setYuqueConfig((prev) => ({
                      ...prev,
                      targetRepoId: repo.id,
                      targetRepoName: repo.name,
                      targetRepoNamespace: repo.namespace,
                    }))
                  }
                }}
                style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
              >
                <option value="">请选择知识库...</option>
                {yuqueRepos.map((repo) => (
                  <option key={repo.id} value={repo.id}>{repo.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="settings-cos-actions">
            <button
              className="settings-cos-btn"
              onClick={async () => {
                if (!yuqueConfig.token) {
                  setYuqueStatus('⚠ 请先输入 Token')
                  setTimeout(() => setYuqueStatus(null), 2000)
                  return
                }
                setYuqueVerifying(true)
                setYuqueStatus(null)
                try {
                  const result = await window.clipToolAPI.verifyYuqueToken(yuqueConfig.token)
                  if (result.success && result.user) {
                    setYuqueConfig((prev) => ({
                      ...prev,
                      login: result.user!.login,
                      userName: result.user!.name,
                    }))
                    setYuqueStatus(`✓ 验证成功：${result.user.name}`)
                    // 自动加载知识库列表
                    setYuqueReposLoading(true)
                    const reposResult = await window.clipToolAPI.getYuqueRepos(yuqueConfig.token, result.user.login)
                    if (reposResult.success && reposResult.repos) {
                      setYuqueRepos(reposResult.repos as YuqueRepo[])
                    }
                    setYuqueReposLoading(false)
                  } else {
                    setYuqueStatus(`✖ ${result.error || '验证失败'}`)
                  }
                } catch {
                  setYuqueStatus('✖ 验证失败')
                } finally {
                  setYuqueVerifying(false)
                }
              }}
              disabled={!yuqueConfig.token || yuqueVerifying}
            >
              {yuqueVerifying ? '⏳ 验证中...' : '🔗 验证连接'}
            </button>
            <button
              className="settings-cos-btn primary"
              onClick={async () => {
                const saved = await window.clipToolAPI.saveYuqueConfig(yuqueConfig)
                setYuqueConfig(saved)
                setYuqueStatus('✓ 语雀配置已保存')
                setTimeout(() => setYuqueStatus(null), 2000)
              }}
              disabled={!yuqueConfig.token}
            >
              💾 保存配置
            </button>
          </div>

          {yuqueReposLoading && (
            <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>⏳ 正在加载知识库列表...</div>
          )}

          {yuqueStatus && (
            <div className={`settings-status ${yuqueStatus.startsWith('✓') ? 'success' : yuqueStatus.startsWith('⚠') ? 'warning' : 'error'}`}
                 style={{ fontSize: 12, marginTop: 4 }}>
              {yuqueStatus}
            </div>
          )}

          <div className="settings-section-hint" style={{ marginTop: 8 }}>
            💡 获取 Token：登录语雀 → 个人设置 → 开发者 → 创建 Token
          </div>
        </div>
      </>
    )
  }

  /** 插件子页面（预留功能） */
  const renderPluginsPage = () => (
    <div className="settings-section">
      <div className="settings-section-title"><IconPlugin size={14} style={{ verticalAlign: -2, marginRight: 4 }} />插件市场</div>
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

      <div className="plugin-footer">
        <span className="plugin-footer-text"><Wrench size={12} style={{ verticalAlign: -2, marginRight: 4 }} />更多插件持续开发中，敬请期待...</span>
      </div>
    </div>
  )

  /** 根据当前激活的子页面渲染内容 */
  /** 页面展示配置子页面 */
  const PAGE_DISPLAY_ITEMS: { key: keyof PageVisibility; icon: React.ReactNode; label: string; desc: string; required?: boolean }[] = [
    { key: 'save', icon: <TabSaveIcon size={14} />, label: '速存', desc: '快速保存剪贴板内容' },
    { key: 'editor', icon: <TabEditorIcon size={14} />, label: '历史', desc: '查看和编辑剪贴板历史' },
    { key: 'search', icon: <TabSearchIcon size={14} />, label: '搜索', desc: '搜索已保存的片段' },
    { key: 'launcher', icon: <TabLauncherIcon size={14} />, label: '导航', desc: '快速链接导航面板' },
    { key: 'doc', icon: <TabDocIcon size={14} />, label: '速记', desc: '快速记录笔记' },
    { key: 'ai', icon: <TabAiIcon size={14} />, label: 'AI', desc: 'AI 智能助手' },
    { key: 'favorite', icon: <TabFavoriteIcon size={14} />, label: '收藏', desc: '收藏的片段管理' },
    { key: 'settings', icon: <TabSettingsIcon size={14} />, label: '设置', desc: '应用设置（建议保持开启）', required: true },
    { key: 'profile', icon: <TabProfileIcon size={14} />, label: '我的', desc: '个人中心' },
  ]

  /** 通用设置页面（合并了保存、编辑、导航设置） */
  const renderGeneralPage = () => {
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
      updateCache({ clipboardHistoryLimit: saved })
      setTimeout(() => setEditorLimitStatus(null), 2000)
    }

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
      updateCache({ launcherCategories: saved })
      setTimeout(() => setCategorySaveStatus(null), 2000)
    }

    const handleRemoveCategory = async (cat: string) => {
      const updated = launcherCategories.filter((c) => c !== cat)
      const saved = await window.clipToolAPI.saveLauncherCategories(updated)
      setLauncherCategories(saved)
      updateCache({ launcherCategories: saved })
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
      updateCache({ launcherCategories: saved })
      setCatDragIndex(null)
      setCatDragOverIndex(null)
    }

    return (
      <>
        {/* ===== 通用 ===== */}
        <div className="settings-section">
          <div className="settings-section-title"><IconSettings size={14} style={{ verticalAlign: -2, marginRight: 4 }} />通用设置</div>
          <div className="settings-section-hint">
            调整应用的通用配置项
          </div>

          {/* 字体大小设置 */}
          <div className="settings-config-item">
            <div className="settings-config-info">
          <div className="settings-config-label"><IconFont size={14} style={{ verticalAlign: -2, marginRight: 4 }} />字体大小</div>
              <div className="settings-config-desc">调整全局字体大小，范围 10-20px，默认 13px</div>
            </div>
            <div className="settings-config-action settings-font-size-control">
              <button
                className="settings-font-size-btn"
                onClick={async () => {
                  const newSize = Math.max(10, appFontSize - 1)
                  setAppFontSize(newSize)
                  await window.clipToolAPI.setAppFontSize(newSize)
                  applyFontZoom(newSize)
                  updateCache({ appFontSize: newSize })
                }}
                disabled={appFontSize <= 10}
              >
                A-
              </button>
              <span className="settings-font-size-value">{appFontSize}px</span>
              <button
                className="settings-font-size-btn"
                onClick={async () => {
                  const newSize = Math.min(20, appFontSize + 1)
                  setAppFontSize(newSize)
                  await window.clipToolAPI.setAppFontSize(newSize)
                  applyFontZoom(newSize)
                  updateCache({ appFontSize: newSize })
                }}
                disabled={appFontSize >= 20}
              >
                A+
              </button>
              <button
                className="settings-font-size-btn settings-font-size-reset"
                onClick={async () => {
                  setAppFontSize(13)
                  await window.clipToolAPI.setAppFontSize(13)
                  applyFontZoom(13)
                  updateCache({ appFontSize: 13 })
                }}
              >
                重置
              </button>
            </div>
          </div>

          {/* 字体大小预览 */}
          <div className="settings-font-preview" style={{ fontSize: `${appFontSize}px` }}>
            <div className="settings-font-preview-title">预览效果</div>
            <div className="settings-font-preview-text">
              ClipTool 是一款智能剪贴板管理工具，支持代码片段保存、搜索、AI 智能分析等功能。
            </div>
            <div className="settings-font-preview-code">
              const hello = &quot;Hello, World!&quot;;
            </div>
          </div>

          {/* 速记页面默认主题 */}
          <div className="settings-config-item">
            <div className="settings-config-info">
          <div className="settings-config-label"><Palette size={14} style={{ verticalAlign: -2, marginRight: 4 }} />速记页面默认主题</div>
              <div className="settings-config-desc">设置速记页面编辑器的默认主题，在速记页面中可临时切换（一次性）</div>
            </div>
            <div className="settings-config-action">
              <select
                className="text-input"
                value={docEditorTheme}
                onChange={async (e) => {
                  const theme = e.target.value
                  setDocEditorTheme(theme)
                  await window.clipToolAPI.setDocEditorTheme(theme)
                  updateCache({ docEditorTheme: theme })
                }}
                style={{ width: 160, padding: '4px 8px', fontSize: 12 }}
              >
                <option value="github-dark">GitHub Dark</option>
                <option value="github-light">GitHub Light</option>
                <option value="one-dark-pro">One Dark Pro</option>
                <option value="dracula">Dracula</option>
                <option value="nord">Nord</option>
                <option value="min-dark">Min Dark</option>
                <option value="min-light">Min Light</option>
                <option value="monokai">Monokai</option>
                <option value="slack-dark">Slack Dark</option>
                <option value="vitesse-dark">Vitesse Dark</option>
                <option value="vitesse-light">Vitesse Light</option>
                <option value="tokyo-night">Tokyo Night</option>
              </select>
            </div>
          </div>
        </div>

        {/* ===== 保存设置 ===== */}
        <div className="settings-section">
          <div className="settings-section-title"><IconClipboard size={14} style={{ verticalAlign: -2, marginRight: 4 }} />保存 — 智能标题</div>
          <div className="settings-section-hint">
            启用后，保存片段时将自动调用 AI 大模型为剪贴板内容生成简短标题（需先在配置页面配置模型密钥）
          </div>

          <div className="settings-config-item" style={{ marginBottom: 16 }}>
            <div className="settings-config-info">
              <div className="settings-config-label"><IconBot size={12} style={{ verticalAlign: -2, marginRight: 4 }} />AI 自动生成标题</div>
              <div className="settings-config-desc">保存时自动使用大模型分析内容并生成标题，替代默认的前30字截取</div>
            </div>
            <div className="settings-config-action">
              <label className="settings-cos-switch" title={aiTitleEnabled ? '已启用' : '未启用'}>
                <input
                  type="checkbox"
                  checked={aiTitleEnabled}
                  onChange={async (e) => {
                    const enabled = e.target.checked
                    const saved = await window.clipToolAPI.setAiTitleEnabled(enabled)
                    setAiTitleEnabled(saved)
                    updateCache({ aiTitleEnabled: saved })
                  }}
                />
                <span className="settings-cos-slider"></span>
              </label>
            </div>
          </div>

          <div className="settings-config-item" style={{ marginBottom: 16 }}>
            <div className="settings-config-info">
          <div className="settings-config-label"><IconTag size={14} color="#FF9800" style={{ verticalAlign: -2, marginRight: 4 }} />AI 自动匹配标签</div>
              <div className="settings-config-desc">保存时自动使用大模型分析内容，从预设标签中匹配最相关的标签</div>
            </div>
            <div className="settings-config-action">
              <label className="settings-cos-switch" title={aiTagEnabled ? '已启用' : '未启用'}>
                <input
                  type="checkbox"
                  checked={aiTagEnabled}
                  onChange={async (e) => {
                    const enabled = e.target.checked
                    const saved = await window.clipToolAPI.setAiTagEnabled(enabled)
                    setAiTagEnabled(saved)
                    updateCache({ aiTagEnabled: saved })
                  }}
                />
                <span className="settings-cos-slider"></span>
              </label>
            </div>
          </div>

          <div className="settings-section-title"><IconClipboard size={14} style={{ verticalAlign: -2, marginRight: 4 }} />保存 — 预设标签管理</div>
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

        {/* ===== 编辑设置 ===== */}
        <div className="settings-section">
          <div className="settings-section-title"><TabEditorIcon size={14} style={{ verticalAlign: -2, marginRight: 4 }} />编辑设置</div>
          <div className="settings-section-hint">
            配置编辑页面的行为参数
          </div>

          <div className="settings-editor-config">
            <div className="settings-config-item">
              <div className="settings-config-info">
                <div className="settings-config-label"><IconClipboard size={12} style={{ verticalAlign: -2, marginRight: 4 }} />剪贴板历史最大条数</div>
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

        {/* ===== 导航设置 ===== */}
        <div className="settings-section">
          <div className="settings-section-title"><TabLauncherIcon size={14} style={{ verticalAlign: -2, marginRight: 4 }} />导航 — 分类标签管理</div>
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
      </>
    )
  }

  const renderDisplayPage = () => (
    <div className="settings-section">
        <div className="settings-section-title"><Eye size={14} style={{ verticalAlign: -2, marginRight: 4 }} />页面展示配置</div>
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
                    // 立即通知 App.tsx 更新状态，实时生效
                    onPageVisibilityChanged?.(newConfig)
                    // 异步保存到 store 和缓存（不影响 UI 即时响应）
                    await window.clipToolAPI.savePageVisibility(newConfig)
                    updateCache({ pageVisibility: newConfig })
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
        <div className="settings-section-title"><Palette size={14} style={{ verticalAlign: -2, marginRight: 4 }} />主题选择</div>
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
              updateCache({ theme: theme.id })
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
      case 'general': return renderGeneralPage()
      case 'config': return renderConfigPage()
      case 'appearance': return renderAppearancePage()
      case 'shortcuts': return renderShortcutsPage()
      case 'display': return renderDisplayPage()
      case 'plugins': return renderPluginsPage()
      default: return null
    }
  }

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
