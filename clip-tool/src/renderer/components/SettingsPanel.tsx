/**
 * 设置面板组件
 * 支持用户自定义全局快捷键和管理预设标签
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { ShortcutConfig, CosConfig, StorageMode } from '../types'

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

const SettingsPanel: React.FC<{ onShortcutsChanged?: () => void; onDataChanged?: () => void }> = ({ onShortcutsChanged, onDataChanged }) => {
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>({
    openSave: '',
    openSearch: '',
  })
  const [recording, setRecording] = useState<keyof ShortcutConfig | null>(null)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const originalRef = useRef<ShortcutConfig | null>(null)

  // 标签管理状态
  const [customTags, setCustomTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [tagSaveStatus, setTagSaveStatus] = useState<string | null>(null)

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

  // 加载当前快捷键配置
  useEffect(() => {
    window.clipToolAPI.getShortcuts().then((config) => {
      setShortcuts(config)
      originalRef.current = { ...config }
    })
    // 加载自定义标签
    window.clipToolAPI.getCustomTags().then(setCustomTags)
    // 加载 COS 配置和设备 ID
    window.clipToolAPI.getCosConfig().then(setCosConfig)
    window.clipToolAPI.getDeviceId().then(setDeviceId)
    // 加载存储模式
    window.clipToolAPI.getStorageMode().then(setStorageModeState)
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
    setNewTagInput('')
    setTagSaveStatus('✓ 已添加')
    setTimeout(() => setTagSaveStatus(null), 2000)
  }, [newTagInput, customTags])

  const handleRemoveTag = useCallback(async (tag: string) => {
    const updated = customTags.filter((t) => t !== tag)
    const saved = await window.clipToolAPI.saveCustomTags(updated)
    setCustomTags(saved)
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
      const [snippetOk, tagOk] = await Promise.all([
        window.clipToolAPI.pushSnippets(),
        window.clipToolAPI.pushTags(),
      ])
      if (snippetOk && tagOk) {
        setCosStatus('✓ 数据已推送到云端')
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
      const [snippets, tags] = await Promise.all([
        window.clipToolAPI.pullSnippets(),
        window.clipToolAPI.pullTags(),
      ])
      if (snippets !== null && tags !== null) {
        if (tags) setCustomTags(tags)
        setCosStatus(`✓ 已从云端拉取 ${snippets.length} 条片段`)
        // 通知父组件刷新数据
        onDataChanged?.()
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
  ]

  return (
    <div className="settings-panel">
      <div className="settings-section">
        <div className="settings-section-title">全局快捷键</div>
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

      {/* ===== 预设标签管理 ===== */}
      <div className="settings-section">
        <div className="settings-section-title">预设标签管理</div>
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
                <span className="settings-tag-name">{tag}</span>
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

      {/* ===== 存储模式选择 ===== */}
      <div className="settings-section">
        <div className="settings-section-title">📦 存储模式</div>
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

      {/* ===== COS 云端存储配置 ===== */}
      <div className="settings-section" style={{ opacity: storageMode === 'cos' ? 1 : 0.5, pointerEvents: storageMode === 'cos' ? 'auto' : 'none' }}>
        <div className="settings-section-title">☁️ 云端存储配置（腾讯云 COS）</div>
        <div className="settings-section-hint">
          配置腾讯云 COS 密钥，片段数据将自动同步到云端。设备 ID：<code style={{ fontSize: 11, color: '#8b949e', userSelect: 'all' }}>{deviceId || '获取中...'}</code>
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
      </div>

      {/* 窗口内快捷键说明（只读展示） */}
      <div className="settings-section">
        <div className="settings-section-title">窗口内快捷键</div>
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
            <span className="settings-builtin-desc">搜索结果导航</span>
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
    </div>
  )
}

export default SettingsPanel
